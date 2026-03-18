/**
 * 同步队列服务（Service Worker 版本）
 * 用于 background.js 的 importScripts
 */

// 常量定义
const SYNC_QUEUE_STORAGE_KEY = 'syncQueue';
const SYNC_QUEUE_MAX_RETRIES = 3;
const SYNC_QUEUE_DEBOUNCE_DELAY = 2000;

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
  // 简单的实现，从 storage 获取标签页
  this.getPinnedTabs = async function() {
    try {
      const result = await chrome.storage.local.get(['pinnedTabs']);
      const tabs = result.pinnedTabs || [];
      console.log('[SyncQueue] Got pinned tabs from storage:', tabs.length);
      return tabs;
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
      console.log('[SyncQueue] Processing operation:', item.type, item.data);
      await processItem(item);
      processedIds.push(getOperationId(item));
      console.log('[SyncQueue] Operation completed:', item.type);
    } catch (error) {
      console.error('[SyncQueue] Process operation error:', error);
      item.retryCount = (item.retryCount || 0) + 1;
      if (item.retryCount >= SYNC_QUEUE_MAX_RETRIES) {
        console.warn('[SyncQueue] Operation max retries reached, removing:', item.type);
        processedIds.push(getOperationId(item));
      }
    }
  }

  const remainingQueue = queue.filter(item => 
    !processedIds.includes(getOperationId(item))
  );
  
  await saveSyncQueue(remainingQueue);
  console.log('[SyncQueue] Queue processed, remaining:', remainingQueue.length);
  
  return remainingQueue;
}

/**
 * 检查是否需要同步
 */
function shouldSync(queue) {
  // 1. 如果本地队列有操作，执行同步
  // 2. 如果本地队列为空，也执行同步以从服务器获取数据
  if (queue.length > 0) {
    return true; // 只要有队列就同步
  } else {
    // 本地队列为空，也需要同步以从服务器获取数据
    console.log('[SyncQueue] Queue is empty, but syncing to check server data');
    return true;
  }
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
      console.log('[SyncQueue] Added operation:', type, data);
    }

    scheduleSync();
  } catch (error) {
    console.error('[SyncQueue] Add operation error:', error);
  }
}

/**
 * 执行同步
 */
async function performSyncQueue() {
  if (isSyncing) {
    console.log('[SyncQueue] Sync already in progress, skipping');
    return;
  }

  isSyncing = true;
  try {
    const queue = await getSyncQueue();
    
    const storageData = await chrome.storage.local.get(['accessToken']);
    const accessToken = storageData.accessToken;

    if (!accessToken) {
      console.log('[SyncQueue] No access token, skipping sync');
      return;
    }
    
    if (shouldSync(queue)) {
      // 执行同步操作
      try {
        // 无论队列中有多少 item，只执行一次完整的同步
        await processSyncOperation({ 
          type: 'sync', 
          data: { tabId: queue.length > 0 ? 'queue-sync' : 'sync-check' } 
        }, accessToken);
        
        // 同步成功后，清除队列中的所有操作
        if (queue.length > 0) {
          console.log('[SyncQueue] Sync completed, clearing queue');
          await saveSyncQueue([]);
          console.log('[SyncQueue] Queue cleared, processed:', queue.length, 'operations');
        } else {
          console.log('[SyncQueue] Sync completed, no local operations to process');
        }
      } catch (error) {
        console.error('[SyncQueue] Process sync error:', error);
        
        // 同步失败时，处理队列中的操作
        if (queue.length > 0) {
          await processQueue(queue, async (item) => {
            // 这里可以添加具体的错误处理逻辑
            throw error;
          });
        }
      }
    }
  } catch (error) {
    console.error('[SyncQueue] Perform sync error:', error);
  } finally {
    isSyncing = false;
  }
}

/**
 * 处理单个同步操作
 */
async function processSyncOperation(item, accessToken) {
  // 数据校验
  if (!item.data || !item.data.tabId) {
    console.warn('[SyncQueue] Skip invalid operation: missing tabId', item);
    throw new Error('Invalid operation: missing tabId');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  };

  // 获取设备 ID 和本地标签页
  const deviceId = await getDeviceId();
  const pinnedTabsService = new PinnedTabsService();
  const localTabs = await pinnedTabsService.getPinnedTabs();
  const localVersion = await getLocalVersion();

  // 筛选出长期固定的 tabs（必须有 isLongTermPinned 和 longTermPinnedAt）
  const longTermTabs = localTabs
    .filter(tab => tab.isLongTermPinned && tab.longTermPinnedAt)
    .map(tab => ({
      url: tab.url,
      title: tab.title,
      longTermPinnedAt: tab.longTermPinnedAt
    }));

  console.log('[SyncQueue] Filtered long-term tabs:', longTermTabs.length);

  let endpoint = '';
  let method = 'POST';
  let body = null;

  // 统一使用完整的同步格式
  endpoint = '/pinned-tabs/sync';
  body = {
    deviceId: deviceId,
    localTabs: longTermTabs,
    lastKnownVersion: localVersion
  };

  console.log('[SyncQueue] Sending sync request:', body);

  const response = await fetch(CONFIG_COMMON.getApiUrl(endpoint), {
    method,
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[SyncQueue] Sync failed:', response.status, errorText);
    throw new Error(`Sync failed: ${response.status}`);
  }

  // 处理服务器响应
  const syncResult = await response.json();
  console.log('[SyncQueue] Sync response:', syncResult);

  // 提取 data 字段
  const syncData = syncResult.data || {};

  // 更新本地标签页
  if (syncData.tabs && Array.isArray(syncData.tabs)) {
    console.log('[SyncQueue] Updating local tabs with', syncData.tabs.length, 'tabs from server');
    
    // 获取当前所有标签页
    const currentTabs = await pinnedTabsService.getPinnedTabs();
    
    // 分离本地的长期固定和非长期固定标签页
    const localLongTermTabs = currentTabs.filter(tab => tab.isLongTermPinned);
    const nonLongTermTabs = currentTabs.filter(tab => !tab.isLongTermPinned);
    const mergedTabs = [...nonLongTermTabs]; // 保留本地非长期固定标签页
    const localMap = new Map(localLongTermTabs.map(t => [t.url, t]));
    
    // 处理服务器返回的长期固定标签页，将 longTermPinnedAt 赋值给 pinnedAt
    for (const serverTab of syncData.tabs) {
      const localTab = localMap.get(serverTab.url);
      
      if (!localTab) {
        // 服务端新增，直接添加
        console.log('[SyncQueue] Adding new tab from server: %s', serverTab.url);
        mergedTabs.push({
          ...serverTab,
          isLongTermPinned: 'true',
          longTermPinnedAt: serverTab.longTermPinnedAt || new Date().toISOString(),
          pinnedAt: serverTab.longTermPinnedAt || new Date().toISOString() // 使用 longTermPinnedAt 作为 pinnedAt
        });
      } else {
        // 存在本地记录，保留本地的 tabId
        console.log('[SyncQueue] Updating existing tab from server: %s', serverTab.url);
        mergedTabs.push({
          ...serverTab,
          tabId: localTab.tabId, // 保留本地的 tabId
          isLongTermPinned: 'true',
          longTermPinnedAt: serverTab.longTermPinnedAt || new Date().toISOString(),
          pinnedAt: serverTab.longTermPinnedAt || new Date().toISOString() // 使用 longTermPinnedAt 作为 pinnedAt
        });
        localMap.delete(serverTab.url);
      }
    }
    
    // 按 pinnedAt 正序排列（时间越早排在越前面）
    mergedTabs.sort((a, b) => {
      const dateA = a.pinnedAt ? new Date(a.pinnedAt) : new Date(0);
      const dateB = b.pinnedAt ? new Date(b.pinnedAt) : new Date(0);
      return dateA - dateB;
    });
    
    const updatedTabs = mergedTabs;
    
    // 保存更新后的标签页
    await chrome.storage.local.set({ pinnedTabs: updatedTabs });
    console.log('[SyncQueue] Local tabs updated successfully');
  }

  // 更新本地版本号
  if (syncData.serverVersion) {
    await chrome.storage.local.set({ pinnedTabsVersion: syncData.serverVersion });
    console.log('[SyncQueue] Local version updated to:', syncData.serverVersion);
  }
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
 * 启动定期同步（合并触发源，避免重复）
 */
let periodicSyncStarted = false;
function startPeriodicSync(interval = 60000) {
  if (periodicSyncStarted) {
    console.log('[SyncQueue] Periodic sync already started');
    return;
  }
  
  periodicSyncStarted = true;
  
  // 只通过 setInterval 触发，不使用 chrome.alarms 避免重复
  setInterval(() => {
    performSyncQueue();
  }, interval);
  
  console.log('[SyncQueue] Periodic sync started with interval:', interval);
}

// 导出全局函数
self.SyncQueueService = {
  addOperation: addToSyncQueue,
  startPeriodicSync,
  performSync: performSyncQueue
};
