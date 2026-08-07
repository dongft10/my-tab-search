import assert from 'node:assert/strict';
import { applyFaviconFallback, getExtensionIconURL, getFaviconURL, getGoogleFaviconURL } from '../js/utils/favicon.mjs';

function createRuntime() {
  return {
    getURL(path) {
      return `chrome-extension://test-id${path.startsWith('/') ? path : `/${path}`}`;
    }
  };
}

const runtime = createRuntime();

// ── 测试 1: getFaviconURL 无 favIconUrl 时使用 _favicon 端点 ──
const faviconUrl = getFaviconURL('http://localhost:41532/api/v1/hello', runtime);
assert.equal(new URL(faviconUrl).pathname, '/_favicon/');
assert.equal(new URL(faviconUrl).searchParams.get('pageUrl'), 'http://localhost:41532/api/v1/hello');
assert.equal(new URL(faviconUrl).searchParams.get('size'), '26');
console.log('✅ 测试 1 通过: _favicon 端点 URL 生成正确');

// ── 测试 2: getFaviconURL 传入 http favIconUrl 时直接返回 ──
const directFavIcon = 'https://www.google.com/favicon.ico';
const result2 = getFaviconURL('http://example.com', runtime, directFavIcon);
assert.equal(result2, directFavIcon);
console.log('✅ 测试 2 通过: http favIconUrl 直接使用');

// ── 测试 3: getFaviconURL 传入非 http favIconUrl 时回退到 _favicon ──
const chromeFavIcon = 'chrome://favicon/';
const result3 = getFaviconURL('http://example.com', runtime, chromeFavIcon);
assert.equal(new URL(result3).pathname, '/_favicon/');
console.log('✅ 测试 3 通过: 非 http favIconUrl 回退到 _favicon');

// ── 测试 4: getExtensionIconURL ──
assert.equal(getExtensionIconURL(runtime), 'chrome-extension://test-id/images/icon-32.png');
console.log('✅ 测试 4 通过: 扩展自带图标 URL 正确');

// ── 测试 5: getGoogleFaviconURL 有效 URL ──
const googleUrl = getGoogleFaviconURL('https://www.example.com/page', 32);
assert.ok(googleUrl, 'Google favicon URL 不应为 null');
assert.equal(new URL(googleUrl).hostname, 'www.google.com');
assert.equal(new URL(googleUrl).searchParams.get('domain'), 'www.example.com');
assert.equal(new URL(googleUrl).searchParams.get('sz'), '32');
console.log('✅ 测试 5 通过: Google favicon URL 生成正确');

// ── 测试 6: getGoogleFaviconURL 无效 URL ──
assert.equal(getGoogleFaviconURL('not-a-url'), null);
console.log('✅ 测试 6 通过: 无效 URL 返回 null');

// ── 测试 7: applyFaviconFallback 有 pageUrl 时走 Google 回退 ──
const image7 = { src: faviconUrl, onerror: null };
applyFaviconFallback(image7, 'https://www.example.com', runtime);
assert.equal(typeof image7.onerror, 'function');

// 第一次 onerror → 应该切换到 Google favicon URL
image7.onerror();
assert.ok(image7.src.includes('www.google.com'), `Expected Google URL, got: ${image7.src}`);
assert.equal(typeof image7.onerror, 'function');

// 第二次 onerror → 应该切换到扩展自带图标
image7.onerror();
assert.equal(image7.onerror, null);
assert.equal(image7.src, 'chrome-extension://test-id/images/icon-32.png');
console.log('✅ 测试 7 通过: 多级回退链 _favicon → Google → 扩展图标');

// ── 测试 8: applyFaviconFallback 无 pageUrl 时直接回退到扩展图标 ──
const image8 = { src: faviconUrl, onerror: null };
applyFaviconFallback(image8, undefined, runtime);
assert.equal(typeof image8.onerror, 'function');

image8.onerror();
assert.equal(image8.onerror, null);
assert.equal(image8.src, 'chrome-extension://test-id/images/icon-32.png');
console.log('✅ 测试 8 通过: 无 pageUrl 时直接回退到扩展图标');

// ── 测试 9: applyFaviconFallback 无效 pageUrl 时直接回退到扩展图标 ──
const image9 = { src: faviconUrl, onerror: null };
applyFaviconFallback(image9, 'not-a-url', runtime);
assert.equal(typeof image9.onerror, 'function');

image9.onerror();
assert.equal(image9.onerror, null);
assert.equal(image9.src, 'chrome-extension://test-id/images/icon-32.png');
console.log('✅ 测试 9 通过: 无效 pageUrl 时直接回退到扩展图标');

console.log('\n全部 favicon utils 测试通过 ✅');
