/**
 * 功能限制服务
 * 处理用户功能权限检查和限制
 */

import authApi from '../api/auth.js';
import authService from './auth.service.js';
import { getCacheTime } from '../config.js';

class FeatureLimitService {
  constructor() {
    this.storageKey = 'featureLimits';
    this.cacheTimeout = getCacheTime(); // 根据环境配置缓存时间
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
   * 清除功能限制缓存
   * 在用户登录/注册后调用，确保获取最新的限制
   * @returns {Promise} - 返回结果
   */
  async clearCache() {
    try {
      this.cachedLimits = null;
      this.cacheTime = null;
      await chrome.storage.local.remove(this.storageKey);
      console.log('[FeatureLimit] Cache cleared');
    } catch (error) {
      console.error('Clear cache error:', error);
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
  getDefaultLimits(isRegistered = false) {
    // 静默注册用户（未完成邮箱验证）：固定tab限制5个
    // 已完成注册用户（体验期/VIP）：固定tab限制100个
    if (!isRegistered) {
      return {
        userType: 'anonymous',
        userTypeName: '匿名用户',
        limits: {
          pinnedTabs: 5,      // 静默注册用户限制5个
          searchHistory: -1,
          theme: 0,           // 只有默认主题
          cloudStorage: 0,
          longTermPinned: 5,  // 静默注册用户限制5个
          crossDeviceSync: 0,
          contentSearch: 0,
          syncDevices: 0,
          vipPinnedTabs: 5
        }
      };
    }
    
    // 已完成注册用户（体验期/VIP）的默认限制
    return {
      userType: 'registered',
      userTypeName: '已注册用户',
      limits: {
        pinnedTabs: 100,     // 限制100个
        searchHistory: -1,
        theme: 0,
        cloudStorage: 0,
        longTermPinned: 100, // 限制100个
        crossDeviceSync: 0,
        contentSearch: 0,
        syncDevices: 0,
        vipPinnedTabs: 100
      }
    };
  }

  /**
   * 检查用户是否已完成注册（邮箱验证或OAuth登录）
   * @returns {Promise<boolean>} - 是否已完成注册
   */
  async isUserRegistered() {
    try {
      // 检查是否有 registeredAt（完成邮箱验证或OAuth登录后设置）
      const data = await chrome.storage.local.get('registeredAt');
      return !!(data.registeredAt);
    } catch (error) {
      console.error('Check user registered error:', error);
      return false;
    }
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
      // 出错时根据用户注册状态返回默认限制
      const isRegistered = await this.isUserRegistered();
      return this.getDefaultLimits(isRegistered);
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
   * @param {boolean} forceRefresh - 是否强制从服务器刷新（默认false，缓存超过1天才刷新）
   * @param {boolean} optimistic - 是否使用乐观模式（默认true，允许操作后再校验）
   * @returns {Promise<number>} - 限制值
   */
  async getFeatureLimit(feature, forceRefresh = false, optimistic = true) {
    // 乐观模式：直接返回本地限制或默认值，不阻塞用户操作
    if (optimistic) {
      const localLimit = await this.getLocalFeatureLimit(feature);
      if (localLimit !== null) {
        return localLimit;
      }
    }

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

      // 检查是否需要刷新（缓存超时或强制刷新）
      if (!forceRefresh && this.cacheTime) {
        const cacheAge = Date.now() - this.cacheTime;
        if (cacheAge > this.cacheTimeout) {
          // 缓存超过1天，强制刷新一次
          this.cachedLimits = null;
          this.cacheTime = null;
          await chrome.storage.local.remove(this.storageKey);
          const freshLimits = await this.getLimits();
          const freshFeatureLimits = freshLimits.limits || {};
          console.log('[FeatureLimit] Cache expired, refreshed limit for', feature, ':', freshFeatureLimits[limitKey], 'UserType:', freshLimits.userType);
          return freshFeatureLimits[limitKey] !== undefined ? freshFeatureLimits[limitKey] : 0;
        }
      }

      console.log('[FeatureLimit] Get limit for', feature, ':', featureLimits[limitKey], 'UserType:', limits.userType);
      return featureLimits[limitKey] !== undefined ? featureLimits[limitKey] : 0;
    } catch (error) {
      console.error('Get feature limit error:', error);
      // 出错时返回本地限制或默认值
      const localLimit = this.getLocalFeatureLimit(feature);
      return localLimit !== null ? localLimit : 0;
    }
  }

  /**
   * 获取本地保存的功能限制值
   * @param {string} feature - 功能ID
   * @returns {Promise<number|null>} - 限制值或null
   */
  async getLocalFeatureLimit(feature) {
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
      return null;
    }

    // 固定tab限制逻辑
    if (feature === 'pinnedTabs' || feature === 'longTermPinned') {
      // 检查用户是否已完成邮箱验证
      const isRegistered = await this.isUserRegistered();
      
      if (!isRegistered) {
        // 静默注册用户（未验证邮箱）：5个
        return 5;
      }
      
      // 已完成邮箱验证的用户，检查体验期和VIP状态
      try {
        // 尝试从本地缓存获取体验期状态
        const trialData = await chrome.storage.local.get('trialStatus');
        const trialStatus = trialData.trialStatus;
        
        // 检查是否在体验期内
        let isInTrialPeriod = false;
        if (trialStatus && trialStatus.trialEndsAt) {
          const endsAt = new Date(trialStatus.trialEndsAt).getTime();
          isInTrialPeriod = endsAt > Date.now();
        }
        
        // 检查是否是VIP
        const vipData = await chrome.storage.local.get('vipStatus');
        const vipStatus = vipData.vipStatus;
        const isVip = vipStatus && vipStatus.isVip;
        
        if (isInTrialPeriod || isVip) {
          // 体验期内或VIP用户：100个
          return 100;
        } else {
          // 体验期结束且非VIP的普通用户：返回 null 让服务器获取最新状态
          return null;
        }
      } catch (e) {
        // 获取状态失败时，返回 null 让系统从服务器获取
        return null;
      }
    }

    return null;
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
