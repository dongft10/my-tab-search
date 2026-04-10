/**
 * API 客户端封装 - ES6 模块版本
 * 用于 popup 等页面
 * 
 * 注意：此文件用于 ES6 模块导入
 * Service Worker 请使用 client.sw.js
 */

const _clientEsmGlobal = typeof self !== 'undefined' ? self : {};

let API_CONFIG = _clientEsmGlobal.API_CONFIG || null;
let getApiUrl = _clientEsmGlobal.getApiUrl || null;
let versionManager = _clientEsmGlobal.versionManager || null;

if (!API_CONFIG) {
  API_CONFIG = {
    BASE_URL: 'https://habpbyhrqiik.ap-southeast-1.clawcloudrun.com',
    API_VERSION: '/api/v1',
    REQUEST: {
      MAX_RETRIES: 3,
      RETRY_DELAY: 1000
    }
  };
}

if (!getApiUrl) {
  getApiUrl = function(endpoint) {
    return `${API_CONFIG.BASE_URL}${API_CONFIG.API_VERSION}${endpoint}`;
  };
}

if (!versionManager) {
  versionManager = {
    getHeaders: async () => {
      return {
        'X-Extension-Version': chrome.runtime.getManifest().version,
        'X-Client-ID': 'chrome-extension'
      };
    }
  };
}

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl || API_CONFIG.BASE_URL;
    this.apiVersion = API_CONFIG.API_VERSION;
    this.maxRetries = API_CONFIG.REQUEST.MAX_RETRIES;
    this.retryDelay = API_CONFIG.REQUEST.RETRY_DELAY;
    this.versionHeaders = null;
    this._initHeaders();
  }

  async _initHeaders() {
    try {
      this.versionHeaders = await versionManager.getHeaders();
    } catch (error) {
      console.error('[ApiClient] Failed to initialize headers:', error);
      this.versionHeaders = {};
    }
  }

  async request(endpoint, method = 'GET', data = null, headers = {}) {
    const startTime = Date.now();
    while (!this.versionHeaders) {
      if (Date.now() - startTime > 5000) {
        console.info('[ApiClient] Timeout waiting for headers, using empty headers');
        this.versionHeaders = {};
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    const url = getApiUrl(endpoint);
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...this.versionHeaders,
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
          const error = new Error(errorData.message || `HTTP error! status: ${response.status}`);
          error.status = response.status;
          error.endpoint = endpoint;
          throw error;
        }

        return await response.json();
      } catch (error) {
        lastError = error;
        
        if (error.status === 429) {
          console.info('[ApiClient] Rate limited, no retry');
          throw error;
        }
        
        if (error.status >= 500 && error.status < 600) {
          error.isServerError = true;
        }
        
        attempt++;
        if (attempt < this.maxRetries) {
          console.info(`Request failed, retrying (${attempt}/${this.maxRetries})...`, { endpoint, status: error.status });
          await this.delay(this.retryDelay);
        }
      }
    }

    if (lastError) {
      lastError.endpoint = endpoint;
      lastError.attempts = attempt;
    }
    
    throw lastError;
  }

  get(endpoint, headers = {}) {
    return this.request(endpoint, 'GET', null, headers);
  }

  post(endpoint, data, headers = {}) {
    return this.request(endpoint, 'POST', data, headers);
  }

  put(endpoint, data, headers = {}) {
    return this.request(endpoint, 'PUT', data, headers);
  }

  delete(endpoint, headers = {}) {
    return this.request(endpoint, 'DELETE', null, headers);
  }

  patch(endpoint, data = null, headers = {}) {
    return this.request(endpoint, 'PATCH', data, headers);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const apiClient = new ApiClient();

export default apiClient;
export { ApiClient };
