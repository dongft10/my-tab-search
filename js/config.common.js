/**
 * 扩展配置文件（通用版本）
 * 用于 Service Worker importScripts
 * 
 * 使用方式：
 * importScripts('./config.common.js'); 然后使用全局变量 CONFIG_COMMON
 */

// 检查是否已经定义过，避免重复声明
if (typeof CONFIG_COMMON === 'undefined') {
  const API_CONFIG = {
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
        VERIFY_EMAIL: '/auth/verify-email',
        OAUTH_VERIFY: '/auth/oauth/verify',
        OAUTH_TOKEN_LOGIN: '/auth/oauth/token-login',
        OAUTH_GOOGLE: '/auth/oauth/google',
        OAUTH_MICROSOFT: '/auth/oauth/microsoft'
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
      },
      // 固定标签页相关
      PINNED_TABS: {
        SYNC: '/pinned-tabs/sync',
        LIST: '/pinned-tabs',
        ADD: '/pinned-tabs',
        UPDATE: '/pinned-tabs',
        DELETE: '/pinned-tabs'
      }
    }
  };

  const PINNED_TABS_CONFIG = {
    // 固定标签页容量限制（最大数量）
    // 静默注册用户：5个
    // 已完成注册用户（体验期/VIP）：100个
    MAX_PINNED_TABS: 100,
    
    // 固定标签页弹窗尺寸（设大一些避免Chrome裁剪）
    WINDOW_WIDTH: 416,
    WINDOW_HEIGHT: 800
  };

  const SEARCH_CONFIG = {
    // 搜索防抖延迟（毫秒）
    DEBOUNCE_DELAY: 150,
    
    // 最大搜索结果数量
    MAX_RESULTS: 100
  };

  const UI_CONFIG = {
    // Toast 提示显示时长（毫秒）
    TOAST_DURATION: 3000,
    
    // 列表项滚动动画时长（毫秒）
    SCROLL_ANIMATION_DURATION: 100
  };

  const STORAGE_KEYS = {
    USER_ID: 'userId',
    DEVICE_ID: 'deviceId',
    ACCESS_TOKEN: 'accessToken',
    TOKEN_EXPIRES_AT: 'tokenExpiresAt',
    REGISTERED_AT: 'registeredAt',
    USER_DEVICE_UUID: 'userDeviceUuid'
  };

  /**
   * 获取完整的 API 端点 URL
   * @param {string} endpoint - 端点路径
   * @returns {string} - 完整的 URL
   */
  function getApiUrl(endpoint) {
    return `${API_CONFIG.BASE_URL}${API_CONFIG.API_VERSION}${endpoint}`;
  }

  // 为 Service Worker 环境提供全局变量
  self.CONFIG_COMMON = {
    API_CONFIG,
    PINNED_TABS_CONFIG,
    SEARCH_CONFIG,
    UI_CONFIG,
    STORAGE_KEYS,
    getApiUrl
  };
}
