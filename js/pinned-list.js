// Import i18n manager
import i18n from './i18n.js';
// Import feature limit service
import featureLimitService from './services/feature-limit.service.js';
// Import auth service
import authService from './services/auth.service.js';
// Import trial service
import trialService from './services/trial.service.js';
// Import VIP service
import vipService from './services/vip.service.js';
// Import sync queue service
import syncQueueService from './services/sync-queue.service.js';
// Import search match service
import searchMatchService from './services/search-match.service.js';

// DOM elements
let pinnedTabList;
let searchInput;
let tabCount;

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
  
  // 更新页面国际化元素
  i18n.updatePageI18n();
  
  // 初始化 DOM 元素
  pinnedTabList = document.getElementById('pinned-tab-list');
  searchInput = document.getElementById('search-input');
  tabCount = document.getElementById('tab-count');
  
  // 将焦点设置到搜索框
  searchInput.focus();
  
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
    titleElement.textContent = i18n.getMessage('pinnedTabsTitle') || 'Pinned Tab List';
  }
  
  // 更新搜索框占位符
  if (searchInput) {
    searchInput.placeholder = i18n.getMessage('searchPinnedTabs') || 'search pinned tabs...';
    searchInput.setAttribute('aria-label', i18n.getMessage('searchPinnedTabsAria') || 'search pinned tabs');
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
  
  // 搜索框输入事件
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      loadPinnedTabs();
    });
  }
  
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
    const result = await chrome.storage.local.get('pinnedTabs');
    let pinnedTabs = result.pinnedTabs || [];
    
    // 获取搜索关键字
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const keywords = query ? query.split(/\s+/).filter(kw => kw.length > 0) : [];
    
    // 获取当前搜索匹配模式
    const searchMatchMode = await searchMatchService.getSearchMatchMode();
    
    // 如果有搜索关键字，对标签页进行过滤
    if (keywords.length > 0) {
      // 根据当前搜索匹配模式过滤标题
      pinnedTabs = pinnedTabs.filter((tab) => {
        const lowerTitle = (tab.title || '').toLowerCase();
        // 多关键字时，所有关键字都必须满足匹配条件（AND逻辑）
        return keywords.every(keyword => {
          return searchMatchService.matchSync(keyword, lowerTitle, searchMatchMode);
        });
      });
      
      // 根据匹配度排序
      pinnedTabs.sort((a, b) => {
        const scoreA = calculateMatchScore(a.title, keywords);
        const scoreB = calculateMatchScore(b.title, keywords);
        return scoreB - scoreA;
      });
    }
    
    renderPinnedTabs(pinnedTabs, targetTabId, keywords, searchMatchMode);
  } catch (error) {
    console.error('Error loading pinned tabs:', error);
    renderEmptyState();
  }
}

// 子序列匹配：检查关键字是否按顺序出现在文本中
function subsequenceMatch(keyword, text) {
  if (!keyword || !text) return false;
  
  let textIndex = 0;
  const keywordLower = keyword.toLowerCase();
  const textLower = text.toLowerCase();
  
  for (let i = 0; i < keywordLower.length && textIndex < textLower.length; i++) {
    const char = keywordLower[i];
    const foundIndex = textLower.indexOf(char, textIndex);
    
    if (foundIndex === -1) {
      return false;
    }
    
    textIndex = foundIndex + 1;
  }
  
  return true;
}

// 计算匹配分数：关键字越靠前、匹配字符越多，分数越高
function calculateMatchScore(title, keywords) {
  if (!title || !keywords || keywords.length === 0) return 0;
  
  const lowerTitle = title.toLowerCase();
  let score = 0;
  
  keywords.forEach((keyword, kwIndex) => {
    const keywordLower = keyword.toLowerCase();
    
    // 标题完全包含关键字
    if (lowerTitle.includes(keywordLower)) {
      score += 100;
      
      // 标题以关键字开头，加更多分
      if (lowerTitle.startsWith(keywordLower)) {
        score += 50;
      }
    }
    
    // 子序列匹配
    if (subsequenceMatch(keywordLower, lowerTitle)) {
      score += 50;
      
      // 关键字在标题中越靠前，分数越高
      const matchIndex = lowerTitle.indexOf(keywordLower);
      if (matchIndex !== -1) {
        score += Math.max(0, 20 - matchIndex / 10);
      }
    }
    
    // 关键字越靠后权重越低（用户通常更关注前面的关键字）
    score -= kwIndex * 5;
  });
  
  return score;
}

// 高亮匹配的关键字
// @param text - 要高亮的文本
// @param keywords - 关键字数组
// @param matchMode - 搜索匹配模式 (1: 完整关键字匹配, 2: 子序列匹配)
function highlightMatches(text, keywords, matchMode = '1') {
  if (!keywords || keywords.length === 0 || !text) {
    return text;
  }

  const lowerText = text.toLowerCase();

  // 创建一个标记数组，记录每个字符是否被匹配
  const matched = new Array(text.length).fill(false);

  // 模式1：完整关键字包含匹配，高亮整个关键字
  if (matchMode === '1' || matchMode === '3') {
    keywords.forEach(keyword => {
      const lowerKeyword = keyword.toLowerCase();
      let startIndex = 0;
      // 找到所有匹配位置
      while (startIndex < lowerText.length) {
        const idx = lowerText.indexOf(lowerKeyword, startIndex);
        if (idx === -1) break;
        // 标记整个关键字匹配的字符
        for (let i = idx; i < idx + lowerKeyword.length; i++) {
          matched[i] = true;
        }
        startIndex = idx + 1;
      }
    });
  } else {
    // 模式2及其他的子序列匹配，高亮每个字符
    keywords.forEach(keyword => {
      for (let k = 0; k < keyword.length; k++) {
        const char = keyword[k].toLowerCase();
        for (let i = 0; i < text.length; i++) {
          if (lowerText[i] === char) {
            matched[i] = true;
          }
        }
      }
    });
  }

  // 构建高亮的 HTML
  let result = '';
  for (let i = 0; i < text.length; i++) {
    if (matched[i]) {
      result += `<span class="highlight">${text[i]}</span>`;
    } else {
      result += text[i];
    }
  }

  return result;
}

// 渲染固定标签页
// @param pinnedTabs 固定标签页列表
// @param targetTabId 可选，指定要滚动到的标签页ID
// @param keywords 可选，搜索关键字用于高亮
// @param matchMode 可选，搜索匹配模式
function renderPinnedTabs(pinnedTabs, targetTabId = null, keywords = [], matchMode = '1') {
  pinnedTabList.innerHTML = '';
  
  // 更新数量显示
  if (tabCount) {
    tabCount.textContent = `${pinnedTabs.length} ${i18n.getMessage('tabs') || 'Tabs'}`;
  }
  
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
      
      // 如果是长期固定的Tab，添加专属底色
      if (tab.isLongTermPinned) {
        li.classList.add('long-term-pinned');
      }
      
      // 标签图标
      const icon = document.createElement('img');
      icon.classList.add('li-icon');
      icon.src = getFaviconURL(tab.url);
      
      const listItemDiv = document.createElement('div');
      listItemDiv.classList.add('li-item');
      
      // 标题和 URL
      const titleDiv = document.createElement('div');
      titleDiv.classList.add('tab-title');
      titleDiv.innerHTML = highlightMatches(tab.title, keywords, matchMode);
      
      const urlHostNameDiv = document.createElement('div');
      urlHostNameDiv.classList.add('tab-url-hostname');
      urlHostNameDiv.textContent = getHostName(tab.url);
      urlHostNameDiv.title = tab.url;
      
      listItemDiv.appendChild(titleDiv);
      listItemDiv.appendChild(urlHostNameDiv);
      
      // 创建操作按钮容器
      const actionContainer = document.createElement('div');
      actionContainer.classList.add('action-container');
      
      // 创建展开按钮区域（悬停菜单按钮时展开）
      const expandActions = document.createElement('div');
      expandActions.classList.add('expand-actions');
      
      // 展开区域布局：从左到右 [长期固定] [取消固定] [关闭]
      
      // 创建关闭按钮（展开时显示）
      const closeBtn = document.createElement('button');
      closeBtn.classList.add('action-btn', 'close-btn');
      closeBtn.innerHTML = "✕";
      closeBtn.title = i18n.getMessage('closeTab') || '关闭标签页';
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closeTabAndRemoveFromPinnedList(tab.tabId);
      });
      
      // 如果是长期固定的tab，隐藏关闭按钮（避免关闭不存在的tab）
      if (tab.isLongTermPinned) {
        closeBtn.style.display = 'none';
      }
      
      // 创建取消固定按钮（展开时显示）
      const unpinBtn = document.createElement('button');
      unpinBtn.classList.add('action-btn', 'unpin-btn');
      unpinBtn.innerHTML = "🟠";
      unpinBtn.title = i18n.getMessage('unpinTab') || '取消固定标签页';
      unpinBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        removeFromPinnedList(tab.tabId);
      });
      
      // 如果是长期固定的tab，隐藏取消固定按钮
      if (tab.isLongTermPinned) {
        unpinBtn.style.display = 'none';
      }
      
      // 创建长期固定按钮（展开时始终显示）
      const longTermBtn = document.createElement('button');
      longTermBtn.classList.add('action-btn', 'longterm-btn');
      // 根据是否已长期固定显示不同图标
      if (tab.isLongTermPinned) {
        longTermBtn.innerHTML = "📌";
        longTermBtn.title = i18n.getMessage('cancelLongTermPinned') || '取消长期固定';
        longTermBtn.classList.add('active');
      } else {
        longTermBtn.innerHTML = "📍";
        longTermBtn.title = i18n.getMessage('setLongTermPinned') || '设为长期固定';
      }
      longTermBtn.addEventListener('click', async function (e) {
        e.stopPropagation();
        // 检查用户状态并处理
        await handleLongTermPinnedClick(tab.tabId, tab.isLongTermPinned);
      });
      
      // 组装展开区域（从左到右：长期固定 → 取消固定 → 关闭）
      expandActions.appendChild(longTermBtn);
      expandActions.appendChild(unpinBtn);
      expandActions.appendChild(closeBtn);
      
      // 创建三横菜单按钮（默认显示）
      const menuBtn = document.createElement('button');
      menuBtn.classList.add('action-btn', 'menu-btn');
      menuBtn.innerHTML = "≡";
      menuBtn.title = i18n.getMessage('menuLabel') || '菜单';
      
      // 悬停菜单按钮时，菜单按钮变成关闭按钮，并展开操作按钮
      menuBtn.addEventListener('mouseenter', function() {
        menuBtn.classList.add('menu-hover');
        expandActions.classList.add('expanded');
      });
      
      // 菜单按钮离开时恢复
      menuBtn.addEventListener('mouseleave', function() {
        menuBtn.classList.remove('menu-hover');
        expandActions.classList.remove('expanded');
      });
      
      // 展开区域也需要处理鼠标离开事件
      expandActions.addEventListener('mouseenter', function() {
        menuBtn.classList.add('menu-hover');
        expandActions.classList.add('expanded');
      });
      
      expandActions.addEventListener('mouseleave', function() {
        menuBtn.classList.remove('menu-hover');
        expandActions.classList.remove('expanded');
      });
      
      // 添加到容器
      actionContainer.appendChild(expandActions);
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
  
  // 更新数量显示
  if (tabCount) {
    tabCount.textContent = '0';
  }
  
  const emptyState = document.createElement('div');
  emptyState.classList.add('empty-state');
  
  const icon = document.createElement('div');
  icon.classList.add('empty-state-icon');
  icon.textContent = '📌';
  
  const text = document.createElement('div');
  text.classList.add('empty-state-text');
  text.textContent = i18n.getMessage('noPinnedTabs') || 'No pinned tabs';
  
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
    // 先尝试通过tabId直接获取标签页
    let tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch (e) {
      // tab不存在，后续处理
    }
    
    // 如果标签页存在，直接切换
    if (tab) {
      await chrome.tabs.update(tabId, { active: true });
      if (tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
      window.close();
      return;
    }
    
    // 标签页不存在，检查是否是长期固定的tab
    const result = await chrome.storage.local.get('pinnedTabs');
    const pinnedTabs = result.pinnedTabs || [];
    const targetTab = pinnedTabs.find(t => t.isLongTermPinned && t.tabId === tabId);
    
    if (targetTab) {
      // 长期固定的tab：先查找当前浏览器中是否有相同URL的已打开标签页
      const existingTabs = await chrome.tabs.query({ url: targetTab.url });
      
      if (existingTabs.length > 0) {
        // 找到已打开的标签页，切换到它
        const existingTab = existingTabs[0];
        await chrome.tabs.update(existingTab.id, { active: true });
        if (existingTab.windowId) {
          await chrome.windows.update(existingTab.windowId, { focused: true });
        }
      } else {
        // 没有找到相同URL的标签页，创建新标签页
        const newTab = await chrome.tabs.create({ url: targetTab.url });
        // 更新pinnedTabList中记录的tabId（保留原标题）
        const updatedTabs = pinnedTabs.map(t => {
          if (t.isLongTermPinned && t.url === targetTab.url) {
            return { 
              ...t, 
              tabId: newTab.id, 
              longTermPinnedAt: new Date().toISOString()
            };
          }
          return t;
        });
        await chrome.storage.local.set({ pinnedTabs: updatedTabs });
      }
      window.close();
      return;
    }
    
    // 非长期固定的tab，直接从列表中移除
    await removeFromPinnedList(tabId);
  } catch (error) {
    console.error('Switch to tab error:', error);
  }
}

// 从固定列表中移除（不关闭标签页）
async function removeFromPinnedList(tabId) {
  try {
    const result = await chrome.storage.local.get('pinnedTabs');
    let pinnedTabs = result.pinnedTabs || [];
    
    // 检查是否是长期固定的tab，如果是则不执行移除
    const targetTab = pinnedTabs.find(t => t.tabId === tabId);
    if (targetTab && targetTab.isLongTermPinned) {
      console.log('[removeFromPinnedList] Cannot remove long-term pinned tab:', tabId);
      return;
    }
    
    // 找到要移除的标签页的索引
    const removedIndex = pinnedTabs.findIndex(tab => tab.tabId === tabId);
    
    // 过滤掉要移除的标签页
    pinnedTabs = pinnedTabs.filter(tab => tab.tabId !== tabId);
    
    // 保存到存储
    await chrome.storage.local.set({ pinnedTabs });
    
    // 异步同步到服务器
    syncQueueService.addOperation('unpinTab', { tabId }).catch(err => console.warn('Sync unpinTab failed:', err));
    
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
    // 检查是否是长期固定的tab
    const result = await chrome.storage.local.get('pinnedTabs');
    const pinnedTabs = result.pinnedTabs || [];
    const targetTab = pinnedTabs.find(t => t.tabId === tabId);
    const isLongTermPinned = targetTab && targetTab.isLongTermPinned;
    
    // 关闭浏览器标签页（如果标签页还存在）
    try {
      await chrome.tabs.get(tabId);
      // 只有 tab 存在时才尝试关闭
      await chrome.tabs.remove(tabId);
    } catch (tabError) {
      // 标签页不存在（可能已经被关闭或不存在），忽略错误
      console.log('[closeTabAndRemoveFromPinnedList] Tab does not exist or already closed:', tabId);
    }
    
    // 根据是否是长期固定tab决定是否从列表中移除
    if (isLongTermPinned) {
      // 长期固定的tab：关闭了浏览器tab，但仍保留在列表中
      showToast('长期固定的Tab已关闭，但仍保留在列表中');
      // 刷新列表显示
      await loadPinnedTabs();
    } else {
      // 普通tab：从列表中移除
      await removeFromPinnedList(tabId);
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

// 处理长期固定按钮点击（根据用户类型显示不同提示）
async function handleLongTermPinnedClick(tabId, isCurrentlyLongTermPinned) {
  try {
    // 检查是否已完成邮箱验证或OAuth登录
    const isEmailVerified = await authService.isEmailVerified();
    
    console.log('[pinned-list] isEmailVerified:', isEmailVerified);
    console.log('[pinned-list] userInfo:', await authService.getUserInfo());
    
    if (!isEmailVerified) {
      // 静默注册用户：检查长期固定数量限制（5个）
      const pinnedTabs = await chrome.storage.local.get('pinnedTabs').then(r => r.pinnedTabs || []);
      const longTermCount = pinnedTabs.filter(t => t.isLongTermPinned).length;
      
      if (!isCurrentlyLongTermPinned && longTermCount >= 5) {
        showToast(i18n.getMessage('longTermPinnedLimitUnverified') || `长期固定标签页数量已达上限（最多5个），请完成邮箱验证解锁更多功能`);
        return;
      }
      
      // 未超过限制，允许操作
      if (isCurrentlyLongTermPinned) {
        await cancelLongTermPinned(tabId);
      } else {
        await setLongTermPinned(tabId);
      }
      return;
    }
    
    // 已完成邮箱验证的用户：根据体验期/VIP状态决定
    // 乐观模式：优先使用本地缓存，服务器异常时不影响用户操作
    
    let localTrialStatus = null;
    let trialStatusError = null;
    try {
      // 使用 getTrialStatus 获取本地缓存状态
      localTrialStatus = await trialService.getTrialStatus();
    } catch (e) {
      console.warn('[pinned-list] Failed to get local trial status:', e);
      trialStatusError = e;
    }
    
    // 如果本地状态显示在体验期内，允许操作（限制100个）
    if (localTrialStatus && localTrialStatus.isInTrialPeriod) {
      console.log('[pinned-list] User in trial period, checking limit');
      const limit = await featureLimitService.getFeatureLimit('longTermPinned', false, true);
      const pinnedTabs = await chrome.storage.local.get('pinnedTabs').then(r => r.pinnedTabs || []);
      const longTermCount = pinnedTabs.filter(t => t.isLongTermPinned).length;
      
      if (!isCurrentlyLongTermPinned && limit !== -1 && longTermCount >= limit) {
        showToast(i18n.getMessage('pinnedTabsLimit', limit.toString()) || `长期固定标签页数量已达上限（最多${limit}个）`);
        return;
      }
      
      if (isCurrentlyLongTermPinned) {
        await cancelLongTermPinned(tabId);
      } else {
        await setLongTermPinned(tabId);
      }
      // 后台异步刷新状态
      trialService.fetchTrialStatus().catch(err => console.warn('[pinned-list] Failed to fetch trial status:', err));
      return;
    }
    
    // 获取VIP状态（使用本地缓存，不强制刷新）
    let vipStatus = null;
    let vipStatusError = null;
    try {
      vipStatus = await vipService.getVipStatus(false);
    } catch (e) {
      console.warn('[pinned-list] Failed to get VIP status:', e);
      vipStatusError = e;
    }
    
    // VIP用户可以正常使用（限制100个）
    if (vipStatus && vipStatus.isVip) {
      const limit = await featureLimitService.getFeatureLimit('longTermPinned', false, true);
      const pinnedTabs = await chrome.storage.local.get('pinnedTabs').then(r => r.pinnedTabs || []);
      const longTermCount = pinnedTabs.filter(t => t.isLongTermPinned).length;
      
      if (!isCurrentlyLongTermPinned && limit !== -1 && longTermCount >= limit) {
        showToast(i18n.getMessage('pinnedTabsLimit', limit.toString()) || `长期固定标签页数量已达上限（最多${limit}个）`);
        return;
      }
      
      if (isCurrentlyLongTermPinned) {
        await cancelLongTermPinned(tabId);
      } else {
        await setLongTermPinned(tabId);
      }
      return;
    }
    
    // 如果获取状态时出错（服务器异常），使用乐观模式允许操作
    // 因为用户已完成邮箱验证，应该有基本的使用权限
    if (trialStatusError || vipStatusError) {
      console.log('[pinned-list] Server error detected, using optimistic mode');
      // 检查长期固定数量，使用前端限制作为fallback（100个）
      const limit = await featureLimitService.getFeatureLimit('longTermPinned', false, true);
      const pinnedTabs = await chrome.storage.local.get('pinnedTabs').then(r => r.pinnedTabs || []);
      const longTermCount = pinnedTabs.filter(t => t.isLongTermPinned).length;
      
      if (!isCurrentlyLongTermPinned && limit !== -1 && longTermCount >= limit) {
        showToast(i18n.getMessage('pinnedTabsLimit', limit.toString()) || `长期固定标签页数量已达上限（最多${limit}个）`);
        return;
      }
      
      if (isCurrentlyLongTermPinned) {
        await cancelLongTermPinned(tabId);
      } else {
        await setLongTermPinned(tabId);
      }
      return;
    }
    
    // 体验期结束且非VIP的普通用户：限制5个长期固定（引导购买VIP）
    const limit = await featureLimitService.getFeatureLimit('longTermPinned', false, true);
    const pinnedTabs = await chrome.storage.local.get('pinnedTabs').then(r => r.pinnedTabs || []);
    const longTermCount = pinnedTabs.filter(t => t.isLongTermPinned).length;
    
    if (!isCurrentlyLongTermPinned && limit !== -1 && longTermCount >= limit) {
      const trialEnabled = localTrialStatus && localTrialStatus.trialEnabled;
      const messageKey = trialEnabled ? 'longTermPinnedLimitExpired' : 'longTermPinnedLimitNoTrial';
      const fallbackMessage = trialEnabled 
        ? `长期固定标签页数量已达上限（最多${limit}个），体验期已结束，升级VIP会员即可继续使用更多功能哦！`
        : `长期固定标签页数量已达上限（最多${limit}个），升级VIP会员即可继续使用更多功能！`;
      showToast(i18n.getMessage(messageKey) || fallbackMessage);
      return;
    }
    
    if (isCurrentlyLongTermPinned) {
      await cancelLongTermPinned(tabId);
    } else {
      await setLongTermPinned(tabId);
    }
  } catch (error) {
    console.error('Long term pinned error:', error);
    showToast(i18n.getMessage('longTermPinnedFailed'));
  }
}

// 设置长期固定Tab
async function setLongTermPinned(tabId) {
  try {
    const result = await chrome.storage.local.get('pinnedTabs');
    const tabs = result.pinnedTabs || [];
    
    const updatedTabs = tabs.map(t => {
      if (t.tabId === tabId) {
        return {
          ...t,
          isLongTermPinned: true,
          longTermPinnedAt: new Date().toISOString()
        };
      }
      return t;
    });
    
    await chrome.storage.local.set({ pinnedTabs: updatedTabs });
    
    // 异步同步到服务器（仅在 tabId 存在时）
    if (tabId) {
      syncQueueService.addOperation('updateTab', {
        tabId,
        isLongTermPinned: true,
        longTermPinnedAt: new Date().toISOString()
      }).catch(err => console.warn('Sync updateTab failed:', err));
    }
    
    showToast(i18n.getMessage('longTermPinnedSuccess'));
    
    // 重新加载列表
    await loadPinnedTabs();
  } catch (error) {
    console.error('Set long term pinned error:', error);
    showToast(i18n.getMessage('setLongTermFailed'));
  }
}

// 取消长期固定Tab
async function cancelLongTermPinned(tabId) {
  try {
    const result = await chrome.storage.local.get('pinnedTabs');
    const tabs = result.pinnedTabs || [];
    
    const updatedTabs = tabs.map(t => {
      if (t.tabId === tabId) {
        return {
          ...t,
          isLongTermPinned: false,
          longTermPinnedAt: null
        };
      }
      return t;
    });
    
    await chrome.storage.local.set({ pinnedTabs: updatedTabs });
    
    // 异步同步到服务器（仅在 tabId 存在时）
    if (tabId) {
      syncQueueService.addOperation('updateTab', {
        tabId,
        isLongTermPinned: false,
        longTermPinnedAt: null
      }).catch(err => console.warn('Sync updateTab failed:', err));
    }
    
    showToast(i18n.getMessage('cancelLongTermSuccess'));
    
    // 重新加载列表
    await loadPinnedTabs();
  } catch (error) {
    console.error('Cancel long term pinned error:', error);
    showToast(i18n.getMessage('cancelLongTermFailed'));
  }
}

// 初始化
initialize().catch(console.error);
