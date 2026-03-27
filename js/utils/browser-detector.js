/**
 * 浏览器检测工具
 * 用于区分 Chrome 和 360 安全浏览器
 * 解决弹窗宽度在不同浏览器中表现不一致的问题
 *
 * 注意：此文件通过 importScripts() 加载到 Service Worker 中，
 * 使用全局函数而非 ES6 export
 *
 * 由于 360 浏览器完全伪装成 Chrome，API 层面无法可靠检测。
 * 因此采用动态调整策略：页面加载后测量实际内容宽度，不对则自动调整窗口。
 */

var BROWSER_360_WIDTH_COMPENSATION = 16;

/**
 * 检测当前浏览器类型（同步版本，仅供参考）
 * @returns {Object}
 */
function detectBrowser() {
  dumpBrowserInfo();

  if (detectByUA()) return { is360: true, isChrome: false, method: 'ua' };
  if (detectByUserAgentData()) return { is360: true, isChrome: false, method: 'userAgentData' };
  if (detectByVendor()) return { is360: true, isChrome: false, method: 'vendor' };

  return { is360: false, isChrome: true, method: 'default' };
}

/**
 * 异步检测浏览器类型
 * @returns {Promise<Object>}
 */
function detectBrowserAsync() {
  return new Promise(function(resolve) {
    dumpBrowserInfo();

    if (detectByUA()) { resolve({ is360: true, isChrome: false, method: 'ua' }); return; }
    if (detectByUserAgentData()) { resolve({ is360: true, isChrome: false, method: 'userAgentData' }); return; }
    if (detectByVendor()) { resolve({ is360: true, isChrome: false, method: 'vendor' }); return; }

    detectByPlatformInfoAsync(function(is360) {
      resolve(is360
        ? { is360: true, isChrome: false, method: 'platformInfo' }
        : { is360: false, isChrome: true, method: 'default' }
      );
    });
  });
}

function dumpBrowserInfo() {
  try {
    console.log('[BrowserDetector] ===== Browser Info =====');
    console.log('[BrowserDetector] UA:', navigator.userAgent);
    console.log('[BrowserDetector] vendor:', navigator.vendor || 'N/A');
    console.log('[BrowserDetector] platform:', navigator.platform);
    if (navigator.userAgentData) {
      console.log('[BrowserDetector] userAgentData.brands:', JSON.stringify(navigator.userAgentData.brands));
      console.log('[BrowserDetector] userAgentData.platform:', navigator.userAgentData.platform);
    }
    console.log('[BrowserDetector] ===== End Info =====');
  } catch (e) {
    console.warn('[BrowserDetector] dumpBrowserInfo failed:', e);
  }
}

function detectByUA() {
  try { return /360se|360ee|360chrome|QihooBrowser|QHBrowser/i.test(navigator.userAgent || ''); }
  catch (e) { return false; }
}

function detectByUserAgentData() {
  try {
    if (navigator.userAgentData && navigator.userAgentData.brands) {
      var brands = navigator.userAgentData.brands;
      for (var i = 0; i < brands.length; i++) {
        if (/360|Qihoo|QIHU/i.test(brands[i].brand || '')) return true;
      }
    }
    return false;
  } catch (e) { return false; }
}

function detectByVendor() {
  try { return navigator.vendor && /360|Qihoo/i.test(navigator.vendor); }
  catch (e) { return false; }
}

function detectByPlatformInfoAsync(callback) {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.getPlatformInfo) {
      callback(false); return;
    }
    chrome.runtime.getPlatformInfo(function(info) {
      try {
        console.log('[BrowserDetector] platformInfo:', JSON.stringify(info));
        var is360 = (info.os && info.os.indexOf('360') !== -1) ||
                    (info.arch && info.arch.indexOf('360') !== -1);
        callback(is360);
      } catch (e) { callback(false); }
    });
  } catch (e) { callback(false); }
}

/**
 * 获取推荐的弹窗宽度
 */
function getRecommendedWindowWidth(baseWidth) {
  var result = detectBrowser();
  return result.is360 ? baseWidth + BROWSER_360_WIDTH_COMPENSATION : baseWidth;
}
