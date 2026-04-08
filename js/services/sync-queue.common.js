/**
 * 同步队列服务（Service Worker 版本）
 * 用于 background.js 的 importScripts
 */

// 常量定义
const SYNC_QUEUE_STORAGE_KEY = 'syncQueue';
const SYNC_QUEUE_MAX_RETRIES = 3;
const SYNC_QUEUE_DEBOUNCE_DELAY = 2000;
const FIRST_SYNC_COMPLETED_KEY = 'firstSyncCompleted';

let syncTimer = null;
let isSyncing = false;

/**
 * 获取设备 ID
 */
async function getDeviceId() {
  try {
    const result = await chrome.storage.local.get(['deviceId']);
    return result.deviceId || null;
  } catch (error) {
    console.error('[SyncQueue] Get deviceId error:', error);
    return null;
  }
}

/**
 * 获取本地版本号
 */
async function getLocalVersion() {
  try {
    const result = await chrome.storage.local.get(['pinnedTabsVersion']);
    return result.pinnedTabsVersion || 0;
  } catch (error) {
    console.error('[SyncQueue] Get local version error:', error);
    return 0;
  }
}

/**
 * 获取 PinnedTabsService
 */
function PinnedTabsService() {
  this.getPinnedTabs = async function() {
    try {
      const result = await chrome.storage.local.get(['pinnedTabs']);
      return result.pinnedTabs || [];
    } catch (error) {
      console.error('[SyncQueue] Get pinned tabs error:', error);
      return [];
    }
  };
}

/**
 * 获取同步队列
 */
async function getSyncQueue() {
  try {
    const data = await chrome.storage.local.get(SYNC_QUEUE_STORAGE_KEY);
    return data[SYNC_QUEUE_STORAGE_KEY] || [];
  } catch (error) {
    console.error('[SyncQueue] Get queue error:', error);
    return [];
  }
}

/**
 * 保存同步队列
 */
async function saveSyncQueue(queue) {
  try {
    await chrome.storage.local.set({
      [SYNC_QUEUE_STORAGE_KEY]: queue
    });
  } catch (error) {
    console.error('[SyncQueue] Save queue error:', error);
  }
}

/**
 * 获取操作唯一标识
 */
function getOperationId(item) {
  return `${item.type}_${item.data?.tabId || 'unknown'}_${item.createdAt}`;
}

/**
 * 处理队列中的操作
 */
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

/**
 * 检查是否需要同步
 */
function shouldSync(queue) {
  return true;
}

/**
 * 安全的错误处理
 */
async function safeExecute(fn, errorMessage) {
  try {
    return await fn();
  } catch (error) {
    console.error(`[SyncQueue] ${errorMessage}:`, error);
    throw error;
  }
}

/**
 * 添加操作到同步队列
 */
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

/**
 * 检查是否已完成初次同步
 */
async function isFirstSyncCompleted() {
  try {
    const result = await chrome.storage.local.get([FIRST_SYNC_COMPLETED_KEY]);
    return !!result[FIRST_SYNC_COMPLETED_KEY];
  } catch (error) {
    console.error('[SyncQueue] Check first sync status error:', error);
    return false;
  }
}

/**
 * 标记初次同步已完成
 */
async function markFirstSyncCompleted() {
  try {
    await chrome.storage.local.set({ [FIRST_SYNC_COMPLETED_KEY]: true });
  } catch (error) {
    console.error('[SyncQueue] Mark first sync completed error:', error);
  }
}

/**
 * 执行同步
 */
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

    if (shouldSync(queue)) {
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
          await processQueue(queue, async (item) => {
            throw error;
          });
        }
      }
    }
  } catch (error) {
    console.warn('[SyncQueue] Perform sync error:', error);
  } finally {
    isSyncing = false;
  }

  return syncResult;
}

/**
 * 处理单个同步操作
 */
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
  const pinnedTabsService = new PinnedTabsService();
  const localTabs = await pinnedTabsService.getPinnedTabs();
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

  const response = await fetch(CONFIG_COMMON.getApiUrl(endpoint), {
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

  if (syncData.needsPull) {
    if (syncData.tabs && Array.isArray(syncData.tabs)) {
      const serverTabsCount = syncData.tabs.length;
      const currentTabs = await pinnedTabsService.getPinnedTabs();
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

    return { pulledData, tabsCount };
  }

  if (syncData.tabs && Array.isArray(syncData.tabs)) {
    const serverTabsCount = syncData.tabs.length;
    const currentTabs = await pinnedTabsService.getPinnedTabs();
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
          console.warn('[SyncQueue] Error querying existing tabs:', e.message);
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

  return { pulledData, tabsCount };
}

/**
 * 安排同步任务（带防抖）
 */
function scheduleSync(delay = 0) {
  if (syncTimer) {
    clearTimeout(syncTimer);
  }

  syncTimer = setTimeout(() => {
    performSyncQueue();
  }, delay || SYNC_QUEUE_DEBOUNCE_DELAY);
}

/**
 * 启动定期同步
 */
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

// 导出全局函数
self.SyncQueueService = {
  addOperation: addToSyncQueue,
  startPeriodicSync,
  performSync: performSyncQueue,
  scheduleSync
};