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
      if (chrome.runtime.lastError) {
        console.warn('获取标签页失败:', chrome.runtime.lastError.message);
        return;
      }
      try {
        const windowId = tab.windowId;
        // 简化逻辑：只要当前激活的标签页与记录的不同，就更新当前和前一个标签页ID
        if (curTabId !== targetTabId) {
          // 只有在当前有有效的标签页ID时，才更新前一个标签页ID
          if (curTabId) {
            preTabId = curTabId;
          }
          curTabId = targetTabId;
        }

        if (windowId !== curWindowId) {
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
  try {
    const tab = await getActiveTabInWindow(windowId);
    if (tab) {
      if (curWindowId !== windowId) {
        curWindowId = windowId;
      }
      if (tab.id !== curTabId) {
        const temp = curTabId;
        curTabId = tab.id;
        preTabId = temp;
      }
    }
    // console.log(`[窗口变化] windowId:${windowId}` +
    //   ' tabId:' + tab.id +
    //   ' curWindowId:' + curWindowId +
    //   ' curTabId:' + curTabId +
    //   ' preTabId:' + preTabId);
  } catch (error) {
    console.error('处理窗口焦点变更时出错:', error.message);
  }
});

// 注册快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "switch-to-previous-tab") {
    let targetTabId = preTabId;
    if (targetTabId) {
      try {
        // 先检查标签页是否存在
        const tabExists = await chrome.tabs.get(targetTabId).catch(() => null);
        if (!tabExists) {
          console.log('Previous tab no longer exists');
          // 当preTab不存在时，尝试获取当前窗口的其他标签页
          await findAlternativeTab();
          return;
        }

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
        if ((e.message && e.message.includes('Tabs cannot be edited right now'))) {
          console.warn('标签页正在被拖拽，无法切换到上一个标签页');
          // 标签页拖拽时不重置preTabId，等待拖拽完成后重试
          return;
        }
        // 只在确认标签页不存在时才清空记录
        try {
          await chrome.tabs.get(targetTabId);
        } catch {
          console.log('Previous tab not found, trying to find alternative');
          await findAlternativeTab();
        }
      }
    } else {
      // 如果preTabId为null，尝试查找当前窗口的其他标签页
      await findAlternativeTab();
    }
  }
});

// 当preTab不存在时，尝试查找当前窗口的其他标签页作为替代
async function findAlternativeTab() {
  try {
    const tabs = await chrome.tabs.query({windowId: curWindowId, active: false});
    if (tabs.length > 0) {
      // 选择第一个非活动标签页作为替代
      const altTab = tabs[0];
      preTabId = altTab.id;
      console.log('Found alternative tab:', preTabId);
      // 尝试切换到这个替代标签页
      await chrome.tabs.update(preTabId, {active: true});
      const temp = curTabId;
      curTabId = preTabId;
      preTabId = temp;
    }
  } catch (e) {
    console.error('Error finding alternative tab:', e);
  }
}

// 监听标签页关闭，清理无效 ID
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (curTabId === tabId) {
    // 当当前标签页关闭时，尝试找到一个新的当前标签页
    try {
      const tabs = await chrome.tabs.query({windowId: curWindowId, active: true});
      if (tabs.length > 0) {
        curTabId = tabs[0].id;
      } else {
        curTabId = null;
      }
    } catch (e) {
      console.error('Error updating curTabId after tab closure:', e);
      curTabId = null;
    }
  }
  if (preTabId === tabId) {
    // 当preTab关闭时，尝试找到一个替代的preTab
    try {
      const tabs = await chrome.tabs.query({windowId: curWindowId, active: false});
      if (tabs.length > 0) {
        // 找到一个不是当前标签页的标签页作为preTab
        const altTab = tabs.find(tab => tab.id !== curTabId);
        preTabId = altTab ? altTab.id : tabs[0].id;
      } else {
        preTabId = null;
      }
    } catch (e) {
      console.error('Error finding alternative preTab after tab closure:', e);
      preTabId = null;
    }
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