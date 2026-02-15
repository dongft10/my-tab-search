/**
 * 认证相关 API
 * 处理静默注册、Token 获取和撤销等操作
 */

import apiClient from './client.js';

class AuthApi {
  /**
   * 静默注册
   * @param {object} deviceInfo - 设备信息
   * @returns {Promise} - 返回注册结果
   */
  async silentRegister(deviceInfo) {
    return apiClient.post('/api/v1/auth/silent-register', deviceInfo);
  }

  /**
   * 获取访问令牌
   * @param {string} userId - 用户 ID
   * @param {string} deviceId - 设备 ID
   * @returns {Promise} - 返回令牌
   */
  async getToken(userId, deviceId) {
    return apiClient.post('/api/v1/auth/token', {
      userId,
      deviceId
    });
  }

  /**
   * 撤销令牌
   * @param {string} accessToken - 访问令牌
   * @returns {Promise} - 返回结果
   */
  async revokeToken(accessToken) {
    return apiClient.post('/api/v1/auth/revoke', {
      accessToken
    });
  }

  /**
   * 验证令牌
   * @param {string} accessToken - 访问令牌
   * @returns {Promise} - 返回验证结果
   */
  async validateToken(accessToken) {
    return apiClient.get('/api/v1/auth/validate', {
      'Authorization': `Bearer ${accessToken}`
    });
  }

  /**
   * 刷新访问令牌
   * @param {string} accessToken - 当前访问令牌
   * @returns {Promise} - 返回新的令牌
   */
  async refreshToken(accessToken) {
    return apiClient.post('/api/v1/auth/refresh', {
      accessToken
    });
  }

  /**
   * 发送邮箱验证码
   * @param {string} email - 邮箱地址
   * @returns {Promise} - 返回发送结果
   */
  async sendVerificationCode(email) {
    return apiClient.post('/api/v1/auth/send-verification', {
      email
    });
  }

  /**
   * 验证邮箱验证码
   * @param {string} email - 邮箱地址
   * @param {string} code - 验证码
   * @param {string} deviceId - 设备ID（可选，用于关联现有设备）
   * @returns {Promise} - 返回验证结果
   */
  async verifyEmail(email, code, deviceId = null) {
    const data = { email, code };
    if (deviceId) {
      data.deviceId = deviceId;
    }
    return apiClient.post('/api/v1/auth/verify-email', data);
  }

  /**
   * 获取用户资料
   * @param {string} accessToken - 访问令牌
   * @returns {Promise} - 返回用户资料
   */
  async getUserProfile(accessToken) {
    return apiClient.get('/api/v1/user/profile', {
      'Authorization': `Bearer ${accessToken}`
    });
  }

  /**
   * 获取VIP状态
   * @param {string} accessToken - 访问令牌
   * @returns {Promise} - 返回VIP状态
   */
  async getVipStatus(accessToken) {
    return apiClient.get('/api/v1/vip/status', {
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
    return apiClient.post('/api/v1/vip/sync', {
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
    return apiClient.get('/api/v1/trial/status', {
      'Authorization': `Bearer ${accessToken}`
    });
  }

  /**
   * 延展体验期
   * @param {string} accessToken - 访问令牌
   * @returns {Promise} - 返回延展结果
   */
  async extendTrial(accessToken) {
    return apiClient.post('/api/v1/trial/extend', {
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
    return apiClient.get('/api/v1/user/limits', {
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
    return apiClient.get(`/api/v1/user/feature/${feature}`, {
      'Authorization': `Bearer ${accessToken}`
    });
  }

  /**
   * 获取设备列表
   * @param {string} accessToken - 访问令牌
   * @returns {Promise} - 返回设备列表
   */
  async getDevices(accessToken) {
    return apiClient.get('/api/v1/devices', {
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
    return apiClient.delete(`/api/v1/devices/${deviceId}`, {
      'Authorization': `Bearer ${accessToken}`
    });
  }

  /**
   * 当前设备登出
   * @param {string} accessToken - 访问令牌
   * @returns {Promise} - 返回登出结果
   */
  async logoutDevice(accessToken) {
    return apiClient.post('/api/v1/devices/logout', {}, {
      'Authorization': `Bearer ${accessToken}`
    });
  }
}

// 导出单例实例
const authApi = new AuthApi();

export default authApi;
export { AuthApi };
