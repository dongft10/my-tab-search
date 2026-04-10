// background.js

// 导入通用配置文件（Service Worker 版本）
try {
  importScripts('./config.sw.js');
} catch (error) {
  console.error('[background] Failed to import config.sw.js:', error);
}

// 导入版本管理器（必须在 client.js 之前）
try {
  importScripts('./utils/version-manager.sw.js');
  console.log('[background] Successfully imported version-manager.sw.js');
} catch (error) {
  console.error('[background] Failed to import version-manager.sw.js:', error);
}

// 导入客户端服务（依赖 version-manager）
try {
  importScripts('./api/client.sw.js');
  console.log('[background] Successfully imported client.sw.js');
} catch (error) {
  console.error('[background] Failed to import client.sw.js:', error);
}

// 导入API服务（依赖 client.js）
try {
  importScripts('./api/auth.sw.js');
  console.log('[background] Successfully imported auth.sw.js');
} catch (error) {
  console.error('[background] Failed to import auth.sw.js:', error);
}

// 导入认证服务（依赖 auth.js）
try {
  importScripts('./services/auth.service.sw.js');
  console.log('[background] Successfully imported auth.service.sw.js');
} catch (error) {
  console.error('[background] Failed to import auth.service.sw.js:', error);
}

// 导入同步队列服务（Service Worker 版本）
try {
  importScripts('./services/sync-queue.common.js');
} catch (error) {
  console.error('[background] Failed to import sync-queue.common.js:', error);
}

// 注意：API_CONFIG, PINNED_TABS_CONFIG 等全局变量已通过 importScripts 导入的文件设置
// 如果需要从 CONFIG_COMMON 获取配置，可以使用以下方式：
const _bgGlobal = typeof self !== 'undefined' ? self : {};
if (typeof CONFIG_COMMON !== 'undefined') {
  if (!_bgGlobal.API_CONFIG && CONFIG_COMMON.API_CONFIG) {
    _bgGlobal.API_CONFIG = CONFIG_COMMON.API_CONFIG;
  }
  if (!_bgGlobal.PINNED_TABS_CONFIG && CONFIG_COMMON.PINNED_TABS_CONFIG) {
    _bgGlobal.PINNED_TABS_CONFIG = CONFIG_COMMON.PINNED_TABS_CONFIG;
  }
  if (!_bgGlobal.STORAGE_KEYS && CONFIG_COMMON.STORAGE_KEYS) {
    _bgGlobal.STORAGE_KEYS = CONFIG_COMMON.STORAGE_KEYS;
  }
}

// 存储键名常量（转换为小写驼峰格式以兼容现有代码）
// 优先使用 CONFIG_COMMON 中导出的 STORAGE_KEYS，如果没有则使用默认值
const _storageKeys = (typeof CONFIG_COMMON !== 'undefined' && CONFIG_COMMON.STORAGE_KEYS) 
  ? CONFIG_COMMON.STORAGE_KEYS 
  : null;
const STORAGE_KEYS_LOCAL = {
  userId: _storageKeys ? _storageKeys.USER_ID : 'userId',
  deviceId: _storageKeys ? _storageKeys.DEVICE_ID : 'deviceId',
  accessToken: _storageKeys ? _storageKeys.ACCESS_TOKEN : 'accessToken',
  tokenExpiresAt: _storageKeys ? _storageKeys.TOKEN_EXPIRES_AT : 'tokenExpiresAt',
  registeredAt: _storageKeys ? _storageKeys.REGISTERED_AT : 'registeredAt'
};

// 使用 chrome.storage 持久化固定标签页弹窗的窗口 ID
// 因为 Service Worker 可能会被挂起和重新启动，全局变量会被重置

// 监听窗口关闭事件，清除窗口 ID
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

// i18n helper functions for background.js
const i18n = {
  language: 'en',
  messages: {},
  loadedLanguages: new Set(),

  // Initialize i18n
  async initialize() {
    try {
      // console.log('[i18n] Initializing i18n system');

      const result = await chrome.storage.sync.get('language');
      if (result.language) {
        this.language = result.language;
        // console.log(`[i18n] Loaded language preference: ${this.language}`);
      } else {
        const browserLang = chrome.i18n.getUILanguage();
        this.language = browserLang.startsWith('zh') ? 'zh_CN' : 'en';
        // console.log(`[i18n] Using browser language: ${browserLang}, set to: ${this.language}`);
      }

      await this.loadMessages(this.language);
      // console.log('[i18n] Initialization complete');
    } catch (error) {
      console.error('[i18n] Failed to initialize i18n in background:', error);
      // Set default values even if initialization fails
      this.language = 'en';
      this.messages['en'] = {};
    }
  },

  // Load messages for a specific language
  async loadMessages(lang) {
    try {
      if (this.loadedLanguages.has(lang)) {
        // console.log(`[i18n] Language ${lang} already loaded, skipping`);
        return;
      }

      // console.log(`[i18n] Loading messages for language: ${lang}`);

      const response = await fetch(`/_locales/${lang}/messages.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to load messages for ${lang}`);
      }

      const messages = await response.json();

      if (!messages || typeof messages !== 'object') {
        throw new Error(`Invalid messages format for ${lang}`);
      }

      this.messages[lang] = messages;
      this.loadedLanguages.add(lang);
      // console.log(`[i18n] Successfully loaded messages for ${lang}`);
    } catch (error) {
      console.error(`[i18n] Failed to load messages for ${lang}:`, error);

      // Fallback to English if the requested language is not English
      if (lang !== 'en') {
        // console.log(`[i18n] Falling back to English`);
        await this.loadMessages('en');
      } else {
        // If even English fails, we have a serious problem
        console.error('[i18n] Critical error: Failed to load English messages');
      }
    }
  },

  // Get message for a key
  getMessage(key, replacements = null) {
    let message = this._getMessageFromLang(key, this.language);

    if (!message) {
      message = this._getMessageFromLang(key, 'en');
    }

    if (!message) {
      return key;
    }

    if (replacements) {
      if (Array.isArray(replacements)) {
        replacements.forEach((replacement, index) => {
          message = message.replace(`$${index + 1}`, replacement);
        });
      } else if (typeof replacements === 'string') {
        message = message.replace('$1', replacements);
      }
    }

    return message;
  },

  // Get message from specific language
  _getMessageFromLang(key, lang) {
    if (this.messages[lang] && this.messages[lang][key]) {
      return this.messages[lang][key].message;
    }
    return null;
  },

  // Set language
  async setLanguage(lang) {
    if (this.language === lang) {
      return;
    }

    this.language = lang;
    await this.loadMessages(lang);
  }
};

// 初始化变量
let curTabId = null;
let preTabId = null;
let curWindowId = null;

// 标签页历史记录栈（用于支持更灵活的切换）
let tabHistory = []; // 存储历史 tabId，最新的在前面
const MAX_HISTORY_SIZE = 20; // 最大历史记录数量

// 方法：保存状态到 storage
async function saveStateToStorage() {
  try {
    await chrome.storage.local.set({
      curTabId: curTabId,
      preTabId: preTabId,
      curWindowId: curWindowId,
      tabHistory: tabHistory
    });
    // console.log('[Storage] 状态已保存:', {curTabId, preTabId, curWindowId, tabHistory});
  } catch (error) {
    console.error('[Storage] 保存状态失败:', error);
  }
}

// 方法：从 storage 读取状态
async function loadStateFromStorage() {
  try {
    return await chrome.storage.local.get(['curTabId', 'preTabId', 'curWindowId', 'tabHistory']);
  } catch (error) {
    console.error('[Storage] 读取状态失败:', error);
    return {};
  }
}

// 方法：通过窗口ID查询当前活动标签页
async function getActiveTabInWindow(windowId) {
  try {
    const tabs = await chrome.tabs.query({
      active: true,
      windowId: windowId
    });
    return tabs[0]; // 返回当前活动标签页
  } catch (error) {
    console.error('Error getting active tab in window:', error);
    return null;
  }
}

// 方法：初始化扩展状态
async function initializeState() {
  try {
    // 首先检查内存中的变量是否有值
    if (curTabId || preTabId || curWindowId) {
      // console.log('[initializeState] 内存中已有状态，无需初始化:', {curTabId, preTabId, curWindowId});
      // 如果内存中有值，说明 service worker 还在活跃状态，不需要从 storage 恢复
      return;
    }

    // 获取当前焦点窗口
    const currentFocusedWindow = await chrome.windows.getLastFocused({ populate: false });
    if (!currentFocusedWindow) return;

    // 内存中没有值，从 storage 读取已保存的状态
    const savedState = await loadStateFromStorage();

    // 如果 storage 中有数据，尝试恢复
    if (savedState.curTabId || savedState.preTabId || savedState.curWindowId || (savedState.tabHistory && savedState.tabHistory.length > 0)) {
      // console.log('[initializeState] 从 storage 恢复状态');

      // 验证 curTabId 是否仍然存在
      if (savedState.curTabId) {
        try {
          const tab = await chrome.tabs.get(savedState.curTabId);
          // 检查标签页是否仍然存在（不再检查是否在同一窗口，因为用户可能切换了窗口）
          curTabId = tab.id;
        } catch (e) {
          console.info('[initializeState] 保存的标签页不存在，需要重新初始化');
        }
      }

      // 验证 preTabId 是否仍然存在
      if (savedState.preTabId) {
        try {
          await chrome.tabs.get(savedState.preTabId);
          // 如果标签页存在，则使用它作为preTabId
          preTabId = savedState.preTabId;
        } catch (e) {
          console.log('[initializeState] 保存的preTabId不存在，将从历史记录中重新确定');
          preTabId = null; // 不设置为无效的preTabId
        }
      }

      // 恢复历史记录（过滤掉不存在的标签页）
      if (savedState.tabHistory && Array.isArray(savedState.tabHistory)) {
        const validHistory = [];
        for (const tabId of savedState.tabHistory) {
          try {
            await chrome.tabs.get(tabId); // 检查标签页是否存在
            validHistory.push(tabId);
          } catch (e) {
            console.log('[initializeState] 历史记录中的标签页不存在，已过滤:', tabId);
          }
        }
        tabHistory = validHistory;

        // 重新计算 preTabId，如果当前preTabId无效的话
        if (tabHistory.length > 1 && preTabId === null && savedState.preTabId) {
          // 检查历史记录中第二个元素是否有效
          try {
            await chrome.tabs.get(tabHistory[1]);
            preTabId = tabHistory[1];
          } catch (e) {
            // 如果历史记录中的preTabId也无效，则使用当前活动标签页之前的标签页作为preTabId
            console.log('[initializeState] 历史记录中的preTabId也无效');
          }
        }
      }

      // 使用当前焦点窗口作为 curWindowId
      curWindowId = currentFocusedWindow.id;

      // 如果当前活动标签页与存储的curTabId不同，需要更新状态
      const currentActiveTab = await getActiveTabInWindow(currentFocusedWindow.id);
      if (currentActiveTab && currentActiveTab.id !== curTabId) {
        // 当前活动的标签页与存储的不同，使用当前活动的标签页作为curTabId
        curTabId = currentActiveTab.id;

        // 将当前标签页添加到历史记录（如果不在其中）
        if (!tabHistory.includes(curTabId)) {
          tabHistory.unshift(curTabId);
          if (tabHistory.length > MAX_HISTORY_SIZE) {
            tabHistory = tabHistory.slice(0, MAX_HISTORY_SIZE);
          }
        }
      }

      // 保存恢复后的状态
      await saveStateToStorage();
      return;
    }

    // 如果内存中没有值且 storage 中也没有有效数据或数据无效，进行正常初始化
    // console.log('[initializeState] 执行正常初始化');

    // 使用当前焦点窗口
    curWindowId = currentFocusedWindow.id;

    // 获取当前活动标签页
    const tab = await getActiveTabInWindow(currentFocusedWindow.id);
    if (tab) {
      curTabId = tab.id;
      preTabId = null;
      tabHistory = [tab.id]; // 初始化历史记录
      // console.log('[TabSearch] State initialized:', {curTabId, preTabId, curWindowId, tabHistory});
    }

    // 保存初始状态
    await saveStateToStorage();
  } catch (error) {
    console.error('Error initializing state:', error);

    // 发生错误时，尝试基本的初始化
    try {
      const currentFocusedWindow = await chrome.windows.getLastFocused({ populate: false });
      if (currentFocusedWindow) {
        curWindowId = currentFocusedWindow.id;
        const tab = await getActiveTabInWindow(currentFocusedWindow.id);
        if (tab) {
          curTabId = tab.id;
          tabHistory = [tab.id];
        }
      }
      await saveStateToStorage();
    } catch (fallbackError) {
      console.error('Fallback initialization also failed:', fallbackError);
    }
  }
}

// 方法：更新标签页历史记录
async function updateTabHistory(newTabId) {
  if (!newTabId) return;

  // 从历史中移除该 tabId（如果存在）
  tabHistory = tabHistory.filter(id => id !== newTabId);

  // 将新的 tabId 添加到历史记录的开头
  tabHistory.unshift(newTabId);

  // 限制历史记录大小
  if (tabHistory.length > MAX_HISTORY_SIZE) {
    tabHistory = tabHistory.slice(0, MAX_HISTORY_SIZE);
  }

  // 更新 preTabId 为历史记录中的第二个元素（即上一个标签页）
  preTabId = tabHistory.length > 1 ? tabHistory[1] : null;

  // 更新当前标签页
  if (curTabId !== newTabId) {
    curTabId = newTabId;
  }

  // 保存到 storage
  await saveStateToStorage();
}

// 方法：从历史记录中移除已关闭的标签页
async function removeFromHistory(tabId) {
  tabHistory = tabHistory.filter(id => id !== tabId);

  // 保存到 storage
  await saveStateToStorage();
}

// 方法：显示通知（已移除通知功能，改为仅打印日志）
function showNotification(message) {
  // 已移除通知功能
}

// 监听标签页激活事件
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { tabId, windowId } = activeInfo
  if (tabId) {
    try {
      await chrome.tabs.get(tabId);
      if (chrome.runtime.lastError) {
        console.info('获取标签页失败:', chrome.runtime.lastError.message);
        return;
      }

      // 更新窗口ID
      if (windowId !== curWindowId) {
        curWindowId = windowId;
      }

      // 只有当激活的标签页与当前记录不同时，才更新状态
      if (curTabId !== tabId) {
        // 更新历史记录
        await updateTabHistory(tabId);
      }

      // console.log("[标签页激活] windowId:" + windowId +
      //   " tabId:" + tabId +
      //   ' curWindowId:' + curWindowId +
      //   " curTabId:" + curTabId +
      //   ' preTabId:' + preTabId +
      //   ' history:' + tabHistory);
    } catch (error) {
      console.error('Error handling tab activation:', error);
      // 处理可能的标签页拖拽错误
      if (error.message && error.message.includes('Tabs cannot be edited right now')) {
        // Tab is being dragged, skip activation logic
      }
    }
  }
});

// 监听标签页更新事件（处理刷新、URL变化等情况）
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  // 只在标签页加载完成或URL变化时处理
  if (changeInfo.status === 'complete' || changeInfo.url) {
    try {
      // 如果更新的标签页是当前标签页，需要更新历史记录中的引用
      if (curTabId === tabId) {
        // 检查历史记录中是否有这个 tabId
        const historyIndex = tabHistory.indexOf(tabId);
        if (historyIndex !== -1) {
          // tabId 没有变化，不需要更新历史记录
          // console.log('[标签页更新] 当前标签页刷新，tabId 未变化');
        }
      }

      // 如果更新的标签页是 preTabId，需要验证它是否仍然存在
      if (preTabId === tabId) {
        // tabId 没有变化，preTabId 仍然有效
        // console.log('[标签页更新] preTabId 刷新，仍然有效');
      }
    } catch (error) {
      console.error('Error handling tab update:', error);
    }
  }
});

// 监听窗口变化（切换窗口时也要记录）
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  if (windowId === curWindowId) {
    return;
  }
  try {
    const tab = await getActiveTabInWindow(windowId);
    if (tab) {
      // 无论标签页 ID 是否相同，都更新状态
      // 因为窗口切换了，preTabId 应该反映新窗口的状态
      await updateTabHistory(tab.id);
      // 更新窗口 ID
      curWindowId = windowId;
      // console.log(`[窗口变化] windowId:${windowId}` +
      //   ' tabId:' + tab.id +
      //   ' curWindowId:' + curWindowId +
      //   ' curTabId:' + curTabId +
      //   ' preTabId:' + preTabId +
      //   ' history:' + tabHistory);
    }
  } catch (error) {
    console.error('处理窗口焦点变更时出错:', error.message);
  }
});

// 用于防止快速连续点击的标志
let isSwitchingToPreviousTab = false;

// 注册快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "switch-to-previous-tab") {
    // 防止快速连续点击
    if (isSwitchingToPreviousTab) {
      return;
    }

    isSwitchingToPreviousTab = true;

    try {
      // 确保状态是最新的，特别是在长时间未使用后
      // 如果当前状态不完整，尝试重新初始化
      if ((!curTabId || !curWindowId || tabHistory.length === 0) &&
        (!preTabId && tabHistory.length <= 1)) {
        await initializeState();
      }

      let targetTabId = preTabId;

      // 如果 preTabId 无效，尝试从历史记录中获取上一个有效的标签页
      if (!targetTabId && tabHistory.length > 1) {
        // 查找第一个仍然存在的历史标签页
        for (let i = 1; i < tabHistory.length; i++) {
          try {
            const tab = await chrome.tabs.get(tabHistory[i]);
            if (tab) {
              targetTabId = tab.id;
              // 更新preTabId以反映正确的状态
              preTabId = targetTabId;
              await saveStateToStorage();
              break;
            }
          } catch (e) {
            // 此历史记录中的标签页已不存在，继续检查下一个
          }
        }
      }

      // 如果仍然没有找到目标标签页，尝试获取当前窗口中最近使用的标签页
      if (!targetTabId) {
        try {
          // 查询当前窗口的所有标签页，并按最近访问时间排序
          const tabs = await chrome.tabs.query({
            windowType: 'normal',
            active: false // 排除当前活动的标签页
          });

          // 过滤出与当前窗口相同的标签页，并按上次访问时间排序
          const currentWindowTabs = tabs
            .filter(tab => tab.windowId === curWindowId)
            .sort((a, b) => b.lastAccessed - a.lastAccessed); // 按最后访问时间降序排列

          if (currentWindowTabs.length > 0) {
            targetTabId = currentWindowTabs[0].id; // 使用最新访问的标签页
            // 更新preTabId
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
          console.error('[快捷键] 尝试获取最近访问标签页时出错:', e);
        }
      }

      if (!targetTabId) {
        const message = i18n.getMessage('noPrevTab') || '未找到前一个标签页，可能已被关闭。';
        showNotification(message);
        return;
      }

      if (targetTabId) {
        try {
          // 先检查标签页是否存在
          const tab = await chrome.tabs.get(targetTabId).catch(() => null);
          if (!tab) {
            // 从历史记录中移除无效的标签页
            await removeFromHistory(targetTabId);

            // 没有找到任何有效的前一个标签页
            preTabId = null;
            await saveStateToStorage();
            const message = i18n.getMessage('noPrevTab') || '未找到前一个标签页，可能已被关闭。';
            showNotification(message);
            return;
          }

          await chrome.tabs.update(targetTabId, { active: true });

          // 更新窗口ID
          if (curWindowId !== tab.windowId) {
            await chrome.windows.update(tab.windowId, { focused: true });
            curWindowId = tab.windowId;
          }

          // 更新历史记录和当前标签页
          if (targetTabId !== curTabId) {
            await updateTabHistory(targetTabId);
          }

          // console.log("[快捷键] 切换成功 - windowId:" + tab.windowId +
          //   " tabId:" + targetTabId +
          //   ' curWindowId:' + curWindowId +
          //   " curTabId:" + curTabId +
          //   ' preTabId:' + preTabId +
          //   ' history:' + tabHistory);
        } catch (e) {
          console.error('[快捷键] Could not switch to the previous tab:', e);
          if ((e.message && e.message.includes('Tabs cannot be edited right now'))) {
          console.info('[快捷键] 标签页正在被拖拽，无法切换到上一个标签页');
            // 标签页拖拽时不重置preTabId，等待拖拽完成后重试
            return;
          }
          // 只在确认标签页不存在时才清空记录
          try {
            await chrome.tabs.get(targetTabId);
          } catch {
            console.log('[快捷键] Previous tab not found, removing from history');
            // 从历史记录中移除无效的标签页
            await removeFromHistory(targetTabId);

            // 尝试从历史记录中找到下一个有效的标签页
            if (tabHistory.length > 1) {
              for (let i = 1; i < tabHistory.length; i++) {
                try {
                  const validTab = await chrome.tabs.get(tabHistory[i]);
                  if (validTab) {
                    preTabId = validTab.id;
                    await saveStateToStorage();
                    break;
                  }
                } catch (e) {
                  // 此历史记录中的标签页已不存在，继续检查下一个
                }
              }
            } else {
              preTabId = null;
            }
          }
        }
      } else {
        // console.log('[快捷键] No previous tab available - preTabId:', preTabId, 'tabHistory:', tabHistory);
        // showNotification('提示', '没有可切换的上一个标签页');
      }
    } finally {
      // 重置标志，允许下次操作
      isSwitchingToPreviousTab = false;
    }
  } else if (command === "open-pinned-tabs") {
    // Toggle 固定标签页弹窗：如果已弹出则关闭，如果未弹出则弹出
    try {
      // 从 storage 中获取已保存的窗口 ID
      const result = await chrome.storage.local.get('pinnedTabsWindowId');
      const savedWindowId = result.pinnedTabsWindowId;

      // 如果已有保存的窗口 ID，尝试关闭该窗口
      if (savedWindowId) {
        try {
          // 检查窗口是否存在
          await chrome.windows.get(savedWindowId);
          // 窗口存在，关闭它
          await chrome.windows.remove(savedWindowId);
          // 清除保存的 ID
          await chrome.storage.local.remove('pinnedTabsWindowId');
          return;
        } catch (error) {
          // 窗口不存在，清除保存的 ID，继续创建新窗口
          await chrome.storage.local.remove('pinnedTabsWindowId');
        }
      }

      // 获取所有 popup 类型的窗口
      const windows = await chrome.windows.getAll({ windowTypes: ['popup'] });

      // 如果有 popup 窗口，说明已经有弹窗打开了，关闭它
      if (windows.length > 0) {
        // 关闭第一个 popup 窗口
        await chrome.windows.remove(windows[0].id);
        // 清除保存的 ID
        await chrome.storage.local.remove('pinnedTabsWindowId');
        return;
      }

      // 如果没有 popup 窗口，则创建新的（位置在屏幕正中间）
      var windowWidth = PINNED_TABS_CONFIG ? PINNED_TABS_CONFIG.WINDOW_WIDTH : 400;
      var windowHeight = PINNED_TABS_CONFIG ? PINNED_TABS_CONFIG.WINDOW_HEIGHT : 600;

      // 获取屏幕信息
      var screenWidth = 1920;
      var screenHeight = 1080;
      try {
        // 使用 chrome.system.display 获取真实屏幕尺寸
        const displays = await chrome.system.display.getInfo();
        if (displays && displays.length > 0) {
          const primaryDisplay = displays.find(display => display.isPrimary) || displays[0];
          screenWidth = primaryDisplay.workArea.width || 1920;
          screenHeight = primaryDisplay.workArea.height || 1080;
        }
      } catch (error) {
        console.info('[background] Failed to get screen info:', error);
      }

      const left = Math.round((screenWidth - windowWidth) / 2);
      const top = Math.round((screenHeight - windowHeight) / 2);

      const newWindow = await chrome.windows.create({
        url: chrome.runtime.getURL('html/pinned-list.html'),
        type: 'popup',
        width: windowWidth,
        height: windowHeight,
        left: left,
        top: top
      });

      // 保存窗口 ID 到 storage
      await chrome.storage.local.set({ pinnedTabsWindowId: newWindow.id });
    } catch (error) {
      console.error('[open-pinned-tabs] Error toggling pinned tabs popup:', error);
      // 出错时清除保存的窗口 ID
      await chrome.storage.local.remove('pinnedTabsWindowId');
    }
  } else if (command === "_execute_action") {
    console.log('[background] _execute_action command received');
    // 打开主搜索弹窗
    try {
      // 获取所有 popup 类型的窗口
      const windows = await chrome.windows.getAll({ windowTypes: ['popup'] });
      console.log('[background] Found popup windows:', windows.length);

      // 检查是否有固定标签页弹窗
      let hasPinnedTabsWindow = false;
      for (const window of windows) {
        console.log('[background] Closing popup window:', window.id, 'URL:', window.tabs?.[0]?.url);
        // 由于窗口 URL 可能是 undefined，我们通过窗口数量来判断
        // 如果有 popup 窗口，我们假设它是固定标签页弹窗
        hasPinnedTabsWindow = true;
        // 关闭所有 popup 窗口
        await chrome.windows.remove(window.id);
      }

      // 如果有固定标签页弹窗，已经关闭了，现在打开主搜索弹窗
      if (hasPinnedTabsWindow) {
        console.log('[background] Closed pinned tabs window, popup should open on next keypress');
      }

      // 等待一小段时间确保窗口关闭完成
      await new Promise(resolve => setTimeout(resolve, 100));

      // 打开主搜索弹窗（通过 chrome.action.openPopup）
      try {
        console.log('[background] Attempting to open popup...');
        chrome.action.openPopup();
        console.log('[background] Popup opened successfully');
      } catch (error) {
        console.info('[background] Failed to open popup:', error.message);
        // 如果无法打开弹窗（例如扩展图标未固定到工具栏），可以在这里添加备用方案
      }
    } catch (error) {
      console.error('[_execute_action] Error:', error);
    }
  }
});

// 监听标签页关闭，清理无效 ID
chrome.tabs.onRemoved.addListener(async (tabId) => {
  // console.log('[标签页关闭] tabId:', tabId);

  // 如果关闭的标签页是 preTabId，清空 preTabId
  if (preTabId === tabId) {
    preTabId = null;
  }

  // 从历史记录中移除已关闭的标签页
  await removeFromHistory(tabId);

  // 从固定列表中移除已关闭的标签页（但长期固定的tab不移除）
  try {
    const result = await chrome.storage.local.get('pinnedTabs');
    const pinnedTabs = result.pinnedTabs || [];
    
    // 过滤掉已关闭的非长期固定标签页
    const filteredTabs = pinnedTabs.filter(tab => {
      // 如果是长期固定的tab，即使浏览器标签页关闭了也不移除
      if (tab.isLongTermPinned && tab.tabId === tabId) {
        return true; // 保留
      }
      // 其他标签页如果关闭了则移除
      return tab.tabId !== tabId;
    });

    if (filteredTabs.length !== pinnedTabs.length) {
      // 有标签页被移除，更新存储
      await chrome.storage.local.set({ pinnedTabs: filteredTabs });
      console.log('[background] Removed closed tab from pinned list:', tabId);
    }
  } catch (error) {
    console.error('[background] Error removing tab from pinned list:', error);
  }

  if (curTabId === tabId) {
    // 当当前标签页关闭时，尝试找到一个新的当前标签页
    try {
      const tabs = await chrome.tabs.query({ windowId: curWindowId, active: true });
      if (tabs.length > 0) {
        curTabId = tabs[0].id;
      } else {
        curTabId = null;
        preTabId = null;
      }
    } catch (e) {
      console.error('Error updating curTabId after tab closure:', e);
      curTabId = null;
    }
    await updateTabHistory(curTabId);
  }

  // console.log('[标签页关闭后] curTabId:' + curTabId +
  //   ' preTabId:' + preTabId +
  //   ' history:' + tabHistory);
});

// 接收来自其它js的message
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "switchToTab") {
    let targetTabId = message.data.tabId;
    let windowId = message.data.windowId;
    if (targetTabId) {
      try {
        await handleSwitchToTab(targetTabId, windowId);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    } else {
      const errorMsg = chrome.i18n.getMessage('invalidTabId') || "无效的标签页ID";
      sendResponse({ success: false, error: errorMsg });
    }
    return true; // 表示异步响应
  }

  if (message.action === 'languageChanged') {
    // Update background i18n language
    await i18n.setLanguage(message.language);

    // 广播语言更改消息给所有标签页
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'languageChanged',
          language: message.language
        }).catch(() => {
          // 忽略发送失败的错误（例如，某些系统页面无法接收消息）
        });
      });
    });

    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'openMainPopup') {
    try {
      // 先关闭所有 popup 窗口（包括 pinnedTabList 弹窗）
      const windows = await chrome.windows.getAll({ windowTypes: ['popup'] });

      for (const window of windows) {
        try {
          await chrome.windows.remove(window.id);
          // console.log('[openMainPopup] Closed popup window:', window.id);
        } catch (error) {
          console.log('[openMainPopup] Failed to close window:', window.id, error);
        }
      }

      // 等待一小段时间确保窗口关闭完成
      await new Promise(resolve => setTimeout(resolve, 100));

      // 打开主搜索弹窗（通过 chrome.action.openPopup）
      try {
        chrome.action.openPopup();
      } catch (error) {
        console.info('[background] Failed to open popup:', error.message);
        // 如果无法打开弹窗（例如扩展图标未固定到工具栏），可以在这里添加备用方案
      }
      sendResponse({ success: true });
    } catch (error) {
      console.error('[background] Error opening main popup:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // 表示异步响应
  }

  if (message.action === 'openPinnedTabs') {
    try {
      // 直接调用打开固定标签页弹窗的逻辑
      // 从 storage 中获取已保存的窗口 ID
      const result = await chrome.storage.local.get('pinnedTabsWindowId');
      const savedWindowId = result.pinnedTabsWindowId;

      // 如果已有保存的窗口 ID，尝试聚焦该窗口
      if (savedWindowId) {
        try {
          await chrome.windows.update(savedWindowId, { focused: true });
          sendResponse({ success: true });
          return;
        } catch (error) {
          // 窗口不存在，清除保存的 ID
          await chrome.storage.local.remove('pinnedTabsWindowId');
        }
      }

      // 获取所有 popup 类型的窗口
      const windows = await chrome.windows.getAll({ windowTypes: ['popup'] });

      // 如果有 popup 窗口，说明已经有弹窗打开了
      if (windows.length > 0) {
        // 聚焦第一个 popup 窗口
        await chrome.windows.update(windows[0].id, { focused: true });
        // 保存窗口 ID
        await chrome.storage.local.set({ pinnedTabsWindowId: windows[0].id });
        sendResponse({ success: true });
        return;
      }

      // 如果没有 popup 窗口，则创建新的（位置在屏幕正中间）
      var windowWidth = PINNED_TABS_CONFIG ? PINNED_TABS_CONFIG.WINDOW_WIDTH : 400;
      var windowHeight = PINNED_TABS_CONFIG ? PINNED_TABS_CONFIG.WINDOW_HEIGHT : 600;

      // 获取屏幕信息
      var screenWidth = 1920;
      var screenHeight = 1080;
      try {
        // 使用 chrome.system.display 获取真实屏幕尺寸
        const displays = await chrome.system.display.getInfo();
        if (displays && displays.length > 0) {
          const primaryDisplay = displays.find(display => display.isPrimary) || displays[0];
          screenWidth = primaryDisplay.workArea.width || 1920;
          screenHeight = primaryDisplay.workArea.height || 1080;
        }
      } catch (error) {
        //  fallback to current window size if system.display API fails
        try {
          const screenInfo = await chrome.windows.getCurrent();
          screenWidth = screenInfo.width || 1920;
          screenHeight = screenInfo.height || 1080;
        } catch (innerError) {
          // 使用默认值
        }
      }

      const left = Math.round((screenWidth - windowWidth) / 2);
      const top = Math.round((screenHeight - windowHeight) / 2);

      const newWindow = await chrome.windows.create({
        url: chrome.runtime.getURL('html/pinned-list.html'),
        type: 'popup',
        width: windowWidth,
        height: windowHeight,
        left: left,
        top: top
      });

      // 保存窗口 ID 到 storage
      await chrome.storage.local.set({ pinnedTabsWindowId: newWindow.id });
      sendResponse({ success: true });
    } catch (error) {
      console.error('[background] Error opening pinned tabs:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  if (message.action === 'openSettings') {
    try {
      // 检查是否已打开设置页面
      const settingsUrl = chrome.runtime.getURL('html/settings.html');
      const tabs = await chrome.tabs.query({ url: settingsUrl });
      
      if (tabs.length > 0) {
        // 已打开设置页面，切换到该标签页
        await chrome.tabs.update(tabs[0].id, { active: true });
        if (tabs[0].windowId) {
          await chrome.windows.update(tabs[0].windowId, { focused: true });
        }
      } else {
        // 未打开设置页面，创建新标签页
        chrome.tabs.create({ url: settingsUrl });
      }
      sendResponse({ success: true });
    } catch (error) {
      console.error('[background] Error opening settings:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  if (message.action === 'openAbout') {
    try {
      // 检查是否已打开关于页面
      const aboutUrl = chrome.runtime.getURL('html/about.html');
      const tabs = await chrome.tabs.query({ url: aboutUrl });
      
      if (tabs.length > 0) {
        // 已打开关于页面，切换到该标签页
        await chrome.tabs.update(tabs[0].id, { active: true });
        if (tabs[0].windowId) {
          await chrome.windows.update(tabs[0].windowId, { focused: true });
        }
      } else {
        // 未打开关于页面，创建新标签页
        chrome.tabs.create({ url: aboutUrl });
      }
      sendResponse({ success: true });
    } catch (error) {
      console.error('[background] Error opening about:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  if (message.action === 'syncQueueAddOperation') {
    // console.log('[background] Received syncQueueAddOperation:', message.type, message.data);
    if (self.SyncQueueService) {
      self.SyncQueueService.scheduleSync && self.SyncQueueService.scheduleSync(2000);
    }
    return false;
  }

  if (message.action === 'AUTH_SUCCESS') {
    try {
      console.log('[background] AUTH_SUCCESS received, starting sync...');
      if (self.SyncQueueService) {
        const syncResult = await self.SyncQueueService.performSync();
        console.log('[background] Sync result:', syncResult);
        if (syncResult && syncResult.success && syncResult.isFirstSync && syncResult.pulledData) {
          const toastMessage = i18n.getMessage('firstSyncCompleted');
          console.log('[background] First sync completed with data, saving toast for later display:', toastMessage);
          // 保存 toast 消息到 storage，让页面刷新后显示
          await chrome.storage.local.set({ pendingFirstSyncToast: toastMessage });
        }
      } else {
        console.log('[background] SyncQueueService not available');
      }
    } catch (error) {
      console.error('[background] Failed to trigger sync:', error);
    }
    sendResponse({ success: true });
    return true;
  }
});

async function handleSwitchToTab(targetTabId, windowId) {
  try {
    // 检查标签页是否存在
    await chrome.tabs.get(targetTabId);

    // 激活目标标签页并聚焦窗口
    await chrome.tabs.update(targetTabId, { active: true });
    if (windowId && windowId !== curWindowId) {
      await chrome.windows.update(windowId, { focused: true });
      curWindowId = windowId;
    }

    // 更新历史记录和当前标签页
    if (targetTabId !== curTabId) {
      curTabId = targetTabId;
      await updateTabHistory(targetTabId);
    }

    // console.log("[消息发送] windowId:" + windowId +
    //   " tabId:" + targetTabId +
    //   ' curWindowId:' + curWindowId +
    //   " curTabId:" + curTabId +
    //   ' preTabId:' + preTabId +
    //   ' history:' + tabHistory);
  } catch (e) {
    console.log('Could not switch to the target tab:', e);
    throw e;
  }
}

// 扩展安装或更新时初始化状态
chrome.runtime.onInstalled.addListener(async (details) => {
  const { reason } = details;
  
  if (reason === 'install') {
    console.log('[TabSearch] Extension newly installed');
    // 全新安装，清除所有旧的存储数据（防止卸载后重装保留数据）
    await clearAllStorage();
  } else if (reason === 'update') {
    console.log('[TabSearch] Extension updated');
    // 更新时不清除数据，保留用户状态
  } else if (reason === 'chrome_update') {
    console.log('[TabSearch] Chrome updated');
  }
  
  await initializeAll();
});

// 扩展启动时初始化状态
chrome.runtime.onStartup.addListener(async () => {
  // console.log('[TabSearch] Extension started');
  await initializeAll();
});

/**
 * API 客户端
 * 处理与后端 API 的通信
 */
class ApiClient {
  constructor() {
    this.baseUrl = API_CONFIG ? API_CONFIG.BASE_URL : 'https://habpbyhrqiik.ap-southeast-1.clawcloudrun.com';
    this.apiVersion = API_CONFIG ? API_CONFIG.API_VERSION : '/api/v1';
    this.maxRetries = API_CONFIG ? API_CONFIG.REQUEST.MAX_RETRIES : 3;
    this.retryDelay = API_CONFIG ? API_CONFIG.REQUEST.RETRY_DELAY : 1000;
  }

  /**
   * 发送请求
   * @param {string} endpoint - API 端点
   * @param {string} method - HTTP 方法
   * @param {object} data - 请求数据
   * @param {object} headers - 请求头
   * @returns {Promise} - 返回响应
   */
  async request(endpoint, method = 'GET', data = null, headers = {}) {
    const url = `${this.baseUrl}${this.apiVersion}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };

    const config = {
      method,
      headers: defaultHeaders
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.body = JSON.stringify(data);
    }

    let attempt = 0;
    let lastError;

    while (attempt < this.maxRetries) {
      try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error = new Error(errorData.message || `HTTP error! status: ${response.status}`);
          error.status = response.status;
          throw error;
        }

        return await response.json();
      } catch (error) {
        lastError = error;
        
        // 429 (Rate Limit) 错误不重试，直接返回失败
        if (error.status === 429) {
          console.info('[ApiClient] Rate limited, no retry');
          throw error;
        }
        
        // 其他错误尝试重试
        attempt++;
        if (attempt < this.maxRetries) {
          console.info(`Request failed, retrying (${attempt}/${this.maxRetries})...`);
          await this.delay(this.retryDelay);
        }
      }
    }

    // 如果是静默注册请求，返回模拟数据以允许扩展继续工作
    const silentRegisterEndpoint = API_CONFIG ? API_CONFIG.ENDPOINTS.AUTH.SILENT_REGISTER : '/auth/silent-register';
    if (endpoint === silentRegisterEndpoint && method === 'POST') {
      console.log('Backend service unavailable, using mock registration data');
      return {
        data: {
          userId: 'mock-user-' + Date.now(),
          deviceId: 'mock-device-' + Date.now(),
          createdAt: new Date().toISOString()
        }
      };
    }

    throw lastError;
  }

  /**
   * POST 请求
   * @param {string} endpoint - API 端点
   * @param {object} data - 请求数据
   * @param {object} headers - 请求头
   * @returns {Promise} - 返回响应
   */
  post(endpoint, data, headers = {}) {
    return this.request(endpoint, 'POST', data, headers);
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟时间（毫秒）
   * @returns {Promise} - 返回 Promise
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 注意：authService 已经在上面通过 importScripts 导入
// 这里不再需要创建新的 AuthService 实例

/**
 * 检查 Token 是否需要刷新
 * Token 在过期前 5 天需要刷新
 * @returns {Promise<boolean>}
 */
async function shouldRefreshToken() {
  try {
    // 1. 先检查用户是否已注册
    const isRegistered = await authService.isRegistered();
    if (!isRegistered) {
      // 用户未注册，不需要刷新 token
      console.log('User not registered, skip token refresh');
      return false;
    }

    // 2. 用户已注册，检查 token 状态
    const { accessToken, tokenExpiresAt } = await chrome.storage.local.get([
      STORAGE_KEYS_LOCAL.accessToken,
      STORAGE_KEYS_LOCAL.tokenExpiresAt
    ]);

    if (!accessToken || !tokenExpiresAt) {
      // 没有 token 或过期时间，需要获取新 token
      console.log('No valid token found, need to get new token');
      return true;
    }

    const expiresAt = new Date(tokenExpiresAt).getTime();
    const now = Date.now();
    const refreshThreshold = 5 * 24 * 60 * 60 * 1000; // 5 天，单位毫秒

    const needsRefresh = expiresAt - now < refreshThreshold;
    console.log('Token refresh check:', {
      expiresAt: new Date(expiresAt).toISOString(),
      now: new Date(now).toISOString(),
      timeUntilExpiry: Math.round((expiresAt - now) / (1000 * 60 * 60)) + ' hours',
      needsRefresh: needsRefresh
    });

    return needsRefresh;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true;
  }
}

/**
 * 刷新访问令牌
 * @returns {Promise<boolean>} - 是否刷新成功
 */
async function refreshAccessToken() {
  try {
    const { accessToken } = await chrome.storage.local.get(STORAGE_KEYS_LOCAL.accessToken);
    if (!accessToken) {
      console.log('No token to refresh');
      return false;
    }

    const refreshTokenEndpoint = API_CONFIG ? API_CONFIG.ENDPOINTS.AUTH.REFRESH_TOKEN : '/auth/refresh';
    const response = await apiClient.post(refreshTokenEndpoint, {
      accessToken
    });

    if (response.data && response.data.accessToken) {
      await chrome.storage.local.set({
        [STORAGE_KEYS_LOCAL.accessToken]: response.data.accessToken,
        [STORAGE_KEYS_LOCAL.tokenExpiresAt]: response.data.expiresAt
      });
      console.log('Token refreshed successfully');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to refresh token:', error);
    // 刷新失败时清除存储，下次重新获取
    await chrome.storage.local.remove([
      STORAGE_KEYS_LOCAL.accessToken,
      STORAGE_KEYS_LOCAL.tokenExpiresAt
    ]);
    return false;
  }
}

/**
 * 执行静默注册
 * @returns {Promise} - 返回注册结果
 */
async function performSilentRegistration() {
  try {
    console.log('Starting silent registration...');
    const result = await authService.silentRegister();
    if (result) {
      console.log('Silent registration completed successfully');
    } else {
      console.log('Silent registration skipped or failed, but extension will continue to work');
    }
  } catch (error) {
    console.error('Error during silent registration:', error);
    // 注册失败不影响扩展使用
  }
}

/**
 * 定期检查和刷新 Token
 */
async function periodicTokenRefresh() {
  try {
    const needsRefresh = await shouldRefreshToken();
    if (needsRefresh) {
      console.log('Token needs refresh, refreshing...');
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        // 刷新失败，尝试重新获取 Token
        console.log('Token refresh failed, trying to get new token...');
        await authService.getAccessToken();
      }
    }
  } catch (error) {
    console.error('Error in periodic token refresh:', error);
  }
}

// 立即初始化（处理扩展已经在运行的情况）
async function initializeAll() {
  try {
    await i18n.initialize();
    await initializeState();
    await performSilentRegistration();
    // 初始化时检查一次 Token 状态
    await periodicTokenRefresh();
    // 初始化同步队列服务
    initializeSyncQueue();
  } catch (error) {
    console.error('[Background] Failed to initialize:', error);
  }
}

// 初始化同步队列服务
async function initializeSyncQueue() {
  try {
    // 使用全局同步队列服务（通过 importScripts 加载）
    if (self.SyncQueueService) {
      // 从配置中获取同步间隔：开发环境1分钟，生产环境30分钟
      const syncInterval = CONFIG_COMMON?.PINNED_TABS_CONFIG?.SYNC_INTERVAL || 30 * 60 * 1000;
      self.SyncQueueService.startPeriodicSync(syncInterval);
      console.log('[Background] Sync queue service initialized with interval:', syncInterval / 1000 / 60, 'minutes');
    } else {
      console.info('[Background] SyncQueueService not available');
    }
  } catch (error) {
    console.error('[Background] Failed to initialize sync queue:', error);
  }
}

/**
 * 数据
 * 用于扩展卸载后重新安装时重置状态
 */
async function clearAllStorage() {
  try {
    await chrome.storage.local.clear();
  } catch (error) {
    console.error('[Background] Failed to clear storage:', error);
  }
}

// 设置定期 Token 刷新（每12小时检查一次）
chrome.alarms.create('tokenRefresh', { periodInMinutes: 720 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'tokenRefresh') {
    periodicTokenRefresh();
  }
});