import assert from 'node:assert/strict';
import { applyFaviconFallback, getExtensionIconURL, getFaviconURL } from '../js/utils/favicon.mjs';

function createRuntime() {
  return {
    getURL(path) {
      return `chrome-extension://test-id${path.startsWith('/') ? path : `/${path}`}`;
    }
  };
}

const runtime = createRuntime();

const faviconUrl = getFaviconURL('http://localhost:41532/api/v1/hello', runtime);
assert.equal(new URL(faviconUrl).pathname, '/_favicon/');
assert.equal(new URL(faviconUrl).searchParams.get('pageUrl'), 'http://localhost:41532/api/v1/hello');
assert.equal(new URL(faviconUrl).searchParams.get('size'), '26');

assert.equal(getExtensionIconURL(runtime), 'chrome-extension://test-id/images/icon-32.png');

const image = { src: faviconUrl, onerror: null };
applyFaviconFallback(image, runtime);
assert.equal(typeof image.onerror, 'function');

image.onerror();
assert.equal(image.onerror, null);
assert.equal(image.src, 'chrome-extension://test-id/images/icon-32.png');

console.log('favicon utils tests passed');
