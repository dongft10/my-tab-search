// Import i18n manager
import i18n from './i18n.js';
// Import config

// DOM elements
let pinnedTabList;

// 当前选中的tab item
let selectedIndex = -1;
// 标签列表
let lis;

// Toast 提示函数
function showToast(message, duration = 3000) {
  // 移除已存在的 toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  // 创建 toast 元素
  const toast = document.createElement('div');
  toast.classList.add('toast');
  toast.textContent = message;

  // 添加到 body
  document.body.appendChild(toast);

  // 自动移除
  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }, duration);
}

// 初始化
async function initialize() {
  await i18n.initialize();
  
  // 初始化 DOM 元素
  pinnedTabList = document.getElementById('pinned-tab-list');
  
  // 更新国际化文本
  updateI18nText();
  
  // 绑定事件
  bindEvents();
  
  // 加载固定标签页
  await loadPinnedTabs();
}

// 更新国际化文本
function updateI18nText() {
  // 更新标题
  const titleElement = document.querySelector('[data-i18n="pinnedTabsTitle"]');
  if (titleElement) {
    titleElement.textContent = i18n.getMessage('pinnedTabsTitle') || 'Fixed Tab List';
  }
  
  // 更新按钮提示
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.title = i18n.getMessage('settingsTitle') || 'Settings';
  }
  
  const aboutBtn = document.getElementById('about-btn');
  if (aboutBtn) {
    aboutBtn.title = i18n.getMessage('aboutTitle') || 'About';
  }
}

// 绑定事件
function bindEvents() {
  // 键盘事件
  window.addEventListener('keydown', handleKeydown);
  
  // 窗口失去焦点时关闭窗口
  window.addEventListener('blur', () => {
    window.close();
  });
  
  // 设置按钮
  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openSettings' });
  });
  
  // 关于按钮
  document.getElementById('about-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openAbout' });
  });
  
  // 监听语言变化
  i18n.addListener(() => {
    updateI18nText();
    loadPinnedTabs();
  });
  
  // 监听来自其他部分的语言变化消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'languageChanged') {
      i18n.setLanguage(message.language).then(() => {
        updateI18nText();
        loadPinnedTabs();
      });
    }
  });
}

// 处理键盘事件
  function handleKeydown(event) {
    // 检查是否是 Ctrl+Shift+A 快捷键
    if (event.ctrlKey && event.shiftKey && event.key === 'A') {
      event.preventDefault();
      console.log('[pinned-list] Ctrl+Shift+A pressed, requesting to close window and open main popup');
      // 通知 background script 关闭当前窗口并打开主搜索弹窗
      chrome.runtime.sendMessage({ action: 'openMainPopup' });
      return;
    }
    
    if (!lis || lis.length === 0) return;  
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = (selectedIndex <= 0) ? lis.length - 1 : selectedIndex - 1;
        updateSelection();
        scrollIntoView(selectedIndex, event);
        break;
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = (selectedIndex >= lis.length - 1) ? 0 : selectedIndex + 1;
        updateSelection();
        scrollIntoView(selectedIndex, event);
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < lis.length) {
          const li = lis[selectedIndex];
          if (li) {
            const tabId = parseInt(li.dataset.tabId);
            if (!isNaN(tabId)) {
              switchToTab(tabId);
            }
          }
        }
        break;
      case 'Delete':
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < lis.length) {
          const li = lis[selectedIndex];
          if (li) {
            const tabId = parseInt(li.dataset.tabId);
            if (!isNaN(tabId)) {
              closeTabAndRemoveFromPinnedList(tabId);
            }
          }
        }
        break;
      case 'Escape':
        event.preventDefault();
        // 关闭当前弹窗
        window.close();
        break;
    }
  }

// 滚动到可视区域
function scrollIntoView(selectedIndex, event, behavior) {
  if (!lis || lis.length === 0) return;
  
  const selectedItem = lis[selectedIndex];
  if (!selectedItem) return;
  
  selectedItem.scrollIntoView({
    block: 'nearest',
    behavior: behavior || 'smooth'
  });
}

// 更新选中状态
function updateSelection() {
  if (!lis) return;
  
  lis.forEach((li, index) => {
    if (index === selectedIndex) {
      li.classList.add('selected');
    } else {
      li.classList.remove('selected');
    }
  });
}

// 加载固定标签页
// @param targetTabId 可选，指定要滚动到的标签页ID
async function loadPinnedTabs(targetTabId = null) {
  try {
    const result = await chrome.storage.sync.get('pinnedTabs');
    const pinnedTabs = result.pinnedTabs || [];
    
    renderPinnedTabs(pinnedTabs, targetTabId);
  } catch (error) {
    console.error('Error loading pinned tabs:', error);
    renderEmptyState();
  }
}

// 渲染固定标签页
// @param pinnedTabs 固定标签页列表
// @param targetTabId 可选，指定要滚动到的标签页ID
function renderPinnedTabs(pinnedTabs, targetTabId = null) {
  pinnedTabList.innerHTML = '';
  
  if (pinnedTabs.length === 0) {
    renderEmptyState();
    return;
  }
  
  // 记录目标元素
  let targetElement = null;
  
  // 遍历固定标签页
  pinnedTabs.forEach((tab, index) => {
    try {
      const li = document.createElement('li');
      li.dataset.tabId = tab.tabId;
      
      // 标签图标
      const icon = document.createElement('img');
      icon.classList.add('li-icon');
      icon.src = getFaviconURL(tab.url);
      
      const listItemDiv = document.createElement('div');
      listItemDiv.classList.add('li-item');
      
      // 标题和 URL
      const titleDiv = document.createElement('div');
      titleDiv.classList.add('tab-title');
      titleDiv.textContent = tab.title;
      
      const urlHostNameDiv = document.createElement('div');
      urlHostNameDiv.classList.add('tab-url-hostname');
      urlHostNameDiv.textContent = getHostName(tab.url);
      urlHostNameDiv.title = tab.url;
      
      listItemDiv.appendChild(titleDiv);
      listItemDiv.appendChild(urlHostNameDiv);
      
      // 创建操作按钮容器
      const actionContainer = document.createElement('div');
      actionContainer.classList.add('action-container');
      
      // 创建取消固定按钮
      const unpinBtn = document.createElement('button');
      unpinBtn.classList.add('action-btn', 'pin-btn');
      unpinBtn.innerHTML = "🟠";
      unpinBtn.title = i18n.getMessage('unpinTab') || '取消固定标签页';
      unpinBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        removeFromPinnedList(tab.tabId);
      });
      
      // 创建关闭按钮
      const closeBtn = document.createElement('button');
      closeBtn.classList.add('action-btn', 'close-btn');
      closeBtn.innerHTML = "✕";
      closeBtn.title = i18n.getMessage('closeTab') || 'Close tab';
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closeTabAndRemoveFromPinnedList(tab.tabId);
      });
      
      // 创建三点按钮（默认显示）
      const menuBtn = document.createElement('button');
      menuBtn.classList.add('action-btn', 'menu-btn');
      menuBtn.innerHTML = "⋯";
      menuBtn.title = i18n.getMessage('menuLabel') || '菜单';
      
      // 组装按钮容器
      actionContainer.appendChild(unpinBtn);
      actionContainer.appendChild(closeBtn);
      actionContainer.appendChild(menuBtn);
      
      li.appendChild(icon);
      li.appendChild(listItemDiv);
      li.appendChild(actionContainer);
      
      // 点击切换到标签页
      li.addEventListener('click', () => {
        switchToTab(tab.tabId);
      });
      
      pinnedTabList.appendChild(li);
      
      // 如果这是目标标签页，记录该元素
      if (targetTabId && tab.tabId === targetTabId) {
        targetElement = li;
      }
    } catch (error) {
      console.error('Error rendering pinned tab:', error);
    }
  });
  
  // 渲染完成后，如果有目标元素，滚动到该位置
  if (targetElement) {
    setTimeout(() => {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
  
  // 更新列表引用
  lis = pinnedTabList.childNodes;
  
  // 默认选中第一个
  if (lis.length > 0) {
    selectedIndex = 0;
    updateSelection();
  }
}

// 渲染空状态
function renderEmptyState() {
  pinnedTabList.innerHTML = '';
  
  const emptyState = document.createElement('div');
  emptyState.classList.add('empty-state');
  
  const icon = document.createElement('div');
  icon.classList.add('empty-state-icon');
  icon.textContent = '📌';
  
  const text = document.createElement('div');
  text.classList.add('empty-state-text');
  text.textContent = i18n.getMessage('noPinnedTabs') || 'No fixed tabs';
  
  const subtext = document.createElement('div');
  subtext.classList.add('empty-state-subtext');
  subtext.textContent = i18n.getMessage('pinTabsHint') || 'Use Ctrl+Shift+A to open search and pin tabs';
  
  emptyState.appendChild(icon);
  emptyState.appendChild(text);
  emptyState.appendChild(subtext);
  
  pinnedTabList.appendChild(emptyState);
  
  // 重置选中状态
  selectedIndex = -1;
  lis = [];
}

// 切换到标签页
async function switchToTab(tabId) {
  try {
    // 检查标签页是否存在
    const tab = await chrome.tabs.get(tabId);
    if (!tab) {
      // 标签页不存在，从固定列表中移除
      await removeFromPinnedList(tabId);
      return;
    }
    
    // 激活标签页
    await chrome.tabs.update(tabId, { active: true });
    
    // 聚焦窗口
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    
    // 关闭弹窗
    window.close();
  } catch (error) {
    if(error.message && error.message.includes('No tab with id')) {
      // 标签页不存在，从固定列表中移除
      await removeFromPinnedList(tabId);
    } else if(error.message && !error.message.includes('No tab with id')) {
      // 其他错误，重新抛出
      throw error;
    }
  }
}

// 从固定列表中移除（不关闭标签页）
async function removeFromPinnedList(tabId) {
  try {
    const result = await chrome.storage.sync.get('pinnedTabs');
    let pinnedTabs = result.pinnedTabs || [];
    
    // 找到要移除的标签页的索引
    const removedIndex = pinnedTabs.findIndex(tab => tab.tabId === tabId);
    
    // 过滤掉要移除的标签页
    pinnedTabs = pinnedTabs.filter(tab => tab.tabId !== tabId);
    
    // 保存到存储
    await chrome.storage.sync.set({ pinnedTabs });
    
    // 确定要滚动到的标签页ID
    // 优先选择下一个标签页，如果没有则选择上一个
    let targetTabId = null;
    if (pinnedTabs.length > 0) {
      if (removedIndex < pinnedTabs.length) {
        // 选择下一个标签页
        targetTabId = pinnedTabs[removedIndex].tabId;
      } else if (removedIndex > 0) {
        // 选择上一个标签页
        targetTabId = pinnedTabs[removedIndex - 1].tabId;
      }
    }
    
    // 重新加载列表，并滚动到目标位置
    await loadPinnedTabs(targetTabId);
  } catch (error) {
    console.error('Error removing from pinned list:', error);
  }
}

// 关闭标签页并从固定列表中移除
async function closeTabAndRemoveFromPinnedList(tabId) {
  try {
    // 先从固定列表中移除
    await removeFromPinnedList(tabId);
    
    // 然后关闭标签页（如果标签页还存在）
    try {
      await chrome.tabs.remove(tabId);
    } catch (tabError) {
      // 标签页可能已经被关闭，忽略此错误
      if (tabError.message && tabError.message.includes('No tab with id')) {
        // 标签页已关闭，这是预期的行为
      } else {
        // 其他错误，重新抛出
        throw tabError;
      }
    }
  } catch (error) {
    console.error('Error closing tab and removing from pinned list:', error);
  }
}

// 获取网站图标
function getFaviconURL(url) {
  try {
    const faviconUrl = new URL(chrome.runtime.getURL('/_favicon/'));
    faviconUrl.searchParams.set('pageUrl', url);
    faviconUrl.searchParams.set('size', '26');
    return faviconUrl.toString();
  } catch (error) {
    return '';
  }
}

// 获取主机名
function getHostName(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    return url;
  }
}

// 初始化
initialize().catch(console.error);
