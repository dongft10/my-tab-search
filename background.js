// background.js

// 初始化变量
let curTabId = null;
let preTabId = null;
let curWindowId = null;

// 标签页历史记录栈（用于支持更灵活的切换）
let tabHistory = []; // 存储历史 tabId，最新的在前面
const MAX_HISTORY_SIZE = 20; // 最大历史记录数量

// console.log('[TabSearch] Variables initialized:', {curTabId, preTabId, curWindowId});

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
    // 获取当前聚焦的窗口
    const window = await chrome.windows.getLastFocused({populate: false});
    if (!window) return;

    curWindowId = window.id;

    // 获取当前活动标签页
    const tab = await getActiveTabInWindow(window.id);
    if (tab) {
      curTabId = tab.id;
      preTabId = null;
      tabHistory = [tab.id]; // 初始化历史记录
      console.log('[TabSearch] State initialized:', {curTabId, preTabId, curWindowId, tabHistory});
    }
  } catch (error) {
    console.error('Error initializing state:', error);
  }
}

// 方法：更新标签页历史记录
function updateTabHistory(newTabId) {
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
}

// 方法：从历史记录中移除已关闭的标签页
function removeFromHistory(tabId) {
  tabHistory = tabHistory.filter(id => id !== tabId);
  // 重新计算 preTabId
  const oldPreTabId = preTabId;
  preTabId = tabHistory.length > 1 ? tabHistory[1] : null;
  
  // 如果 preTabId 被清空，发送通知
  if (oldPreTabId && !preTabId) {
    // showNotification('上一个标签页已关闭', '无法切换到上一个标签页');
  }
}

// 方法：显示通知
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/icon-48.png',
    title: title,
    message: message,
    priority: 1
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.error('Failed to show notification:', chrome.runtime.lastError.message);
    } else {
      console.log('[通知]', title, '-', message);
      // 3秒后自动关闭通知
      setTimeout(() => {
        chrome.notifications.clear(notificationId);
      }, 3000);
    }
  });
}

// 监听标签页激活事件
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const targetTabId = activeInfo.tabId;
  const windowId = activeInfo.windowId;

  if (targetTabId) {
    try {
      const tab = await chrome.tabs.get(targetTabId);
      if (chrome.runtime.lastError) {
        console.warn('获取标签页失败:', chrome.runtime.lastError.message);
        return;
      }

      // 更新窗口ID
      if (windowId !== curWindowId) {
        curWindowId = windowId;
      }

      // 只有当激活的标签页与当前记录不同时，才更新状态
      if (curTabId !== targetTabId) {
        // 更新历史记录
        updateTabHistory(targetTabId);
        curTabId = targetTabId;
      }

      console.log("[标签页激活] windowId:" + windowId +
        " tabId:" + targetTabId +
        ' curWindowId:' + curWindowId +
        " curTabId:" + curTabId +
        ' preTabId:' + preTabId +
        ' history:' + tabHistory);
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
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // 只在标签页加载完成或URL变化时处理
  if (changeInfo.status === 'complete' || changeInfo.url) {
    try {
      // 如果更新的标签页是当前标签页，需要更新历史记录中的引用
      if (curTabId === tabId) {
        // 检查历史记录中是否有这个 tabId
        const historyIndex = tabHistory.indexOf(tabId);
        if (historyIndex !== -1) {
          // tabId 没有变化，不需要更新历史记录
          console.log('[标签页更新] 当前标签页刷新，tabId 未变化');
        }
      }

      // 如果更新的标签页是 preTabId，需要验证它是否仍然存在
      if (preTabId === tabId) {
        // tabId 没有变化，preTabId 仍然有效
        console.log('[标签页更新] preTabId 刷新，仍然有效');
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
        updateTabHistory(tab.id);
        curTabId = tab.id;
      }
      console.log(`[窗口变化] windowId:${windowId}` +
        ' tabId:' + tab.id +
        ' curWindowId:' + curWindowId +
        ' curTabId:' + curTabId +
        ' preTabId:' + preTabId +
        ' history:' + tabHistory);
    }
  } catch (error) {
    console.error('处理窗口焦点变更时出错:', error.message);
  }
});

// 注册快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "switch-to-previous-tab") {
    let targetTabId = preTabId;
    
    // 如果 preTabId 无效，尝试从历史记录中查找
    if (!targetTabId && tabHistory.length > 1) {
      targetTabId = tabHistory[1];
      console.log('[快捷键] preTabId 为空，从历史记录获取:', targetTabId);
    }
    
    if (targetTabId) {
      try {
        // 先检查标签页是否存在
        const tabExists = await chrome.tabs.get(targetTabId).catch(() => null);
        if (!tabExists) {
          console.log('Previous tab no longer exists, clearing preTabId');
          // 从历史记录中移除无效的标签页
          removeFromHistory(targetTabId);
          // 清空 preTabId，不自动找替代
          preTabId = null;
          // showNotification('上一个标签页已关闭', '无法切换到上一个标签页');
          return;
        }

        await chrome.tabs.update(targetTabId, {active: true});
        const tab = await chrome.tabs.get(targetTabId);
        
        // 更新窗口ID
        if (curWindowId !== tab.windowId) {
          await chrome.windows.update(tab.windowId, {focused: true});
          curWindowId = tab.windowId;
        }
        
        // 更新历史记录和当前标签页
        if (targetTabId !== curTabId) {
          updateTabHistory(targetTabId);
          curTabId = targetTabId;
        }
        
        console.log("[快捷键] windowId:" + tab.windowId +
          " tabId:" + targetTabId +
          ' curWindowId:' + curWindowId +
          " preTabId:" + preTabId +
          ' history:' + tabHistory);
      } catch (e) {
        console.log('Could not switch to the previous tab:', e);
        if ((e.message && e.message.includes('Tabs cannot be edited right now'))) {
          console.warn('标签页正在被拖拽，无法切换到上一个标签页');
          // 标签页拖拽时不重置preTabId，等待拖拽完成后重试
          return;
        }
        // 只在确认标签页不存在时才清空记录
        try {
          await chrome.tabs.get(targetTabId);
        } catch {
          console.log('Previous tab not found, removing from history');
          removeFromHistory(targetTabId);
          preTabId = null;
          // showNotification('上一个标签页已关闭', '无法切换到上一个标签页');
        }
      }
    } else {
      console.log('No previous tab available');
    }
  }
});

// 监听标签页关闭，清理无效 ID
chrome.tabs.onRemoved.addListener(async (tabId) => {
  console.log('[标签页关闭] tabId:', tabId);

  // 如果关闭的标签页是 preTabId，清空 preTabId
  if (preTabId === tabId) {
    console.log('[标签页关闭] 被关闭的标签页是 preTabId，清空 preTabId');
    preTabId = null;
    // showNotification('上一个标签页已关闭', '无法切换到上一个标签页');
  }

  // 从历史记录中移除已关闭的标签页
  removeFromHistory(tabId);

  if (curTabId === tabId) {
    // 当当前标签页关闭时，尝试找到一个新的当前标签页
    try {
      const tabs = await chrome.tabs.query({windowId: curWindowId, active: true});
      if (tabs.length > 0) {
        curTabId = tabs[0].id;
        // 更新历史记录
        updateTabHistory(curTabId);
      } else {
        curTabId = null;
        preTabId = null;
      }
    } catch (e) {
      console.error('Error updating curTabId after tab closure:', e);
      curTabId = null;
    }
  }

  console.log('[标签页关闭后] curTabId:' + curTabId +
    ' preTabId:' + preTabId +
    ' history:' + tabHistory);
});

// 接收来自其它js的message
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "switchToTab") {
    let targetTabId = message.data.tabId;
    let windowId = message.data.windowId;
    if (targetTabId) {
      handleSwitchToTab(targetTabId, windowId)
        .then(() => sendResponse({success: true}))
        .catch(error => sendResponse({success: false, error: error.message}));
    } else {
      sendResponse({success: false, error: "无效的标签页ID"});
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
      updateTabHistory(targetTabId);
      curTabId = targetTabId;
    }
    
    console.log("[消息发送] windowId:" + windowId +
      " tabId:" + targetTabId +
      ' curWindowId:' + curWindowId +
      " curTabId:" + curTabId +
      ' preTabId:' + preTabId +
      ' history:' + tabHistory);
  } catch (e) {
    console.log('Could not switch to the target tab:', e);
    throw e;
  }
}

// 扩展安装或更新时初始化状态
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[TabSearch] Extension installed/updated');
  await initializeState();
});

// 扩展启动时初始化状态
chrome.runtime.onStartup.addListener(async () => {
  console.log('[TabSearch] Extension started');
  await initializeState();
});

// 立即初始化（处理扩展已经在运行的情况）
initializeState();