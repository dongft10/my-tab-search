/**
 * 扩展配置文件
 * 集中管理所有可配置�? */

// 环境配置
const ENV_TYPE = globalThis.ENV_TYPE || 'dev';

const ENV_CONFIG = {
  DEBUG: ENV_TYPE !== 'prod',
  CACHE: {
    DEV_CACHE_TIME: 1 * 60 * 1000,
    PROD_CACHE_TIME: 24 * 60 * 60 * 1000
  }
};

export function getCacheTime() {
  return ENV_CONFIG.DEBUG ? ENV_CONFIG.CACHE.DEV_CACHE_TIME : ENV_CONFIG.CACHE.PROD_CACHE_TIME;
}

const API_BASE_URLS = {
  dev: 'http://localhost:41532',
  qa: 'https://habpbyhrqiik.ap-southeast-1.clawcloudrun.com',
  prod: 'https://mytabsearch.us.kg'
};

export const API_CONFIG = {
  BASE_URL: API_BASE_URLS[ENV_TYPE],
  API_VERSION: '/api/v1',
  REQUEST: {
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    TIMEOUT: 30000
  },
  ENDPOINTS: {
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
      LOGOUT_ALL: '/devices/logout',
      ACTIVE: '/devices/active'
    },
    PINNED_TABS: {
      SYNC: '/pinned-tabs/sync',
      LIST: '/pinned-tabs',
      ADD: '/pinned-tabs',
      UPDATE: '/pinned-tabs',
      DELETE: '/pinned-tabs'
    }
  }
};

export const PINNED_TABS_CONFIG = {
  MAX_PINNED_TABS: 100,
  WINDOW_WIDTH: 416,
  WINDOW_HEIGHT: 800
};

export const SEARCH_CONFIG = {
  DEBOUNCE_DELAY: 150,
  MAX_RESULTS: 100
};

export const UI_CONFIG = {
  TOAST_DURATION: 3000,
  SCROLL_ANIMATION_DURATION: 100
};

export const STORAGE_KEYS = {
  USER_ID: 'userId',
  DEVICE_ID: 'deviceId',
  ACCESS_TOKEN: 'accessToken',
  TOKEN_EXPIRES_AT: 'tokenExpiresAt',
  REGISTERED_AT: 'registeredAt'
};

export function getApiUrl(endpoint) {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.API_VERSION}${endpoint}`;
}

export default {
  API_CONFIG,
  PINNED_TABS_CONFIG,
  SEARCH_CONFIG,
  UI_CONFIG,
  STORAGE_KEYS,
  ENV_CONFIG,
  ENV_TYPE,
  getApiUrl,
  getCacheTime
};
