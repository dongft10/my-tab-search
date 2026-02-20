/**
 * VIP 状态管理服务
 * 处理VIP状态的本地存储和同步
 */

import authApi from '../api/auth.js';
import authService from './auth.service.js';
import { getCacheTime } from '../config.js';

class VipService {
  constructor() {
    this.storageKey = 'vipStatus';
    this.syncInterval = 60 * 60 * 1000; // 1小时同步一次
    this.cacheMaxAge = getCacheTime(); // 缓存时间：生产环境1天，开发环境1分钟
    this.lastSyncAt = null;
    this.syncTimer = null;
  }

  /**
   * 获取本地VIP状态
   * @returns {Promise<object>} - 返回本地VIP状态
   */
  async getLocalVipStatus() {
    const data = await chrome.storage.local.get(this.storageKey);
    return data[this.storageKey] || null;
  }

  /**
   * 保存VIP状态到本地
   * @param {object} vipStatus - VIP状态
   * @returns {Promise} - 返回保存结果
   */
  async saveVipStatus(vipStatus) {
    const data = {
      ...vipStatus,
      lastSyncAt: new Date().toISOString()
    };
    
    return chrome.storage.local.set({
      [this.storageKey]: data
    });
  }

  /**
   * 获取有效的访问令牌
   * @returns {Promise<string|null>} - 返回访问令牌
   */
  async getValidAccessToken() {
    return await authService.getValidAccessToken();
  }

  /**
   * 从服务器同步VIP状态
   * @returns {Promise<object>} - 返回同步后的VIP状态
   */
  async syncVipStatus() {
    try {
      const accessToken = await this.getValidAccessToken();
      if (!accessToken) {
        throw new Error('No access token');
      }

      const localStatus = await this.getLocalVipStatus();
      const lastSyncAt = localStatus ? localStatus.lastSyncAt : '';

      const response = await authApi.syncVipStatus(accessToken, lastSyncAt);
      
      if (response.code === 0) {
        const vipData = response.data;
        await this.saveVipStatus({
          vipStatus: vipData.vipStatus,
          vipTier: vipData.vipTier,
          vipExpiresAt: vipData.expiresAt,
          vipFeatures: vipData.features,
          needsSync: vipData.needsSync
        });

        this.lastSyncAt = new Date().toISOString();
        
        return vipData;
      }

      throw new Error(response.message || 'Sync failed');
    } catch (error) {
      console.error('Sync VIP status error:', error);
      // 返回默认状态而不是 null
      return {
        vipStatus: 'inactive',
        vipTier: '',
        vipFeatures: [],
        isVip: false
      };
    }
  }

  /**
   * 获取VIP状态（优先使用本地，必要时同步）
   * @param {boolean} forceRefresh - 是否强制从服务器刷新（默认false）
   * @returns {Promise<object>} - 返回VIP状态
   */
  async getVipStatus(forceRefresh = false) {
    try {
      const localStatus = await this.getLocalVipStatus();
      
      // 如果本地没有状态，需要同步
      if (!localStatus) {
        return await this.syncVipStatus();
      }

      const lastSync = new Date(localStatus.lastSyncAt).getTime();
      const now = Date.now();
      
      // 强制刷新：直接返回本地缓存状态，供前端使用
      // 非强制：检查缓存是否超过1天，超过才同步
      if (!forceRefresh && (now - lastSync > this.cacheMaxAge)) {
        // 后台同步
        this.syncVipStatus();
      }

      // 检查VIP是否过期
      if (localStatus.vipExpiresAt) {
        const expiresAt = new Date(localStatus.vipExpiresAt).getTime();
        if (expiresAt < Date.now()) {
          localStatus.vipStatus = 'expired';
          localStatus.isVip = false;
        } else {
          localStatus.isVip = true;
        }
      }

      return localStatus;
    } catch (error) {
      console.error('Get VIP status error:', error);
      return {
        vipStatus: 'inactive',
        vipTier: '',
        vipFeatures: [],
        isVip: false
      };
    }
  }

  /**
   * 检查是否有指定功能权限
   * @param {string} feature - 功能ID
   * @returns {Promise<boolean>} - 是否有权限
   */
  async hasFeature(feature) {
    const vipStatus = await this.getVipStatus();
    
    if (!vipStatus.isVip) {
      return false;
    }

    if (!vipStatus.vipFeatures || !Array.isArray(vipStatus.vipFeatures)) {
      return false;
    }

    return vipStatus.vipFeatures.includes(feature);
  }

  /**
   * 检查功能使用次数是否超过限制
   * @param {string} feature - 功能ID
   * @param {number} currentUsage - 当前使用次数
   * @returns {Promise<{allowed: boolean, limit: number}>} - 是否允许及限制
   */
  async checkFeatureLimit(feature, currentUsage) {
    const limits = {
      pinned_tabs: 5,
      sync_devices: 3,
      cloud_storage_mb: 100,
      search_history: 100
    };

    const isVip = await this.hasFeature(feature);
    
    if (isVip) {
      return { allowed: true, limit: -1 }; // VIP无限制
    }

    const limit = limits[feature] || -1;
    
    if (limit === -1) {
      return { allowed: true, limit: -1 };
    }

    return {
      allowed: currentUsage < limit,
      limit: limit
    };
  }

  /**
   * 启动定期同步
   */
  startPeriodicSync() {
    if (this.syncTimer) {
      return;
    }

    this.syncTimer = setInterval(() => {
      this.syncVipStatus();
    }, this.syncInterval);
  }

  /**
   * 停止定期同步
   */
  stopPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * 清除本地VIP状态
   * @returns {Promise} - 返回清除结果
   */
  async clearVipStatus() {
    return chrome.storage.local.remove(this.storageKey);
  }
}

// 导出单例实例
const vipService = new VipService();

export default vipService;
export { VipService };
