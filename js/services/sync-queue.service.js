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

  async addOperation(type, data) {
    await addToSyncQueue(type, data);

    chrome.runtime.sendMessage({
      action: 'syncQueueAddOperation',
      type: type,
      data: data
    }).catch(err => {
      console.info('[SyncQueue] Failed to notify background:', err);
      this.scheduleSync();
    });
  }

  async removeOperation(type, tabId) {
    await safeExecute(async () => {
      const queue = await getSyncQueue();
      const filtered = queue.filter(item =>
        !(item.type === type && item.data.tabId === tabId)
      );
      await saveSyncQueue(filtered);
    }, 'Remove operation error');
  }

  async performSync() {
    if (this.isSyncing) {
      return;
    }

    this.isSyncing = true;
    try {
      const queue = await getSyncQueue();

      const accessToken = await authService.getValidAccessToken();

      if (!accessToken) {
        return;
      }

      if (shouldSync(queue)) {
        const { PinnedTabsSyncService, createPinnedTabsSyncService } = await import('./pinned-tabs-sync.service.js');
        const syncService = createPinnedTabsSyncService(pinnedTabsService, authService, deviceService);

        await syncService.fullSync();

        if (queue.length > 0) {
          await processQueue(queue, async (item) => {
            // 完整同步已完成
          });
        }
      }
    } catch (error) {
      console.error('[SyncQueue] Perform sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  async processOperation(item, accessToken) {
    if (!item.data || !item.data.tabId) {
      console.info('[SyncQueue] Skip invalid operation: missing tabId', item);
      throw new Error('Invalid operation: missing tabId');
    }

    try {
      const { PinnedTabsSyncService, createPinnedTabsSyncService } = await import('./pinned-tabs-sync.service.js');
      const syncService = createPinnedTabsSyncService(pinnedTabsService, authService, deviceService);

      await syncService.fullSync();
    } catch (error) {
      console.info('[SyncQueue] Sync operation failed (will retry):', item.type, error.message);
      throw error;
    }
  }

  scheduleSync(delay = 0) {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    const actualDelay = delay || this.debounceDelay;

    this.syncTimer = setTimeout(() => {
      this.performSync();
    }, actualDelay);
  }

  startPeriodicSync(interval = 60000) {
    this.scheduleSync(interval);

    chrome.alarms.create('syncQueue', { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'syncQueue') {
        this.performSync();
      }
    });
  }

  async clearQueue() {
    await saveSyncQueue([]);
  }
}

const syncQueueService = new SyncQueueService();

export default syncQueueService;
export { SyncQueueService };