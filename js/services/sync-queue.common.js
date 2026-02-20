/**
 * 同步队列服务（Service Worker 版本）
 * 用于 background.js 的 importScripts
 */

const SYNC_QUEUE_STORAGE_KEY = 'syncQueue';
const SYNC_QUEUE_MAX_RETRIES = 3;

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
    
    const exists = queue.some(item => 
      item.type === type && 
      item.data.tabId === data.tabId
    );

    if (!exists) {
      queue.push({
        type,
        data,
        createdAt: new Date().toISOString(),
        retryCount: 0
      });
      await saveSyncQueue(queue);
      console.log('[SyncQueue] Added operation:', type, data);
    }

    // 安排同步
    scheduleSync();
  } catch (error) {
    console.error('[SyncQueue] Add operation error:', error);
  }
}

/**
 * 执行同步
 */
async function performSyncQueue() {
  try {
    const queue = await getSyncQueue();
    if (queue.length === 0) {
      console.log('[SyncQueue] Queue is empty, skipping sync');
      return;
    }

    console.log('[SyncQueue] Starting sync, queue length:', queue.length);

    // 获取 token
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
        processedIds.push(`${item.type}_${item.data.tabId}_${item.createdAt}`);
      } catch (error) {
        console.error('[SyncQueue] Process operation error:', error);
        item.retryCount = (item.retryCount || 0) + 1;
        if (item.retryCount >= SYNC_QUEUE_MAX_RETRIES) {
          console.warn('[SyncQueue] Operation max retries reached, removing:', item.type);
          processedIds.push(`${item.type}_${item.data.tabId}_${item.createdAt}`);
        }
      }
    }

    const remainingQueue = queue.filter(item => 
      !processedIds.includes(`${item.type}_${item.data.tabId}_${item.createdAt}`)
    );
    await saveSyncQueue(remainingQueue);

    console.log('[SyncQueue] Sync completed, remaining:', remainingQueue.length);
  } catch (error) {
    console.error('[SyncQueue] Perform sync error:', error);
  }
}

/**
 * 处理单个同步操作
 */
async function processSyncOperation(item, accessToken) {
  const apiUrl = 'http://localhost:41532/api/v1';
  
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
        tab: {
          ...item.data,
          tabId: String(item.data.tabId)
        }
      };
      break;
    default:
      console.warn('[SyncQueue] Unknown operation type:', item.type);
      return;
  }

  console.log('[SyncQueue] Sending sync request:', item.type, body);

  const response = await fetch(apiUrl + endpoint, {
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
 * 安排同步任务
 */
let syncTimer = null;
function scheduleSync(delay = 0) {
  if (syncTimer) {
    clearTimeout(syncTimer);
  }
  
  syncTimer = setTimeout(() => {
    performSyncQueue();
  }, delay);
}

/**
 * 启动定期同步
 */
function startPeriodicSync(interval = 60000) {
  scheduleSync(interval);
  
  chrome.alarms.create('syncQueue', { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'syncQueue') {
      performSyncQueue();
    }
  });
  
  console.log('[SyncQueue] Periodic sync started');
}

// 导出全局函数
self.SyncQueueService = {
  addOperation: addToSyncQueue,
  startPeriodicSync,
  performSync: performSyncQueue
};
