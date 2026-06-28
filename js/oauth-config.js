/**
 * OAuth 配置管理模块
 * 支持多浏览器市场、多包 ID 的动态映射
 *
 * 设计原则：
 * - Client ID 的选择维度是浏览器市场，不是部署环境
 * - 同一市场的所有包 ID（开发/生产）使用相同的 Client ID
 * - 查询逻辑：包 ID → 市场 → Client ID
 *
 * @module oauth-config
 * @author MyTabSearch Team
 * @since 2026-06-28
 */

// === 编译时注入的配置 ===
// 由 esbuild define 选项注入，按市场命名
const INJECTED_CONFIG = {
  // Chrome Web Store（开发和生产共用）
  CHROME_GOOGLE_CLIENT_ID: typeof globalThis.CHROME_GOOGLE_CLIENT_ID !== 'undefined'
    ? globalThis.CHROME_GOOGLE_CLIENT_ID
    : null,
  CHROME_MICROSOFT_CLIENT_ID: typeof globalThis.CHROME_MICROSOFT_CLIENT_ID !== 'undefined'
    ? globalThis.CHROME_MICROSOFT_CLIENT_ID
    : null,

  // Edge Add-ons
  EDGE_GOOGLE_CLIENT_ID: typeof globalThis.EDGE_GOOGLE_CLIENT_ID !== 'undefined'
    ? globalThis.EDGE_GOOGLE_CLIENT_ID
    : null,
  EDGE_MICROSOFT_CLIENT_ID: typeof globalThis.EDGE_MICROSOFT_CLIENT_ID !== 'undefined'
    ? globalThis.EDGE_MICROSOFT_CLIENT_ID
    : null,

  // Firefox Add-ons
  FIREFOX_GOOGLE_CLIENT_ID: typeof globalThis.FIREFOX_GOOGLE_CLIENT_ID !== 'undefined'
    ? globalThis.FIREFOX_GOOGLE_CLIENT_ID
    : null,
  FIREFOX_MICROSOFT_CLIENT_ID: typeof globalThis.FIREFOX_MICROSOFT_CLIENT_ID !== 'undefined'
    ? globalThis.FIREFOX_MICROSOFT_CLIENT_ID
    : null
};

// === OAuth 凭证（按市场组织）===
// 每个市场有一套独立的 Client ID，所有包 ID 共用
const MARKET_CREDENTIALS = {
  // Chrome Web Store（开发和生产使用相同的 Client ID）
  'chrome-web-store': {
    google: '45721927150-pphehddi5o6ttqrnv7mlrfk1i24m9e6d.apps.googleusercontent.com',
    microsoft: 'e4c0fb3b-dbf9-4785-892a-6c9fecdb5c75',
    description: 'Chrome Web Store（所有环境）'
  },

  // Edge Add-ons（近期上架）
  'edge-addons': {
    google: null, // 通过 EDGE_GOOGLE_CLIENT_ID 环境变量注入
    microsoft: null, // 通过 EDGE_MICROSOFT_CLIENT_ID 环境变量注入
    description: 'Edge Add-ons（所有环境）'
  },

  // Firefox Add-ons（远期规划）
  'firefox-addons': {
    google: null, // 通过 FIREFOX_GOOGLE_CLIENT_ID 环境变量注入
    microsoft: null, // 通过 FIREFOX_MICROSOFT_CLIENT_ID 环境变量注入
    description: 'Firefox Add-ons（所有环境）'
  }
};

// === 包 ID 到市场的映射 ===
const EXTENSION_TO_MARKET = {
  // Chrome Web Store（多个包 ID 映射到同一个市场）
  'bgmhkhckclnkdjehcnemcggbmnmiichf': 'chrome-web-store', // 开发/测试包
  'adfbidbchmbodidfjmimbkfndnenljjp': 'chrome-web-store', // 生产包

  // Edge Add-ons（包 ID 待分配后取消注释）
  // 'edge-production-extension-id': 'edge-addons',

  // Firefox Add-ons（包 ID 待分配后取消注释）
  // 'firefox-production-extension-id': 'firefox-addons'
};

/**
 * 获取 OAuth Client ID
 *
 * 查询逻辑：包 ID → 市场 → Client ID
 *
 * @param {string} provider - OAuth Provider: 'google' | 'microsoft'
 * @returns {string} Client ID，如果未配置则返回空字符串
 *
 * @example
 * const googleClientId = getOAuthClientId('google');
 * const microsoftClientId = getOAuthClientId('microsoft');
 */
export function getOAuthClientId(provider) {
  // 验证 provider 参数
  if (!['google', 'microsoft'].includes(provider)) {
    console.error(`[OAuth] Invalid provider: "${provider}". Must be 'google' or 'microsoft'`);
    return '';
  }

  // 获取当前扩展的包 ID
  const extensionId = chrome.runtime.id;
  const market = EXTENSION_TO_MARKET[extensionId];

  // 检查是否找到市场映射
  if (!market) {
    console.error(
      `[OAuth] Unknown extension ID: "${extensionId}".\n` +
      'Please update EXTENSION_TO_MARKET in js/oauth-config.js\n' +
      'Current known extension IDs:\n' +
      Object.keys(EXTENSION_TO_MARKET).map(id => `  - ${id} → ${EXTENSION_TO_MARKET[id]}`).join('\n')
    );
    return '';
  }

  // 优先使用编译时注入的值（用于生产环境或需要覆盖的场景）
  const injectedKey = `${market.toUpperCase().replace(/-/g, '_')}_${provider.toUpperCase()}_CLIENT_ID`;
  const injectedValue = INJECTED_CONFIG[injectedKey];

  if (injectedValue) {
    return injectedValue;
  }

  // 降级到市场凭证表中的值（用于开发环境）
  const credentials = MARKET_CREDENTIALS[market];

  if (!credentials || !credentials[provider]) {
    console.error(
      `[OAuth] Missing ${provider} Client ID for market: ${market}\n` +
      `Extension ID: ${extensionId}\n` +
      `Description: ${credentials?.description || 'N/A'}\n` +
      'Please configure the corresponding environment variable:\n' +
      `${injectedKey}`
    );
    return '';
  }

  return credentials[provider];
}

/**
 * 获取 Google OAuth Client ID
 * @returns {string} Google Client ID
 */
export function getGoogleOAuthClientId() {
  return getOAuthClientId('google');
}

/**
 * 获取 Microsoft OAuth Client ID
 * @returns {string} Microsoft Client ID
 */
export function getMicrosoftOAuthClientId() {
  return getOAuthClientId('microsoft');
}

/**
 * 检查 OAuth 配置是否完整
 * @returns {{google: boolean, microsoft: boolean}} 配置状态
 */
export function checkOAuthConfig() {
  return {
    google: !!getGoogleOAuthClientId(),
    microsoft: !!getMicrosoftOAuthClientId()
  };
}

/**
 * 获取当前扩展的详细信息
 * @returns {object} 扩展信息
 */
export function getExtensionInfo() {
  const extensionId = chrome.runtime.id;
  const market = EXTENSION_TO_MARKET[extensionId];
  const credentials = market ? MARKET_CREDENTIALS[market] : null;

  return {
    extensionId,
    market: market || 'unknown',
    description: credentials?.description || 'Unknown extension'
  };
}

// === 导出默认对象 ===
export default {
  getOAuthClientId,
  getGoogleOAuthClientId,
  getMicrosoftOAuthClientId,
  checkOAuthConfig,
  getExtensionInfo,
  MARKET_CREDENTIALS,
  EXTENSION_TO_MARKET,
  INJECTED_CONFIG
};
