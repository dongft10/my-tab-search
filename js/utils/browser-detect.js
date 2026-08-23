/**
 * 浏览器检测工具
 * 根据 User-Agent 判断当前浏览器类型，返回对应的扩展商店链接
 */

const STORE_LINKS = {
  chrome: 'https://chromewebstore.google.com/detail/MyBetterHistory/kganimhlifineghdimhlhbdfjgboekbp',
  edge: 'https://microsoftedge.microsoft.com/addons/detail/mybetterhistory/akebfcibdkeeedgfelkdffjnjkcbdgao'
};

// 缓存浏览器类型，避免重复解析 UA
let _cachedBrowser = null;

/**
 * 检测当前浏览器类型
 * @returns {'chrome'|'edge'|'unknown'}
 */
export function detectBrowser() {
  if (_cachedBrowser !== null) {
    return _cachedBrowser;
  }

  const ua = navigator.userAgent;
  // Edge 的 UA 同时包含 Chrome 和 Edg，需先判断 Edge
  if (ua.includes('Edg/')) {
    _cachedBrowser = 'edge';
  } else if (ua.includes('Chrome/')) {
    _cachedBrowser = 'chrome';
  } else {
    _cachedBrowser = 'unknown';
  }

  return _cachedBrowser;
}

/**
 * 获取对应的扩展商店安装链接
 * @returns {string} 商店链接
 */
export function getStoreLink() {
  const browser = detectBrowser();
  return STORE_LINKS[browser] || STORE_LINKS.chrome;
}

/**
 * 获取商店 i18n key（用于国际化）
 * @returns {string} i18n key，如 'chromeStoreName' 或 'edgeStoreName'
 */
export function getStoreNameKey() {
  const browser = detectBrowser();
  return browser === 'edge' ? 'edgeStoreName' : 'chromeStoreName';
}