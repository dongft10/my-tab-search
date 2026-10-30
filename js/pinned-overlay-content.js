/**
 * pinned-overlay-content.js - 注入式固定标签页弹窗（方案 B）
 *
 * 由 background 在收到 open-pinned-tabs 指令时优先向当前活动标签页注入。
 * 使用 Shadow DOM 隔离宿主页面样式，视觉与扩展 popup 保持一致的品牌风格。
 * 在受限页面（chrome:// 等）上由 background 自动降级为 popup 窗口方案。
 */
(function () {
  'use strict';

  if (window.__mtsPinnedOverlayInstalled) return;
  window.__mtsPinnedOverlayInstalled = true;

  var MSG_TOGGLE = 'mtsTogglePinnedOverlay';

  // ============== 设计令牌（与扩展主题体系一致） ==============
  var TOKENS_DARK = {
    '--pl-bg-primary': '#1a1a2e',
    '--pl-bg-secondary': '#252540',
    '--pl-bg-hover': '#2a2a45',
    '--pl-bg-selected': 'rgba(99, 102, 241, 0.25)',
    '--pl-badge-bg': 'rgba(99, 102, 241, 0.25)',
    '--pl-focus-ring': 'rgba(99, 102, 241, 0.25)',
    '--pl-text-primary': '#ffffff',
    '--pl-text-secondary': 'rgba(255, 255, 255, 0.7)',
    '--pl-text-muted': 'rgba(255, 255, 255, 0.45)',
    '--pl-border': 'rgba(255, 255, 255, 0.1)',
    '--pl-primary': '#6366f1',
    '--pl-primary-light': '#818cf8',
    '--pl-danger': '#ef4444',
    '--pl-success': '#a78bfa',
    '--pl-highlight-bg': '#fef08a',
    '--pl-highlight-text': '#000000',
    '--pl-longterm': 'rgba(167, 139, 250, 0.28)',
    '--pl-overlay': 'rgba(0, 0, 0, 0.55)',
    '--pl-shadow': '0 24px 64px rgba(0, 0, 0, 0.5)'
  };

  var TOKENS_LIGHT = {
    '--pl-bg-primary': '#ffffff',
    '--pl-bg-secondary': '#f1f5f9',
    '--pl-bg-hover': '#e2e8f0',
    '--pl-bg-selected': '#e8f0fe',
    '--pl-badge-bg': 'rgba(99, 102, 241, 0.12)',
    '--pl-focus-ring': 'rgba(99, 102, 241, 0.15)',
    '--pl-text-primary': '#1e293b',
    '--pl-text-secondary': '#475569',
    '--pl-text-muted': '#94a3b8',
    '--pl-border': '#e2e8f0',
    '--pl-primary': '#6366f1',
    '--pl-primary-light': '#818cf8',
    '--pl-danger': '#ef4444',
    '--pl-success': '#7c3aed',
    '--pl-highlight-bg': '#fef08a',
    '--pl-highlight-text': '#000000',
    '--pl-longterm': 'rgba(167, 139, 250, 0.18)',
    '--pl-overlay': 'rgba(15, 23, 42, 0.45)',
    '--pl-shadow': '0 24px 64px rgba(15, 23, 42, 0.25)'
  };

  var CSS = [
    ':host { all: initial; }',
    '* { box-sizing: border-box; margin: 0; padding: 0; }',
    '.pl-overlay {',
    '  position: fixed; top: 0; left: 0; width: 100%; height: 100%;',
    '  background: var(--pl-overlay);',
    '  display: flex; align-items: center; justify-content: center;',
    '  z-index: 2147483646;',
    '  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;',
    '  animation: pl-fade-in 0.16s ease;',
    '}',
    '@keyframes pl-fade-in { from { opacity: 0; } to { opacity: 1; } }',
    '.pl-modal {',
    '  width: 640px; max-width: calc(100vw - 48px);',
    '  max-height: min(680px, calc(100vh - 96px));',
    '  background: var(--pl-bg-primary);',
    '  border: 1px solid var(--pl-border);',
    '  border-radius: 10px;',
    '  box-shadow: var(--pl-shadow);',
    '  display: flex; flex-direction: column;',
    '  overflow: hidden;',
    '  animation: pl-pop-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);',
    '}',
    '@keyframes pl-pop-in {',
    '  from { opacity: 0; transform: translateY(12px) scale(0.98); }',
    '  to { opacity: 1; transform: translateY(0) scale(1); }',
    '}',
    '.pl-header {',
    '  display: flex; align-items: center; gap: 10px;',
    '  padding: 16px 20px 12px;',
    '  flex-shrink: 0;',
    '}',
    '.pl-title {',
    '  font-size: 15px; font-weight: 600; color: var(--pl-text-primary);',
    '  display: flex; align-items: center; gap: 8px;',
    '}',
    '.pl-title svg { color: var(--pl-primary); flex-shrink: 0; }',
    '.pl-count {',
    '  font-size: 12px; font-weight: 600; color: var(--pl-primary);',
    '  background: var(--pl-badge-bg);',
    '  padding: 2px 8px; border-radius: 10px;',
    '}',
    '.pl-header-actions { margin-left: auto; display: flex; gap: 4px; }',
    '.pl-icon-btn {',
    '  width: 28px; height: 28px; border: none; border-radius: 6px;',
    '  background: transparent; color: var(--pl-text-secondary);',
    '  cursor: pointer; display: flex; align-items: center; justify-content: center;',
    '  transition: background-color 0.15s ease, color 0.15s ease;',
    '}',
    '.pl-icon-btn:hover { background: var(--pl-bg-hover); color: var(--pl-text-primary); }',
    '.pl-icon-btn:focus-visible { outline: 2px solid var(--pl-primary); outline-offset: 1px; }',
    '.pl-search-wrap { padding: 0 20px 12px; flex-shrink: 0; }',
    '.pl-search {',
    '  display: flex; align-items: center; gap: 10px;',
    '  background: var(--pl-bg-secondary);',
    '  border: 1px solid var(--pl-border);',
    '  border-radius: 10px; padding: 9px 14px;',
    '  transition: border-color 0.15s ease, box-shadow 0.15s ease;',
    '}',
    '.pl-search:focus-within {',
    '  border-color: var(--pl-primary);',
    '  box-shadow: 0 0 0 3px var(--pl-focus-ring);',
    '}',
    '.pl-search svg { color: var(--pl-text-muted); flex-shrink: 0; }',
    '.pl-search input {',
    '  flex: 1; border: none; outline: none; background: transparent;',
    '  font-size: 14px; color: var(--pl-text-primary);',
    '  font-family: inherit;',
    '}',
    '.pl-search input::placeholder { color: var(--pl-text-muted); }',
    '.pl-list {',
    '  flex: 1; overflow-y: auto; padding: 4px 0 12px;',
    '  min-height: 0;',
    '}',
    '.pl-list::-webkit-scrollbar { width: 8px; }',
    '.pl-list::-webkit-scrollbar-track { background: transparent; }',
    '.pl-list::-webkit-scrollbar-thumb { background: var(--pl-border); border-radius: 4px; }',
    '.pl-item {',
    '  display: flex; align-items: center; gap: 12px;',
    '  padding: 10px 16px 10px 20px; border-radius: 0;',
    '  cursor: pointer; position: relative;',
    '  transition: background-color 0.12s ease;',
    '  animation: pl-item-in 0.18s ease backwards;',
    '}',
    '@keyframes pl-item-in {',
    '  from { opacity: 0; transform: translateY(4px); }',
    '  to { opacity: 1; transform: translateY(0); }',
    '}',
    '.pl-item:hover { background: var(--pl-bg-hover); }',
    '.pl-item.selected { background: var(--pl-bg-selected); }',
    '.pl-item.long-term { background: var(--pl-longterm); }',
    '.pl-item.long-term::before {',
    '  content: ""; position: absolute; left: 0; top: 0; bottom: 0;',
    '  width: 3px; border-radius: 0; background: var(--pl-success);',
    '}',
    '.pl-item.long-term:hover, .pl-item.long-term.selected {',
    '  background: var(--pl-longterm);',
    '  filter: brightness(1.15);',
    '}',
    '.pl-favicon {',
    '  width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;',
    '  object-fit: contain; background: var(--pl-bg-secondary);',
    '}',
    '.pl-item-main { flex: 1; min-width: 0; }',
    '.pl-item-title {',
    '  font-size: 13.5px; font-weight: 500; color: var(--pl-text-primary);',
    '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
    '  line-height: 1.45;',
    '}',
    '.pl-item-url {',
    '  font-size: 11.5px; color: var(--pl-text-muted);',
    '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
    '  line-height: 1.4; margin-top: 1px;',
    '}',
    '.pl-item-title .pl-hl {',
    '  background: var(--pl-highlight-bg); color: var(--pl-highlight-text);',
    '  border-radius: 2px; padding: 0 1px;',
    '}',
    '.pl-pin-badge {',
    '  flex-shrink: 0; color: var(--pl-success); display: flex;',
    '}',
    '.pl-actions {',
    '  display: flex; gap: 0; flex-shrink: 0;',
    '  opacity: 0; transition: opacity 0.15s ease;',
    '}',
    '.pl-item:hover .pl-actions, .pl-item.selected .pl-actions,',
    '.pl-item:focus-within .pl-actions { opacity: 1; }',
    '.pl-action-btn {',
    '  width: 24px; height: 24px; border: none; border-radius: 6px;',
    '  background: transparent; color: var(--pl-text-secondary);',
    '  cursor: pointer; display: flex; align-items: center; justify-content: center;',
    '  font-size: 13px; line-height: 1;',
    '  transition: background-color 0.12s ease, color 0.12s ease;',
    '}',
    '.pl-action-btn:hover { background: var(--pl-bg-secondary); color: var(--pl-text-primary); }',
    '.pl-action-btn.danger:hover { color: var(--pl-danger); }',
    '.pl-action-btn.pin-active { color: var(--pl-success); }',
    '.pl-action-btn:focus-visible { outline: 2px solid var(--pl-primary); outline-offset: 1px; }',
    '.pl-footer {',
    '  display: flex; align-items: center; gap: 14px;',
    '  padding: 10px 20px; flex-shrink: 0;',
    '  border-top: 1px solid var(--pl-border);',
    '  font-size: 11.5px; color: var(--pl-text-muted);',
    '}',
    '.pl-kbd {',
    '  display: inline-flex; align-items: center; gap: 4px;',
    '}',
    '.pl-kbd b {',
    '  font-weight: 500; color: var(--pl-text-secondary);',
    '  background: var(--pl-bg-secondary); border: 1px solid var(--pl-border);',
    '  border-radius: 4px; padding: 1px 5px; font-size: 10.5px;',
    '  font-family: inherit;',
    '}',
    '.pl-empty {',
    '  text-align: center; padding: 48px 20px; color: var(--pl-text-muted);',
    '}',
    '.pl-empty-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.6; }',
    '.pl-empty-text { font-size: 14px; color: var(--pl-text-secondary); margin-bottom: 6px; }',
    '.pl-empty-hint { font-size: 12px; }',
    '.pl-toast {',
    '  position: absolute; bottom: 56px; left: 50%; transform: translateX(-50%);',
    '  background: var(--pl-bg-secondary); color: var(--pl-text-primary);',
    '  border: 1px solid var(--pl-border);',
    '  padding: 9px 18px; border-radius: 8px; font-size: 13px;',
    '  animation: pl-fade-in 0.2s ease; white-space: nowrap;',
    '}'
  ].join('\n');

  // ============== 状态 ==============
  var host = null;
  var root = null;
  var els = {};
  var allTabs = [];
  var visibleTabs = [];
  var selectedIndex = 0;
  var isOpen = false;
  var previouslyFocused = null;

  // ============== 工具函数 ==============
  function msg(key, fallback) {
    try {
      var m = chrome.i18n.getMessage(key);
      return m || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function getHostName(url) {
    try { return new URL(url).hostname; } catch (e) { return url || ''; }
  }

  function faviconURL(tab) {
    try {
      if (tab.icon && /^https?:\/\//.test(tab.icon)) return tab.icon;
      var u = new URL(chrome.runtime.getURL('/_favicon/'));
      u.searchParams.set('pageUrl', tab.url || '');
      u.searchParams.set('size', '32');
      return u.toString();
    } catch (e) {
      return chrome.runtime.getURL('/images/icon-32.png');
    }
  }

  function onImgError(img, tab) {
    img.onerror = function () {
      img.onerror = null;
      img.src = chrome.runtime.getURL('/images/icon-32.png');
    };
    var g = 'https://www.google.com/s2/favicons?domain=' +
      encodeURIComponent(getHostName(tab.url)) + '&sz=32';
    img.src = g;
  }

  // 子序列匹配（与扩展子序列模式一致）
  function subsequenceMatch(keyword, text) {
    if (!keyword || !text) return false;
    var k = keyword.toLowerCase(), t = text.toLowerCase();
    var ti = 0;
    for (var i = 0; i < k.length && ti < t.length; i++) {
      var idx = t.indexOf(k[i], ti);
      if (idx === -1) return false;
      ti = idx + 1;
    }
    return true;
  }

  function highlight(text, keywords) {
    var safe = escapeHtml(text || '');
    if (!keywords || !keywords.length || !text) return safe;
    var lower = (text || '').toLowerCase();
    var matched = new Array(text.length).fill(false);
    keywords.forEach(function (kw) {
      var lk = kw.toLowerCase();
      var start = 0;
      while (start < lower.length) {
        var idx = lower.indexOf(lk, start);
        if (idx === -1) break;
        for (var i = idx; i < idx + lk.length; i++) matched[i] = true;
        start = idx + 1;
      }
      // 子序列逐字符高亮
      if (!lower.includes(lk) && subsequenceMatch(lk, lower)) {
        var ti = 0;
        for (var c = 0; c < lk.length; c++) {
          var f = lower.indexOf(lk[c], ti);
          if (f === -1) break;
          matched[f] = true;
          ti = f + 1;
        }
      }
    });
    var out = '';
    for (var j = 0; j < text.length; j++) {
      var ch = escapeHtml(text[j]);
      out += matched[j] ? '<span class="pl-hl">' + ch + '</span>' : ch;
    }
    return out;
  }

  function showToast(text) {
    if (!root) return;
    var old = root.querySelector('.pl-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'pl-toast';
    t.textContent = text;
    els.modal.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 2600);
  }

  // ============== 主题 ==============
  function applyTheme() {
    if (!root) return;
    chrome.storage.local.get('overlayTheme', function (r) {
      var tokens = (r && r.overlayTheme === 'dark') ? TOKENS_DARK : TOKENS_LIGHT;
      if (!r || !r.overlayTheme) {
        // 未镜像时跟随系统
        tokens = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
          ? TOKENS_LIGHT : TOKENS_DARK;
      }
      Object.keys(tokens).forEach(function (k) {
        root.host.style.setProperty(k, tokens[k]);
      });
    });
  }

  // ============== DOM 构建 ==============
  var SVG_SEARCH = '<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>';
  var SVG_PIN = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z"/></svg>';
  var SVG_CLOSE = '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>';
  var SVG_REFRESH = '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/><path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/></svg>';
  var SVG_UNPIN = '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z"/><path d="M2 14.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 0-1h-11a.5.5 0 0 0-.5.5z"/></svg>';
  var SVG_SETTINGS = '<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.901-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/></svg>';

  function buildDOM() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'mts-pinned-overlay-host';
    document.documentElement.appendChild(host);
    root = host.attachShadow({ mode: 'open' });

    var style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);

    var overlay = document.createElement('div');
    overlay.className = 'pl-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', msg('pinnedTabsTitle', 'Pinned Tab List'));
    overlay.style.display = 'none';

    overlay.innerHTML =
      '<div class="pl-modal">' +
      '  <div class="pl-header">' +
      '    <div class="pl-title">' + SVG_PIN + '<span id="pl-title-text">' + escapeHtml(msg('pinnedTabsTitle', 'Pinned Tab List')) + '</span></div>' +
      '    <span class="pl-count" id="pl-count">0</span>' +
      '    <div class="pl-header-actions">' +
      '      <button class="pl-icon-btn" id="pl-settings-btn" title="' + escapeHtml(msg('settingsTitle', 'Settings')) + '">' + SVG_SETTINGS + '</button>' +
      '      <button class="pl-icon-btn" id="pl-close-btn" title="Esc">' + SVG_CLOSE + '</button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="pl-search-wrap">' +
      '    <div class="pl-search">' + SVG_SEARCH +
      '      <input id="pl-search-input" type="text" aria-label="' + escapeHtml(msg('searchPinnedTabsAria', 'search pinned tabs')) + '" placeholder="' + escapeHtml(msg('searchPinnedTabs', 'search pinned tabs...')) + '">' +
      '    </div>' +
      '  </div>' +
      '  <div class="pl-list" id="pl-list" role="listbox" aria-label="' + escapeHtml(msg('pinnedTabsTitle', 'Pinned Tab List')) + '"></div>' +
      '  <div class="pl-footer">' +
      '    <span class="pl-kbd"><b>\u2191\u2193</b> ' + escapeHtml(msg('menuLabel', 'menu')) + '</span>' +
      '    <span class="pl-kbd"><b>Enter</b> ' + escapeHtml(msg('pinTab', 'switch')) + '</span>' +
      '    <span class="pl-kbd"><b>Del</b> ' + escapeHtml(msg('closeTab', 'close')) + '</span>' +
      '    <span class="pl-kbd"><b>Esc</b> ' + escapeHtml(msg('cancel', 'close')) + '</span>' +
      '  </div>' +
      '</div>';

    root.appendChild(overlay);

    els = {
      overlay: overlay,
      modal: overlay.querySelector('.pl-modal'),
      list: overlay.querySelector('#pl-list'),
      input: overlay.querySelector('#pl-search-input'),
      count: overlay.querySelector('#pl-count')
    };

    // 事件绑定
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) closeOverlay();
    });
    overlay.querySelector('#pl-close-btn').addEventListener('click', closeOverlay);
    overlay.querySelector('#pl-settings-btn').addEventListener('click', function () {
      chrome.runtime.sendMessage({ action: 'openSettings' });
      closeOverlay();
    });
    els.input.addEventListener('input', renderList);
    els.list.addEventListener('click', function (e) {
      var item = e.target.closest('.pl-item');
      if (item && item.dataset.index !== undefined) {
        switchToTab(parseInt(item.dataset.index, 10));
      }
    });
    document.addEventListener('keydown', onKeydown, true);
    document.addEventListener('mousedown', onOutsideMousedown, true);
  }

  // ============== 数据与渲染 ==============
  function loadTabs() {
    return new Promise(function (resolve) {
      chrome.storage.local.get('pinnedTabs', function (r) {
        resolve((r && r.pinnedTabs) || []);
      });
    });
  }

  function getKeywords() {
    var q = (els.input.value || '').trim().toLowerCase();
    return q ? q.split(/\s+/).filter(Boolean) : [];
  }

  function filterTabs(tabs, keywords) {
    if (!keywords.length) return tabs.slice();
    return tabs.filter(function (tab) {
      var lower = (tab.title || '').toLowerCase();
      return keywords.every(function (kw) {
        return lower.includes(kw) || subsequenceMatch(kw, lower);
      });
    }).sort(function (a, b) {
      // 包含关键字者靠前，再按出现位置排序
      var la = (a.title || '').toLowerCase(), lb = (b.title || '').toLowerCase();
      var pa = Infinity, pb = Infinity;
      keywords.forEach(function (kw) {
        var ia = la.indexOf(kw); if (ia !== -1 && ia < pa) pa = ia;
        var ib = lb.indexOf(kw); if (ib !== -1 && ib < pb) pb = ib;
      });
      return pa - pb;
    });
  }

  function renderList() {
    if (!els.list) return;
    var keywords = getKeywords();
    visibleTabs = filterTabs(allTabs, keywords);
    selectedIndex = visibleTabs.length ? Math.min(selectedIndex, visibleTabs.length - 1) : 0;
    els.count.textContent = String(visibleTabs.length);
    els.list.innerHTML = '';

    if (!visibleTabs.length) {
      var empty = document.createElement('div');
      empty.className = 'pl-empty';
      empty.innerHTML =
        '<div class="pl-empty-icon">\uD83D\uDCCC</div>' +
        '<div class="pl-empty-text">' + escapeHtml(msg('noPinnedTabs', 'No pinned tabs')) + '</div>' +
        '<div class="pl-empty-hint">' + escapeHtml(msg('pinTabsHint', 'Use Alt+Q to open search and pin tabs')) + '</div>';
      els.list.appendChild(empty);
      return;
    }

    var frag = document.createDocumentFragment();
    visibleTabs.forEach(function (tab, index) {
      var item = document.createElement('div');
      item.className = 'pl-item' + (tab.isLongTermPinned ? ' long-term' : '') + (index === selectedIndex ? ' selected' : '');
      item.dataset.index = String(index);
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', index === selectedIndex ? 'true' : 'false');
      item.setAttribute('aria-label', (tab.title || '') + ' ' + (tab.url || ''));
      item.title = (tab.title || '') + (tab.url ? '\n' + tab.url : '');
      item.style.animationDelay = Math.min(index * 18, 220) + 'ms';

      var img = document.createElement('img');
      img.className = 'pl-favicon';
      img.src = faviconURL(tab);
      img.onerror = function () { onImgError(img, tab); };

      var main = document.createElement('div');
      main.className = 'pl-item-main';
      var titleDiv = document.createElement('div');
      titleDiv.className = 'pl-item-title';
      titleDiv.innerHTML = highlight(tab.title || msg('untitled', '(untitled)'), keywords);
      var urlDiv = document.createElement('div');
      urlDiv.className = 'pl-item-url';
      var hostName = getHostName(tab.url);
      var lastSeg = (tab.url || '').substring((tab.url || '').lastIndexOf('/') + 1);
      urlDiv.textContent = hostName + (lastSeg ? '/.../' + lastSeg : '');
      urlDiv.title = tab.url || '';
      main.appendChild(titleDiv);
      main.appendChild(urlDiv);

      var actions = document.createElement('div');
      actions.className = 'pl-actions';

      // 操作按钮 hover 时抑制整行 title 气泡，避免误弹
      actions.addEventListener('mouseenter', function () { item.removeAttribute('title'); });
      actions.addEventListener('mouseleave', function () {
        item.title = (tab.title || '') + (tab.url ? '\n' + tab.url : '');
      });

      var refreshBtn = makeActionBtn(SVG_REFRESH, msg('refreshTab', '刷新此标签页'), '', function (e) {
        e.stopPropagation();
        if (tab.tabId != null) {
          chrome.runtime.sendMessage({ action: 'mtsPinnedOverlayAction', op: 'refreshTab', tabId: tab.tabId });
        }
      });
      var pinBtn = makeActionBtn(
        tab.isLongTermPinned ? SVG_PIN : SVG_UNPIN,
        tab.isLongTermPinned ? msg('cancelLongTermPinned', '取消长期固定') : msg('setLongTermPinned', '设为长期固定'),
        tab.isLongTermPinned ? 'pin-active' : '',
        function (e) { e.stopPropagation(); toggleLongTerm(tab); }
      );
      actions.appendChild(refreshBtn);
      actions.appendChild(pinBtn);

      if (!tab.isLongTermPinned) {
        var closeBtn = makeActionBtn(SVG_CLOSE, msg('closeTab', '关闭标签页'), 'danger', function (e) {
          e.stopPropagation();
          closeTabItem(tab);
        });
        var unpinBtn = makeActionBtn('\u2715', msg('unpinTab', '取消固定标签页'), '', function (e) {
          e.stopPropagation();
          unpinTab(tab);
        });
        unpinBtn.textContent = '\u2212'; // minus icon for unpin
        actions.appendChild(unpinBtn);
        actions.appendChild(closeBtn);
      }

      item.appendChild(img);
      item.appendChild(main);
      item.appendChild(actions);
      frag.appendChild(item);
    });
    els.list.appendChild(frag);
  }

  function makeActionBtn(svg, title, extraClass, onClick) {
    var btn = document.createElement('button');
    btn.className = 'pl-action-btn' + (extraClass ? ' ' + extraClass : '');
    btn.innerHTML = svg;
    btn.title = title;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function updateSelectionVisual() {
    var items = els.list.querySelectorAll('.pl-item');
    items.forEach(function (item, i) {
      item.classList.toggle('selected', i === selectedIndex);
      item.setAttribute('aria-selected', i === selectedIndex ? 'true' : 'false');
    });
    var sel = items[selectedIndex];
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  // ============== 操作 ==============
  function switchToTab(index) {
    var tab = visibleTabs[index];
    if (!tab) return;
    var doSwitch = function () {
      chrome.runtime.sendMessage({
        action: 'pinnedListTabAction',
        data: { operation: 'switchDirect', tabId: tab.tabId, targetUrl: tab.url }
      }, function (resp) {
        if (resp && resp.success) {
          closeOverlay(true);
        } else if (tab.url) {
          // tabId 无效（如长期固定的离线 tab），回退为打开新标签页
          chrome.runtime.sendMessage({
            action: 'pinnedListTabAction',
            data: { operation: 'openNew', targetUrl: tab.url }
          }, function () { closeOverlay(true); });
        }
      });
    };
    // 有 tabId 时先校验 URL 是否仍匹配（复用扩展的更新语义过于复杂，v1 直接切换）
    doSwitch();
  }

  function unpinTab(tab) {
    chrome.storage.local.get('pinnedTabs', function (r) {
      var tabs = (r && r.pinnedTabs) || [];
      var updated = tabs.filter(function (t) {
        return !((tab.url && t.url === tab.url) || (tab.tabId != null && t.tabId === tab.tabId));
      });
      chrome.storage.local.set({ pinnedTabs: updated }, function () {
        allTabs = updated;
        renderList();
        showToast(msg('tabUnpinned', '已取消固定'));
      });
    });
  }

  function closeTabItem(tab) {
    chrome.runtime.sendMessage({
      action: 'mtsPinnedOverlayAction',
      op: 'closeTab',
      tabId: tab.tabId,
      tabUrl: tab.url,
      isLongTermPinned: !!tab.isLongTermPinned
    }, function (resp) {
      if (resp && resp.success) {
        if (tab.isLongTermPinned) {
          showToast(msg('longTermPinnedKept', '长期固定的Tab已关闭，但仍保留在列表中'));
          renderList();
        } else {
          unpinTab(tab);
        }
      } else {
        showToast(msg('closeTabFailed', '关闭失败'));
      }
    });
  }

  function toggleLongTerm(tab) {
    chrome.storage.local.get('pinnedTabs', function (r) {
      var tabs = (r && r.pinnedTabs) || [];
      var now = new Date().toISOString();
      var target = null;
      var updated = tabs.map(function (t) {
        if ((tab.url && t.url === tab.url) || (tab.tabId != null && t.tabId === tab.tabId)) {
          target = t;
          return Object.assign({}, t, {
            isLongTermPinned: !t.isLongTermPinned,
            longTermPinnedAt: t.isLongTermPinned ? null : now
          });
        }
        return t;
      });
      if (!target) return;
      var next = !target.isLongTermPinned;
      chrome.storage.local.set({ pinnedTabs: updated }, function () {
        // 同步到服务器
        try {
          var syncQueue = chrome.runtime.getURL && null; // sync 由 background 统一处理
        } catch (e) {}
        chrome.runtime.sendMessage({
          action: 'mtsPinnedOverlayAction',
          op: 'syncLongTerm',
          tabId: tab.tabId != null ? tab.tabId : ('url:' + tab.url),
          url: tab.url,
          isLongTermPinned: next,
          longTermPinnedAt: next ? now : null
        });
        allTabs = updated;
        renderList();
        showToast(next
          ? msg('longTermPinnedSuccess', '已设为长期固定')
          : msg('cancelLongTermSuccess', '已取消长期固定'));
      });
    });
  }

  // ============== 键盘 ==============
  function onKeydown(e) {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeOverlay();
      return;
    }
    // 焦点在输入框时仅处理 Escape / Enter
    var inInput = root.activeElement === els.input;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inInput && visibleTabs.length) switchToTab(selectedIndex);
      else if (visibleTabs.length) switchToTab(selectedIndex);
      return;
    }
    if (inInput && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      moveSelection(e.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (inInput) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(-1); }
    else if (e.key === 'Delete') {
      e.preventDefault();
      if (visibleTabs[selectedIndex]) closeTabItem(visibleTabs[selectedIndex]);
    }
  }

  function moveSelection(delta) {
    if (!visibleTabs.length) return;
    selectedIndex = (selectedIndex + delta + visibleTabs.length) % visibleTabs.length;
    updateSelectionVisual();
  }

  function onOutsideMousedown(e) {
    if (!isOpen) return;
    if (host && !host.contains(e.target) && e.target !== host) {
      // 点击了 shadow DOM 外部（host 本身不拦截事件）
    }
  }

  // ============== 打开 / 关闭 ==============
  function openOverlay() {
    buildDOM();
    previouslyFocused = document.activeElement;
    applyTheme();
    isOpen = true;
    els.overlay.style.display = 'flex';
    els.input.value = '';
    loadTabs().then(function (tabs) {
      allTabs = tabs;
      selectedIndex = 0;
      renderList();
      els.input.focus();
    });
  }

  function closeOverlay(skipRefocus) {
    if (!isOpen) return;
    isOpen = false;
    els.overlay.style.display = 'none';
    if (!skipRefocus && previouslyFocused && previouslyFocused.focus) {
      try { previouslyFocused.focus(); } catch (e) {}
    }
  }

  function toggleOverlay() {
    if (isOpen) closeOverlay();
    else openOverlay();
    return isOpen;
  }

  // ============== 消息监听 ==============
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message && message.action === MSG_TOGGLE) {
      var visible = toggleOverlay();
      sendResponse({ success: true, visible: visible });
    }
    return false;
  });
})();
