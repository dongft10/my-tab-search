/**
 * Pinned Tabs 跨设备同步服务
 * 负责 VIP 用户长期固定标签页的跨设备同步
 */

import { API_CONFIG, getApiUrl } from '../config.esm.js';

class PinnedTabsSyncService {
  constructor(pinnedTabsService, authService, deviceService) {
    this.pinnedTabsService = pinnedTabsService;
    this.authService = authService;
    this.deviceService = deviceService;

    this.SYNC_INTERVAL_MS = 30 * 60 * 1000;
    this.CHECK_INTERVAL_MS = 30 * 60 * 1000;
    this.DEBOUNCE_DELAY = 5000;

    this.LOCAL_VERSION_KEY = 'pinnedTabsVersion';
    this.LAST_SYNC_TIME_KEY = 'pinnedTabsLastSyncTime';
    this.SYNC_FAILURE_COUNT_KEY = 'pinnedTabsSyncFailureCount';
    this.LAST_FAILURE_TIME_KEY = 'pinnedTabsLastFailureTime';

    this.FAILURE_THRESHOLD = 5;
    this.COOLDOWN_TIME = 5 * 60 * 1000;

    this.syncInterval = null;
    this.syncTimer = null;
  }

  async initialize() {
    try {
      const isLoggedIn = await this.authService.isRegistered();
      if (!isLoggedIn) {
        return;
      }

      const hasPermission = await this.checkLongTermPinnedPermission();
      if (!hasPermission) {
        return;
      }

      await this.fullSync();
      this.startPeriodicCheck();
    } catch (error) {
      console.error('[PinnedTabsSync] Initialization failed:', error);
    }
  }

  async checkLongTermPinnedPermission() {
    try {
      const isVIP = await this.authService.isVIP();
      if (isVIP) {
        return true;
      }

      // 获取体验期状态
      const trialStatus = await this.getTrialStatus();
      
      // 推广期（trialEnabled = false）：已验证邮箱的用户可用
      if (!trialStatus.trialEnabled) {
        const isEmailVerified = await this.authService.isEmailVerified();
        return isEmailVerified;
      }

      // 正式体验期（trialEnabled = true）：体验期内已验证邮箱的用户可用
      if (trialStatus.isInTrialPeriod) {
        const isEmailVerified = await this.authService.isEmailVerified();
        return isEmailVerified;
      }

      return false;
    } catch (error) {
      console.error('[PinnedTabsSync] Check permission failed:', error);
      return false;
    }
  }

  async getTrialStatus() {
    try {
      const token = await this.authService.getValidAccessToken();
      if (!token) {
        return { trialEnabled: false, isInTrialPeriod: false };
      }
      const response = await fetch(getApiUrl('/trial/status'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        return { trialEnabled: false, isInTrialPeriod: false };
      }

      const result = await response.json();
      return result.data || { trialEnabled: false, isInTrialPeriod: false };
    } catch (error) {
      console.error('[PinnedTabsSync] Get trial status failed:', error);
      return { trialEnabled: false, isInTrialPeriod: false };
    }
  }

  startPeriodicCheck() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      await this.periodicCheck();
    }, this.CHECK_INTERVAL_MS);
  }

  stopPeriodicCheck() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async periodicCheck() {
    try {
      const canSync = await this.canSync();
      if (!canSync) {
        return;
      }

      const lastSyncTime = await this.getLastSyncTime();
      const now = Date.now();

      if (lastSyncTime && (now - lastSyncTime) < this.SYNC_INTERVAL_MS) {
        return;
      }

      const isServerAvailable = await this.checkServerHealth();
      if (!isServerAvailable) {
        return;
      }

      const localVersion = await this.getLocalVersion();
      const response = await this.apiCheckSync(localVersion);

      if (response.needsSync) {
        await this.fullSync();
      } else {
        await this.updateLastSyncTime(Date.now());
      }
    } catch (error) {
      console.error('[PinnedTabsSync] Periodic check failed:', error);
      await this.recordFailure();
    }
  }

  async fullSync() {
    try {
      const deviceId = await this.getDeviceId();
      const localTabs = await this.pinnedTabsService.getPinnedTabs();
      const localVersion = await this.getLocalVersion();

      if (!deviceId) {
        return;
      }

      const tabsToSync = this.getTabsToSync(localTabs);

      const response = await this.apiSync({
        deviceId,
        localTabs: tabsToSync,
        lastKnownVersion: localVersion
      });

      if (response.success) {
        console.log('[PinnedTabsSync] fullSync - success, needsPull:', response.needsPull, ', server tabs count:', response.tabs?.length || 0, ', local tabs count:', localTabs.length);
        
        if (response.needsPull && response.tabs) {
          // 服务端返回需要拉取，合并数据后检查是否有新数据需要同步
          const mergedTabs = await this.mergeData(response.tabs, localTabs);
          await this.setLocalVersion(response.serverVersion);
          
          // 检查合并后是否有本地独有的新tab需要同步
          const mergedTabsToSync = this.getTabsToSync(mergedTabs);
          const serverUrls = new Set(response.tabs.map(t => t.url));
          const hasNewLocalTabs = mergedTabsToSync.some(tab => !serverUrls.has(tab.url));
          
          if (hasNewLocalTabs) {
            console.log('[PinnedTabsSync] fullSync - has new local tabs after merge, re-syncing');
            // 使用合并后的版本号再次同步
            const reSyncResponse = await this.apiSync({
              deviceId,
              localTabs: mergedTabsToSync,
              lastKnownVersion: response.serverVersion
            });
            if (reSyncResponse.success) {
              await this.setLocalVersion(reSyncResponse.serverVersion);
              await this.updateLastSyncTime(Date.now());
              await this.resetFailureCount();
            }
          } else {
            await this.updateLastSyncTime(Date.now());
            await this.resetFailureCount();
          }
        } else {
          // 正常同步完成
          if (response.tabs) {
            await this.mergeData(response.tabs, localTabs);
          }
          await this.setLocalVersion(response.serverVersion);
          await this.updateLastSyncTime(Date.now());
          await this.resetFailureCount();
        }
      }
    } catch (error) {
      console.error('[PinnedTabsSync] Full sync failed:', error);
      await this.recordFailure();
      throw error;
    }
  }

  async syncAfterChange(tab, action) {
    try {
      if (!tab || !tab.isLongTermPinned) {
        return;
      }

      if (this.syncTimer) {
        clearTimeout(this.syncTimer);
      }

      if (action === 'remove') {
        await this.fullSync();
        return;
      }

      this.syncTimer = setTimeout(async () => {
        await this.fullSync();
      }, this.DEBOUNCE_DELAY);
    } catch (error) {
      console.error('[PinnedTabsSync] Sync after change failed:', error);
    }
  }

  getTabsToSync(tabs) {
    return tabs
      .filter(tab => tab.isLongTermPinned)
      .map(tab => ({
        url: tab.url,
        title: tab.title,
        longTermPinnedAt: tab.longTermPinnedAt
      }));
  }

  async mergeData(serverTabs, localTabs) {
    try {
      const mergedTabs = [];
      const localMap = new Map(localTabs.map(t => [t.url, t]));

      console.log('[PinnedTabsSync] mergeData - serverTabs count:', serverTabs.length);
      console.log('[PinnedTabsSync] mergeData - localTabs count:', localTabs.length);

      for (const serverTab of serverTabs) {
        const localTab = localMap.get(serverTab.url);

        if (!localTab) {
          console.log('[PinnedTabsSync] mergeData - localTab not found for URL:', serverTab.url);
          let tabId = undefined;
          try {
            const existingTabs = await chrome.tabs.query({ url: serverTab.url });
            console.log('[PinnedTabsSync] mergeData - query result for URL:', serverTab.url, 'found:', existingTabs?.length || 0, 'tabs');
            if (existingTabs && existingTabs.length > 0) {
              tabId = existingTabs[0].id;
            }
          } catch (e) {
            console.log('[PinnedTabsSync] mergeData - query error:', e.message);
          }
          mergedTabs.push({
            ...serverTab,
            tabId: tabId,
            isLongTermPinned: true,
            pinnedAt: serverTab.longTermPinnedAt || new Date().toISOString()
          });
        } else {
          console.log('[PinnedTabsSync] mergeData - localTab found, localTab.tabId:', localTab.tabId);
          const resolved = this.resolveConflict(localTab, serverTab);
          if (resolved.value) {
            let tabId = localTab.tabId;
            if (tabId === undefined || tabId === null) {
              try {
                const existingTabs = await chrome.tabs.query({ url: serverTab.url });
                console.log('[PinnedTabsSync] mergeData - query result for URL:', serverTab.url, 'found:', existingTabs?.length || 0, 'tabs');
                if (existingTabs && existingTabs.length > 0) {
                  tabId = existingTabs[0].id;
                }
              } catch (e) {
                console.log('[PinnedTabsSync] mergeData - query error:', e.message);
              }
            }
            mergedTabs.push({
              ...resolved.value,
              tabId: tabId,
              isLongTermPinned: true,
              pinnedAt: resolved.value.longTermPinnedAt || resolved.value.pinnedAt || new Date().toISOString()
            });
          }
          localMap.delete(serverTab.url);
        }
      }

      for (const [url, localTab] of localMap) {
        mergedTabs.push(localTab);
      }

      mergedTabs.sort((a, b) => {
        const dateA = a.pinnedAt ? new Date(a.pinnedAt) : new Date(0);
        const dateB = b.pinnedAt ? new Date(b.pinnedAt) : new Date(0);
        return dateA - dateB;
      });

      await this.pinnedTabsService.savePinnedTabs(mergedTabs);
      return mergedTabs;
    } catch (error) {
      console.error('[PinnedTabsSync] Merge data failed:', error);
      throw error;
    }
  }

  resolveConflict(localTab, serverTab) {
    const localTime = new Date(localTab.longTermPinnedAt || 0);
    const serverTime = new Date(serverTab.longTermPinnedAt || 0);

    if (localTime > serverTime) {
      return { value: localTab, resolution: 'client_wins' };
    } else if (localTime < serverTime) {
      return { value: serverTab, resolution: 'server_wins' };
    } else {
      return { value: localTab, resolution: 'equal' };
    }
  }

  async apiSync(data) {
    const token = await this.authService.getValidAccessToken();
    if (!token) {
      throw new Error('No valid access token');
    }
    const deviceId = data.deviceId;

    const response = await fetch(getApiUrl('/pinned-tabs/sync'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Device-ID': deviceId
      },
      body: JSON.stringify({
        deviceId: deviceId,
        localTabs: data.localTabs,
        lastKnownVersion: data.lastKnownVersion
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Sync failed');
    }

    const result = await response.json();
    return result.data;
  }

  async apiCheckSync(localVersion) {
    const token = await this.authService.getValidAccessToken();
    if (!token) {
      return { needsSync: false, serverVersion: 0 };
    }
    const deviceId = await this.getDeviceId();

    if (!deviceId) {
      return { needsSync: false, serverVersion: 0 };
    }

    const response = await fetch(getApiUrl('/pinned-tabs/sync/check'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Device-ID': deviceId
      },
      body: JSON.stringify({
        deviceId: deviceId,
        localVersion: localVersion
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Check sync failed');
    }

    const result = await response.json();
    return result.data;
  }

  async checkServerHealth() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${API_CONFIG.BASE_URL}/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async getDeviceId() {
    const userInfo = await this.authService.getUserInfo();
    return userInfo?.[this.authService.storageKey.deviceId];
  }

  async getLocalVersion() {
    const result = await chrome.storage.local.get([this.LOCAL_VERSION_KEY]);
    return result[this.LOCAL_VERSION_KEY] || 0;
  }

  async setLocalVersion(version) {
    await chrome.storage.local.set({ [this.LOCAL_VERSION_KEY]: version });
  }

  async getLastSyncTime() {
    const result = await chrome.storage.local.get([this.LAST_SYNC_TIME_KEY]);
    return result[this.LAST_SYNC_TIME_KEY] || null;
  }

  async updateLastSyncTime(timestamp) {
    await chrome.storage.local.set({ [this.LAST_SYNC_TIME_KEY]: timestamp });
  }

  async recordFailure() {
    const count = await this.getFailureCount() + 1;
    await chrome.storage.local.set({
      [this.SYNC_FAILURE_COUNT_KEY]: count,
      [this.LAST_FAILURE_TIME_KEY]: Date.now()
    });
  }

  async getFailureCount() {
    const result = await chrome.storage.local.get([this.SYNC_FAILURE_COUNT_KEY]);
    return result[this.SYNC_FAILURE_COUNT_KEY] || 0;
  }

  async resetFailureCount() {
    await chrome.storage.local.set({ [this.SYNC_FAILURE_COUNT_KEY]: 0 });
  }

  async canSync() {
    const lastFailure = await this.getLastFailureTime();
    if (!lastFailure) return true;

    if (Date.now() - lastFailure < this.COOLDOWN_TIME) {
      return false;
    }

    return true;
  }

  async getLastFailureTime() {
    const result = await chrome.storage.local.get([this.LAST_FAILURE_TIME_KEY]);
    return result[this.LAST_FAILURE_TIME_KEY] || null;
  }

  async getSyncStatus() {
    const isOnline = navigator.onLine;
    const canSync = await this.canSync();
    const failureCount = await this.getFailureCount();

    if (!isOnline) {
      return { status: 'offline', message: '网络已断开，使用本地数据' };
    }

    if (!canSync && failureCount >= this.FAILURE_THRESHOLD) {
      return { status: 'degraded', message: '同步暂不可用，请稍后重试' };
    }

    return { status: 'normal', message: '' };
  }

  async clearSyncData() {
    try {
      const keysToRemove = [
        this.LOCAL_VERSION_KEY,
        this.LAST_SYNC_TIME_KEY,
        this.SYNC_FAILURE_COUNT_KEY,
        this.LAST_FAILURE_TIME_KEY
      ];
      await chrome.storage.local.remove(keysToRemove);
    } catch (error) {
      console.error('[PinnedTabsSync] Clear sync data error:', error);
    }
  }

  destroy() {
    this.stopPeriodicCheck();
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
  }
}

let pinnedTabsSyncService = null;

function createPinnedTabsSyncService(pinnedTabsService, authService, deviceService) {
  if (!pinnedTabsSyncService) {
    pinnedTabsSyncService = new PinnedTabsSyncService(pinnedTabsService, authService, deviceService);
  }
  return pinnedTabsSyncService;
}

export { PinnedTabsSyncService, createPinnedTabsSyncService, pinnedTabsSyncService };