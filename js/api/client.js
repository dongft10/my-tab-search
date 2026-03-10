/**
 * API 客户端封装
 * 处理与后端 API 的所有通信
 */

import { API_CONFIG, getApiUrl } from '../config.js';
import { versionManager } from '../utils/version-manager.js';

class ApiClient {
  /**
   * 构造函数
   * @param {string} baseUrl - 可选的基础 URL，默认使用配置文件中的地址
   */
  constructor(baseUrl) {
    this.baseUrl = baseUrl || API_CONFIG.BASE_URL;
    this.apiVersion = API_CONFIG.API_VERSION;
    this.maxRetries = API_CONFIG.REQUEST.MAX_RETRIES;
    this.retryDelay = API_CONFIG.REQUEST.RETRY_DELAY;
    this.versionHeaders = null;
    this._initHeaders(); // 异步初始化
  }

  /**
   * 异步初始化 headers
   */
  async _initHeaders() {
    try {
      this.versionHeaders = await versionManager.getHeaders();
    } catch (error) {
      console.error('[ApiClient] Failed to initialize headers:', error);
      this.versionHeaders = {};
    }
  }

  /**
   * 发送请求
   * @param {string} endpoint - API 端点
   * @param {string} method - HTTP 方法
   * @param {object} data - 请求数据
   * @param {object} headers - 请求头
   * @returns {Promise} - 返回响应
   */
  async request(endpoint, method = 'GET', data = null, headers = {}) {
    // 等待 headers 初始化完成（最多等待 5 秒）
    const startTime = Date.now();
    while (!this.versionHeaders) {
      if (Date.now() - startTime > 5000) {
        console.warn('[ApiClient] Timeout waiting for headers, using empty headers');
        this.versionHeaders = {};
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    const url = getApiUrl(endpoint);
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...this.versionHeaders, // 使用缓存的版本信息（性能优化）
      ...headers
    };

    const config = {
      method,
      headers: defaultHeaders
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.body = JSON.stringify(data);
    }

    let attempt = 0;
    let lastError;

    while (attempt < this.maxRetries) {
      try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error;
        attempt++;
        
        if (attempt < this.maxRetries) {
          console.warn(`Request failed, retrying (${attempt}/${this.maxRetries})...`);
          await this.delay(this.retryDelay);
        }
      }
    }

    throw lastError;
  }

  /**
   * GET 请求
   * @param {string} endpoint - API 端点
   * @param {object} headers - 请求头
   * @returns {Promise} - 返回响应
   */
  get(endpoint, headers = {}) {
    return this.request(endpoint, 'GET', null, headers);
  }

  /**
   * POST 请求
   * @param {string} endpoint - API 端点
   * @param {object} data - 请求数据
   * @param {object} headers - 请求头
   * @returns {Promise} - 返回响应
   */
  post(endpoint, data, headers = {}) {
    return this.request(endpoint, 'POST', data, headers);
  }

  /**
   * PUT 请求
   * @param {string} endpoint - API 端点
   * @param {object} data - 请求数据
   * @param {object} headers - 请求头
   * @returns {Promise} - 返回响应
   */
  put(endpoint, data, headers = {}) {
    return this.request(endpoint, 'PUT', data, headers);
  }

  /**
   * DELETE 请求
   * @param {string} endpoint - API 端点
   * @param {object} headers - 请求头
   * @returns {Promise} - 返回响应
   */
  delete(endpoint, headers = {}) {
    return this.request(endpoint, 'DELETE', null, headers);
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟时间（毫秒）
   * @returns {Promise} - 返回 Promise
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出单例实例
const apiClient = new ApiClient();

export default apiClient;
export { ApiClient };
