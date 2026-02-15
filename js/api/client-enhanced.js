/**
 * API 客户端增强
 * 处理 Token 过期和离线降级策略
 */

import authService from '../services/auth.service.js';
import vipService from '../services/vip.service.js';

class ApiClientEnhanced {
  constructor() {
    this.isOnline = navigator.onLine;
    this.setupNetworkListener();
  }

  /**
   * 设置网络状态监听
   */
  setupNetworkListener() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('Network: online');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('Network: offline');
    });
  }

  /**
   * 检查网络状态
   * @returns {boolean} - 是否在线
   */
  checkNetworkStatus() {
    return this.isOnline && navigator.onLine;
  }

  /**
   * 处理 Token 过期情况
   * @param {string} feature - 请求的功能
   * @returns {Promise<object>} - 返回处理结果
   */
  async handleTokenExpired(feature) {
    // 1. 检查本地 VIP 状态
    const localVip = await vipService.getLocalVipStatus();

    if (!localVip) {
      // 没有本地VIP状态，需要网络
      return {
        allowed: false,
        mode: 'restricted',
        message: '请连接网络以同步您的账户信息'
      };
    }

    // 2. 检查 VIP 是否有效
    if (localVip.isVip && localVip.vipExpiresAt) {
      const expiresAt = new Date(localVip.vipExpiresAt).getTime();
      if (expiresAt > Date.now()) {
        // VIP 未过期，允许离线使用
        return {
          allowed: true,
          mode: 'offline',
          message: '使用离线模式'
        };
      }
    }

    // 3. 尝试刷新 Token
    if (this.checkNetworkStatus()) {
      try {
        const newToken = await authService.refreshAccessToken();
        if (newToken) {
          // 刷新成功，同步最新 VIP 状态
          await vipService.syncVipStatus();
          return {
            allowed: true,
            mode: 'online',
            message: '已刷新登录状态'
          };
        }
      } catch (error) {
        console.error('Refresh token failed:', error);
      }
    }

    // 4. VIP 已过期，限制功能
    return {
      allowed: false,
      mode: 'restricted',
      message: '您的VIP已过期，请连接网络续费'
    };
  }

  /**
   * 带离线策略的 API 请求
   * @param {string} url - 请求 URL
   * @param {object} options - 请求选项
   * @returns {Promise} - 返回请求结果
   */
  async requestWithOfflineFallback(url, options = {}) {
    // 尝试在线请求
    if (this.checkNetworkStatus()) {
      try {
        const response = await this.doRequest(url, options);
        
        // 检查是否是 Token 过期错误
        if (response.status === 401) {
          const handleResult = await this.handleTokenExpired();
          
          if (handleResult.allowed) {
            // 刷新 Token 后重试
            return await this.doRequest(url, options);
          }
          
          // 返回限制信息
          return {
            ok: false,
            offline: true,
            ...handleResult
          };
        }
        
        return response;
      } catch (error) {
        console.error('Request error:', error);
        
        // 网络错误，检查是否可以使用离线模式
        return await this.handleOfflineRequest(url, options);
      }
    } else {
      // 离线状态
      return await this.handleOfflineRequest(url, options);
    }
  }

  /**
   * 处理离线请求
   * @param {string} url - 请求 URL
   * @param {object} options - 请求选项
   * @returns {Promise} - 返回离线处理结果
   */
  async handleOfflineRequest(url, options = {}) {
    // 检查是否是只读操作
    const isReadOnly = !options.method || options.method === 'GET';
    
    if (isReadOnly) {
      // 检查本地缓存是否有数据
      const cachedData = await this.getCachedData(url);
      
      if (cachedData) {
        return {
          ok: true,
          offline: true,
          data: cachedData,
          message: '显示缓存数据'
        };
      }
    }

    // 无法处理离线请求
    return {
      ok: false,
      offline: true,
      allowed: false,
      message: '当前处于离线状态，无法执行此操作'
    };
  }

  /**
   * 获取缓存数据
   * @param {string} url - 请求 URL
   * @returns {Promise<object|null>} - 返回缓存数据
   */
  async getCachedData(url) {
    const cache = await chrome.storage.local.get('api_cache');
    const cacheData = cache.api_cache || {};
    
    // 简单缓存策略：根据URL匹配
    if (url.includes('/vip/status')) {
      return cacheData.vipStatus;
    }
    
    if (url.includes('/user/profile')) {
      return cacheData.userProfile;
    }

    return null;
  }

  /**
   * 缓存 API 响应数据
   * @param {string} url - 请求 URL
   * @param {object} data - 响应数据
   */
  async cacheData(url, data) {
    const cache = await chrome.storage.local.get('api_cache');
    const cacheData = cache.api_cache || {};

    // 根据URL缓存数据
    if (url.includes('/vip/status')) {
      cacheData.vipStatus = data;
    }
    
    if (url.includes('/user/profile')) {
      cacheData.userProfile = data;
    }

    // 保存缓存，设置过期时间
    await chrome.storage.local.set({
      api_cache: cacheData
    });
  }

  /**
   * 执行实际请求
   * @param {string} url - 请求 URL
   * @param {object} options - 请求选项
   * @returns {Promise} - 返回请求结果
   */
  async doRequest(url, options) {
    // 导入原始 API 客户端
    const apiClient = (await import('./client.js')).default;
    
    // 根据方法类型调用不同的 API 方法
    if (options.method === 'POST') {
      return await apiClient.post(url, options.body || {}, options.headers || {});
    } else if (options.method === 'GET') {
      return await apiClient.get(url, options.params || {}, options.headers || {});
    }
    
    throw new Error('Unsupported method');
  }
}

// 导出单例实例
const apiClientEnhanced = new ApiClientEnhanced();

export default apiClientEnhanced;
export { ApiClientEnhanced };
