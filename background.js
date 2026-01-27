// background.js

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
    const currentFocusedWindow = await chrome.windows.getLastFocused({populate: false});
    if (!currentFocusedWindow) return;

    // 内存中没有值，从 storage 读取已保存的状态
    const savedState = await loadStateFromStorage();

    // 如果 storage 中有数据，尝试恢复
    if (savedState.curTabId || savedState.preTabId || savedState.curWindowId) {
      // console.log('[initializeState] 从 storage 恢复状态');

      // 验证保存的数据是否仍然有效
      let isValid = true;

      // 验证 curTabId 是否仍然存在
      if (savedState.curTabId) {
        try {
          const tab = await chrome.tabs.get(savedState.curTabId);
          // 检查标签页是否在当前焦点窗口中，如果不是，则不使用该标签页
          if (tab.windowId === currentFocusedWindow.id) {
            curTabId = tab.id;
          } else {
            // console.log('[initializeState] 保存的标签页不在当前窗口，跳过恢复');
            isValid = false;
          }
        } catch (e) {
          console.log('[initializeState] 保存的标签页不存在，需要重新初始化');
          isValid = false;
        }
      }

      // 验证 preTabId 是否仍然存在
      if (isValid && savedState.preTabId) {
        preTabId = savedState.preTabId;
      }

      // 恢复历史记录（过滤掉不存在的标签页）
      if (isValid && savedState.tabHistory && Array.isArray(savedState.tabHistory)) {
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

        // 重新计算 preTabId
        if (tabHistory.length > 1 && preTabId === null) {
          preTabId = tabHistory[1];
        }
      }

      // 使用当前焦点窗口作为 curWindowId
      curWindowId = currentFocusedWindow.id;

      if (isValid) {
        // console.log('[initializeState] 状态恢复成功:', {curTabId, preTabId, curWindowId, tabHistory});
        // 保存恢复后的状态
        await saveStateToStorage();
        return;
      }
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
  if(curTabId !== newTabId){
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

// 方法：显示通知
function showNotification(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/icon-48.png',
    title: chrome.i18n.getMessage('notificationTitle') || 'Tab Search',
    message: message,
    priority: 1
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.error('Failed to show notification:', chrome.runtime.lastError.message);
    } else {
      console.log('[通知]', chrome.i18n.getMessage('notificationTitle') || 'Tab Search', '-', message);
      // 使用 alarms API 来延迟关闭通知（service worker 兼容）
      chrome.alarms.create(`notification-${notificationId}`, {
        delayInMinutes: 0.05 // 3秒 = 0.05分钟
      });
    }
  });
}

// 监听标签页激活事件
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const {tabId, windowId} = activeInfo
  if (tabId) {
    try {
      await chrome.tabs.get(tabId);
      if (chrome.runtime.lastError) {
        console.warn('获取标签页失败:', chrome.runtime.lastError.message);
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
        console.log('Tab is being dragged, skipping activation logic');
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
      if (curWindowId !== windowId) {
        curWindowId = windowId;
      }
      if (tab.id !== curTabId) {
        // 更新历史记录
        await updateTabHistory(tab.id);
      }
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

// 注册快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "switch-to-previous-tab") {
    let targetTabId = preTabId;

    // 如果 preTabId 无效，则弹窗提示
    if (!targetTabId && tabHistory.length > 1) {
      const message = chrome.i18n.getMessage('noPrevTab') || '未找到前一个标签页，可能已被关闭。';
      showNotification(message);
      return;
    }

    if (targetTabId) {
      try {
        // 先检查标签页是否存在
        const tab = await chrome.tabs.get(targetTabId).catch(() => null);
        if (!tab) {
          // console.log('[快捷键] Previous tab no longer exists, clearing preTabId');
          // 清空 preTabId，不自动找替代
          preTabId = null;
          // 从历史记录中移除无效的标签页
          await removeFromHistory(targetTabId);
          return;
        }

        await chrome.tabs.update(targetTabId, {active: true});

        // 更新窗口ID
        if (curWindowId !== tab.windowId) {
          await chrome.windows.update(tab.windowId, {focused: true});
          curWindowId = tab.windowId;
        }

        // 更新历史记录和当前标签页
        if (targetTabId !== curTabId) {
          await updateTabHistory(targetTabId);
        }

        // console.log("[快捷键] 切换成功 - windowId:" + tab.windowId +
        //   " tabId:" + targetTabId +
        //   ' curWindowId:' + curWindowId +
        //   " preTabId:" + preTabId +
        //   ' history:' + tabHistory);
      } catch (e) {
        console.log('[快捷键] Could not switch to the previous tab:', e);
        if ((e.message && e.message.includes('Tabs cannot be edited right now'))) {
          console.warn('[快捷键] 标签页正在被拖拽，无法切换到上一个标签页');
          // 标签页拖拽时不重置preTabId，等待拖拽完成后重试
          return;
        }
        // 只在确认标签页不存在时才清空记录
        try {
          await chrome.tabs.get(targetTabId);
        } catch {
          console.log('[快捷键] Previous tab not found, removing from history');
          preTabId = null;
          await removeFromHistory(targetTabId);
        }
      }
    } else {
      // console.log('[快捷键] No previous tab available - preTabId:', preTabId, 'tabHistory:', tabHistory);
      // showNotification('提示', '没有可切换的上一个标签页');
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

  if (curTabId === tabId) {
    // 当当前标签页关闭时，尝试找到一个新的当前标签页
    try {
      const tabs = await chrome.tabs.query({windowId: curWindowId, active: true});
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
        sendResponse({success: true});
      } catch (error) {
        sendResponse({success: false, error: error.message});
      }
    } else {
      const errorMsg = chrome.i18n.getMessage('invalidTabId') || "无效的标签页ID";
      sendResponse({success: false, error: errorMsg});
    }
    return true; // 表示异步响应
  }
});

async function handleSwitchToTab(targetTabId, windowId) {
  try {
    // 检查标签页是否存在
    await chrome.tabs.get(targetTabId);

    // 激活目标标签页并聚焦窗口
    await chrome.tabs.update(targetTabId, {active: true});
    if (windowId && windowId !== curWindowId) {
      await chrome.windows.update(windowId, {focused: true});
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
chrome.runtime.onInstalled.addListener(async () => {
  // console.log('[TabSearch] Extension installed/updated');
  await initializeState();
});

// 扩展启动时初始化状态
chrome.runtime.onStartup.addListener(async () => {
  // console.log('[TabSearch] Extension started');
  await initializeState();
});

// 立即初始化（处理扩展已经在运行的情况）
initializeState();

// 监听 alarms 事件，用于关闭通知
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name && alarm.name.startsWith('notification-')) {
    const notificationId = alarm.name.replace('notification-', '');
    chrome.notifications.clear(notificationId);
  }
});