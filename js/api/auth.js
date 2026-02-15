/**
 * 认证相关 API
 * 处理静默注册、Token 获取和撤销等操作
 */

import apiClient from './client.js';
import { API_CONFIG } from '../config.js';

const { ENDPOINTS } = API_CONFIG;

class AuthApi {
  /**
   * 静默注册
   * @param {object} deviceInfo - 设备信息
   * @returns {Promise} - 返回注册结果
   */
  async silentRegister(deviceInfo) {
    return apiClient.post(ENDPOINTS.AUTH.SILENT_REGISTER, deviceInfo);
  }

  /**
   * 获取访问令牌
   * @param {string} userId - 用户 ID
   * @param {string} deviceId - 设备 ID
   * @returns {Promise} - 返回令牌
   */
  async getToken(userId, deviceId) {
    return apiClient.post(ENDPOINTS.AUTH.GET_TOKEN, {
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
    return apiClient.post(ENDPOINTS.AUTH.VERIFY_EMAIL, data);
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
    return apiClient.post(ENDPOINTS.DEVICES.LOGOUT_ALL, {}, {
      'Authorization': `Bearer ${accessToken}`
    });
  }
}

// 导出单例实例
const authApi = new AuthApi();

export default authApi;
export { AuthApi };
