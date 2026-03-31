/**
 * 同步队列核心逻辑
 * 提供共享的同步队列操作功能
 */

// 常量定义
export const SYNC_QUEUE_STORAGE_KEY = 'syncQueue';
export const SYNC_QUEUE_MAX_RETRIES = 3;
export const SYNC_QUEUE_DEBOUNCE_DELAY = 2000;

/**
 * 获取同步队列
 * @returns {Promise<Array>} - 返回同步队列
 */
export async function getSyncQueue() {
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
 * @param {Array} queue - 同步队列
 * @returns {Promise} - 返回保存结果
 */
export async function saveSyncQueue(queue) {
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
 * @param {string} type - 操作类型
 * @param {object} data - 操作数据
 * @param {Function} scheduleSync - 调度同步的函数
 * @returns {Promise} - 返回添加结果
 */
export async function addToSyncQueue(type, data, scheduleSync) {
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

    if (scheduleSync) {
      scheduleSync();
    }
  } catch (error) {
    console.error('[SyncQueue] Add operation error:', error);
  }
}

/**
 * 获取操作唯一标识
 * @param {object} item - 操作项
 * @returns {string} - 返回唯一标识
 */
export function getOperationId(item) {
  return `${item.type}_${item.data?.tabId || 'unknown'}_${item.createdAt}`;
}

/**
 * 处理队列中的操作
 * @param {Array} queue - 同步队列
 * @param {Function} processItem - 处理单个操作的函数
 * @returns {Promise<Array>} - 返回剩余的队列
 */
export async function processQueue(queue, processItem) {
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
        console.info('[SyncQueue] Operation max retries reached, removing:', item.type);
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
 * @param {Array} queue - 同步队列
 * @returns {boolean} - 是否需要同步
 */
export function shouldSync(queue) {
  // 1. 如果本地队列有操作，检查是否是长期固定标签页相关操作
  if (queue.length > 0) {
    // 检查是否有长期固定的标签页操作
    const longTermPinnedQueue = queue.filter(item => 
      (item.data && (item.data.isLongTermPinned || item.data.longTermPinnedAt)) ||
      (item.isLongTermPinned && item.longTermPinnedAt)
    );
    return longTermPinnedQueue.length > 0;
  } else {
    // 本地队列为空，也需要同步以从服务器获取数据
    console.log('[SyncQueue] Queue is empty, but syncing to check server data');
    return true;
  }
}

/**
 * 安全的错误处理
 * @param {Function} fn - 要执行的函数
 * @param {string} errorMessage - 错误消息
 * @returns {Promise<any>} - 执行结果
 */
export async function safeExecute(fn, errorMessage) {
  try {
    return await fn();
  } catch (error) {
    console.error(`[SyncQueue] ${errorMessage}:`, error);
    throw error;
  }
}
