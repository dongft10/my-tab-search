/**
 * 同步队列服务
 * 处理需要后台同步的操作队列
 * 用户操作先存本地，后台定时同步到服务器
 */

class SyncQueueService {
  constructor() {
    this.storageKey = 'syncQueue';
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5秒
    this.syncTimer = null;
  }

  /**
   * 获取同步队列
   * @returns {Promise<Array>} - 返回同步队列
   */
  async getQueue() {
    try {
      const data = await chrome.storage.local.get(this.storageKey);
      return data[this.storageKey] || [];
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
  async saveQueue(queue) {
    try {
      await chrome.storage.local.set({
        [this.storageKey]: queue
      });
    } catch (error) {
      console.error('[SyncQueue] Save queue error:', error);
    }
  }

  /**
   * 添加操作到同步队列
   * @param {string} type - 操作类型
   * @param {object} data - 操作数据
   * @returns {Promise} - 返回添加结果
   */
  async addOperation(type, data) {
    try {
      const queue = await this.getQueue();
      
      // 检查是否已存在相同操作（根据类型和关键字段去重）
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
        await this.saveQueue(queue);
        console.log('[SyncQueue] Added operation:', type, data);
      }

      // 尝试立即同步
      this.scheduleSync();
    } catch (error) {
      console.error('[SyncQueue] Add operation error:', error);
    }
  }

  /**
   * 移除操作
   * @param {string} type - 操作类型
   * @param {number} tabId - Tab ID
   * @returns {Promise} - 返回移除结果
   */
  async removeOperation(type, tabId) {
    try {
      const queue = await this.getQueue();
      const filtered = queue.filter(item => 
        !(item.type === type && item.data.tabId === tabId)
      );
      await this.saveQueue(filtered);
    } catch (error) {
      console.error('[SyncQueue] Remove operation error:', error);
    }
  }

  /**
   * 执行同步
   * @returns {Promise} - 返回同步结果
   */
  async performSync() {
    try {
      const queue = await this.getQueue();
      if (queue.length === 0) {
        console.log('[SyncQueue] Queue is empty, skipping sync');
        return;
      }

      console.log('[SyncQueue] Starting sync, queue length:', queue.length);

      // 导入 auth 服务获取 token
      const { authService } = await import('./auth.service.js');
      const accessToken = await authService.getValidAccessToken();

      if (!accessToken) {
        console.log('[SyncQueue] No access token, skipping sync');
        return;
      }

      // 逐个处理队列中的操作
      const processedIds = [];
      for (const item of queue) {
        try {
          await this.processOperation(item, accessToken);
          processedIds.push(this.getOperationId(item));
        } catch (error) {
          console.error('[SyncQueue] Process operation error:', error);
          // 增加重试计数
          item.retryCount = (item.retryCount || 0) + 1;
          if (item.retryCount >= this.maxRetries) {
            console.warn('[SyncQueue] Operation max retries reached, removing:', item.type);
            processedIds.push(this.getOperationId(item));
          }
        }
      }

      // 移除已处理的操作
      const remainingQueue = queue.filter(item => 
        !processedIds.includes(this.getOperationId(item))
      );
      await this.saveQueue(remainingQueue);

      console.log('[SyncQueue] Sync completed, remaining:', remainingQueue.length);
    } catch (error) {
      console.error('[SyncQueue] Perform sync error:', error);
    }
  }

  /**
   * 处理单个操作
   * @param {object} item - 操作项
   * @param {string} accessToken - 访问令牌
   * @returns {Promise} - 返回处理结果
   */
  async processOperation(item, accessToken) {
    const { authApi } = await import('../api/auth.js');

    switch (item.type) {
      case 'pinTab':
        await authApi.syncPinnedTab(accessToken, item.data);
        break;
      case 'unpinTab':
        await authApi.syncUnpinTab(accessToken, item.data.tabId);
        break;
      case 'updateTab':
        await authApi.syncUpdateTab(accessToken, item.data);
        break;
      default:
        console.warn('[SyncQueue] Unknown operation type:', item.type);
    }
  }

  /**
   * 获取操作唯一标识
   * @param {object} item - 操作项
   * @returns {string} - 返回唯一标识
   */
  getOperationId(item) {
    return `${item.type}_${item.data.tabId}_${item.createdAt}`;
  }

  /**
   * 安排同步任务
   * @param {number} delay - 延迟时间（毫秒）
   */
  scheduleSync(delay = 0) {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    
    this.syncTimer = setTimeout(() => {
      this.performSync();
    }, delay);
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
    await this.saveQueue([]);
  }
}

// 导出单例实例
const syncQueueService = new SyncQueueService();

export default syncQueueService;
export { SyncQueueService };
