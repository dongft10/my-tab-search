/**
 * 同步队列服务
 * 处理需要后台同步的操作队列
 * 用户操作先存本地，后台定时同步到服务器
 */

import authService from './auth.service.js';
import authApi from '../api/auth.js';
import pinnedTabsService from './pinned-tabs.service.js';
import deviceService from './device.service.js';
import {
  SYNC_QUEUE_STORAGE_KEY,
  SYNC_QUEUE_MAX_RETRIES,
  SYNC_QUEUE_DEBOUNCE_DELAY,
  getSyncQueue,
  saveSyncQueue,
  addToSyncQueue,
  getOperationId,
  processQueue,
  shouldSync,
  safeExecute
} from './sync-queue.core.js';

class SyncQueueService {
  constructor() {
    this.syncTimer = null;
    this.debounceDelay = SYNC_QUEUE_DEBOUNCE_DELAY;
    this.isSyncing = false;
  }

  /**
   * 添加操作到同步队列
   * @param {string} type - 操作类型
   * @param {object} data - 操作数据
   * @returns {Promise} - 返回添加结果
   */
  async addOperation(type, data) {
    await addToSyncQueue(type, data, () => this.scheduleSync());
  }

  /**
   * 移除操作
   * @param {string} type - 操作类型
   * @param {number} tabId - Tab ID
   * @returns {Promise} - 返回移除结果
   */
  async removeOperation(type, tabId) {
    await safeExecute(async () => {
      const queue = await getSyncQueue();
      const filtered = queue.filter(item => 
        !(item.type === type && item.data.tabId === tabId)
      );
      await saveSyncQueue(filtered);
    }, 'Remove operation error');
  }

  /**
   * 执行同步
   * @returns {Promise} - 返回同步结果
   */
  async performSync() {
    if (this.isSyncing) {
      console.log('[SyncQueue] Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;
    try {
      const queue = await getSyncQueue();
      
      const accessToken = await authService.getValidAccessToken();

      if (!accessToken) {
        console.log('[SyncQueue] No access token, skipping sync');
        return;
      }
      
      if (shouldSync(queue)) {
        console.log('[SyncQueue] Starting sync');
        
        // 使用 pinned-tabs-sync.service.js 进行同步
        const { PinnedTabsSyncService, createPinnedTabsSyncService } = await import('./pinned-tabs-sync.service.js');
        const syncService = createPinnedTabsSyncService(pinnedTabsService, authService, deviceService);
        
        // 触发完整同步（让 sync 服务自己处理）
        await syncService.fullSync();
        
        // 如果有本地队列，处理队列中的操作
        if (queue.length > 0) {
          await processQueue(queue, async (item) => {
            // 已经执行了完整同步，这里可以标记操作为完成
            console.log('[SyncQueue] Operation completed:', item.type);
          });
        } else {
          console.log('[SyncQueue] Sync completed, no local operations to process');
        }
      } else {
        console.log('[SyncQueue] No operations to sync, skipping');
      }
    } catch (error) {
      console.error('[SyncQueue] Perform sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 处理单个操作
   * @param {object} item - 操作项
   * @param {string} accessToken - 访问令牌
   * @returns {Promise} - 返回处理结果
   */
  async processOperation(item, accessToken) {
    if (!item.data || !item.data.tabId) {
      console.warn('[SyncQueue] Skip invalid operation: missing tabId', item);
      throw new Error('Invalid operation: missing tabId');
    }
    
    try {
      // 使用 pinned-tabs-sync.service.js 进行同步
      const { PinnedTabsSyncService, createPinnedTabsSyncService } = await import('./pinned-tabs-sync.service.js');
      const syncService = createPinnedTabsSyncService(pinnedTabsService, authService, deviceService);
      
      // 触发完整同步（让 sync 服务自己处理）
      await syncService.fullSync();
      
      console.log('[SyncQueue] Sync operation completed:', item.type);
    } catch (error) {
      // 同步失败，但不影响本地操作
      // 错误会在 performSync 中被捕获，增加重试计数
      console.warn('[SyncQueue] Sync operation failed (will retry):', item.type, error.message);
      throw error; // 抛出错误，让上层处理重试
    }
  }

  /**
   * 安排同步任务
   * @param {number} delay - 延迟时间（毫秒）
   */
  scheduleSync(delay = 0) {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      console.log('[SyncQueue] Cleared previous sync timer');
    }
    
    const actualDelay = delay || this.debounceDelay;
    console.log('[SyncQueue] Scheduling sync in %dms', actualDelay);
    
    this.syncTimer = setTimeout(() => {
      console.log('[SyncQueue] Timer triggered, starting sync...');
      this.performSync();
    }, actualDelay);
  }

  /**
   * 启动定期同步
   * @param {number} interval - 同步间隔（毫秒），默认1分钟
   */
  startPeriodicSync(interval = 60000) {
    // 每分钟检查一次
    this.scheduleSync(interval);
    
    // 使用 chrome.alarms 实现更可靠的定期任务
    chrome.alarms.create('syncQueue', { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'syncQueue') {
        this.performSync();
      }
    });
  }

  /**
   * 清除队列
   * @returns {Promise} - 返回清除结果
   */
  async clearQueue() {
    await saveSyncQueue([]);
  }
}

// 导出单例实例
const syncQueueService = new SyncQueueService();

export default syncQueueService;
export { SyncQueueService };
