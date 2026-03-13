/**
 * 认证相关 API
 * 处理静默注册、Token 获取和撤销等操作
 */

import apiClient from './client.js';
import { API_CONFIG } from '../config.js';
import { versionManager } from '../utils/version-manager.js';

const { ENDPOINTS } = API_CONFIG;

class AuthApi {
  /**
   * 静默注册
   * @param {object} deviceInfo - 设备信息
   * @returns {Promise} - 返回注册结果
   */
  async silentRegister(deviceInfo) {
    // 直接从 storage 获取 deviceId，不通过 authService
    let deviceId = null;
    try {
      const result = await chrome.storage.local.get(['deviceId']);
      deviceId = result.deviceId || null;
      console.log('[silentRegister] Got deviceId from storage:', deviceId ? 'exists' : 'null');
    } catch (e) {
      console.warn('Failed to get deviceId from storage:', e);
    }
    
    const data = { ...deviceInfo };
    
    const headers = {};
    
    // 如果有 deviceId，通过 Header 传递给后端
    if (deviceId) {
      headers['X-Device-ID'] = deviceId;
      console.log('[silentRegister] Sending X-Device-ID header:', deviceId);
    } else {
      console.log('[silentRegister] No deviceId found, will create new device');
    }
    
    return apiClient.post(ENDPOINTS.AUTH.SILENT_REGISTER, data, headers);
  }

  /**
   * 验证邮箱验证码（关联设备）
   * @param {string} email - 邮箱地址
   * @param {string} code - 验证码
   * @param {string} deviceId - 设备ID（可选，用于关联现有设备）
   * @param {Object} deviceInfo - 设备信息（可选，包含 browserInfo）
   * @returns {Promise} - 返回验证结果
   */
  async verifyEmail(email, code, deviceId = null, deviceInfo = null) {
    const data = { email, code };
    if (deviceId) {
      data.deviceId = deviceId;
    }
    if (deviceInfo) {
      data.browserInfo = deviceInfo.browserInfo;
      data.extensionVersion = deviceInfo.extensionVersion;
    }
    return apiClient.post(ENDPOINTS.AUTH.VERIFY_EMAIL, data);
  }

  /**
   * 撤销令牌
   * @param {string} accessToken - 访问令牌
   * @returns {Promise} - 返回结果
   */
  async revokeToken(accessToken) {
    return apiClient.post(ENDPOINTS.AUTH.REVOKE_TOKEN, {
      accessToken
    });
  }

  /**
   * 验证令牌
   * @param {string} accessToken - 访问令牌
   * @returns {Promise} - 返回验证结果
   */
  async validateToken(accessToken) {
    return apiClient.get(ENDPOINTS.AUTH.VALIDATE_TOKEN, {
      'Authorization': `Bearer ${accessToken}`
    });
  }

  /**
   * 刷新访问令牌
   * @param {string} accessToken - 当前访问令牌
   * @returns {Promise} - 返回新的令牌
   */
  async refreshToken(accessToken) {
    return apiClient.post(ENDPOINTS.AUTH.REFRESH_TOKEN, {
      accessToken
    });
  }

  /**
   * 发送邮箱验证码
   * @param {string} email - 邮箱地址
   * @returns {Promise} - 返回发送结果
   */
  async sendVerificationCode(email) {
    return apiClient.post(ENDPOINTS.AUTH.SEND_VERIFICATION, {
      email
    });
  }

  /**
   * 获取访问令牌
   * @param {string} userId - 用户ID
   * @param {string} deviceId - 设备ID
   * @returns {Promise} - 返回令牌
   */
  async getToken(userId, deviceId) {
    return apiClient.post(ENDPOINTS.AUTH.GET_TOKEN, {
      userId,
      deviceId
    });
  }

  /**
   * 获取用户资料
   * @param {string} accessToken - 访问令牌
   * @returns {Promise} - 返回用户资料
   */
  async getUserProfile(accessToken) {
    return apiClient.get(ENDPOINTS.USER.PROFILE, {
      'Authorization': `Bearer ${accessToken}`
    });
  }

  /**
   * 获取VIP状态
   * @param {string} accessToken - 访问令牌
   * @returns {Promise} - 返回VIP状态
   */
  async getVipStatus(accessToken) {
    return apiClient.get(ENDPOINTS.VIP.STATUS, {
      'Authorization': `Bearer ${accessToken}`
    });
  }

  /**
   * 同步VIP状态
   * @param {string} accessToken - 访问令牌
   * @param {string} lastSyncAt - 上次同步时间
   * @returns {Promise} - 返回同步结果
   */
  async syncVipStatus(accessToken, lastSyncAt) {
    return apiClient.post(ENDPOINTS.VIP.SYNC, {
      lastSyncAt
    }, {
      'Authorization': `Bearer ${accessToken}`
    });
  }

  /**
   * 获取体验期状态
   * @param {string} accessToken - 访问令牌
   * @returns {Promise} - 返回体验期状态
   */
  async getTrialStatus(accessToken) {
    return apiClient.get(ENDPOINTS.TRIAL.STATUS, {
      'Authorization': `Bearer ${accessToken}`
    });
  }

  /**
   * 延展体验期
   * @param {string} accessToken - 访问令牌
   * @returns {Promise} - 返回延展结果
   */
  async extendTrial(accessToken) {
    return apiClient.post(ENDPOINTS.TRIAL.EXTEND, {
      confirm: true
    }, {
      'Authorization': `Bearer ${accessToken}`
    });
  }

  /**
   * 获取用户功能限制
   * @param {string} accessToken - 访问令牌
   * @returns {Promise} - 返回功能限制
   */
  async getUserLimits(accessToken) {
    return apiClient.get(ENDPOINTS.USER.LIMITS, {
      'Authorization': `Bearer ${accessToken}`
    });
  }

  /**
   * 检查功能访问权限
   * @param {string} accessToken - 访问令牌
   * @param {string} feature - 功能ID
   * @returns {Promise} - 返回权限检查结果
   */
  async checkFeatureAccess(accessToken, feature) {
    return apiClient.get(`${ENDPOINTS.USER.FEATURE}/${feature}`, {
      'Authorization': `Bearer ${accessToken}`
    });
  }

  /**
   * 获取设备列表
   * @param {string} accessToken - 访问令牌
   * @returns {Promise} - 返回设备列表
   */
  async getDevices(accessToken) {
    return apiClient.get(ENDPOINTS.DEVICES.LIST, {
      'Authorization': `Bearer ${accessToken}`
    });
  }

  /**
   * 删除设备
   * @param {string} accessToken - 访问令牌
   * @param {string} deviceId - 设备ID
   * @returns {Promise} - 返回删除结果
   */
  async deleteDevice(accessToken, deviceId) {
    return apiClient.delete(`${ENDPOINTS.DEVICES.DELETE}/${deviceId}`, {
      'Authorization': `Bearer ${accessToken}`
    });
  }

  /**
   * 当前设备登出
   * @param {string} accessToken - 访问令牌
   * @returns {Promise} - 返回登出结果
    */
  async logoutDevice(accessToken) {
    const headers = {
      'Authorization': `Bearer ${accessToken}`
    };
    return apiClient.post(ENDPOINTS.DEVICES.LOGOUT_ALL, {}, headers);
  }

  /**
   * 上报设备活跃度
   * @param {string} deviceId - 设备 ID
   * @returns {Promise} - 返回上报结果
   */
  async reportDeviceActive(deviceId) {
    return apiClient.patch(ENDPOINTS.DEVICES.ACTIVE, {}, { 'X-Device-ID': deviceId });
  }

  /**
   * 验证 OAuth code 并获取 token
   * @param {string} provider - OAuth 提供商 (google/microsoft)
   * @param {string} code - OAuth 授权码
   * @returns {Promise} - 返回验证结果
   */
  async verifyOAuthCode(provider, code) {
    // 获取本地存储的 deviceId
    let deviceId = null;
    try {
      const authService = await import('../services/auth.service.js');
      const userInfo = await authService.default.getUserInfo();
      deviceId = userInfo[authService.default.storageKey.deviceId];
    } catch (e) {
      console.warn('Failed to get deviceId from storage:', e);
    }
    
    const data = {
      provider,
      code
    };
    
    const headers = {};
    
    // 如果有 deviceId，通过 Header 传递给后端
    if (deviceId) {
      headers['X-Device-ID'] = deviceId;
    }
    
    return apiClient.post(ENDPOINTS.AUTH.OAUTH_VERIFY, data, headers);
  }

  /**
   * 验证 OAuth token 并登录
   * @param {string} provider - OAuth 提供商 (google/microsoft)
   * @param {string} accessToken - OAuth access token
   * @param {object} userInfo - 用户信息
   * @returns {Promise} - 返回验证结果
   */
  async verifyOAuthToken(provider, accessToken, userInfo) {
    const data = {
      provider,
      accessToken,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture
    };
    
    // 获取浏览器信息并添加到 headers
    const userAgent = navigator.userAgent;
    const browserInfo = this.parseUserAgent(userAgent);
    
    // 获取本地存储的 deviceId
    let deviceId = null;
    try {
      const authService = await import('../services/auth.service.js');
      const storedUserInfo = await authService.default.getUserInfo();
      deviceId = storedUserInfo[authService.default.storageKey.deviceId];
    } catch (e) {
      console.warn('Failed to get deviceId from storage:', e);
    }
    
    const headers = {
      'X-Browser-Name': browserInfo.name,
      'X-Browser-Version': browserInfo.version,
      'X-Platform': browserInfo.platform,
      'X-Language': navigator.language,
      'X-Extension-Version': await versionManager.getVersion()
    };
    
    // 如果有 deviceId，传递给后端
    if (deviceId) {
      headers['X-Device-ID'] = deviceId;
    }
    
    return apiClient.post(ENDPOINTS.AUTH.OAUTH_TOKEN_LOGIN, data, headers);
  }

  /**
   * 解析 User-Agent 获取浏览器信息
   * @param {string} userAgent - User-Agent 字符串
   * @returns {object} - 返回浏览器信息 {name, version, platform}
   */
  parseUserAgent(userAgent) {
    let name = 'Chrome';
    let version = '';
    let platform = 'Unknown';
    
    // 更精确的浏览器检测顺序（避免误判）
    // Edge 必须在 Chrome 之前检测（因为 Edge 也包含 Chrome）
    if (userAgent.includes('Edg/')) {
      name = 'Edge';
      const match = userAgent.match(/Edg\/([\d.]+)/);
      if (match) version = match[1];
    } 
    // Firefox
    else if (userAgent.includes('Firefox/')) {
      name = 'Firefox';
      const match = userAgent.match(/Firefox\/([\d.]+)/);
      if (match) version = match[1];
    } 
    // Opera (包含 OPR/ 或 Opera)
    else if (userAgent.includes('OPR/')) {
      name = 'Opera';
      const match = userAgent.match(/OPR\/([\d.]+)/);
      if (match) version = match[1];
    } 
    else if (userAgent.includes('Opera')) {
      name = 'Opera';
      const match = userAgent.match(/Version\/([\d.]+)/);
      if (match) version = match[1];
    }
    // Safari (必须在 Chrome 之前检测，因为 Safari 不包含 Chrome 但可能被误判)
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      name = 'Safari';
      const match = userAgent.match(/Version\/([\d.]+)/);
      if (match) version = match[1];
    }
    // Chrome
    else if (userAgent.includes('Chrome')) {
      name = 'Chrome';
      const match = userAgent.match(/Chrome\/([\d.]+)/);
      if (match) version = match[1];
    }
    
    // 检测操作系统（更精确的匹配）
    if (userAgent.includes('Windows NT')) {
      platform = 'Windows';
    } else if (userAgent.includes('Mac OS X')) {
      platform = 'macOS';
    } else if (userAgent.includes('Linux')) {
      platform = 'Linux';
    } else if (userAgent.includes('Android')) {
      platform = 'Android';
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad') || userAgent.includes('iPod')) {
      platform = 'iOS';
    }
    
    return { name, version, platform };
  }

  /**
   * 同步固定Tab到服务器
   * @param {string} accessToken - 访问令牌
   * @param {object} tabData - Tab数据
   * @returns {Promise} - 返回同步结果
   */
  async syncPinnedTab(accessToken, tabData) {
    return apiClient.post(ENDPOINTS.PINNED_TABS.SYNC, {
      action: 'add',
      tab: tabData
    }, {
      'Authorization': `Bearer ${accessToken}`
    });
  }

  /**
   * 同步取消固定Tab到服务器
   * @param {string} accessToken - 访问令牌
   * @param {string} tabId - Tab ID
   * @returns {Promise} - 返回同步结果
   */
  async syncUnpinTab(accessToken, tabId) {
    return apiClient.post(ENDPOINTS.PINNED_TABS.SYNC, {
      action: 'remove',
      tabId: tabId
    }, {
      'Authorization': `Bearer ${accessToken}`
    });
  }

  /**
   * 同步更新固定Tab到服务器
   * @param {string} accessToken - 访问令牌
   * @param {object} tabData - Tab数据
   * @returns {Promise} - 返回同步结果
   */
  async syncUpdateTab(accessToken, tabData) {
    return apiClient.post(ENDPOINTS.PINNED_TABS.SYNC, {
      action: 'update',
      tab: tabData
    }, {
      'Authorization': `Bearer ${accessToken}`
    });
  }
}

// 导出单例实例
const authApi = new AuthApi();

export default authApi;
export { AuthApi };
