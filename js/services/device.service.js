/**
 * 设备管理服务
 * 处理设备列表、删除设备、设备登出等功能
 */

import authApi from '../api/auth.js';
import authService from './auth.service.js';
import vipService from './vip.service.js';
import featureLimitService from './feature-limit.service.js';
import pinnedTabsService from './pinned-tabs.service.js';

class DeviceService {
  constructor() {
    this.storageKey = 'devices';
    this.cacheTimeout = 5 * 60 * 1000; // 5分钟缓存
    this.cachedDevices = null;
    this.cacheTime = null;
  }

  /**
   * 获取本地缓存的设备列表
   * @returns {Promise<Array|null>} - 返回缓存的设备列表
   */
  async getLocalDevices() {
    try {
      const data = await chrome.storage.local.get(this.storageKey);
      return data[this.storageKey] || null;
    } catch (error) {
      console.error('Get local devices error:', error);
      return null;
    }
  }

  /**
   * 保存设备列表到本地
   * @param {Array} devices - 设备列表
   * @returns {Promise} - 返回保存结果
   */
  async saveDevices(devices) {
    try {
      const data = {
        devices: devices,
        cachedAt: new Date().toISOString()
      };
      await chrome.storage.local.set({
        [this.storageKey]: data
      });
      this.cachedDevices = devices;
      this.cacheTime = Date.now();
    } catch (error) {
      console.error('Save devices error:', error);
    }
  }

  /**
   * 从服务器获取设备列表
   * @returns {Promise<Array>} - 返回设备列表
   */
  async fetchDevicesFromServer() {
    try {
      const accessToken = await authService.getValidAccessToken();
      if (!accessToken) {
        throw new Error('No access token');
      }

      // 检查是否有 deviceId，如果没有（邮箱登录），直接返回空列表
      const userInfo = await authService.getUserInfo();
      const deviceId = userInfo?.[authService.storageKey.deviceId];
      if (!deviceId) {
        return [];
      }

      const response = await authApi.getDevices(accessToken);
      
      // 兼容两种响应格式: {code: 0, data: {...}} 或 {success: true, ...}
      const isSuccess = response?.code === 0 || response?.success === true;
      
      if (isSuccess) {
        const data = response.data?.data || response.data;
        const devices = data?.devices || [];
        await this.saveDevices(devices);
        return devices;
      }

      throw new Error(response.data?.msg || response.data?.message || 'Failed to fetch devices');
    } catch (error) {
      console.error('Fetch devices error:', error);
      throw error;
    }
  }

  /**
   * 获取设备列表（优先使用缓存）
   * @returns {Promise<Array>} - 返回设备列表
   */
  async getDevices() {
    try {
      // 检查缓存
      if (this.cachedDevices && this.cacheTime) {
        const elapsed = Date.now() - this.cacheTime;
        if (elapsed < this.cacheTimeout) {
          return this.cachedDevices;
        }
      }

      // 尝试从本地存储获取
      const localData = await this.getLocalDevices();
      if (localData) {
        const cachedAt = localData.cachedAt ? new Date(localData.cachedAt).getTime() : 0;
        const elapsed = Date.now() - cachedAt;
        
        if (elapsed < this.cacheTimeout) {
          this.cachedDevices = localData.devices;
          this.cacheTime = cachedAt;
          return localData.devices;
        }
      }

      // 从服务器获取
      return await this.fetchDevicesFromServer();
    } catch (error) {
      console.error('Get devices error:', error);
      // 返回缓存或空列表
      return this.cachedDevices || [];
    }
  }

  /**
   * 刷新设备列表
   * @returns {Promise<Array>} - 返回设备列表
   */
  async refreshDevices() {
    try {
      const devices = await this.fetchDevicesFromServer();
      return devices;
    } catch (error) {
      console.error('Refresh devices error:', error);
      throw error;
    }
  }

  /**
   * 删除指定设备
   * @param {string} deviceId - 设备ID
   * @returns {Promise<{success: boolean, message: string}>} - 返回删除结果
   */
  async deleteDevice(deviceId) {
    try {
      const accessToken = await authService.getValidAccessToken();
      if (!accessToken) {
        throw new Error('No access token');
      }

      const response = await authApi.deleteDevice(accessToken, deviceId);
      
      if (response.code === 0) {
        // 清除缓存
        await this.clearCache();
        // 刷新设备列表
        await this.refreshDevices();
        return {
          success: true,
          message: response.msg || 'Device deleted'
        };
      }

      throw new Error(response.data.msg || 'Failed to delete device');
    } catch (error) {
      console.error('Delete device error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 当前设备登出
   * @returns {Promise<{success: boolean, message: string}>} - 返回登出结果
   */
  async logout() {
    try {
      const accessToken = await authService.getValidAccessToken();
      if (!accessToken) {
        throw new Error('No access token');
      }

      const response = await authApi.logoutDevice(accessToken);
      
      // 兼容两种响应格式
      const isSuccess = response?.code === 0 || response?.success === true;
      
      if (isSuccess) {
        // 清除所有本地存储
        await this.clearLocalData();
        return {
          success: true,
          message: response?.data?.msg || response?.msg || 'Logged out'
        };
      }

      throw new Error(response?.data?.msg || response?.msg || 'Failed to logout');
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 清除本地缓存
   * @returns {Promise} - 返回清除结果
   */
  async clearCache() {
    try {
      await chrome.storage.local.remove(this.storageKey);
      this.cachedDevices = null;
      this.cacheTime = null;
    } catch (error) {
      console.error('Clear cache error:', error);
    }
  }

  /**
   * 清除本地数据（登出时使用）
   * @returns {Promise} - 返回清除结果
   */
  async clearLocalData() {
    try {
      // 清除设备缓存
      await this.clearCache();
      
      // 清除固定标签页
      await pinnedTabsService.clearPinnedTabs();
      
      // 使用 authService 的 storageKey 清除登录相关数据
      const keysToRemove = [
        authService.storageKey.userId,
        authService.storageKey.deviceId,
        authService.storageKey.accessToken,
        authService.storageKey.tokenExpiresAt,
        authService.storageKey.registeredAt,
        vipService.storageKey,
        featureLimitService.storageKey
      ];
      
      await chrome.storage.local.remove(keysToRemove);
    } catch (error) {
      console.error('Clear local data error:', error);
    }
  }

  /**
   * 获取当前设备信息
   * @returns {Promise<object|null>} - 返回当前设备信息
   */
  async getCurrentDevice() {
    try {
      const devices = await this.getDevices();
      return devices.find(d => d.isCurrentDevice) || null;
    } catch (error) {
      console.error('Get current device error:', error);
      return null;
    }
  }

  /**
   * 获取设备数量
   * @returns {Promise<number>} - 返回设备数量
   */
  async getDeviceCount() {
    try {
      const devices = await this.getDevices();
      return devices.length;
    } catch (error) {
      console.error('Get device count error:', error);
      return 0;
    }
  }
}

// 导出单例实例
const deviceService = new DeviceService();

export default deviceService;
export { DeviceService };
