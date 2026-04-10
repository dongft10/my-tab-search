/**
 * 体验期管理服务
 * 处理体验期的显示和延展
 */

import authApi from '../api/auth.js';
import authService from './auth.service.js';
import { getCacheTime } from '../config.js';

class TrialService {
  constructor() {
    this.storageKey = 'trialStatus';
    this.lastSyncAt = null;
    this.syncTimer = null;
    this.pendingRequest = null;
    this._isFetching = false;
    this._requestTimeoutMs = 10000;
    this._lastRefreshAt = 0;           // 上次刷新时间戳
    this._minRefreshIntervalMs = 60000; // 最小刷新间隔 1 分钟
  }

  /**
   * 获取缓存时间
   * @returns {number} - 缓存时间（毫秒）
   */
  getCacheMaxAge() {
    return getCacheTime();
  }

  /**
   * 获取本地体验期状态
   * @returns {Promise<object>} - 返回本地体验期状态
   */
  async getLocalTrialStatus() {
    const data = await chrome.storage.local.get(this.storageKey);
    return data[this.storageKey] || null;
  }

  /**
   * 保存体验期状态到本地
   * @param {object} trialStatus - 体验期状态
   * @returns {Promise} - 返回保存结果
   */
  async saveTrialStatus(trialStatus) {
    const data = {
      ...trialStatus,
      lastUpdateAt: new Date().toISOString()
    };
    
    return chrome.storage.local.set({
      [this.storageKey]: data
    });
  }

  /**
   * 从服务器获取体验期状态
   * @param {boolean} forceRefresh - 是否强制刷新（默认false，缓存超过配置时间才刷新）
   * @returns {Promise<object>} - 返回体验期状态
   */
  async fetchTrialStatus(forceRefresh = false) {
    if (this._isFetching) {
      console.log('[Trial] Reusing pending request');
      return this.pendingRequest;
    }

    this._isFetching = true;
    const requestPromise = this._doFetchTrialStatus(forceRefresh);
    this.pendingRequest = requestPromise;

    try {
      return await requestPromise;
    } finally {
      this._isFetching = false;
      this.pendingRequest = null;
    }
  }

  _withTimeout(promise) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), this._requestTimeoutMs)
      )
    ]);
  }

  async _doFetchTrialStatus(forceRefresh = false) {
    try {
      const localStatus = await this.getLocalTrialStatus();
      const cacheMaxAge = this.getCacheMaxAge();

      // 检查缓存是否超过配置时间
      if (!forceRefresh && localStatus && localStatus.lastUpdateAt) {
        const cacheAge = Date.now() - new Date(localStatus.lastUpdateAt).getTime();
        if (cacheAge < cacheMaxAge) {
          // 缓存未超过配置时间，直接返回本地状态
          // 检查是否过期
          if (localStatus.trialEndsAt) {
            const endsAt = new Date(localStatus.trialEndsAt).getTime();
            if (endsAt < Date.now()) {
              localStatus.isInTrialPeriod = false;
              localStatus.trialDaysLeft = 0;
            }
          }
          // 即使缓存未过期，也检查 trialEndsAt 是否已过期
          if (localStatus.trialEndsAt) {
            const endsAt = new Date(localStatus.trialEndsAt).getTime();
            if (endsAt < Date.now()) {
              localStatus.isInTrialPeriod = false;
              localStatus.trialDaysLeft = 0;
              await this.saveTrialStatus(localStatus);
            }
          }
          console.log('[Trial] Using cached status, cache age:', Math.round(cacheAge / 1000 / 60), 'minutes');
          return localStatus;
        }
      }

      // 缓存超过配置时间或没有缓存，从服务器获取
      const accessToken = await this._withTimeout(authService.getValidAccessToken());
      if (!accessToken) {
        console.log('[Trial] No access token available, skipping fetch');
        return {
          isInTrialPeriod: false,
          trialDaysLeft: 0,
          extendedCount: 0,
          maxExtendCount: 2
        };
      }

      const response = await this._withTimeout(authApi.getTrialStatus(accessToken, forceRefresh));

      if (response.code === 0) {
        const trialData = response.data;
        await this.saveTrialStatus(trialData);
        this._lastRefreshAt = Date.now();
        console.log('[Trial] Fetched fresh status from server');
        return trialData;
      }

      throw new Error(response.msg || 'Failed to get trial status');
    } catch (error) {
      console.error('Fetch trial status error:', error);
      // 返回默认状态而不是 null
      return {
        isInTrialPeriod: false,
        trialDaysLeft: 0,
        extendedCount: 0,
        maxExtendCount: 2
      };
    }
  }

  /**
   * 获取体验期状态（优先使用本地，必要时从服务器获取）
   * @param {boolean} forceRefresh - 是否强制刷新（绕过所有缓存）
   * @returns {Promise<object>} - 返回体验期状态
   */
  async getTrialStatus(forceRefresh = false) {
    try {
      // 强制刷新时，直接从服务器获取
      if (forceRefresh) {
        return await this.fetchTrialStatus(true);
      }

      const localStatus = await this.getLocalTrialStatus();
      const cacheMaxAge = this.getCacheMaxAge();

      // 如果本地没有状态，需要获取
      if (!localStatus) {
        return await this.fetchTrialStatus();
      }

      // 如果有 trialEndsAt，实时计算剩余天数
      if (localStatus.trialEndsAt && localStatus.isInTrialPeriod) {
        const endsAt = new Date(localStatus.trialEndsAt).getTime();
        const now = Date.now();

        if (endsAt > now) {
          // 实时计算剩余天数，而不是使用缓存的值
          const daysLeft = Math.ceil((endsAt - now) / (24 * 60 * 60 * 1000));
          localStatus.trialDaysLeft = daysLeft;
        } else {
          // 已过期
          localStatus.isInTrialPeriod = false;
          localStatus.trialDaysLeft = 0;
          // 更新状态类型（如果后端返回了新字段）
          if (localStatus.statusType === 'active') {
            localStatus.statusType = 'expired';
            localStatus.displayText = '体验期已结束';
          }
          await this.saveTrialStatus(localStatus);
          return localStatus;
        }
      }

      // 检查缓存是否过期
      if (localStatus.lastUpdateAt) {
        const cacheAge = Date.now() - new Date(localStatus.lastUpdateAt).getTime();
        if (cacheAge >= cacheMaxAge) {
          // 缓存已过期，检查是否在冷却期内
          const timeSinceLastRefresh = Date.now() - this._lastRefreshAt;
          if (timeSinceLastRefresh >= this._minRefreshIntervalMs) {
            // 不在冷却期，后台刷新状态（不阻塞 UI）
            this.fetchTrialStatus(true);
          } else {
            console.log('[Trial] Skipping refresh, in cooldown period');
          }
        }
      }

      return localStatus;
    } catch (error) {
      console.error('Get trial status error:', error);
      return {
        isInTrialPeriod: false,
        trialDaysLeft: 0,
        extendedCount: 0,
        maxExtendCount: 2
      };
    }
  }

  /**
   * 延展体验期
   * @returns {Promise<object>} - 返回延展结果
   */
  async extendTrial() {
    try {
      const accessToken = await authService.getValidAccessToken();
      if (!accessToken) {
        throw new Error('No access token');
      }

      const response = await authApi.extendTrial(accessToken);
      
      if (response.code === 0) {
        const extendData = response.data;
        
        // 更新本地状态
        await this.saveTrialStatus({
          isInTrialPeriod: true,
          trialDaysLeft: extendData.trialDaysLeft,
          trialEndsAt: extendData.trialEndsAt,
          extendedCount: extendData.extendedCount,
          canExtend: extendData.extendedCount < 2
        });

        return {
          success: true,
          trialDaysLeft: extendData.trialDaysLeft,
          message: extendData.message
        };
      }

      throw new Error(response.msg || 'Failed to extend trial');
    } catch (error) {
      console.error('Extend trial error:', error);
      return {
        success: false,
        message: error.message || '网络错误，请稍后重试'
      };
    }
  }

  /**
   * 检查是否应该显示体验期提醒
   * @returns {Promise<{shouldShow: boolean, daysLeft: number}>} - 是否显示及剩余天数
   */
  async shouldShowTrialReminder() {
    const status = await this.getTrialStatus();
    
    if (!status.isInTrialPeriod) {
      return { shouldShow: false, daysLeft: 0 };
    }

    // 提前7天显示提醒
    const reminderDays = 7;
    const shouldShow = status.trialDaysLeft <= reminderDays;

    return {
      shouldShow: shouldShow,
      daysLeft: status.trialDaysLeft
    };
  }

  /**
   * 获取体验期剩余天数显示文本
   * @returns {Promise<string>} - 返回显示文本
   */
  async getTrialDaysText() {
    const status = await this.getTrialStatus();
    
    if (!status.isInTrialPeriod) {
      return '';
    }

    if (status.trialDaysLeft === 0) {
      return '体验期今天结束';
    } else if (status.trialDaysLeft === 1) {
      return '体验期剩余1天';
    } else {
      return `体验期剩余${status.trialDaysLeft}天`;
    }
  }

  /**
   * 清除本地体验期状态
   * @returns {Promise} - 返回清除结果
   */
  async clearTrialStatus() {
    return chrome.storage.local.remove(this.storageKey);
  }
}

// 导出单例实例
const trialService = new TrialService();

export default trialService;
export { TrialService };
