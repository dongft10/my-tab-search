// 扩展配置文件
// 集中管理所有可配置项
// 注意：此文件用于 ES6 模块环境，config.common.js 用于 Service Worker 环境

/**
 * API 相关配置
 */
export const API_CONFIG = {
  // 后端服务基础地址
  BASE_URL: 'http://localhost:41532',
  
  // API 版本前缀
  API_VERSION: '/api/v1',
  
  // 请求配置
  REQUEST: {
    // 最大重试次数
    MAX_RETRIES: 3,
    // 重试延迟（毫秒）
    RETRY_DELAY: 1000,
    // 请求超时时间（毫秒）
    TIMEOUT: 30000
  },
  
  // API 端点定义
  ENDPOINTS: {
    // 认证相关
    AUTH: {
      SILENT_REGISTER: '/auth/silent-register',
      GET_TOKEN: '/auth/token',
      REVOKE_TOKEN: '/auth/revoke',
      VALIDATE_TOKEN: '/auth/validate',
      REFRESH_TOKEN: '/auth/refresh',
      SEND_VERIFICATION: '/auth/send-verification',
      VERIFY_EMAIL: '/auth/verify-email'
    },
    // 用户相关
    USER: {
      PROFILE: '/user/profile',
      LIMITS: '/user/limits',
      FEATURE: '/user/feature'
    },
    // VIP 相关
    VIP: {
      STATUS: '/vip/status',
      SYNC: '/vip/sync'
    },
    // 体验期相关
    TRIAL: {
      STATUS: '/trial/status',
      EXTEND: '/trial/extend'
    },
    // 设备管理
    DEVICES: {
      LIST: '/devices',
      DELETE: '/devices',
      LOGOUT_ALL: '/devices/logout'
    }
  }
};

/**
 * 固定标签页相关配置
 */
export const PINNED_TABS_CONFIG = {
  // 固定标签页容量限制（最大数量）
  MAX_PINNED_TABS: 5,
  
  // 固定标签页弹窗尺寸
  WINDOW_WIDTH: 384,
  WINDOW_HEIGHT: 600
};

/**
 * 搜索相关配置
 */
export const SEARCH_CONFIG = {
  // 搜索防抖延迟（毫秒）
  DEBOUNCE_DELAY: 150,
  
  // 最大搜索结果数量
  MAX_RESULTS: 100
};

/**
 * UI 相关配置
 */
export const UI_CONFIG = {
  // Toast 提示显示时长（毫秒）
  TOAST_DURATION: 3000,
  
  // 列表项滚动动画时长（毫秒）
  SCROLL_ANIMATION_DURATION: 100
};

/**
 * 存储键名配置
 */
export const STORAGE_KEYS = {
  USER_ID: 'mytabsearch_user_id',
  DEVICE_ID: 'mytabsearch_device_id',
  ACCESS_TOKEN: 'mytabsearch_access_token',
  TOKEN_EXPIRES_AT: 'mytabsearch_token_expires_at',
  REGISTERED_AT: 'mytabsearch_registered_at',
  DEVICE_FINGERPRINT: 'mytabsearch_device_fingerprint'
};

/**
 * 获取完整的 API 端点 URL
 * @param {string} endpoint - 端点路径
 * @returns {string} - 完整的 URL
 */
export function getApiUrl(endpoint) {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.API_VERSION}${endpoint}`;
}

// 默认导出所有配置
export default {
  API_CONFIG,
  PINNED_TABS_CONFIG,
  SEARCH_CONFIG,
  UI_CONFIG,
  STORAGE_KEYS,
  getApiUrl
};
