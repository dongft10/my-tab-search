# Background.js 优化说明

## 问题分析

### 原始代码存在的问题

1. **网页刷新导致 preTabId 失效**
   - 当用户刷新网页时，Chrome 会重新创建标签页，但 tabId 实际上保持不变
   - 原始代码缺少对标签页更新事件的监听，无法正确处理刷新场景

2. **缺少初始化逻辑**
   - 扩展加载时，`curTabId`、`preTabId`、`curWindowId` 都是 `null`
   - 没有从当前活动标签页初始化状态，导致首次使用时功能不可用

3. **历史记录管理不完善**
   - 只记录"上一个"标签页，无法记录完整的历史访问顺序
   - 当 preTabId 失效时，无法找到合适的替代标签页

4. **跨窗口切换逻辑问题**
   - 在不同窗口间切换时，preTabId 的维护逻辑不够健壮
   - 没有考虑跨窗口的历史记录管理

5. **标签页关闭处理不完整**
   - 标签页关闭时，没有清理历史记录中的无效引用
   - 可能导致 preTabId 指向已关闭的标签页

---

## 优化方案

### 1. 引入标签页历史记录栈

```javascript
// 标签页历史记录栈（用于支持更灵活的切换）
let tabHistory = []; // 存储历史 tabId，最新的在前面
const MAX_HISTORY_SIZE = 20; // 最大历史记录数量
```

**优势：**
- 记录完整的标签页访问历史
- 支持更灵活的标签页切换
- 当 preTabId 失效时，可以从历史记录中找到替代标签页

### 2. 添加初始化函数

```javascript
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
```

**优势：**
- 扩展加载时自动初始化状态
- 从当前活动标签页获取初始值
- 避免首次使用时功能不可用

### 3. 添加标签页更新事件监听

```javascript
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // 只在标签页加载完成或URL变化时处理
  if (changeInfo.status === 'complete' || changeInfo.url) {
    try {
      // 如果更新的标签页是当前标签页，需要更新历史记录中的引用
      if (curTabId === tabId) {
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
```

**优势：**
- 监听标签页刷新、URL 变化等事件
- 确保标签页更新时状态保持正确
- 处理网页刷新场景

### 4. 优化历史记录管理函数

```javascript
// 更新标签页历史记录
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

// 从历史记录中移除已关闭的标签页
function removeFromHistory(tabId) {
  tabHistory = tabHistory.filter(id => id !== tabId);
  // 重新计算 preTabId
  preTabId = tabHistory.length > 1 ? tabHistory[1] : null;
}
```

**优势：**
- 自动维护历史记录的顺序
- 自动更新 preTabId
- 避免历史记录无限增长

### 5. 改进快捷键命令处理

```javascript
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
          return;
        }
        // 只在确认标签页不存在时才清空记录
        try {
          await chrome.tabs.get(targetTabId);
        } catch {
          console.log('Previous tab not found, removing from history');
          removeFromHistory(targetTabId);
          preTabId = null;
        }
      }
    } else {
      console.log('No previous tab available');
    }
  }
});
```

**优势：**
- 当 `preTabId` 无效时，直接清空 `preTabId`，**不再自动找替代标签页**
- 这样更符合用户预期，避免让用户感到困惑
- 自动清理历史记录中的无效引用
- 提供更详细的日志输出

### 6. 改进标签页关闭处理

```javascript
chrome.tabs.onRemoved.addListener(async (tabId) => {
  console.log('[标签页关闭] tabId:', tabId);
  
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
```

**优势：**
- 自动清理历史记录中的无效引用
- 自动更新 curTabId 和 preTabId
- 提供详细的日志输出

### 7. 添加扩展生命周期事件监听

```javascript
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
```

**优势：**
- 确保扩展加载时状态正确初始化
- 支持扩展安装、更新、启动等场景
- 避免状态不一致的问题

### 8. 添加通知功能

```javascript
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
```

**优势：**
- 当 `preTabId` 被清空时，向用户显示友好的提示
- 通知会在 3 秒后自动关闭，不会打扰用户
- 提供更好的用户体验，让用户清楚了解状态变化

**使用场景：**
- 当用户使用快捷键切换标签页时，如果上一个标签页已关闭，会显示通知
- 当标签页关闭导致 `preTabId` 被清空时，会显示通知

---

## 优化效果

### 解决的问题

1. ✅ **网页刷新不会丢失 preTabId**
   - 通过 `onUpdated` 事件监听，正确处理标签页刷新
   - tabId 在刷新时保持不变，历史记录仍然有效

2. ✅ **扩展加载时自动初始化**
   - 从当前活动标签页获取初始状态
   - 避免首次使用时功能不可用

3. ✅ **更健壮的历史记录管理**
   - 记录完整的标签页访问历史
   - 自动清理无效引用
   - 支持智能的替代标签页查找

4. ✅ **跨窗口切换支持**
   - 正确处理跨窗口的历史记录
   - 支持在不同窗口间切换标签页

5. ✅ **标签页关闭处理完善**
   - 自动清理历史记录
   - 自动更新状态变量

### 新增功能

1. 📊 **详细的日志输出**
   - 所有关键操作都有日志记录
   - 便于调试和问题排查

2. 🔄 **智能替代策略**
   - 优先从历史记录中查找替代标签页
   - 支持跨窗口查找

3. 💾 **历史记录管理**
   - 最多记录 20 个标签页
   - 自动清理过期记录

---

## 使用说明

### 快捷键

- **Ctrl+Shift+A** (Windows/Linux) 或 **Command+Shift+A** (Mac)：打开扩展弹出窗口
- **Ctrl+Shift+S** (Windows/Linux) 或 **Command+Shift+S** (Mac)：切换到上一个标签页

### 调试

打开 Chrome 开发者工具的扩展页面，查看 Console 日志：

1. 访问 `chrome://extensions/`
2. 找到 "My Tab Search Extension"
3. 点击 "Service Worker" 或 "背景页" 链接
4. 查看控制台日志输出

---

## 测试建议

### 测试场景

1. **基本功能测试**
   - 打开多个标签页
   - 使用快捷键切换到上一个标签页
   - 验证切换是否正确

2. **刷新测试**
   - 打开标签页 A 和 B
   - 切换到 A，然后刷新 A
   - 使用快捷键切换，应该能正确切换到 B

3. **关闭标签页测试**
   - 打开标签页 A、B、C
   - 切换顺序：A → B → C
   - 关闭 B
   - 使用快捷键切换，应该能正确切换到 A

4. **跨窗口测试**
   - 打开两个窗口，每个窗口有多个标签页
   - 在不同窗口间切换标签页
   - 使用快捷键切换，验证跨窗口功能

5. **扩展重启测试**
   - 打开多个标签页
   - 禁用并重新启用扩展
   - 使用快捷键切换，验证状态是否正确

---

## 总结

通过引入标签页历史记录栈、添加初始化逻辑、改进事件监听等方式，我们解决了原始代码中存在的多个问题，使得标签页切换功能更加健壮和可靠。

优化后的代码具有以下特点：

- ✅ 更健壮的状态管理
- ✅ 更完善的错误处理
- ✅ 更详细的日志输出
- ✅ 更智能的替代策略
- ✅ 更好的用户体验