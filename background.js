// background.js

let curTabId = null;
let preTabId = null;
let curWindowId = null;

// 方法1：通过窗口ID查询当前活动标签页
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

// 监听标签页激活事件
chrome.tabs.onActivated.addListener((activeInfo) => {
  const targetTabId = activeInfo.tabId;
  if (targetTabId) {
    chrome.tabs.get(targetTabId, (tab) => {
      try {
        const windowId = tab.windowId;
        if (!curTabId) {
          curTabId = targetTabId;
          if (!preTabId) {
            preTabId = targetTabId;
          }
        } else if (curTabId !== targetTabId || preTabId === targetTabId) {
          const temp = curTabId;
          curTabId = targetTabId;
          preTabId = temp;
        } else if (curTabId === targetTabId) {
          // do nothing .
        }
        chrome.tabs.update(targetTabId, {active: true});
        if (windowId !== curWindowId) {
          chrome.windows.update(tab.windowId, {focused: true});
          curWindowId = windowId;
        }
        // console.log("[标签页激活] windowId:" + windowId +
        //   " tabId:" + targetTabId +
        //   ' curWindowId:' + curWindowId +
        //   " curTabId:" + curTabId +
        //   ' preTabId:' + preTabId)
      } catch (error) {
        console.error('Error handling tab activation:', error);
        // 处理可能的标签页拖拽错误
        if (error.message && error.message.includes('Tabs cannot be edited right now')) {
          console.log('Tab is being dragged, skipping activation logic');
        }
      }
    });
  }
});

// 监听窗口变化（切换窗口时也要记录）
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  if (windowId === curWindowId) {
    return;
  }
  getActiveTabInWindow(windowId).then(async (tab) => {
    if (curWindowId !== windowId) {
      curWindowId = windowId;
    }
    if (tab.id !== curTabId) {
      const temp = curTabId;
      curTabId = tab.id;
      preTabId = temp;
    }
    // console.log(`[窗口变化] windowId:${windowId}` +
    //   ' tabId:' + tab.id +
    //   ' curWindowId:' + curWindowId +
    //   ' curTabId:' + curTabId +
    //   ' preTabId:' + preTabId);
  }).catch((error) => {
    console.error('错误:', error.message);
  });
});

// 注册快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "switch-to-previous-tab") {
    // 优先使用内存中的值，否则从 storage 加载
    let targetTabId = preTabId;
    if (targetTabId) {
      try {
        await chrome.tabs.update(targetTabId, {active: true});
        const tab = await chrome.tabs.get(targetTabId);
        if (curWindowId !== tab.windowId) {
          await chrome.windows.update(tab.windowId, {focused: true});
          curWindowId = tab.windowId;
        }
        if (targetTabId !== curTabId) {
          const temp = curTabId;
          curTabId = targetTabId;
          preTabId = temp;
        }
        // console.log("[快捷键] windowId:" + tab.windowId +
        //   " tabId:" + targetTabId +
        //   ' curWindowId:' + curWindowId +
        //   " curTabId:" + curTabId +
        //   ' preTabId:' + preTabId)
      } catch (e) {
        console.log('Could not switch to the previous tab:', e);
        // preTab 可能已经关闭，清空记录
        preTabId = null;
      }
    }
  }
});

// 监听标签页关闭，清理无效 ID
chrome.tabs.onRemoved.addListener(async (tabId) => {
  // console.log('[onRemoved] remove tab:' + tabId)
  if (curTabId === tabId) {
    curTabId = null;
  }
  if (preTabId === tabId) {
    preTabId = null;
  }
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
    }
    return true; // 表示异步响应
  }
});

async function handleSwitchToTab(targetTabId, windowId) {
  try {
    // 激活目标标签页并聚焦窗口
    await chrome.tabs.update(targetTabId, {active: true});
    if (windowId !== curWindowId) {
      await chrome.windows.update(windowId, {focused: true});
      curWindowId = windowId;
    }
    if (targetTabId !== curTabId) {
      const temp = curTabId;
      curTabId = targetTabId;
      preTabId = temp;
    }
    // console.log("[消息发送] windowId:" + windowId +
    //   " tabId:" + targetTabId +
    //   ' curWindowId:' + curWindowId +
    //   " curTabId:" + curTabId +
    //   ' preTabId:' + preTabId)
  } catch (e) {
    console.log('Could not switch to the target tab:', e);
    throw e;
  }
}