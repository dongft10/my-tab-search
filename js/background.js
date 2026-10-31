/**
 * background.js - Service Worker
 * Chrome Extension background script
 */

import { API_CONFIG, PINNED_TABS_CONFIG } from './config.js';
import authService from './services/auth.service.js';
import authApi from './api/auth.js';
import { SyncQueueService } from './services/sync-queue.common.js';
import trialService from './services/trial.service.js';
import vipService from './services/vip.service.js';
import featureLimitService from './services/feature-limit.service.js';

const STORAGE_KEYS_LOCAL = {
  userId: 'userId',
  deviceId: 'deviceId',
  accessToken: 'accessToken',
  tokenExpiresAt: 'tokenExpiresAt',
  registeredAt: 'registeredAt'
};

chrome.windows.onRemoved.addListener(async (windowId) => {
  try {
    const result = await chrome.storage.local.get('pinnedTabsWindowId');
    if (result.pinnedTabsWindowId === windowId) {
      await chrome.storage.local.remove('pinnedTabsWindowId');
    }
  } catch (error) {
    console.error('[background] Error clearing pinned tabs window ID:', error);
  }
});

const i18n = {
  language: 'en',
  messages: {},
  loadedLanguages: new Set(),

  async initialize() {
    try {
      const result = await chrome.storage.sync.get('language');
      if (result.language) {
        this.language = result.language;
      } else {
        const browserLang = chrome.i18n.getUILanguage();
        this.language = browserLang.startsWith('zh') ? 'zh_CN' : 'en';
      }
      await this.loadMessages(this.language);
    } catch (error) {
      console.error('[i18n] Failed to initialize:', error);
      this.language = 'en';
      this.messages['en'] = {};
    }
  },

  async loadMessages(lang) {
    try {
      if (this.loadedLanguages.has(lang)) return;
      const response = await fetch(`/_locales/${lang}/messages.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const messages = await response.json();
      this.messages[lang] = messages;
      this.loadedLanguages.add(lang);
    } catch (error) {
      console.error(`[i18n] Failed to load messages for ${lang}:`, error);
      if (lang !== 'en') await this.loadMessages('en');
    }
  },

  getMessage(key, replacements = null) {
    let message = this._getMessageFromLang(key, this.language);
    if (!message) message = this._getMessageFromLang(key, 'en');
    if (!message) return key;
    if (replacements) {
      if (Array.isArray(replacements)) {
        replacements.forEach((r, i) => message = message.replace(`$${i + 1}`, r));
      } else {
        message = message.replace('$1', replacements);
      }
    }
    return message;
  },

  _getMessageFromLang(key, lang) {
    return this.messages[lang]?.[key]?.message || null;
  },

  async setLanguage(lang) {
    if (this.language === lang) return;
    this.language = lang;
    await this.loadMessages(lang);
  }
};

let curTabId = null;
let preTabId = null;
let curWindowId = null;
let tabHistory = [];
const MAX_HISTORY_SIZE = 20;

async function saveStateToStorage() {
  try {
    await chrome.storage.local.set({ curTabId, preTabId, curWindowId, tabHistory });
  } catch (error) {
    console.error('[Storage] Save state error:', error);
  }
}

async function loadStateFromStorage() {
  try {
    return await chrome.storage.local.get(['curTabId', 'preTabId', 'curWindowId', 'tabHistory']);
  } catch (error) {
    console.error('[Storage] Load state error:', error);
    return {};
  }
}

async function getActiveTabInWindow(windowId) {
  try {
    const tabs = await chrome.tabs.query({ active: true, windowId });
    return tabs[0];
  } catch (error) {
    console.error('Error getting active tab:', error);
    return null;
  }
}

async function initializeState() {
  try {
    if (curTabId || preTabId || curWindowId) return;
    const currentFocusedWindow = await chrome.windows.getLastFocused({ populate: false });
    if (!currentFocusedWindow) return;
    const savedState = await loadStateFromStorage();

    if (savedState.curTabId || savedState.preTabId || savedState.curWindowId || savedState.tabHistory?.length > 0) {
      if (savedState.curTabId) {
        try {
          await chrome.tabs.get(savedState.curTabId);
          curTabId = savedState.curTabId;
        } catch (e) {
          console.info('[initializeState] Saved tab not found');
        }
      }
      if (savedState.preTabId) {
        try {
          await chrome.tabs.get(savedState.preTabId);
          preTabId = savedState.preTabId;
        } catch (e) {
          preTabId = null;
        }
      }
      if (savedState.tabHistory && Array.isArray(savedState.tabHistory)) {
        const validHistory = [];
        for (const tabId of savedState.tabHistory) {
          try {
            await chrome.tabs.get(tabId);
            validHistory.push(tabId);
          } catch (e) {}
        }
        tabHistory = validHistory;
        if (tabHistory.length > 1 && preTabId === null && savedState.preTabId) {
          try {
            await chrome.tabs.get(tabHistory[1]);
            preTabId = tabHistory[1];
          } catch (e) {}
        }
      }
      curWindowId = currentFocusedWindow.id;
      const currentActiveTab = await getActiveTabInWindow(currentFocusedWindow.id);
      if (currentActiveTab && currentActiveTab.id !== curTabId) {
        curTabId = currentActiveTab.id;
        if (!tabHistory.includes(curTabId)) {
          tabHistory.unshift(curTabId);
          if (tabHistory.length > MAX_HISTORY_SIZE) {
            tabHistory = tabHistory.slice(0, MAX_HISTORY_SIZE);
          }
        }
      }
      await saveStateToStorage();
      return;
    }

    curWindowId = currentFocusedWindow.id;
    const tab = await getActiveTabInWindow(currentFocusedWindow.id);
    if (tab) {
      curTabId = tab.id;
      preTabId = null;
      tabHistory = [tab.id];
    }
    await saveStateToStorage();
  } catch (error) {
    console.error('Error initializing state:', error);
    try {
      const currentFocusedWindow = await chrome.windows.getLastFocused({ populate: false });
      if (currentFocusedWindow) {
        curWindowId = currentFocusedWindow.id;
        const tab = await getActiveTabInWindow(currentFocusedWindow.id);
        if (tab) {
          curTabId = tab.id;
          tabHistory = [tab.id];
        }
        await saveStateToStorage();
      }
    } catch (fallbackError) {
      console.error('Fallback initialization failed:', fallbackError);
    }
  }
}

async function updateTabHistory(newTabId) {
  if (!newTabId) return;
  tabHistory = tabHistory.filter(id => id !== newTabId);
  tabHistory.unshift(newTabId);
  if (tabHistory.length > MAX_HISTORY_SIZE) {
    tabHistory = tabHistory.slice(0, MAX_HISTORY_SIZE);
  }
  preTabId = tabHistory.length > 1 ? tabHistory[1] : null;
  if (curTabId !== newTabId) curTabId = newTabId;
  await saveStateToStorage();
}

async function removeFromHistory(tabId) {
  tabHistory = tabHistory.filter(id => id !== tabId);
  await saveStateToStorage();
}

function showNotification(message) {}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { tabId, windowId } = activeInfo;
  if (tabId) {
    try {
      await chrome.tabs.get(tabId);
      if (chrome.runtime.lastError) return;
      if (windowId !== curWindowId) curWindowId = windowId;
      if (curTabId !== tabId) await updateTabHistory(tabId);
    } catch (error) {
      if (error.message?.includes('Tabs cannot be edited right now')) {}
    }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    // Tab updated
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE || windowId === curWindowId) return;
  try {
    const tab = await getActiveTabInWindow(windowId);
    if (tab) {
      await updateTabHistory(tab.id);
      curWindowId = windowId;
    }
  } catch (error) {
    console.error('Window focus change error:', error.message);
  }
});

let isSwitchingToPreviousTab = false;

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "switch-to-previous-tab") {
    if (isSwitchingToPreviousTab) return;
    isSwitchingToPreviousTab = true;

    try {
      if ((!curTabId || !curWindowId || tabHistory.length === 0) && !preTabId && tabHistory.length <= 1) {
        await initializeState();
      }

      let targetTabId = preTabId;

      if (!targetTabId && tabHistory.length > 1) {
        for (let i = 1; i < tabHistory.length; i++) {
          try {
            const tab = await chrome.tabs.get(tabHistory[i]);
            if (tab) {
              targetTabId = tab.id;
              preTabId = targetTabId;
              await saveStateToStorage();
              break;
            }
          } catch (e) {}
        }
      }

      if (!targetTabId) {
        try {
          const tabs = await chrome.tabs.query({ windowType: 'normal', active: false });
          const currentWindowTabs = tabs
            .filter(tab => tab.windowId === curWindowId)
            .sort((a, b) => b.lastAccessed - a.lastAccessed);
          if (currentWindowTabs.length > 0) {
            targetTabId = currentWindowTabs[0].id;
            preTabId = targetTabId;
            if (!tabHistory.includes(targetTabId)) {
              tabHistory.unshift(targetTabId);
              if (tabHistory.length > MAX_HISTORY_SIZE) {
                tabHistory = tabHistory.slice(0, MAX_HISTORY_SIZE);
              }
            }
            await saveStateToStorage();
          }
        } catch (e) {
          console.error('[Shortcut] Get recent tabs error:', e);
        }
      }

      if (!targetTabId) {
        showNotification(i18n.getMessage('noPrevTab') || 'No previous tab found');
        return;
      }

      const tab = await chrome.tabs.get(targetTabId).catch(() => null);
      if (!tab) {
        await removeFromHistory(targetTabId);
        preTabId = null;
        await saveStateToStorage();
        showNotification(i18n.getMessage('noPrevTab') || 'No previous tab found');
        return;
      }

      await chrome.tabs.update(targetTabId, { active: true });
      if (curWindowId !== tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
        curWindowId = tab.windowId;
      }
      if (targetTabId !== curTabId) await updateTabHistory(targetTabId);
    } catch (e) {
      console.error('[Shortcut] Switch tab error:', e);
    } finally {
      isSwitchingToPreviousTab = false;
    }
  } else if (command === "open-pinned-tabs") {
    await openPinnedTabsUI();
  } else if (command === "_execute_action") {
    try {
      const windows = await chrome.windows.getAll({ windowTypes: ['popup'] });
      for (const window of windows) {
        await chrome.windows.remove(window.id);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      chrome.action.openPopup();
    } catch (error) {
      console.error('[_execute_action] Error:', error);
    }
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (preTabId === tabId) preTabId = null;
  await removeFromHistory(tabId);

  try {
    const result = await chrome.storage.local.get('pinnedTabs');
    const pinnedTabs = result.pinnedTabs || [];
    const filteredTabs = pinnedTabs.filter(tab => {
      if (tab.isLongTermPinned && tab.tabId === tabId) return true;
      return tab.tabId !== tabId;
    });
    if (filteredTabs.length !== pinnedTabs.length) {
      await chrome.storage.local.set({ pinnedTabs: filteredTabs });
    }
  } catch (error) {
    console.error('[background] Remove tab from pinned list error:', error);
  }

  if (curTabId === tabId) {
    try {
      const tabs = await chrome.tabs.query({ windowId: curWindowId, active: true });
      curTabId = tabs.length > 0 ? tabs[0].id : null;
    } catch (e) {
      curTabId = null;
    }
    await updateTabHistory(curTabId);
  }
});

// MV3 建议的稳健写法：listener 必须是非 async 函数，同步瞬间返回布尔值
// （true = 保持通道，供稍后 sendResponse；false = 不响应，交给其他 listener）
// 异步逻辑放 .then/.catch 里执行，否则 async 函数返回 Promise<boolean>，
// Chrome 无法可靠地据此保持消息通道，会导致 sendResponse 丢失 → "port closed"
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const action = message && message.action;
  console.info('[background][msg]', action);

  if (action === "switchToTab") {
    handleSwitchToTab(message.data.tabId, message.data.windowId)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (action === 'languageChanged') {
    i18n.setLanguage(message.language)
      .then(() => {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'languageChanged',
              language: message.language
            }).catch(() => {});
          });
        });
        sendResponse({ success: true });
      })
      .catch(() => sendResponse({ success: false }));
    return true;
  }

  if (action === 'openMainPopup') {
    (async () => {
      try {
        const windows = await chrome.windows.getAll({ windowTypes: ['popup'] });
        for (const window of windows) {
          await chrome.windows.remove(window.id);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        chrome.action.openPopup();
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (action === 'openPinnedTabs') {
    openPinnedTabsUI()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (action === 'openSettings') {
    (async () => {
      try {
        const settingsUrl = chrome.runtime.getURL('html/settings.html');
        const tabs = await chrome.tabs.query({ url: settingsUrl });
        if (tabs.length > 0) {
          await chrome.tabs.update(tabs[0].id, { active: true });
          if (tabs[0].windowId) await chrome.windows.update(tabs[0].windowId, { focused: true });
        } else {
          chrome.tabs.create({ url: settingsUrl });
        }
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (action === 'openAbout') {
    (async () => {
      try {
        const aboutUrl = chrome.runtime.getURL('html/about.html');
        const tabs = await chrome.tabs.query({ url: aboutUrl });
        if (tabs.length > 0) {
          await chrome.tabs.update(tabs[0].id, { active: true });
          if (tabs[0].windowId) await chrome.windows.update(tabs[0].windowId, { focused: true });
        } else {
          chrome.tabs.create({ url: aboutUrl });
        }
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (action === 'syncQueueAddOperation') {
    SyncQueueService.scheduleSync?.(2000);
    return false;
  }

  if (action === 'AUTH_SUCCESS') {
    (async () => {
      try {
        console.log('[background] AUTH_SUCCESS received');
        const syncResult = await SyncQueueService.performSync();
        if (syncResult?.success && syncResult.isFirstSync && syncResult.pulledData) {
          const toastMessage = i18n.getMessage('firstSyncCompleted');
          await chrome.storage.local.set({ pendingFirstSyncToast: toastMessage });
        }
      } catch (error) {
        console.error('[background] Sync trigger error:', error);
      }
      sendResponse({ success: true });
    })();
    return true;
  }

  // 处理 pinned-list 的 tab 操作委托
  // pinned-list 窗口会立即关闭，由 background 执行实际的 tab 操作
  if (action === 'pinnedListTabAction') {
    handlePinnedListTabAction(message.data)
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('[background] pinnedListTabAction error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (action === 'mtsPinnedOverlayAction') {
    handlePinnedOverlayAction(message, sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // content script 没有 chrome.tabs API，tab 查询由 background 代理
  if (action === 'mtsQueryTabs') {
    (async () => {
      try {
        const tabs = await new Promise((resolve) => {
          chrome.tabs.query(message.query || {}, (result) => {
            resolve(result || []);
          });
        });
        sendResponse({ success: true, tabs: tabs });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (action === 'mtsGetTab') {
    chrome.tabs.get(message.tabId)
      .then(tab => sendResponse({ success: true, tab: tab }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  // 拼音回退搜索：content script 不带 pinyin 字典，由 background 用现有 pinyin-util 代理
  if (action === 'mtsPinyinMatch') {
    (async () => {
      try {
        const { pinyinUtil } = await import(chrome.runtime.getURL('js/pinyin-util.js'));
        const lowerTitles = message.titles || []; // [{url, title}]
        const keywords = message.keywords || [];
        // 对每个 tab：标题转拼音后，按「完整包含」匹配所有关键字
        const hits = [];
        lowerTitles.forEach(function (item) {
          const py = pinyinUtil.toPinyinForSearch ? pinyinUtil.toPinyinForSearch(item.title) : pinyinUtil.toPinyin(item.title || '');
          const lowerPy = py.toLowerCase();
          const ok = keywords.every(function (kw) {
            return lowerPy.includes(kw.toLowerCase());
          });
          if (ok) hits.push({ url: item.url, title: item.title });
        });
        sendResponse({ success: true, hits: hits });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // 未匹配任何分支：不保活通道，返回 false
  return false;
});

async function handleSwitchToTab(targetTabId, windowId) {
  await chrome.tabs.get(targetTabId);
  await chrome.tabs.update(targetTabId, { active: true });
  if (windowId && windowId !== curWindowId) {
    await chrome.windows.update(windowId, { focused: true });
    curWindowId = windowId;
  }
  if (targetTabId !== curTabId) {
    curTabId = targetTabId;
    await updateTabHistory(targetTabId);
  }
}

/**
 * 等待 tab 加载完成，返回最终的 URL
 * @param {number} tabId - tab ID
 * @param {number} timeout - 超时时间（毫秒），默认 5 秒
 * @returns {Promise<string>} 最终的 URL
 */
function waitForTabLoad(tabId, timeout = 5000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      // 超时后获取当前 URL
      chrome.tabs.get(tabId).then(tab => resolve(tab.url)).catch(() => resolve(''));
    }, timeout);

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        chrome.tabs.get(tabId).then(tab => resolve(tab.url)).catch(() => resolve(''));
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * 处理 pinned-list 委托的 tab 操作
 * pinned-list 窗口在发送消息后立即关闭，由 background 执行实际操作
 * @param {Object} data - 操作数据
 * @param {string} data.operation - 操作类型：'switchDirect' | 'switchOnly' | 'switchAndUpdate' | 'openNew' | 'extensionsSpecial' | 'noMatch'
 * @param {number} data.tabId - 目标 tab ID（switchDirect/switchOnly/switchAndUpdate 时使用）
 * @param {number} data.windowId - 目标窗口 ID（可选）
 * @param {string} data.targetUrl - 原始目标 URL（用于 storage 更新查找）
 * @param {string} data.matchedUrl - 匹配到的 URL（switchAndUpdate 时更新到 storage）
 * @param {string} data.matchedTitle - 匹配到的标题（switchAndUpdate 时更新到 storage）
 * @param {number} data.existingTabId - 已存在的 tab ID（extensionsSpecial 时使用）
 */
async function handlePinnedListTabAction(data) {
  if (!data || !data.operation) {
    console.error('[background] pinnedListTabAction: missing operation');
    throw new Error('missing operation');
  }

  const { operation, tabId, windowId, targetUrl, matchedUrl, matchedTitle, existingTabId } = data;

  switch (operation) {
    case 'switchDirect':
    case 'switchOnly':
    case 'switchAndUpdate':
      if (!tabId) {
        console.error(`[background] ${operation}: missing tabId`);
        throw new Error(`${operation}: missing tabId`);
      }
      try {
        await activateTab(tabId, windowId);
      } catch (tabError) {
        // tabId 已失效（浏览器重启后 tabId 变化、同步拉下的脏数据等）。
        // switchDirect 且带 targetUrl 时降级为打开新标签页，保持"点了就能到"的语义
        if (operation === 'switchDirect' && targetUrl) {
          console.info(`[background] ${operation}: tabId ${tabId} invalid, fallback to openNew:`, tabError.message);
          const newTab = await chrome.tabs.create({ url: targetUrl, active: true });
          const finalUrl = await waitForTabLoad(newTab.id) || targetUrl;
          await updatePinnedTabUrlAndId(targetUrl, finalUrl, newTab.id);
          break;
        }
        throw tabError;
      }
      if (operation === 'switchAndUpdate') {
        await updatePinnedTabUrlAndId(targetUrl, matchedUrl, tabId, matchedTitle);
      } else if (operation === 'switchDirect' && targetUrl) {
        await updatePinnedTabId(targetUrl, tabId);
      }
      break;

    case 'openNew': {
      if (!targetUrl) {
        console.error('[background] openNew: missing targetUrl');
        return;
      }
      const newTab = await chrome.tabs.create({ url: targetUrl, active: true });
      const finalUrl = await waitForTabLoad(newTab.id) || targetUrl;
      await updatePinnedTabUrlAndId(targetUrl, finalUrl, newTab.id);
      break;
    }

    case 'extensionsSpecial': {
      if (!existingTabId || !targetUrl) {
        console.error('[background] extensionsSpecial: missing existingTabId or targetUrl');
        return;
      }
      await chrome.tabs.update(existingTabId, { url: targetUrl, active: true });
      const tabInfo = await chrome.tabs.get(existingTabId);
      if (tabInfo.windowId) {
        await chrome.windows.update(tabInfo.windowId, { focused: true });
      }
      await updatePinnedTabId(targetUrl, existingTabId);
      break;
    }

    case 'noMatch': {
      if (!targetUrl) {
        console.error('[background] noMatch: missing targetUrl');
        return;
      }
      console.info('[background] noMatch: opening new tab for', targetUrl);
      const newTab = await chrome.tabs.create({ url: targetUrl });
      const finalUrl = await waitForTabLoad(newTab.id) || targetUrl;
      await updatePinnedTabUrlAndId(targetUrl, finalUrl, newTab.id);
      break;
    }

    default:
      console.warn('[background] Unknown pinnedListTabAction operation:', operation);
      throw new Error('unknown operation: ' + operation);
  }
}

/**
 * 激活 tab 并聚焦窗口
 * @param {number} tabId - tab ID
 * @param {number} [windowId] - 窗口 ID（可选）
 */
async function activateTab(tabId, windowId) {
  await chrome.tabs.update(tabId, { active: true });
  if (windowId) {
    await chrome.windows.update(windowId, { focused: true });
  }
}

// ============== 注入式固定标签页弹窗（方案 B） ==============

/**
 * 判断 URL 是否为内容脚本无法注入的受限页面
 * @param {string} url - 页面 URL
 * @returns {boolean}
 */
function isRestrictedPageForOverlay(url) {
  if (!url) return true;
  const restrictedPrefixes = [
    'chrome://', 'chrome-extension://', 'edge://', 'about:',
    'view-source:', 'devtools:', 'https://chrome.google.com/webstore',
    'https://chromewebstore.google.com', 'https://microsoftedge.microsoft.com/addons'
  ];
  return restrictedPrefixes.some(prefix => url.startsWith(prefix));
}

/**
 * 打开固定标签页 UI（双模式）
 * 优先向当前活动标签页注入自绘居中弹窗（无系统标题栏、宽度可控）；
 * 受限页面或注入失败时降级为独立 popup 窗口（原有 pinned-list.html 方案）。
 */
async function openPinnedTabsUI() {
  // 已有 popup 窗口时先关闭（toggle 行为，与原逻辑一致）
  const windows = await chrome.windows.getAll({ windowTypes: ['popup'] });
  if (windows.length > 0) {
    for (const w of windows) {
      await chrome.windows.remove(w.id);
    }
    await chrome.storage.local.remove('pinnedTabsWindowId');
    return;
  }

  // 尝试注入式弹窗
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && !isRestrictedPageForOverlay(activeTab.url)) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['js/pinned-overlay-content.js']
        });
        // 必须带 callback：保证 content script 的 sendResponse 端口存活，
        // 否则响应可能丢失导致误判注入失败而重复打开 popup 窗口
        const resp = await new Promise((resolve) => {
          let settled = false;
          const timer = setTimeout(() => {
            if (!settled) { settled = true; resolve(null); }
          }, 1500);
          try {
            chrome.tabs.sendMessage(activeTab.id, { action: 'mtsTogglePinnedOverlay' }, (r) => {
              if (!settled) { settled = true; clearTimeout(timer); resolve(r || null); }
            });
          } catch (e) {
            if (!settled) { settled = true; clearTimeout(timer); resolve(null); }
          }
        });
        if (resp && resp.success && resp.visible) {
          return; // 注入式弹窗已打开
        }
        if (resp && resp.success && !resp.visible) {
          return; // toggle 关闭了已打开的弹窗，同样视为已处理
        }
        // resp 存在但 success=false，或超时无响应 → 降级
      } catch (injectError) {
        console.info('[open-pinned-tabs] Overlay inject failed, fallback to popup window:', injectError?.message);
      }
    }
  } catch (error) {
    console.info('[open-pinned-tabs] Overlay path error, fallback:', error?.message);
  }

  // 降级：独立 popup 窗口（pinned-list.html）
  await openPinnedTabsWindow();
}

/**
 * 打开独立 popup 窗口（原有方案，作为降级路径保留）
 */
async function openPinnedTabsWindow() {
  const windowWidth = PINNED_TABS_CONFIG?.WINDOW_WIDTH || 400;
  const windowHeight = PINNED_TABS_CONFIG?.WINDOW_HEIGHT || 600;
  let screenWidth = 1920, screenHeight = 1080;

  try {
    const displays = await chrome.system.display.getInfo();
    if (displays?.length > 0) {
      const primaryDisplay = displays.find(d => d.isPrimary) || displays[0];
      screenWidth = primaryDisplay.workArea.width || 1920;
      screenHeight = primaryDisplay.workArea.height || 1080;
    }
  } catch (error) {}

  const newWindow = await chrome.windows.create({
    url: chrome.runtime.getURL('html/pinned-list.html'),
    type: 'popup',
    width: windowWidth,
    height: windowHeight,
    left: Math.round((screenWidth - windowWidth) / 2),
    top: Math.round((screenHeight - windowHeight) / 2)
  });

  await chrome.storage.local.set({ pinnedTabsWindowId: newWindow.id });
}

/**
 * 校验并执行「长期固定」/「取消长期固定」
 * 完整复刻 pinned-list.js handleLongTermPinnedClick 的业务规则。
 * @param {string} url - 固定 tab 的 URL
 * @param {number} [tabId] - 固定 tab 的 tabId（可能为 undefined）
 * @param {boolean} isCurrentlyLongTermPinned - 当前是否已长期固定
 * @returns {Promise<{allowed:boolean, stop?:{toast:string}, applyToggle?:Function}>}
 */
async function resolveLongTermToggle(url, tabId, isCurrentlyLongTermPinned) {
  // 邮箱验证
  const isEmailVerified = await authService.isEmailVerified();
  if (!isEmailVerified) {
    return {
      allowed: false,
      stop: { toast: i18n.getMessage('longTermPinnedRequireVerification') || '长期固定功能需要完成邮箱验证后才能使用哦！' }
    };
  }

  // 读取当前固定列表，找到目标条目
  const result = await chrome.storage.local.get('pinnedTabs');
  const pinnedTabs = result.pinnedTabs || [];
  const currentTab = pinnedTabs.find(t =>
    (url && t.url === url) || (tabId !== undefined && t.tabId === tabId)
  );

  // 体验期状态（乐观模式，本地缓存优先）
  let localTrialStatus = null;
  let trialStatusError = null;
  try {
    localTrialStatus = await trialService.getTrialStatus();
  } catch (e) {
    trialStatusError = e;
  }

  // 额度检查与切换动作（在满足条件时执行）
  const makeApplier = (next) => async () => {
    const now = new Date().toISOString();
    // 写库前重新读取最新 pinnedTabs，缩小并发竞态窗口（防覆盖他端/后台变更）
    const freshResult = await chrome.storage.local.get('pinnedTabs');
    const freshTabs = freshResult.pinnedTabs || [];
    const updated = freshTabs.map(t => {
      if ((url && t.url === url) || (tabId !== undefined && t.tabId === tabId)) {
        return { ...t, isLongTermPinned: next, longTermPinnedAt: next ? now : null };
      }
      return t;
    });
    await chrome.storage.local.set({ pinnedTabs: updated });
    // 服务器同步
    try {
      const syncModule = await import(chrome.runtime.getURL('js/services/sync-queue.service.js'));
      syncModule.default.addOperation('updateTab', {
        tabId: tabId !== undefined && tabId !== null ? tabId : ('url:' + url),
        url,
        isLongTermPinned: next,
        longTermPinnedAt: next ? now : null
      }).catch(() => {});
    } catch (e) { /* 同步失败不影响本地 */ }
  };
  const applySet = makeApplier(true);
  const applyCancel = makeApplier(false);

  const checkLimit = async () => {
    const limit = await featureLimitService.getFeatureLimit('longTermPinned', false, true);
    const longTermCount = pinnedTabs.filter(t => t.isLongTermPinned).length;
    if (!isCurrentlyLongTermPinned && limit !== -1 && longTermCount >= limit) {
      return { blocked: true, limit };
    }
    return { blocked: false };
  };

  // 体验期内：限量 100（getFeatureLimit 决定）
  if (localTrialStatus && localTrialStatus.isInTrialPeriod) {
    const lim = await checkLimit();
    if (lim.blocked) {
      return { allowed: false, stop: { toast: i18n.getMessage('pinnedTabsLimit', lim.limit.toString()) || `长期固定标签页数量已达上限（最多${lim.limit}个）` } };
    }
    trialService.fetchTrialStatus().catch(err => console.info('[background] fetchTrialStatus failed:', err));
    return { allowed: true, applyToggle: isCurrentlyLongTermPinned ? applyCancel : applySet };
  }

  // VIP 或 服务器异常乐观模式：限量
  let vipStatus = null;
  let vipStatusError = null;
  try {
    vipStatus = await vipService.getVipStatus(false);
  } catch (e) {
    vipStatusError = e;
  }

  if ((vipStatus && vipStatus.isVip) || trialStatusError || vipStatusError) {
    if (trialStatusError || vipStatusError) {
      console.info('[background] trial/vip server error, optimistic mode');
    }
    const lim = await checkLimit();
    if (lim.blocked) {
      return { allowed: false, stop: { toast: i18n.getMessage('pinnedTabsLimit', lim.limit.toString()) || `长期固定标签页数量已达上限（最多${lim.limit}个）` } };
    }
    return { allowed: true, applyToggle: isCurrentlyLongTermPinned ? applyCancel : applySet };
  }

  // 体验期结束 + 非 VIP 普通用户：限量并引导升级（用体验期映射的专用提示）
  const lim = await checkLimit();
  if (lim.blocked) {
    const trialEnabled = localTrialStatus && localTrialStatus.trialEnabled;
    const messageKey = trialEnabled ? 'longTermPinnedLimitExpired' : 'longTermPinnedLimitNoTrial';
    const fallback = trialEnabled
      ? `长期固定标签页数量已达上限（最多${lim.limit}个），体验期已结束，升级VIP会员即可继续使用更多功能哦！`
      : `长期固定标签页数量已达上限（最多${lim.limit}个），升级VIP会员即可继续使用更多功能！`;
    return { allowed: false, stop: { toast: i18n.getMessage(messageKey) || fallback } };
  }

  return { allowed: true, applyToggle: isCurrentlyLongTermPinned ? applyCancel : applySet };
}

/**
 * 处理注入式弹窗的 tab 操作（closeTab / refreshTab / syncLongTerm）
 * @param {Object} message - 消息
 * @param {Function} sendResponse - 响应回调
 */
async function handlePinnedOverlayAction(message, sendResponse) {
  try {
    switch (message.op) {
      case 'closeTab': {
        const { tabId, tabUrl, isLongTermPinned } = message;
        let closed = false;
        if (tabId != null) {
          try {
            await chrome.tabs.get(tabId);
            await chrome.tabs.remove(tabId);
            closed = true;
          } catch (e) { /* tabId 无效 */ }
        }
        if (!closed && tabUrl) {
          const allTabs = await chrome.tabs.query({});
          const matches = allTabs.filter(t => t.url === tabUrl);
          if (matches.length > 0) {
            await chrome.tabs.remove(matches[0].id);
            closed = true;
          }
        }
        // 非长期固定的 tab：从列表中移除
        if (!isLongTermPinned) {
          const result = await chrome.storage.local.get('pinnedTabs');
          const pinnedTabs = (result.pinnedTabs || []).filter(t =>
            !((tabUrl && t.url === tabUrl) || (tabId != null && t.tabId === tabId))
          );
          await chrome.storage.local.set({ pinnedTabs });
        }
        sendResponse({ success: closed || isLongTermPinned });
        break;
      }

      case 'refreshTab': {
        try {
          await chrome.tabs.reload(message.tabId);
          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        break;
      }

      case 'syncLongTerm': {
        try {
          const syncQueueService = await import(chrome.runtime.getURL('js/services/sync-queue.service.js'));
          syncQueueService.default.addOperation('updateTab', {
            tabId: message.tabId,
            url: message.url,
            isLongTermPinned: message.isLongTermPinned,
            longTermPinnedAt: message.longTermPinnedAt
          }).catch(() => {});
          sendResponse({ success: true });
        } catch (e) {
          // 同步失败不影响本地操作
          sendResponse({ success: false, error: e.message });
        }
        break;
      }

      case 'toggleLongTerm': {
        // 完整复刻 pinned-list.js handleLongTermPinnedClick 的校验链后再执行切换。
        // 校验在 background 进行，因为 content script 无法访问这些服务层。
        const { tabId, url, isCurrentlyLongTermPinned } = message;
        try {
          const { allowed, stop, applyToggle } = await resolveLongTermToggle(url, tabId, isCurrentlyLongTermPinned);
          if (!allowed) {
            sendResponse({ success: false, blocked: true, toast: stop.toast });
            break;
          }
          await applyToggle();
          sendResponse({ success: true, toggleApplied: true });
        } catch (e) {
          console.error('[background] toggleLongTerm error:', e);
          sendResponse({ success: false, error: e.message });
        }
        break;
      }

      case 'syncTabOrder': {
        try {
          // 按新顺序重排服务器侧固定列表（全量 url 顺序）
          const result = await chrome.storage.local.get('pinnedTabs');
          const pinnedTabs = result.pinnedTabs || [];
          const urlSet = new Set(message.urls || []);
          const ordered = [];
          for (const url of message.urls || []) {
            const tab = pinnedTabs.find(t => t.url === url);
            if (tab) ordered.push(tab);
          }
          // 兜底：不在 urls 里的（新增未同步的）追加到末尾，避免丢数据
          for (const t of pinnedTabs) {
            if (!urlSet.has(t.url)) ordered.push(t);
          }
          if (ordered.length === pinnedTabs.length) {
            await chrome.storage.local.set({ pinnedTabs: ordered });
          }
          // 服务器同步：逐条 updateTab 队列成本高，v1 仅本地重排；
          // 服务器侧顺序以 addTab 时间为准，后续版本再补 order 字段
          sendResponse({ success: true, reordered: ordered.length === pinnedTabs.length });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        break;
      }

      default:
        sendResponse({ success: false, error: 'unknown op: ' + message.op });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 更新 pinned-list 中 tab 的 URL、tabId 和 title
 * @param {string} oldUrl - 旧的 URL（用于查找 tab）
 * @param {string} newUrl - 新的 URL
 * @param {number} newTabId - 新的 tabId
 * @param {string} [newTitle] - 新的标题（可选）
 */
async function updatePinnedTabUrlAndId(oldUrl, newUrl, newTabId, newTitle) {
  if (!oldUrl || !newUrl || newTabId === undefined || newTabId === null) {
    console.error('[background] updatePinnedTabUrlAndId: invalid params', { oldUrl, newUrl, newTabId });
    return;
  }

  // 如果 URL 没变，只更新 tabId 和 title
  if (oldUrl === newUrl) {
    await updatePinnedTabId(oldUrl, newTabId);
    return;
  }

  const result = await chrome.storage.local.get('pinnedTabs');
  const pinnedTabs = result.pinnedTabs || [];

  let updated = false;
  let updatedTab = null;
  const updatedTabs = pinnedTabs.map(t => {
    if (!updated && t.url === oldUrl) {
      updated = true;
      updatedTab = { ...t, url: newUrl, tabId: newTabId };
      if (newTitle) {
        updatedTab.title = newTitle;
      }
      return updatedTab;
    }
    return t;
  });

  if (updated) {
    await chrome.storage.local.set({ pinnedTabs: updatedTabs });

    // 如果是长期固定的 tab，同步 URL/title 变化到服务器
    if (updatedTab && updatedTab.isLongTermPinned) {
      const syncData = {
        tabId: 'url:' + newUrl,
        url: newUrl,
        isLongTermPinned: true,
        longTermPinnedAt: updatedTab.longTermPinnedAt
      };
      if (newTitle) {
        syncData.title = newTitle;
      }
      SyncQueueService.addOperation('updateTab', syncData)
        .catch(err => console.info('[background] Sync updateTab failed:', err));
    }
  }
}

/**
 * 仅更新 pinned-list 中 tab 的 tabId
 * @param {string} targetUrl - 目标 URL（用于查找 tab）
 * @param {number} newTabId - 新的 tabId
 */
async function updatePinnedTabId(targetUrl, newTabId) {
  if (!targetUrl || newTabId === undefined || newTabId === null) {
    console.error('[background] updatePinnedTabId: invalid params', { targetUrl, newTabId });
    return;
  }

  const result = await chrome.storage.local.get('pinnedTabs');
  const pinnedTabs = result.pinnedTabs || [];

  let updated = false;
  const updatedTabs = pinnedTabs.map(t => {
    if (!updated && t.url === targetUrl) {
      updated = true;
      return { ...t, tabId: newTabId };
    }
    return t;
  });

  if (updated) {
    await chrome.storage.local.set({ pinnedTabs: updatedTabs });
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const { reason } = details;
  if (reason === 'install') {
    console.log('[TabSearch] Extension newly installed');
    await clearAllStorage();
  } else if (reason === 'update') {
    console.log('[TabSearch] Extension updated');
  }
  await initializeAll();
});

chrome.runtime.onStartup.addListener(async () => {
  await initializeAll();
});

async function shouldRefreshToken() {
  try {
    const isRegistered = await authService.isRegistered();
    if (!isRegistered) return false;
    const { accessToken, tokenExpiresAt } = await chrome.storage.local.get([
      STORAGE_KEYS_LOCAL.accessToken,
      STORAGE_KEYS_LOCAL.tokenExpiresAt
    ]);
    if (!accessToken || !tokenExpiresAt) return true;
    const expiresAt = new Date(tokenExpiresAt).getTime();
    const now = Date.now();
    const refreshThreshold = 5 * 24 * 60 * 60 * 1000;
    return expiresAt - now < refreshThreshold;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true;
  }
}

async function refreshAccessToken() {
  try {
    const { accessToken } = await chrome.storage.local.get(STORAGE_KEYS_LOCAL.accessToken);
    if (!accessToken) return false;
    const response = await authApi.refreshToken(accessToken);
    if (response.data?.accessToken) {
      await chrome.storage.local.set({
        [STORAGE_KEYS_LOCAL.accessToken]: response.data.accessToken,
        [STORAGE_KEYS_LOCAL.tokenExpiresAt]: response.data.expiresAt
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to refresh token:', error);
    await chrome.storage.local.remove([
      STORAGE_KEYS_LOCAL.accessToken,
      STORAGE_KEYS_LOCAL.tokenExpiresAt
    ]);
    return false;
  }
}

async function performSilentRegistration() {
  try {
    console.log('Starting silent registration...');
    const result = await authService.silentRegister();
    if (result) {
      console.log('Silent registration completed successfully');
    }
  } catch (error) {
    console.error('Error during silent registration:', error);
  }
}

async function periodicTokenRefresh() {
  try {
    const needsRefresh = await shouldRefreshToken();
    if (needsRefresh) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        await authService.getAccessToken();
      }
    }
  } catch (error) {
    console.error('Error in periodic token refresh:', error);
  }
}

async function initializeAll() {
  try {
    await i18n.initialize();
    await initializeState();
    await performSilentRegistration();
    await periodicTokenRefresh();
    initializeSyncQueue();
  } catch (error) {
    console.error('[Background] Failed to initialize:', error);
  }
}

function initializeSyncQueue() {
  try {
    const syncInterval = PINNED_TABS_CONFIG?.SYNC_INTERVAL || 30 * 60 * 1000;
    SyncQueueService.startPeriodicSync(syncInterval);
    console.log('[Background] Sync queue service initialized');
  } catch (error) {
    console.error('[Background] Failed to initialize sync queue:', error);
  }
}

async function clearAllStorage() {
  try {
    await chrome.storage.local.clear();
  } catch (error) {
    console.error('[Background] Failed to clear storage:', error);
  }
}

chrome.alarms.create('tokenRefresh', { periodInMinutes: 720 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'tokenRefresh') {
    periodicTokenRefresh();
  }
});
