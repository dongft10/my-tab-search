/**
 * 认证服务
 * 处理认证相关的业务逻辑
 */

import authApi from '../api/auth.js';
import fingerprintUtil from '../utils/fingerprint.js';

class AuthService {
  constructor() {
    this.storageKey = {
      userId: 'mytabsearch_user_id',
      deviceId: 'mytabsearch_device_id',
      accessToken: 'mytabsearch_access_token',
      registeredAt: 'mytabsearch_registered_at'
    };
  }

  /**
   * 静默注册
   * @returns {Promise} - 返回注册结果
   */
  async silentRegister() {
    try {
      // 检查是否已注册
      const isRegistered = await this.isRegistered();
      if (isRegistered) {
        console.log('Already registered, skipping...');
        return await this.getUserInfo();
      }

      // 生成设备指纹
      const deviceFingerprint = await fingerprintUtil.generate();

      // 获取浏览器信息
      const browserInfo = this.getBrowserInfo();

      // 获取扩展版本
      const extensionVersion = chrome.runtime.getManifest().version;

      // 发送注册请求
      const response = await authApi.silentRegister({
        deviceFingerprint,
        browserInfo,
        extensionVersion
      });

      // 存储用户信息
      await this.saveUserInfo({
        userId: response.data.userId,
        deviceId: response.data.deviceId,
        registeredAt: response.data.createdAt
      });

      console.log('Silent registration successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('Silent registration failed:', error);
      // 注册失败不影响扩展使用
      return null;
    }
  }

  /**
   * 获取访问令牌
   * @returns {Promise} - 返回令牌
   */
  async getAccessToken() {
    try {
      const userInfo = await this.getUserInfo();
      if (!userInfo || !userInfo.userId || !userInfo.deviceId) {
        throw new Error('User not registered');
      }

      const response = await authApi.getToken(userInfo.userId, userInfo.deviceId);
      const accessToken = response.data.accessToken;

      // 存储访问令牌
      await chrome.storage.local.set({
        [this.storageKey.accessToken]: accessToken
      });

      return accessToken;
    } catch (error) {
      console.error('Failed to get access token:', error);
      throw error;
    }
  }

  /**
   * 登出
   * @returns {Promise} - 返回结果
   */
  async logout() {
    try {
      // 获取当前令牌
      const { accessToken } = await chrome.storage.local.get(this.storageKey.accessToken);
      
      // 撤销令牌
      if (accessToken) {
        await authApi.revokeToken(accessToken);
      }

      // 清除存储的信息
      await chrome.storage.local.remove([
        this.storageKey.userId,
        this.storageKey.deviceId,
        this.storageKey.accessToken,
        this.storageKey.registeredAt
      ]);

      console.log('Logout successful');
      return true;
    } catch (error) {
      console.error('Logout failed:', error);
      // 即使失败也清除本地存储
      await chrome.storage.local.remove([
        this.storageKey.userId,
        this.storageKey.deviceId,
        this.storageKey.accessToken,
        this.storageKey.registeredAt
      ]);
      return false;
    }
  }

  /**
   * 检查是否已注册
   * @returns {Promise} - 返回注册状态
   */
  async isRegistered() {
    const { userId, deviceId } = await chrome.storage.local.get([
      this.storageKey.userId,
      this.storageKey.deviceId
    ]);
    return !!userId && !!deviceId;
  }

  /**
   * 获取用户信息
   * @returns {Promise} - 返回用户信息
   */
  async getUserInfo() {
    const userInfo = await chrome.storage.local.get([
      this.storageKey.userId,
      this.storageKey.deviceId,
      this.storageKey.accessToken,
      this.storageKey.registeredAt
    ]);
    return userInfo;
  }

  /**
   * 保存用户信息
   * @param {object} userInfo - 用户信息
   * @returns {Promise} - 返回结果
   */
  async saveUserInfo(userInfo) {
    const storageData = {};
    
    if (userInfo.userId) {
      storageData[this.storageKey.userId] = userInfo.userId;
    }
    if (userInfo.deviceId) {
      storageData[this.storageKey.deviceId] = userInfo.deviceId;
    }
    if (userInfo.accessToken) {
      storageData[this.storageKey.accessToken] = userInfo.accessToken;
    }
    if (userInfo.registeredAt) {
      storageData[this.storageKey.registeredAt] = userInfo.registeredAt;
    }

    return chrome.storage.local.set(storageData);
  }

  /**
   * 获取浏览器信息
   * @returns {object} - 浏览器信息
   */
  getBrowserInfo() {
    const ua = navigator.userAgent;
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';
    let platform = navigator.platform;
    let language = navigator.language || navigator.userLanguage;

    // 检测浏览器
    if (ua.includes('Chrome') && !ua.includes('Edg')) {
      browserName = 'Chrome';
      browserVersion = ua.match(/Chrome\/(\d+\.\d+)/)[1];
    } else if (ua.includes('Edg')) {
      browserName = 'Edge';
      browserVersion = ua.match(/Edg\/(\d+\.\d+)/)[1];
    } else if (ua.includes('Firefox')) {
      browserName = 'Firefox';
      browserVersion = ua.match(/Firefox\/(\d+\.\d+)/)[1];
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
      browserName = 'Safari';
      browserVersion = ua.match(/Version\/(\d+\.\d+)/)[1];
    }

    return {
      name: browserName,
      version: browserVersion,
      platform,
      language
    };
  }

  /**
   * 获取认证头
   * @returns {Promise} - 返回认证头
   */
  async getAuthHeaders() {
    const { accessToken } = await chrome.storage.local.get(this.storageKey.accessToken);
    if (!accessToken) {
      // 如果没有令牌，尝试获取
      await this.getAccessToken();
      const { accessToken: newToken } = await chrome.storage.local.get(this.storageKey.accessToken);
      if (newToken) {
        return { 'Authorization': `Bearer ${newToken}` };
      }
      return {};
    }
    return { 'Authorization': `Bearer ${accessToken}` };
  }
}

// 导出单例实例
const authService = new AuthService();

export default authService;
export { AuthService };
