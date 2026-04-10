/**
 * background.js - Service Worker
 * Chrome Extension background script
 */

import { API_CONFIG, PINNED_TABS_CONFIG } from './config.js';
import authService from './services/auth.service.js';
import authApi from './api/auth.js';
import { SyncQueueService } from './services/sync-queue.common.js';

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
    try {
      const result = await chrome.storage.local.get('pinnedTabsWindowId');
      const savedWindowId = result.pinnedTabsWindowId;

      if (savedWindowId) {
        try {
          await chrome.windows.get(savedWindowId);
          await chrome.windows.remove(savedWindowId);
          await chrome.storage.local.remove('pinnedTabsWindowId');
          return;
        } catch (error) {
          await chrome.storage.local.remove('pinnedTabsWindowId');
        }
      }

      const windows = await chrome.windows.getAll({ windowTypes: ['popup'] });
      if (windows.length > 0) {
        await chrome.windows.remove(windows[0].id);
        await chrome.storage.local.remove('pinnedTabsWindowId');
        return;
      }

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
    } catch (error) {
      console.error('[open-pinned-tabs] Error:', error);
      await chrome.storage.local.remove('pinnedTabsWindowId');
    }
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

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "switchToTab") {
    try {
      await handleSwitchToTab(message.data.tabId, message.data.windowId);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  if (message.action === 'languageChanged') {
    await i18n.setLanguage(message.language);
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'languageChanged',
          language: message.language
        }).catch(() => {});
      });
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'openMainPopup') {
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
    return true;
  }

  if (message.action === 'openPinnedTabs') {
    try {
      const result = await chrome.storage.local.get('pinnedTabsWindowId');
      if (result.pinnedTabsWindowId) {
        try {
          await chrome.windows.update(result.pinnedTabsWindowId, { focused: true });
          sendResponse({ success: true });
          return;
        } catch (error) {
          await chrome.storage.local.remove('pinnedTabsWindowId');
        }
      }

      const windows = await chrome.windows.getAll({ windowTypes: ['popup'] });
      if (windows.length > 0) {
        await chrome.windows.update(windows[0].id, { focused: true });
        await chrome.storage.local.set({ pinnedTabsWindowId: windows[0].id });
        sendResponse({ success: true });
        return;
      }

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
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  if (message.action === 'openSettings') {
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
    return true;
  }

  if (message.action === 'openAbout') {
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
    return true;
  }

  if (message.action === 'syncQueueAddOperation') {
    SyncQueueService.scheduleSync?.(2000);
    return false;
  }

  if (message.action === 'AUTH_SUCCESS') {
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
    return true;
  }
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
