const FALLBACK_ICON_PATH = '/images/icon-32.png';

function getRuntime(runtime = globalThis.chrome?.runtime) {
  if (!runtime?.getURL) {
    throw new Error('chrome.runtime.getURL is unavailable');
  }
  return runtime;
}

// 使用 Chrome 内置 favicon 接口获取网站图标。
export function getFaviconURL(pageUrl, runtime) {
  const chromeRuntime = getRuntime(runtime);
  const faviconUrl = new URL(chromeRuntime.getURL('/_favicon/'));
  faviconUrl.searchParams.set('pageUrl', pageUrl);
  faviconUrl.searchParams.set('size', '26');
  return faviconUrl.toString();
}

export function getExtensionIconURL(runtime) {
  return getRuntime(runtime).getURL(FALLBACK_ICON_PATH);
}

export function applyFaviconFallback(imageElement, runtime) {
  imageElement.onerror = () => {
    imageElement.onerror = null;
    imageElement.src = getExtensionIconURL(runtime);
  };
}
