/**
 * 功能限制服务
 * 处理用户功能权限检查和限制
 */

import authApi from '../api/auth.js';
import authService from './auth.service.js';

class FeatureLimitService {
  constructor() {
    this.storageKey = 'featureLimits';
    this.cacheTimeout = 60 * 60 * 1000; // 1小时缓存
    this.cachedLimits = null;
    this.cacheTime = null;
  }

  /**
   * 获取本地缓存的功能限制
   * @returns {Promise<object|null>} - 返回缓存的功能限制
   */
  async getLocalLimits() {
    try {
      const data = await chrome.storage.local.get(this.storageKey);
      return data[this.storageKey] || null;
    } catch (error) {
      console.error('Get local limits error:', error);
      return null;
    }
  }

  /**
   * 保存功能限制到本地
   * @param {object} limits - 功能限制
   * @returns {Promise} - 返回保存结果
   */
  async saveLimits(limits) {
    try {
      const data = {
        ...limits,
        cachedAt: new Date().toISOString()
      };
      await chrome.storage.local.set({
        [this.storageKey]: data
      });
      this.cachedLimits = limits;
      this.cacheTime = Date.now();
    } catch (error) {
      console.error('Save limits error:', error);
    }
  }

  /**
   * 从服务器同步功能限制
   * @returns {Promise<object>} - 返回功能限制
   */
  async syncLimits() {
    try {
      const accessToken = await authService.getValidAccessToken();
      if (!accessToken) {
        // 没有访问令牌时静默返回默认限制
        return await this.getLocalLimits() || this.getDefaultLimits();
      }

      const response = await authApi.getUserLimits(accessToken);
      
      if (response.code === 0) {
        const limitsData = response.data;
        await this.saveLimits(limitsData);
        return limitsData;
      }

      // 同步失败时返回缓存的或默认限制
      return await this.getLocalLimits() || this.getDefaultLimits();
    } catch (error) {
      // 网络错误或服务不可用时静默返回默认限制
      return await this.getLocalLimits() || this.getDefaultLimits();
    }
  }

  /**
   * 获取默认功能限制
   * @returns {object} - 返回默认功能限制
   */
  getDefaultLimits() {
    return {
      userType: 'anonymous',
      userTypeName: '匿名用户',
      limits: {
        pinnedTabs: 5,
        searchHistory: -1,
        theme: 0,
        cloudStorage: 0,
        longTermPinned: 0,
        crossDeviceSync: 0,
        contentSearch: 0,
        syncDevices: 0
      }
    };
  }

  /**
   * 获取功能限制（优先使用本地，必要时同步）
   * @returns {Promise<object>} - 返回功能限制
   */
  async getLimits() {
    try {
      // 检查缓存
      if (this.cachedLimits && this.cacheTime) {
        const elapsed = Date.now() - this.cacheTime;
        if (elapsed < this.cacheTimeout) {
          return this.cachedLimits;
        }
      }

      // 尝试从本地存储获取
      const localLimits = await this.getLocalLimits();
      if (localLimits) {
        const cachedAt = localLimits.cachedAt ? new Date(localLimits.cachedAt).getTime() : 0;
        const elapsed = Date.now() - cachedAt;
        
        if (elapsed < this.cacheTimeout) {
          this.cachedLimits = localLimits;
          this.cacheTime = cachedAt;
          return localLimits;
        }
      }

      // 同步最新限制
      return await this.syncLimits();
    } catch (error) {
      console.error('Get limits error:', error);
      return this.getDefaultLimits();
    }
  }

  /**
   * 检查是否有功能访问权限
   * @param {string} feature - 功能ID
   * @returns {Promise<boolean>} - 是否有权限
   */
  async hasFeatureAccess(feature) {
    try {
      const limits = await this.getLimits();
      const featureLimits = limits.limits || {};
      
      // 功能到限制key的映射
      const featureMap = {
        longTermPinned: 'longTermPinned',
        cloudStorage: 'cloudStorage',
        crossDeviceSync: 'crossDeviceSync',
        contentSearch: 'contentSearch',
        syncDevices: 'syncDevices'
      };

      const limitKey = featureMap[feature];
      if (!limitKey) {
        return true; // 未映射的功能默认允许
      }

      const limitValue = featureLimits[limitKey];
      return limitValue !== 0;
    } catch (error) {
      console.error('Check feature access error:', error);
      return false;
    }
  }

  /**
   * 获取功能限制值
   * @param {string} feature - 功能ID
   * @returns {Promise<number>} - 限制值
   */
  async getFeatureLimit(feature) {
    try {
      const limits = await this.getLimits();
      const featureLimits = limits.limits || {};
      
      // 功能到限制key的映射
      const featureMap = {
        pinnedTabs: 'pinnedTabs',
        searchHistory: 'searchHistory',
        theme: 'theme',
        longTermPinned: 'longTermPinned',
        cloudStorage: 'cloudStorage',
        crossDeviceSync: 'crossDeviceSync',
        contentSearch: 'contentSearch',
        syncDevices: 'syncDevices'
      };

      const limitKey = featureMap[feature];
      if (!limitKey) {
        return -1;
      }

      return featureLimits[limitKey] !== undefined ? featureLimits[limitKey] : 0;
    } catch (error) {
      console.error('Get feature limit error:', error);
      return 0;
    }
  }

  /**
   * 检查是否超过功能使用限制
   * @param {string} feature - 功能ID
   * @param {number} currentUsage - 当前使用次数
   * @returns {Promise<{allowed: boolean, limit: number}>} - 是否允许及限制
   */
  async checkUsageLimit(feature, currentUsage) {
    const limit = await this.getFeatureLimit(feature);
    
    if (limit === -1) {
      return { allowed: true, limit: -1 }; // 无限制
    }

    if (limit === 0) {
      return { allowed: false, limit: 0 }; // 无权限
    }

    return {
      allowed: currentUsage < limit,
      limit: limit
    };
  }

  /**
   * 获取用户类型
   * @returns {Promise<string>} - 用户类型
   */
  async getUserType() {
    const limits = await this.getLimits();
    return limits.userType || 'anonymous';
  }

  /**
   * 清除本地缓存
   * @returns {Promise} - 返回清除结果
   */
  async clearCache() {
    try {
      await chrome.storage.local.remove(this.storageKey);
      this.cachedLimits = null;
      this.cacheTime = null;
    } catch (error) {
      console.error('Clear cache error:', error);
    }
  }
}

// 导出单例实例
const featureLimitService = new FeatureLimitService();

export default featureLimitService;
export { FeatureLimitService };
