/**
 * 同步队列服务
 * 用于 background.js 的同步功�? */

import { API_CONFIG, getApiUrl, PINNED_TABS_CONFIG } from '../config.js';
import authApi from '../api/auth.js';

const SYNC_QUEUE_STORAGE_KEY = 'syncQueue';
const SYNC_QUEUE_MAX_RETRIES = 3;
const SYNC_QUEUE_DEBOUNCE_DELAY = 2000;
const FIRST_SYNC_COMPLETED_KEY = 'firstSyncCompleted';

let syncTimer = null;
let isSyncing = false;

async function getDeviceId() {
  try {
    const result = await chrome.storage.local.get(['deviceId']);
    return result.deviceId || null;
  } catch (error) {
    console.error('[SyncQueue] Get deviceId error:', error);
    return null;
  }
}

async function getLocalVersion() {
  try {
    const result = await chrome.storage.local.get(['pinnedTabsVersion']);
    return result.pinnedTabsVersion || 0;
  } catch (error) {
    console.error('[SyncQueue] Get local version error:', error);
    return 0;
  }
}

async function getPinnedTabs() {
  try {
    const result = await chrome.storage.local.get(['pinnedTabs']);
    return result.pinnedTabs || [];
  } catch (error) {
    console.error('[SyncQueue] Get pinned tabs error:', error);
    return [];
  }
}

async function getSyncQueue() {
  try {
    const data = await chrome.storage.local.get(SYNC_QUEUE_STORAGE_KEY);
    return data[SYNC_QUEUE_STORAGE_KEY] || [];
  } catch (error) {
    console.error('[SyncQueue] Get queue error:', error);
    return [];
  }
}

async function saveSyncQueue(queue) {
  try {
    await chrome.storage.local.set({
      [SYNC_QUEUE_STORAGE_KEY]: queue
    });
  } catch (error) {
    console.error('[SyncQueue] Save queue error:', error);
  }
}

function getOperationId(item) {
  return `${item.type}_${item.data?.tabId || 'unknown'}_${item.createdAt}`;
}

async function processQueue(queue, processItem) {
  const processedIds = [];

  for (const item of queue) {
    try {
      await processItem(item);
      processedIds.push(getOperationId(item));
    } catch (error) {
      console.warn('[SyncQueue] Process operation error:', error);
      item.retryCount = (item.retryCount || 0) + 1;
      if (item.retryCount >= SYNC_QUEUE_MAX_RETRIES) {
        console.info('[SyncQueue] Operation max retries reached, removing:', item.type);
        processedIds.push(getOperationId(item));
      }
    }
  }

  const remainingQueue = queue.filter(item =>
    !processedIds.includes(getOperationId(item))
  );

  await saveSyncQueue(remainingQueue);
  return remainingQueue;
}

async function isFirstSyncCompleted() {
  try {
    const result = await chrome.storage.local.get([FIRST_SYNC_COMPLETED_KEY]);
    return !!result[FIRST_SYNC_COMPLETED_KEY];
  } catch (error) {
    console.error('[SyncQueue] Check first sync status error:', error);
    return false;
  }
}

async function markFirstSyncCompleted() {
  try {
    await chrome.storage.local.set({ [FIRST_SYNC_COMPLETED_KEY]: true });
  } catch (error) {
    console.error('[SyncQueue] Mark first sync completed error:', error);
  }
}

async function processSyncOperation(item, accessToken) {
  if (!item.data || !item.data.tabId) {
    console.info('[SyncQueue] Skip invalid operation: missing tabId', item);
    throw new Error('Invalid operation: missing tabId');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  };

  const deviceId = await getDeviceId();
  const localTabs = await getPinnedTabs();
  const localVersion = await getLocalVersion();

  const longTermTabs = localTabs
    .filter(tab => tab.isLongTermPinned && tab.longTermPinnedAt)
    .map(tab => ({
      url: tab.url,
      title: tab.title,
      longTermPinnedAt: tab.longTermPinnedAt
    }));

  const endpoint = '/pinned-tabs/sync';
  const body = {
    deviceId: deviceId,
    localTabs: longTermTabs,
    lastKnownVersion: localVersion
  };

  const response = await fetch(getApiUrl(endpoint), {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[SyncQueue] Sync failed:', response.status, errorText);
    throw new Error(`Sync failed: ${response.status}`);
  }

  const syncResult = await response.json();
  const syncData = syncResult.data || {};

  let pulledData = false;
  let tabsCount = 0;

  if (syncData.needsPull || syncData.tabs) {
    if (syncData.tabs && Array.isArray(syncData.tabs)) {
      const serverTabsCount = syncData.tabs.length;
      const currentTabs = await getPinnedTabs();
      const localLongTermTabs = currentTabs.filter(tab => tab.isLongTermPinned);
      const nonLongTermTabs = currentTabs.filter(tab => !tab.isLongTermPinned);
      const mergedTabs = [...nonLongTermTabs];
      const localLongTermMap = new Map(localLongTermTabs.map(t => [t.url, t]));

      for (const serverTab of syncData.tabs) {
        const localTab = localLongTermMap.get(serverTab.url);
        if (!localTab) {
          let existingTabId = undefined;
          try {
            const existingTabs = await chrome.tabs.query({ url: serverTab.url });
            if (existingTabs && existingTabs.length > 0) {
              existingTabId = existingTabs[0].id;
            }
          } catch (e) {
            console.info('[SyncQueue] Error querying existing tabs:', e.message);
          }
          
          mergedTabs.push({
            ...serverTab,
            tabId: existingTabId,
            isLongTermPinned: true,
            longTermPinnedAt: serverTab.longTermPinnedAt || new Date().toISOString(),
            pinnedAt: serverTab.longTermPinnedAt || new Date().toISOString()
          });
          pulledData = true;
        } else {
          mergedTabs.push({
            ...serverTab,
            tabId: localTab.tabId,
            isLongTermPinned: true,
            longTermPinnedAt: serverTab.longTermPinnedAt || new Date().toISOString(),
            pinnedAt: serverTab.longTermPinnedAt || new Date().toISOString()
          });
          localLongTermMap.delete(serverTab.url);
        }
      }

      mergedTabs.sort((a, b) => {
        const dateA = a.pinnedAt ? new Date(a.pinnedAt) : new Date(0);
        const dateB = b.pinnedAt ? new Date(b.pinnedAt) : new Date(0);
        return dateA - dateB;
      });

      await chrome.storage.local.set({ pinnedTabs: mergedTabs });
      tabsCount = serverTabsCount;
    }

    if (syncData.serverVersion) {
      await chrome.storage.local.set({ pinnedTabsVersion: syncData.serverVersion });
    }
  }

  return { pulledData, tabsCount };
}

async function performSyncQueue() {
  if (isSyncing) {
    return { success: false, reason: 'already_syncing' };
  }

  isSyncing = true;
  let syncResult = {
    success: false,
    isFirstSync: false,
    pulledData: false,
    tabsCount: 0
  };

  try {
    const queue = await getSyncQueue();

    const storageData = await chrome.storage.local.get(['accessToken']);
    const accessToken = storageData.accessToken;

    if (!accessToken) {
      return { success: false, reason: 'no_token' };
    }

    const wasFirstSync = !(await isFirstSyncCompleted());

    try {
      const processResult = await processSyncOperation({
        type: 'sync',
        data: { tabId: queue.length > 0 ? 'queue-sync' : 'sync-check' }
      }, accessToken);

      syncResult.success = true;
      syncResult.isFirstSync = wasFirstSync;
      syncResult.pulledData = processResult?.pulledData || false;
      syncResult.tabsCount = processResult?.tabsCount || 0;

      if (wasFirstSync) {
        await markFirstSyncCompleted();
        console.log('[SyncQueue] First sync completed, pulledData:', syncResult.pulledData, 'tabsCount:', syncResult.tabsCount);
      }

      if (queue.length > 0) {
        await saveSyncQueue([]);
      }
    } catch (error) {
      console.warn('[SyncQueue] Process sync error:', error);

      if (queue.length > 0) {
        await processQueue(queue, async () => {
          throw error;
        });
      }
    }
  } catch (error) {
    console.warn('[SyncQueue] Perform sync error:', error);
  } finally {
    isSyncing = false;
  }

  return syncResult;
}

async function addToSyncQueue(type, data) {
  try {
    const queue = await getSyncQueue();

    const normalizedTabId = String(data.tabId || '');

    const exists = queue.some(item =>
      item.type === type &&
      String(item.data.tabId || '') === normalizedTabId &&
      item.status !== 'completed'
    );

    if (!exists) {
      queue.push({
        type,
        data,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        status: 'pending'
      });
      await saveSyncQueue(queue);
    }

    scheduleSync();
  } catch (error) {
    console.error('[SyncQueue] Add operation error:', error);
  }
}

function scheduleSync(delay = 0) {
  if (syncTimer) {
    clearTimeout(syncTimer);
  }

  syncTimer = setTimeout(() => {
    performSyncQueue();
  }, delay || SYNC_QUEUE_DEBOUNCE_DELAY);
}

let periodicSyncStarted = false;
function startPeriodicSync(interval = 60000) {
  if (periodicSyncStarted) {
    return;
  }

  periodicSyncStarted = true;

  setInterval(() => {
    performSyncQueue();
  }, interval);
}

export const SyncQueueService = {
  addOperation: addToSyncQueue,
  startPeriodicSync,
  performSync: performSyncQueue,
  scheduleSync
};

export default SyncQueueService;
