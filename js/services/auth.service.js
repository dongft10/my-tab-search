/**
 * 认证服务
 * 处理认证相关的业务逻辑
 */

import authApi from '../api/auth.js';

class AuthService {
  constructor() {
    this.storageKey = {
      userId: 'userId',
      deviceId: 'deviceId',
      accessToken: 'accessToken',
      tokenExpiresAt: 'tokenExpiresAt',
      registeredAt: 'registeredAt'
    };
    // Token 刷新提前时间（过期前 5 天）
    this.refreshThreshold = 5 * 24 * 60 * 60 * 1000; // 5天，单位毫秒
    // Token 请求去重：防止并发请求
    this._tokenRequestPromise = null;
    // Token 请求失败缓存：避免短时间内重复请求失败的接口
    this._lastTokenError = null;
    this._lastTokenErrorTime = 0;
    this._errorCooldown = 30000; // 失败后30秒内不再尝试
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

      // 获取浏览器信息
      const browserInfo = this.getBrowserInfo();

      // 获取扩展版本
      const extensionVersion = chrome.runtime.getManifest().version;

      // 发送注册请求
      const response = await authApi.silentRegister({
        browserInfo,
        extensionVersion
      });

      // 存储用户信息（静默注册不设置 registeredAt）
      await this.saveUserInfo({
        userId: response.data.userId,
        deviceId: response.data.deviceId
        // 注意：不设置 registeredAt，只有邮箱验证或OAuth登录后才设置
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
   * 获取访问令牌（带去重机制）
   * @returns {Promise} - 返回令牌
   */
  async getAccessToken() {
    // 如果已有正在进行的请求，复用它
    if (this._tokenRequestPromise) {
      return this._tokenRequestPromise;
    }

    this._tokenRequestPromise = this._doGetAccessToken();
    
    try {
      const result = await this._tokenRequestPromise;
      return result;
    } finally {
      this._tokenRequestPromise = null;
    }
  }

  /**
   * 内部方法：实际获取访问令牌
   * @returns {Promise} - 返回令牌
   */
  async _doGetAccessToken() {
    try {
      // 检查是否在错误冷却期内
      if (this._lastTokenError && (Date.now() - this._lastTokenErrorTime) < this._errorCooldown) {
        console.log('Token request in cooldown period, skipping');
        return null;
      }

      // 检查用户是否已完成邮箱验证
      const isVerified = await this.isEmailVerified();
      if (!isVerified) {
        console.log('User not verified, skipping token request');
        return null;
      }

      const userInfo = await this.getUserInfo();
      if (!userInfo || !userInfo.userId || !userInfo.deviceId) {
        return null;
      }

      const response = await authApi.getToken(userInfo.userId, userInfo.deviceId);
      const data = response.data;
      const accessToken = data.accessToken;
      const expiresAt = data.expiresAt;

      const storageData = {
        [this.storageKey.accessToken]: accessToken,
        [this.storageKey.tokenExpiresAt]: expiresAt
      };

      await chrome.storage.local.set(storageData);

      // 重置错误状态
      this._lastTokenError = null;
      this._lastTokenErrorTime = 0;

      return accessToken;
    } catch (error) {
      console.warn('Failed to get access token:', error);
      // 记录错误信息和时间
      this._lastTokenError = error;
      this._lastTokenErrorTime = Date.now();
      return null;
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
    const result = await chrome.storage.local.get([
      this.storageKey.userId,
      this.storageKey.deviceId,
      this.storageKey.accessToken,
      this.storageKey.registeredAt
    ]);
    // 只要有 userId 或 accessToken 或 registeredAt 任一存在，即认为已注册/登录
    const userId = result[this.storageKey.userId];
    const accessToken = result[this.storageKey.accessToken];
    const registeredAt = result[this.storageKey.registeredAt];
    return !!(userId || accessToken || registeredAt);
  }

  /**
   * 检查是否已完成邮箱验证或OAuth登录
   * 区别于 isRegistered：静默注册用户 isRegistered=true 但 isEmailVerified=false
   * @returns {Promise<boolean>} - 返回是否已完成验证
   */
  async isEmailVerified() {
    const result = await chrome.storage.local.get(this.storageKey.registeredAt);
    return !!(result[this.storageKey.registeredAt]);
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

  /**
   * 检查 Token 是否需要刷新
   * @returns {Promise<boolean>} - 是否需要刷新
   */
  async shouldRefreshToken() {
    const { accessToken, tokenExpiresAt } = await chrome.storage.local.get([
      this.storageKey.accessToken,
      this.storageKey.tokenExpiresAt
    ]);

    if (!accessToken || !tokenExpiresAt) {
      return false;
    }

    const expiresAt = new Date(tokenExpiresAt).getTime();
    const now = Date.now();
    
    // 如果 Token 将在 x 天内过期，需要刷新
    return expiresAt - now < this.refreshThreshold;
  }

  /**
   * 刷新访问令牌
   * @returns {Promise<string|null>} - 返回新的令牌
   */
  async refreshAccessToken() {
    try {
      const { accessToken } = await chrome.storage.local.get(this.storageKey.accessToken);
      if (!accessToken) {
        throw new Error('No token to refresh');
      }

      const response = await authApi.refreshToken(accessToken);
      const newToken = response.data.accessToken;
      const newExpiresAt = response.data.expiresAt;

      // 存储新令牌
      await chrome.storage.local.set({
        [this.storageKey.accessToken]: newToken,
        [this.storageKey.tokenExpiresAt]: newExpiresAt
      });

      console.log('Token refreshed successfully');
      return newToken;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      // 刷新失败时清除存储，下次重新获取
      await chrome.storage.local.remove([
        this.storageKey.accessToken,
        this.storageKey.tokenExpiresAt
      ]);
      return null;
    }
  }

  /**
   * 获取有效的访问令牌（自动刷新或获取新token）
   * @returns {Promise<string|null>} - 返回有效的令牌
   */
  async getValidAccessToken() {
    const { accessToken, tokenExpiresAt } = await chrome.storage.local.get([
      this.storageKey.accessToken,
      this.storageKey.tokenExpiresAt
    ]);
    
    // 如果有token且未过期，直接返回
    if (accessToken && tokenExpiresAt) {
      const expiresAt = new Date(tokenExpiresAt).getTime();
      if (expiresAt > Date.now()) {
        return accessToken;
      }
    }
    
    // token不存在或已过期，尝试刷新或获取新token
    try {
      // 先尝试刷新现有token
      if (accessToken) {
        const needsRefresh = await this.shouldRefreshToken();
        if (needsRefresh) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            return refreshed;
          }
        }
      }
      
      // 刷新失败或没有token，获取新token
      return await this.getAccessToken();
    } catch (e) {
      console.error('Failed to get valid access token:', e);
      return null;
    }
  }
}

// 导出单例实例
const authService = new AuthService();

export default authService;
export { AuthService };
