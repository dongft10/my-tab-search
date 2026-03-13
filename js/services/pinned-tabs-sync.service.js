/**
 * Pinned Tabs 跨设备同步服务
 * 
 * 负责 VIP 用户长期固定标签页的跨设备同步
 * 包括：同步初始化、定期检查、冲突处理、重试机制
 */

class PinnedTabsSyncService {
  constructor(pinnedTabsService, authService, deviceService) {
    this.pinnedTabsService = pinnedTabsService;
    this.authService = authService;
    this.deviceService = deviceService;
    
    // 同步配置
    this.SYNC_INTERVAL_MS = 30 * 60 * 1000;  // 30 分钟同步间隔
    this.CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 分钟检查间隔
    this.DEBOUNCE_DELAY = 5000;              // 5 秒防抖延迟
    
    // 存储键名
    this.LOCAL_VERSION_KEY = 'pinnedTabsVersion';
    this.LAST_SYNC_TIME_KEY = 'pinnedTabsLastSyncTime';
    this.SYNC_FAILURE_COUNT_KEY = 'pinnedTabsSyncFailureCount';
    this.LAST_FAILURE_TIME_KEY = 'pinnedTabsLastFailureTime';
    
    // 失败配置
    this.FAILURE_THRESHOLD = 5;              // 失败阈值
    this.COOLDOWN_TIME = 5 * 60 * 1000;      // 5 分钟冷却时间
    
    // 定时器
    this.syncInterval = null;
    this.syncTimer = null;
    
    console.log('[PinnedTabsSync] Service initialized');
  }

  /**
   * 初始化同步服务
   */
  async initialize() {
    try {
      // 检查是否已登录
      const isLoggedIn = await this.authService.isRegistered();
      if (!isLoggedIn) {
        console.log('[PinnedTabsSync] User not logged in, skip initialization');
        return;
      }

      // 检查用户是否有权限使用长期固定 Tab 功能
      const hasPermission = await this.checkLongTermPinnedPermission();
      if (!hasPermission) {
        console.log('[PinnedTabsSync] User does not have permission, skip sync');
        return;
      }

      console.log('[PinnedTabsSync] Initializing sync service...');

      // 登录后首次同步
      await this.fullSync();

      // 设置定期检查（每 30 分钟）
      this.startPeriodicCheck();

      console.log('[PinnedTabsSync] Initialization completed');
    } catch (error) {
      console.error('[PinnedTabsSync] Initialization failed:', error);
    }
  }

  /**
   * 检查用户是否有权限使用长期固定 Tab 功能
   * 优先级：trial_enabled 配置 > VIP 用户 > 邮箱验证的普通用户
   */
  async checkLongTermPinnedPermission() {
    try {
      // 1. 检查是否是 VIP 用户（最高优先级）
      const isVIP = await this.authService.isVIP();
      if (isVIP) {
        console.log('[PinnedTabsSync] User is VIP, has permission');
        return true;
      }

      // 2. 检查 trial_enabled 配置
      const trialEnabled = await this.checkTrialEnabled();
      if (!trialEnabled) {
        // trial_enabled 未开启，说明是推广期
        // 检查用户是否已完成邮箱验证
        const isEmailVerified = await this.authService.isEmailVerified();
        if (isEmailVerified) {
          console.log('[PinnedTabsSync] Trial period, email verified user has permission');
          return true;
        } else {
          console.log('[PinnedTabsSync] Trial period, but email not verified');
          return false;
        }
      }

      // trial_enabled 已开启，但用户不是 VIP
      console.log('[PinnedTabsSync] Trial disabled, user is not VIP');
      return false;
    } catch (error) {
      console.error('[PinnedTabsSync] Check permission failed:', error);
      return false;
    }
  }

  /**
   * 检查 trial_enabled 配置
   */
  async checkTrialEnabled() {
    try {
      const token = await this.authService.getAccessToken();
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/system/trial`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.log('[PinnedTabsSync] Get trial config failed');
        return false;
      }

      const result = await response.json();
      const trialEnabled = result.data && result.data.enabled === true;
      console.log('[PinnedTabsSync] Trial enabled:', trialEnabled);
      return trialEnabled;
    } catch (error) {
      console.error('[PinnedTabsSync] Check trial enabled failed:', error);
      return false;
    }
  }

  /**
   * 启动定期检查
   */
  startPeriodicCheck() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      await this.periodicCheck();
    }, this.CHECK_INTERVAL_MS);

    console.log('[PinnedTabsSync] Periodic check started (interval: 30min)');
  }

  /**
   * 停止定期检查
   */
  stopPeriodicCheck() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[PinnedTabsSync] Periodic check stopped');
    }
  }

  /**
   * 定期检查：询问服务器是否需要同步
   */
  async periodicCheck() {
    try {
      // 检查是否可以同步（避免频繁失败后仍不断重试）
      const canSync = await this.canSync();
      if (!canSync) {
        console.log('[PinnedTabsSync] In cooldown period, skip check');
        return;
      }

      // 检查距离上次同步时间
      const lastSyncTime = await this.getLastSyncTime();
      const now = Date.now();
      
      if (lastSyncTime && (now - lastSyncTime) < this.SYNC_INTERVAL_MS) {
        console.log('[PinnedTabsSync] Within sync interval, skip check');
        return;
      }

      // 先检测服务器是否可用
      const isServerAvailable = await this.checkServerHealth();
      if (!isServerAvailable) {
        console.log('[PinnedTabsSync] Server unavailable, skip check');
        return;
      }

      // 询问服务器是否需要同步
      const localVersion = await this.getLocalVersion();
      const response = await this.apiCheckSync(localVersion);

      if (response.needsSync) {
        console.log('[PinnedTabsSync] Server has newer data (serverVersion=%d, localVersion=%d), triggering full sync', 
          response.serverVersion, localVersion);
        await this.fullSync();
      } else {
        console.log('[PinnedTabsSync] Version matches, no sync needed');
        await this.updateLastSyncTime(Date.now());
      }
    } catch (error) {
      console.error('[PinnedTabsSync] Periodic check failed:', error);
      await this.recordFailure();
    }
  }

  /**
   * 完整同步流程
   */
  async fullSync() {
    try {
      console.log('[PinnedTabsSync] Starting full sync...');

      const deviceId = await this.getDeviceId();
      const localTabs = await this.pinnedTabsService.getPinnedTabs();
      const localVersion = await this.getLocalVersion();
      
      console.log('[PinnedTabsSync] Got local tabs:', localTabs.length);
      console.log('[PinnedTabsSync] Local tabs:', JSON.stringify(localTabs));
      
      const tabsToSync = this.getTabsToSync(localTabs);

      console.log('[PinnedTabsSync] Sync data: deviceId=%s, version=%d, tabsCount=%d', 
        deviceId, localVersion, tabsToSync.length);

      const response = await this.apiSync({
        deviceId,
        localTabs: tabsToSync,
        lastKnownVersion: localVersion
      });

      if (response.success) {
        // 合并数据
        await this.mergeData(response.tabs, localTabs);
        
        // 更新本地版本号
        await this.setLocalVersion(response.serverVersion);
        
        // 记录同步时间
        await this.updateLastSyncTime(Date.now());
        
        // 重置失败计数
        await this.resetFailureCount();

        console.log('[PinnedTabsSync] Full sync completed, new version: %d', response.serverVersion);

        // 如果有冲突，记录日志
        if (response.conflicts && response.conflicts.length > 0) {
          console.log('[PinnedTabsSync] Conflicts resolved: %d', response.conflicts.length);
          response.conflicts.forEach(conflict => {
            console.log('[PinnedTabsSync]   - URL: %s, resolution: %s, reason: %s', 
              conflict.url, conflict.resolution, conflict.reason);
          });
        }
      }
    } catch (error) {
      console.error('[PinnedTabsSync] Full sync failed:', error);
      await this.recordFailure();
      throw error;
    }
  }

  /**
   * 同步数据（带防抖）
   * @param {Object} tab - 发生变更的 tab
   * @param {string} action - 操作类型：'add' | 'remove'
   */
  async syncAfterChange(tab, action) {
    try {
      // 清除之前的定时器
      if (this.syncTimer) {
        clearTimeout(this.syncTimer);
      }

      // 高优先级：取消长期固定（立即同步）
      if (action === 'remove') {
        console.log('[PinnedTabsSync] Immediate sync for remove action');
        await this.fullSync();
        return;
      }

      // 中优先级：设置长期固定（延迟 5 秒）
      console.log('[PinnedTabsSync] Debounced sync for add action (delay: 5s)');
      this.syncTimer = setTimeout(async () => {
        await this.fullSync();
      }, this.DEBOUNCE_DELAY);
    } catch (error) {
      console.error('[PinnedTabsSync] Sync after change failed:', error);
    }
  }

  /**
   * 获取需要同步的数据（仅长期固定 Tabs）
   */
  getTabsToSync(tabs) {
    return tabs
      .filter(tab => tab.isLongTermPinned)
      .map(tab => ({
        url: tab.url,
        title: tab.title,
        longTermPinnedAt: tab.longTermPinnedAt
      }));
  }

  /**
   * 合并数据
   */
  async mergeData(serverTabs, localTabs) {
    try {
      // 先获取本地的长期固定 Tabs
      const localLongTermTabs = localTabs.filter(t => t.isLongTermPinned);
      const mergedTabs = [];
      const localMap = new Map(localLongTermTabs.map(t => [t.url, t]));

      console.log('[PinnedTabsSync] Merging data: serverTabs=%d, localLongTermTabs=%d', 
        serverTabs.length, localLongTermTabs.length);

      for (const serverTab of serverTabs) {
        const localTab = localMap.get(serverTab.url);

        if (!localTab) {
          // 服务端新增，直接添加
          console.log('[PinnedTabsSync] Adding new tab from server: %s', serverTab.url);
          mergedTabs.push({
            ...serverTab,
            isLongTermPinned: true
          });
        } else {
          // 存在本地记录，处理冲突
          const resolved = this.resolveConflict(localTab, serverTab);
          if (resolved.value) {
            console.log('[PinnedTabsSync] Resolved conflict for %s: %s', 
              serverTab.url, resolved.resolution);
            mergedTabs.push({
              ...resolved.value,
              isLongTermPinned: true
            });
          }
          localMap.delete(serverTab.url);
        }
      }

      // 保存合并后的数据
      await this.pinnedTabsService.savePinnedTabs(mergedTabs);
      console.log('[PinnedTabsSync] Merged data saved, total tabs: %d', mergedTabs.length);
    } catch (error) {
      console.error('[PinnedTabsSync] Merge data failed:', error);
      throw error;
    }
  }

  /**
   * 冲突解决
   */
  resolveConflict(localTab, serverTab) {
    const localTime = new Date(localTab.longTermPinnedAt || 0);
    const serverTime = new Date(serverTab.longTermPinnedAt || 0);
    
    if (localTime > serverTime) {
      console.log('[PinnedTabsSync] Client wins for %s (localTime=%s, serverTime=%s)', 
        localTab.url, localTab.longTermPinnedAt, serverTab.longTermPinnedAt);
      return { value: localTab, resolution: 'client_wins' };
    } else {
      console.log('[PinnedTabsSync] Server wins for %s (localTime=%s, serverTime=%s)', 
        localTab.url, localTab.longTermPinnedAt, serverTab.longTermPinnedAt);
      return { value: serverTab, resolution: 'server_wins' };
    }
  }

  /**
   * API: 同步接口
   */
  async apiSync(data) {
    const token = await this.authService.getAccessToken();
    const deviceId = data.deviceId;

    const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/pinned-tabs/sync`, {
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

  /**
   * API: 检查同步接口
   */
  async apiCheckSync(localVersion) {
    const token = await this.authService.getAccessToken();
    const deviceId = await this.getDeviceId();

    const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/pinned-tabs/sync/check`, {
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

  /**
   * 检测服务器是否可用
   */
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
      console.log('[PinnedTabsSync] Server health check failed:', error.message);
      return false;
    }
  }

  /**
   * 获取设备 ID
   */
  async getDeviceId() {
    return await this.deviceService.getDeviceId();
  }

  /**
   * 获取本地版本号
   */
  async getLocalVersion() {
    const result = await chrome.storage.local.get([this.LOCAL_VERSION_KEY]);
    return result[this.LOCAL_VERSION_KEY] || 0;
  }

  /**
   * 设置本地版本号
   */
  async setLocalVersion(version) {
    await chrome.storage.local.set({ [this.LOCAL_VERSION_KEY]: version });
  }

  /**
   * 获取上次同步时间
   */
  async getLastSyncTime() {
    const result = await chrome.storage.local.get([this.LAST_SYNC_TIME_KEY]);
    return result[this.LAST_SYNC_TIME_KEY] || null;
  }

  /**
   * 更新上次同步时间
   */
  async updateLastSyncTime(timestamp) {
    await chrome.storage.local.set({ [this.LAST_SYNC_TIME_KEY]: timestamp });
  }

  /**
   * 记录同步失败
   */
  async recordFailure() {
    const count = await this.getFailureCount() + 1;
    await chrome.storage.local.set({
      [this.SYNC_FAILURE_COUNT_KEY]: count,
      [this.LAST_FAILURE_TIME_KEY]: Date.now()
    });
    console.log('[PinnedTabsSync] Failure recorded: count=%d', count);
  }

  /**
   * 获取失败计数
   */
  async getFailureCount() {
    const result = await chrome.storage.local.get([this.SYNC_FAILURE_COUNT_KEY]);
    return result[this.SYNC_FAILURE_COUNT_KEY] || 0;
  }

  /**
   * 重置失败计数
   */
  async resetFailureCount() {
    await chrome.storage.local.set({ [this.SYNC_FAILURE_COUNT_KEY]: 0 });
    console.log('[PinnedTabsSync] Failure count reset');
  }

  /**
   * 检查是否可以同步
   */
  async canSync() {
    const lastFailure = await this.getLastFailureTime();
    if (!lastFailure) return true;

    // 如果上次失败在 5 分钟内，暂时跳过
    if (Date.now() - lastFailure < this.COOLDOWN_TIME) {
      console.log('[PinnedTabsSync] In cooldown period (lastFailure: %dms ago)', Date.now() - lastFailure);
      return false;
    }

    return true;
  }

  /**
   * 获取上次失败时间
   */
  async getLastFailureTime() {
    const result = await chrome.storage.local.get([this.LAST_FAILURE_TIME_KEY]);
    return result[this.LAST_FAILURE_TIME_KEY] || null;
  }

  /**
   * 获取同步状态
   */
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

  /**
   * 清理资源
   */
  destroy() {
    this.stopPeriodicCheck();
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    console.log('[PinnedTabsSync] Service destroyed');
  }
}

// 导出单例实例（需要在 background.js 中初始化）
let pinnedTabsSyncService = null;

function createPinnedTabsSyncService(pinnedTabsService, authService, deviceService) {
  if (!pinnedTabsSyncService) {
    pinnedTabsSyncService = new PinnedTabsSyncService(pinnedTabsService, authService, deviceService);
  }
  return pinnedTabsSyncService;
}

export { PinnedTabsSyncService, createPinnedTabsSyncService, pinnedTabsSyncService };
