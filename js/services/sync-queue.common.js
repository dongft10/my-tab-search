/**
 * 同步队列服务（Service Worker 版本）
 * 用于 background.js 的 importScripts
 */

const SYNC_QUEUE_STORAGE_KEY = 'syncQueue';
const SYNC_QUEUE_MAX_RETRIES = 3;
const SYNC_QUEUE_DEBOUNCE_DELAY = 2000;

let syncTimer = null;
let isSyncing = false;

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
    if (queue.length === 0) {
      console.log('[SyncQueue] Queue is empty, skipping sync');
      return;
    }

    console.log('[SyncQueue] Starting sync, queue length:', queue.length);

    const storageData = await chrome.storage.local.get(['accessToken']);
    const accessToken = storageData.accessToken;

    if (!accessToken) {
      console.log('[SyncQueue] No access token, skipping sync');
      return;
    }

    const processedIds = [];
    for (const item of queue) {
      try {
        await processSyncOperation(item, accessToken);
        processedIds.push(`${item.type}_${item.data?.tabId || 'unknown'}_${item.createdAt}`);
      } catch (error) {
        console.error('[SyncQueue] Process operation error:', error);
        item.retryCount = (item.retryCount || 0) + 1;
        if (item.retryCount >= SYNC_QUEUE_MAX_RETRIES) {
          console.warn('[SyncQueue] Operation max retries reached, removing:', item.type);
          processedIds.push(`${item.type}_${item.data?.tabId || 'unknown'}_${item.createdAt}`);
        }
      }
    }

    const remainingQueue = queue.filter(item => 
      !processedIds.includes(`${item.type}_${item.data?.tabId || 'unknown'}_${item.createdAt}`)
    );
    await saveSyncQueue(remainingQueue);

    console.log('[SyncQueue] Sync completed, remaining:', remainingQueue.length);
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

  let endpoint = '';
  let method = 'POST';
  let body = null;

  switch (item.type) {
    case 'pinTab':
      endpoint = '/pinned-tabs/sync';
      body = { 
        action: 'add', 
        tab: {
          ...item.data,
          tabId: String(item.data.tabId)
        }
      };
      break;
    case 'unpinTab':
      endpoint = '/pinned-tabs/sync';
      body = { action: 'remove', tabId: String(item.data?.tabId) };
      break;
    case 'updateTab':
      endpoint = '/pinned-tabs/sync';
      body = { 
        action: 'update', 
        tabId: String(item.data?.tabId),
        tab: {
          ...item.data,
          tabId: String(item.data?.tabId)
        }
      };
      break;
    default:
      console.warn('[SyncQueue] Unknown operation type:', item.type);
      return;
  }

  console.log('[SyncQueue] Sending sync request:', item.type, body);

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
