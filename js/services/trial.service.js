/**
 * 体验期管理服务
 * 处理体验期的显示和延展
 */

import authApi from '../api/auth.js';
import authService from './auth.service.js';

class TrialService {
  constructor() {
    this.storageKey = 'mytabsearch_trial_status';
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
   * 获取有效的访问令牌
   * @returns {Promise<string|null>} - 返回访问令牌
   */
  async getValidAccessToken() {
    return await authService.getValidAccessToken();
  }

  /**
   * 从服务器获取体验期状态
   * @returns {Promise<object>} - 返回体验期状态
   */
  async fetchTrialStatus() {
    try {
      const accessToken = await this.getValidAccessToken();
      if (!accessToken) {
        throw new Error('No access token');
      }

      const response = await authApi.getTrialStatus(accessToken);
      
      if (response.data.code === 0) {
        const trialData = response.data.data;
        await this.saveTrialStatus(trialData);
        return trialData;
      }

      throw new Error(response.data.message || 'Failed to get trial status');
    } catch (error) {
      console.error('Fetch trial status error:', error);
      // 返回本地状态
      return await this.getLocalTrialStatus();
    }
  }

  /**
   * 获取体验期状态（优先使用本地，必要时从服务器获取）
   * @returns {Promise<object>} - 返回体验期状态
   */
  async getTrialStatus() {
    try {
      const localStatus = await this.getLocalTrialStatus();
      
      // 如果本地没有状态，需要获取
      if (!localStatus) {
        return await this.fetchTrialStatus();
      }

      // 检查是否过期
      if (localStatus.trialEndsAt) {
        const endsAt = new Date(localStatus.trialEndsAt).getTime();
        if (endsAt < Date.now()) {
          localStatus.isInTrialPeriod = false;
          localStatus.trialDaysLeft = 0;
        }
      }

      // 后台刷新状态
      this.fetchTrialStatus();

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
      const accessToken = await this.getValidAccessToken();
      if (!accessToken) {
        throw new Error('No access token');
      }

      const response = await authApi.extendTrial(accessToken);
      
      if (response.data.code === 0) {
        const extendData = response.data.data;
        
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

      throw new Error(response.data.message || 'Failed to extend trial');
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
