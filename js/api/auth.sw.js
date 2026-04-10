/**
 * 认证相关 API
 * 处理静默注册、Token 获取和撤销等操作
 * 
 * 注意：此文件用于 importScripts（Service Worker）
 * popup 等页面请使用 auth.esm.js
 */

// 全局对象引用
const _authFileGlobal = typeof self !== 'undefined' ? self : {};

// 如果已经初始化过，直接跳过
if (typeof _authFileGlobal._authApiInitialized === 'undefined') {
  _authFileGlobal._authApiInitialized = true;

  // 尝试加载全局变量
  var apiClient = _authFileGlobal.apiClient || null;
  var API_CONFIG = _authFileGlobal.API_CONFIG || null;
  var versionManager = _authFileGlobal.versionManager || null;

  // 简单的实现（作为备用）
  if (!apiClient) {
    apiClient = {
      post: async (endpoint, data, headers) => {
        console.error('apiClient not loaded, using mock implementation');
        throw new Error('apiClient not available');
      },
      get: async (endpoint, headers) => {
        console.error('apiClient not loaded, using mock implementation');
        throw new Error('apiClient not available');
      },
      delete: async (endpoint, headers) => {
        console.error('apiClient not loaded, using mock implementation');
        throw new Error('apiClient not available');
      },
      patch: async (endpoint, data, headers) => {
        console.error('apiClient not loaded, using mock implementation');
        throw new Error('apiClient not available');
      }
    };
  }

  if (!API_CONFIG) {
    API_CONFIG = {
      ENDPOINTS: {
        AUTH: {
          SILENT_REGISTER: '/auth/silent-register',
          VERIFY_EMAIL: '/auth/verify-email',
          REVOKE_TOKEN: '/auth/revoke-token',
          VALIDATE_TOKEN: '/auth/validate-token',
          REFRESH_TOKEN: '/auth/refresh-token',
          SEND_VERIFICATION: '/auth/send-verification',
          GET_TOKEN: '/auth/token',
          OAUTH_VERIFY: '/auth/oauth/verify',
          OAUTH_TOKEN_LOGIN: '/auth/oauth/token-login'
        },
        USER: {
          PROFILE: '/user/profile',
          LIMITS: '/user/limits',
          FEATURE: '/user/feature'
        },
        VIP: {
          STATUS: '/vip/status',
          SYNC: '/vip/sync'
        },
        TRIAL: {
          STATUS: '/trial/status',
          EXTEND: '/trial/extend'
        },
        DEVICES: {
          LIST: '/devices',
          DELETE: '/devices',
          LOGOUT_ALL: '/devices/logout-all',
          ACTIVE: '/devices/active'
        },
        PINNED_TABS: {
          SYNC: '/pinned-tabs/sync'
        }
      }
    };
  }

  if (!versionManager) {
    versionManager = {
      getVersion: async () => {
        return chrome.runtime.getManifest().version;
      }
    };
  }

  var ENDPOINTS = API_CONFIG.ENDPOINTS;

  class AuthApi {
    async silentRegister(deviceInfo) {
      let deviceId = null;
      try {
        const result = await chrome.storage.local.get(['deviceId']);
        deviceId = result.deviceId || null;
      } catch (e) {
        console.info('Failed to get deviceId from storage:', e);
      }
      
      const data = { ...deviceInfo };
      const headers = {};
      
      if (deviceId) {
        headers['X-Device-ID'] = deviceId;
      }
      
      return apiClient.post(ENDPOINTS.AUTH.SILENT_REGISTER, data, headers);
    }

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

    async revokeToken(accessToken) {
      return apiClient.post(ENDPOINTS.AUTH.REVOKE_TOKEN, { accessToken });
    }

    async validateToken(accessToken) {
      return apiClient.get(ENDPOINTS.AUTH.VALIDATE_TOKEN, {
        'Authorization': `Bearer ${accessToken}`
      });
    }

    async refreshToken(accessToken) {
      return apiClient.post(ENDPOINTS.AUTH.REFRESH_TOKEN, { accessToken });
    }

    async sendVerificationCode(email) {
      return apiClient.post(ENDPOINTS.AUTH.SEND_VERIFICATION, { email });
    }

    async getToken(userId, deviceId) {
      return apiClient.post(ENDPOINTS.AUTH.GET_TOKEN, { userId, deviceId });
    }

    async getUserProfile(accessToken) {
      return apiClient.get(ENDPOINTS.USER.PROFILE, {
        'Authorization': `Bearer ${accessToken}`
      });
    }

    async getVipStatus(accessToken) {
      return apiClient.get(ENDPOINTS.VIP.STATUS, {
        'Authorization': `Bearer ${accessToken}`
      });
    }

    async syncVipStatus(accessToken, lastSyncAt) {
      return apiClient.post(ENDPOINTS.VIP.SYNC, { lastSyncAt }, {
        'Authorization': `Bearer ${accessToken}`
      });
    }

    async getTrialStatus(accessToken, forceRefresh = false) {
      const url = forceRefresh 
        ? `${ENDPOINTS.TRIAL.STATUS}?force=true` 
        : ENDPOINTS.TRIAL.STATUS;
      return apiClient.get(url, {
        'Authorization': `Bearer ${accessToken}`
      });
    }

    async extendTrial(accessToken) {
      return apiClient.post(ENDPOINTS.TRIAL.EXTEND, { confirm: true }, {
        'Authorization': `Bearer ${accessToken}`
      });
    }

    async getUserLimits(accessToken) {
      return apiClient.get(ENDPOINTS.USER.LIMITS, {
        'Authorization': `Bearer ${accessToken}`
      });
    }

    async checkFeatureAccess(accessToken, feature) {
      return apiClient.get(`${ENDPOINTS.USER.FEATURE}/${feature}`, {
        'Authorization': `Bearer ${accessToken}`
      });
    }

    async getDevices(accessToken) {
      return apiClient.get(ENDPOINTS.DEVICES.LIST, {
        'Authorization': `Bearer ${accessToken}`
      });
    }

    async deleteDevice(accessToken, deviceId) {
      return apiClient.delete(`${ENDPOINTS.DEVICES.DELETE}/${deviceId}`, {
        'Authorization': `Bearer ${accessToken}`
      });
    }

    async logoutDevice(accessToken) {
      return apiClient.post(ENDPOINTS.DEVICES.LOGOUT_ALL, {}, {
        'Authorization': `Bearer ${accessToken}`
      });
    }

    async reportDeviceActive(deviceId) {
      return apiClient.patch(ENDPOINTS.DEVICES.ACTIVE, {}, { 'X-Device-ID': deviceId });
    }

    async verifyOAuthCode(provider, code) {
      let deviceId = null;
      try {
        const result = await chrome.storage.local.get(['deviceId']);
        deviceId = result.deviceId || null;
      } catch (e) {
        console.info('Failed to get deviceId from storage:', e);
      }
      
      const data = { provider, code };
      const headers = {};
      
      if (deviceId) {
        headers['X-Device-ID'] = deviceId;
      }
      
      return apiClient.post(ENDPOINTS.AUTH.OAUTH_VERIFY, data, headers);
    }

    async verifyOAuthToken(provider, accessToken, userInfo) {
      const userAgent = navigator.userAgent;
      const browserInfo = this.parseUserAgent(userAgent);
      
      let deviceId = null;
      try {
        const result = await chrome.storage.local.get(['deviceId']);
        deviceId = result.deviceId || null;
      } catch (e) {
        console.info('Failed to get deviceId from storage:', e);
      }
      
      const data = {
        provider,
        accessToken,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        deviceId: deviceId || undefined,
        browserName: browserInfo.name,
        browserVersion: browserInfo.version,
        platform: browserInfo.platform,
        language: navigator.language,
        extensionVersion: await versionManager.getVersion()
      };
      
      return apiClient.post(ENDPOINTS.AUTH.OAUTH_TOKEN_LOGIN, data);
    }

    parseUserAgent(userAgent) {
      let name = 'Chrome';
      let version = '';
      let platform = 'Unknown';
      
      if (userAgent.includes('Edg/')) {
        name = 'Edge';
        const match = userAgent.match(/Edg\/([\d.]+)/);
        if (match) version = match[1];
      } else if (userAgent.includes('Firefox/')) {
        name = 'Firefox';
        const match = userAgent.match(/Firefox\/([\d.]+)/);
        if (match) version = match[1];
      } else if (userAgent.includes('OPR/')) {
        name = 'Opera';
        const match = userAgent.match(/OPR\/([\d.]+)/);
        if (match) version = match[1];
      } else if (userAgent.includes('Opera')) {
        name = 'Opera';
        const match = userAgent.match(/Version\/([\d.]+)/);
        if (match) version = match[1];
      } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        name = 'Safari';
        const match = userAgent.match(/Version\/([\d.]+)/);
        if (match) version = match[1];
      } else if (userAgent.includes('Chrome')) {
        name = 'Chrome';
        const match = userAgent.match(/Chrome\/([\d.]+)/);
        if (match) version = match[1];
      }
      
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

    async syncPinnedTab(accessToken, tabData) {
      return apiClient.post(ENDPOINTS.PINNED_TABS.SYNC, {
        action: 'add',
        tab: tabData
      }, { 'Authorization': `Bearer ${accessToken}` });
    }

    async syncUnpinTab(accessToken, tabId) {
      return apiClient.post(ENDPOINTS.PINNED_TABS.SYNC, {
        action: 'remove',
        tabId: tabId
      }, { 'Authorization': `Bearer ${accessToken}` });
    }

    async syncUpdateTab(accessToken, tabData) {
      return apiClient.post(ENDPOINTS.PINNED_TABS.SYNC, {
        action: 'update',
        tab: tabData
      }, { 'Authorization': `Bearer ${accessToken}` });
    }
  }

  // 创建单例实例并挂载到全局
  _authFileGlobal.authApi = new AuthApi();
  _authFileGlobal.AuthApi = AuthApi;
}
