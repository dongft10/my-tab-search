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
}

// 导出单例实例
const authApi = new AuthApi();

export default authApi;
export { AuthApi };
