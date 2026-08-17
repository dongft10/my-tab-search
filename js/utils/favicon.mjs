const FALLBACK_ICON_PATH = '/images/icon-32.png';
const GOOGLE_FAVICON_SERVICE = 'https://www.google.com/s2/favicons';

function getRuntime(runtime = globalThis.chrome?.runtime) {
  if (!runtime?.getURL) {
    throw new Error('chrome.runtime.getURL is unavailable');
  }
  return runtime;
}

/**
 * 从 pageUrl 中提取域名
 * @param {string} pageUrl - 页面 URL
 * @returns {string|null} 域名，无法解析时返回 null
 */
function getDomainFromUrl(pageUrl) {
  try {
    return new URL(pageUrl).hostname;
  } catch {
    return null;
  }
}

/**
 * 判断是否为扩展内部页面（chrome-extension:// URL）
 * 例如 settings.html、about.html 等扩展自带页面
 * @param {string} [pageUrl] - 页面 URL
 * @returns {boolean}
 */
export function isExtensionPage(pageUrl) {
  return typeof pageUrl === 'string' && /^chrome-extension:\/\//i.test(pageUrl);
}

/**
 * 使用 Google favicon 服务获取网站图标 URL
 * 作为 _favicon 端点在不支持该 API 的浏览器（如 Edge）上的回退方案
 * @param {string} pageUrl - 页面 URL
 * @param {number} [size=32] - 图标尺寸
 * @returns {string|null} Google favicon 服务 URL，无法提取域名时返回 null
 */
export function getGoogleFaviconURL(pageUrl, size = 32) {
  // 扩展内部页面（chrome-extension://）的 hostname 是扩展 ID，
  // Google 服务无法为该域名取图（会返回 200 空/默认图标且不触发 onerror），
  // 因此直接返回 null 让调用方跳过这一层
  if (isExtensionPage(pageUrl)) return null;
  const domain = getDomainFromUrl(pageUrl);
  if (!domain) return null;
  const url = new URL(GOOGLE_FAVICON_SERVICE);
  url.searchParams.set('domain', domain);
  url.searchParams.set('sz', String(size));
  return url.toString();
}

// 获取网站图标 URL
// 优先级：favIconUrl（如果传入且为 http/https URL）> Chrome _favicon 端点
// favIconUrl 来自 chrome.tabs API 的 tab.favIconUrl 属性，在 Chrome 和 Edge 上均可用
export function getFaviconURL(pageUrl, runtime, favIconUrl) {
  // 扩展内部页面（settings/about 等）：统一直接使用扩展自带图标。
  // Chrome 上 _favicon 虽能取到扩展图标，但 Edge 上 _favicon 不可用，
  // 且 favIconUrl 对扩展页面通常为空字符串，直接返回扩展图标最稳妥。
  if (isExtensionPage(pageUrl)) {
    return getExtensionIconURL(runtime);
  }
  // 如果有直接可用的 http/https favIconUrl，优先使用（兼容所有浏览器）
  if (favIconUrl && /^https?:\/\//.test(favIconUrl)) {
    return favIconUrl;
  }
  const chromeRuntime = getRuntime(runtime);
  const faviconUrl = new URL(chromeRuntime.getURL('/_favicon/'));
  faviconUrl.searchParams.set('pageUrl', pageUrl);
  faviconUrl.searchParams.set('size', '26');
  return faviconUrl.toString();
}

export function getExtensionIconURL(runtime) {
  return getRuntime(runtime).getURL(FALLBACK_ICON_PATH);
}

/**
 * 为 img 元素注册多级回退链
 * 加载失败时依次尝试：Google favicon 服务 → 扩展自带图标
 *
 * 回退链设计原因：
 *   Chrome 上 _favicon 端点正常工作，不会触发回退
 *   Edge 上 _favicon 端点返回 ERR_FAILED，触发回退到 Google favicon 服务
 *   若 Google 服务也不可用（如网络受限），最终回退到扩展自带图标
 *
 * @param {HTMLImageElement} imageElement - img 元素
 * @param {string} [pageUrl] - 页面 URL（用于生成 Google favicon 回退 URL）
 * @param {object} [runtime] - chrome.runtime 对象（测试注入用）
 */
export function applyFaviconFallback(imageElement, pageUrl, runtime) {
  imageElement.onerror = () => {
    // 第一次失败：尝试 Google favicon 服务
    const googleUrl = pageUrl ? getGoogleFaviconURL(pageUrl, 32) : null;
    if (googleUrl) {
      imageElement.onerror = () => {
        // 第二次失败：使用扩展自带图标
        imageElement.onerror = null;
        imageElement.src = getExtensionIconURL(runtime);
      };
      imageElement.src = googleUrl;
      return;
    }
    // 没有 pageUrl，直接使用扩展自带图标
    imageElement.onerror = null;
    imageElement.src = getExtensionIconURL(runtime);
  };
}
