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
      registeredAt: 'registeredAt',
      lastTokenErrorTime: 'lastTokenErrorTime',
      lastTokenError: 'lastTokenError'
    };
    this.syncStorageKey = {
      userId: 'sync_userId',
      deviceId: 'sync_deviceId',
      accessToken: 'sync_accessToken',
      tokenExpiresAt: 'sync_tokenExpiresAt',
      registeredAt: 'sync_registeredAt',
      helpTourCompleted: 'sync_helpTourCompleted',
      searchMatchMode: 'sync_searchMatchMode',
      vipStatus: 'sync_vipStatus',
      trialStatus: 'sync_trialStatus'
    };
    this.refreshThreshold = 5 * 24 * 60 * 60 * 1000;
    this._tokenRequestPromise = null;
    this._errorCooldown = 30000;
  }

  async _getErrorCoolDownState() {
    try {
      const result = await chrome.storage.local.get([
        this.storageKey.lastTokenErrorTime,
        this.storageKey.lastTokenError
      ]);
      return {
        lastErrorTime: result[this.storageKey.lastTokenErrorTime] || 0,
        lastError: result[this.storageKey.lastTokenError]
      };
    } catch (error) {
      console.warn('Failed to get error cooldown state from storage:', error);
      return { lastErrorTime: 0, lastError: null };
    }
  }

  async _setErrorCoolDownState(error) {
    try {
      const storageData = {
        [this.storageKey.lastTokenErrorTime]: Date.now(),
        [this.storageKey.lastTokenError]: error ? error.message || String(error) : null
      };
      await chrome.storage.local.set(storageData);
    } catch (error) {
      console.warn('Failed to set error cooldown state to storage:', error);
    }
  }

  async _clearErrorCoolDownState() {
    try {
      await chrome.storage.local.remove([
        this.storageKey.lastTokenErrorTime,
        this.storageKey.lastTokenError
      ]);
    } catch (error) {
      console.warn('Failed to clear error cooldown state from storage:', error);
    }
  }

  async _isInErrorCoolDown() {
    const state = await this._getErrorCoolDownState();
    if (state.lastErrorTime === 0) {
      return false;
    }
    return (Date.now() - state.lastErrorTime) < this._errorCooldown;
  }

  async silentRegister() {
    try {
      const isRegistered = await this.isRegistered();
      if (isRegistered) {
        console.log('Already registered, skipping...');
        return await this.getUserInfo();
      }

      const browserInfo = this.getBrowserInfo();
      const extensionVersion = chrome.runtime.getManifest().version;

      const response = await authApi.silentRegister({
        browserInfo,
        extensionVersion
      });

      await this.saveUserInfo({
        userId: response.data.userId,
        deviceId: response.data.deviceId
      });

      console.log('Silent registration successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('Silent registration failed:', error);
      return null;
    }
  }

  async getAccessToken() {
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

  async _doGetAccessToken() {
    try {
      if (await this._isInErrorCoolDown()) {
        console.log('Token request in cooldown period, skipping');
        return null;
      }

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
      const syncStorageData = {
        [this.syncStorageKey.accessToken]: accessToken,
        [this.syncStorageKey.tokenExpiresAt]: expiresAt
      };

      await chrome.storage.local.set(storageData);
      await chrome.storage.sync.set(syncStorageData);
      await this._clearErrorCoolDownState();

      return accessToken;
    } catch (error) {
      console.warn('Failed to get access token:', error);
      await this._setErrorCoolDownState(error);
      return null;
    }
  }

  async logout() {
    try {
      const { accessToken } = await chrome.storage.local.get(this.storageKey.accessToken);
      
      if (accessToken) {
        await authApi.revokeToken(accessToken);
      }

      await chrome.storage.local.remove([
        this.storageKey.userId,
        this.storageKey.accessToken,
        this.storageKey.registeredAt
      ]);
      await chrome.storage.sync.remove([
        this.syncStorageKey.userId,
        this.syncStorageKey.accessToken,
        this.syncStorageKey.registeredAt
      ]);

      console.log('Logout successful');
      return true;
    } catch (error) {
      console.error('Logout failed:', error);
      await chrome.storage.local.remove([
        this.storageKey.userId,
        this.storageKey.accessToken,
        this.storageKey.registeredAt
      ]);
      await chrome.storage.sync.remove([
        this.syncStorageKey.userId,
        this.syncStorageKey.accessToken,
        this.syncStorageKey.registeredAt
      ]);
      return false;
    }
  }

  async isRegistered() {
    const result = await chrome.storage.local.get([
      this.storageKey.userId,
      this.storageKey.deviceId,
      this.storageKey.accessToken,
      this.storageKey.registeredAt
    ]);
    const userId = result[this.storageKey.userId];
    const accessToken = result[this.storageKey.accessToken];
    const registeredAt = result[this.storageKey.registeredAt];
    return !!(userId || accessToken || registeredAt);
  }

  async isEmailVerified() {
    const result = await chrome.storage.local.get(this.storageKey.registeredAt);
    return !!(result[this.storageKey.registeredAt]);
  }

  async getUserInfo() {
    const userInfo = await chrome.storage.local.get([
      this.storageKey.userId,
      this.storageKey.deviceId,
      this.storageKey.accessToken,
      this.storageKey.registeredAt
    ]);
    return userInfo;
  }

  async saveUserInfo(userInfo) {
    const syncStorageData = {};
    
    if (userInfo.userId) {
      syncStorageData[this.syncStorageKey.userId] = userInfo.userId;
    }
    if (userInfo.deviceId) {
      syncStorageData[this.syncStorageKey.deviceId] = userInfo.deviceId;
    }
    if (userInfo.accessToken) {
      syncStorageData[this.syncStorageKey.accessToken] = userInfo.accessToken;
    }
    if (userInfo.registeredAt) {
      syncStorageData[this.syncStorageKey.registeredAt] = userInfo.registeredAt;
    }

    await chrome.storage.sync.set(syncStorageData);
    await chrome.storage.local.set(syncStorageData);
  }

  async saveSettings(settings) {
    const syncStorageData = {};
    const localStorageData = {};
    
    if (settings.helpTourCompleted !== undefined) {
      syncStorageData[this.syncStorageKey.helpTourCompleted] = settings.helpTourCompleted;
      localStorageData.helpTourCompleted = settings.helpTourCompleted;
    }
    if (settings.searchMatchMode !== undefined) {
      syncStorageData[this.syncStorageKey.searchMatchMode] = settings.searchMatchMode;
      localStorageData.searchMatchMode = settings.searchMatchMode;
    }
    if (settings.vipStatus !== undefined) {
      syncStorageData[this.syncStorageKey.vipStatus] = settings.vipStatus;
      localStorageData.vipStatus = settings.vipStatus;
    }
    if (settings.trialStatus !== undefined) {
      syncStorageData[this.syncStorageKey.trialStatus] = settings.trialStatus;
      localStorageData.trialStatus = settings.trialStatus;
    }

    if (Object.keys(syncStorageData).length > 0) {
      await chrome.storage.sync.set(syncStorageData);
      await chrome.storage.local.set(localStorageData);
    }
  }

  async restoreFromSyncStorage() {
    try {
      const syncResult = await chrome.storage.sync.get([
        this.syncStorageKey.userId,
        this.syncStorageKey.deviceId,
        this.syncStorageKey.accessToken,
        this.syncStorageKey.tokenExpiresAt,
        this.syncStorageKey.registeredAt,
        this.syncStorageKey.helpTourCompleted,
        this.syncStorageKey.searchMatchMode
      ]);

      const localResult = await chrome.storage.local.get([
        this.storageKey.userId,
        this.storageKey.deviceId,
        this.storageKey.registeredAt,
        'helpTourCompleted',
        'searchMatchMode',
        'vipStatus',
        'trialStatus'
      ]);

      const hasLocalUserData = localResult[this.storageKey.userId] || localResult[this.storageKey.registeredAt];
      const localRestoreData = {};

      if (!hasLocalUserData && (syncResult[this.syncStorageKey.userId] || syncResult[this.syncStorageKey.registeredAt])) {
        localRestoreData[this.storageKey.userId] = syncResult[this.syncStorageKey.userId];
        localRestoreData[this.storageKey.deviceId] = syncResult[this.syncStorageKey.deviceId];
        localRestoreData[this.storageKey.accessToken] = syncResult[this.syncStorageKey.accessToken];
        localRestoreData[this.storageKey.tokenExpiresAt] = syncResult[this.syncStorageKey.tokenExpiresAt];
        localRestoreData[this.storageKey.registeredAt] = syncResult[this.syncStorageKey.registeredAt];
      }

      if (!localResult.helpTourCompleted && syncResult[this.syncStorageKey.helpTourCompleted]) {
        localRestoreData.helpTourCompleted = syncResult[this.syncStorageKey.helpTourCompleted];
      }
      if (!localResult.searchMatchMode && syncResult[this.syncStorageKey.searchMatchMode]) {
        localRestoreData.searchMatchMode = syncResult[this.syncStorageKey.searchMatchMode];
      }
      if (!localResult.vipStatus && syncResult[this.syncStorageKey.vipStatus]) {
        localRestoreData.vipStatus = syncResult[this.syncStorageKey.vipStatus];
      }
      if (!localResult.trialStatus && syncResult[this.syncStorageKey.trialStatus]) {
        localRestoreData.trialStatus = syncResult[this.syncStorageKey.trialStatus];
      }

      if (Object.keys(localRestoreData).length > 0) {
        await chrome.storage.local.set(localRestoreData);
        console.log('[AuthService] Restored user data from sync storage:', Object.keys(localRestoreData));
        return true;
      }
    } catch (error) {
      console.warn('[AuthService] Failed to restore from sync storage:', error);
    }
    return false;
  }

  getBrowserInfo() {
    const ua = navigator.userAgent;
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';
    let platform = navigator.platform;
    let language = navigator.language || navigator.userLanguage;

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

    return { name: browserName, version: browserVersion, platform, language };
  }

  async getAuthHeaders() {
    const { accessToken } = await chrome.storage.local.get(this.storageKey.accessToken);
    if (!accessToken) {
      await this.getAccessToken();
      const { accessToken: newToken } = await chrome.storage.local.get(this.storageKey.accessToken);
      if (newToken) {
        return { 'Authorization': `Bearer ${newToken}` };
      }
      return {};
    }
    return { 'Authorization': `Bearer ${accessToken}` };
  }

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
    
    return expiresAt - now < this.refreshThreshold;
  }

  async refreshAccessToken() {
    try {
      const { accessToken } = await chrome.storage.local.get(this.storageKey.accessToken);
      if (!accessToken) {
        throw new Error('No token to refresh');
      }

      const response = await authApi.refreshToken(accessToken);
      const newToken = response.data.accessToken;
      const newExpiresAt = response.data.expiresAt;

      await chrome.storage.local.set({
        [this.storageKey.accessToken]: newToken,
        [this.storageKey.tokenExpiresAt]: newExpiresAt
      });
      await chrome.storage.sync.set({
        [this.syncStorageKey.accessToken]: newToken,
        [this.syncStorageKey.tokenExpiresAt]: newExpiresAt
      });

      console.log('Token refreshed successfully');
      return newToken;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      await chrome.storage.local.remove([
        this.storageKey.accessToken,
        this.storageKey.tokenExpiresAt
      ]);
      await chrome.storage.sync.remove([
        this.syncStorageKey.accessToken,
        this.syncStorageKey.tokenExpiresAt
      ]);
      return null;
    }
  }

  async getValidAccessToken() {
    if (await this._isInErrorCoolDown()) {
      console.log('Token request in cooldown period, skipping');
      return null;
    }

    const isVerified = await this.isEmailVerified();
    if (!isVerified) {
      console.log('User not verified, skipping token request');
      return null;
    }

    const { accessToken, tokenExpiresAt } = await chrome.storage.local.get([
      this.storageKey.accessToken,
      this.storageKey.tokenExpiresAt
    ]);
    
    if (accessToken && tokenExpiresAt) {
      const expiresAt = new Date(tokenExpiresAt).getTime();
      if (expiresAt > Date.now()) {
        return accessToken;
      }
    }
    
    try {
      if (accessToken) {
        const needsRefresh = await this.shouldRefreshToken();
        if (needsRefresh) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            await this._clearErrorCoolDownState();
            return refreshed;
          }
        }
      }
      
      const newToken = await this.getAccessToken();
      if (newToken) {
        await this._clearErrorCoolDownState();
      }
      return newToken;
    } catch (e) {
      console.error('Failed to get valid access token:', e);
      await this._setErrorCoolDownState(e);
      return null;
    }
  }
}

const authService = new AuthService();

export default authService;
export { AuthService };
