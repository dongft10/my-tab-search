// Import i18n manager
import i18n from './i18n.js';
// Import feature limit service
import featureLimitService from './services/feature-limit.service.js';
// Import auth service (ESM version)
import authService from './services/auth.service.js';
// Import trial service
import trialService from './services/trial.service.js';
// Import VIP service
import vipService from './services/vip.service.js';
// Import sync queue service
import syncQueueService from './services/sync-queue.service.js';
// Import search match service
import searchMatchService from './services/search-match.service.js';
// Import pinyin utility for Chinese character conversion
import { isPureEnglish, toPinyin, toPinyinPerChar } from './pinyin-util.js';
import { applyFaviconFallback, getFaviconURL as buildFaviconURL } from './utils/favicon.mjs';
import { refreshTabIfOpen } from './utils/tab-refresh.mjs';

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
  // 加载快捷键配置
  await loadShortcutConfig();
  
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

  // 检查是否有待显示的初次同步 toast
  try {
    const result = await chrome.storage.local.get(['pendingFirstSyncToast']);
    if (result.pendingFirstSyncToast) {
      const toastMessage = result.pendingFirstSyncToast;
      // 清除存储的 toast 消息
      await chrome.storage.local.remove(['pendingFirstSyncToast']);
      // 延迟显示 toast，确保页面已完全加载
      setTimeout(() => {
        showToast(toastMessage);
      }, 500);
    }
  } catch (e) {
    console.error('[PinnedList] Failed to check pending toast:', e);
  }
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
  
  // 窗口失去焦点时延迟关闭，给 pending 的异步操作留出完成时间
  window.addEventListener('blur', () => {
    setTimeout(() => {
      window.close();
    }, 300);
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
    if (message.action === 'SHOW_TOAST') {
      showToast(message.message);
    }
    sendResponse({ success: true });
    return true;
  });
}

// 存储快捷键配置
let shortcutConfig = {
  openPopup: 'Alt+Q',
  openPinnedTabs: 'Alt+E'
};

// 加载快捷键配置
async function loadShortcutConfig() {
  try {
    const commands = await chrome.commands.getAll();
    console.log('[pinned-list] Loaded commands:', commands);
    
    for (const cmd of commands) {
      if (cmd.name === '_execute_action') {
        shortcutConfig.openPopup = cmd.shortcut || 'Ctrl+Shift+A';
      } else if (cmd.name === 'open-pinned-tabs') {
        shortcutConfig.openPinnedTabs = cmd.shortcut || 'Ctrl+Shift+D';
      }
    }
    
    console.log('[pinned-list] Shortcut config:', shortcutConfig);
  } catch (error) {
    console.error('[pinned-list] Failed to load shortcut config:', error);
  }
}

// 解析快捷键字符串，返回 { key, ctrl, shift, alt, meta }
function parseShortcut(shortcut) {
  if (!shortcut) return null;
  
  const parts = shortcut.split('+');
  const key = parts[parts.length - 1].toUpperCase();
  const modifiers = parts.slice(0, -1).map(p => p.toUpperCase());
  
  return {
    key: key,
    ctrl: modifiers.includes('CTRL'),
    shift: modifiers.includes('SHIFT'),
    alt: modifiers.includes('ALT'),
    meta: modifiers.includes('COMMAND') || modifiers.includes('CMD') || modifiers.includes('META')
  };
}

// 检查事件是否匹配快捷键
function matchesShortcut(event, shortcut) {
  const parsed = parseShortcut(shortcut);
  if (!parsed) return false;
  
  const keyMatch = event.key.toUpperCase() === parsed.key;
  const ctrlMatch = event.ctrlKey === parsed.ctrl;
  const shiftMatch = event.shiftKey === parsed.shift;
  const altMatch = event.altKey === parsed.alt;
  const metaMatch = event.metaKey === parsed.meta;
  
  console.log('[pinned-list] Checking shortcut match:', {
    eventKey: event.key.toUpperCase(),
    eventCtrl: event.ctrlKey,
    eventShift: event.shiftKey,
    eventAlt: event.altKey,
    eventMeta: event.metaKey,
    parsed,
    keyMatch,
    ctrlMatch,
    shiftMatch,
    altMatch,
    metaMatch
  });
  
  return keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch;
}

// 处理键盘事件
function handleKeydown(event) {
  console.log('[pinned-list] Keydown event:', event.key, 'ctrlKey:', event.ctrlKey, 'metaKey:', event.metaKey, 'shiftKey:', event.shiftKey, 'altKey:', event.altKey);
  
  // 检查是否匹配打开主弹窗的快捷键
  if (matchesShortcut(event, shortcutConfig.openPopup)) {
    event.preventDefault();
    console.log('[pinned-list] Open popup shortcut detected, sending message to background...');
    // 通知 background 关闭当前窗口并打开主弹窗
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
            // 构造一个模拟的 event 对象，包含 target 元素
            const mockEvent = { target: li };
            switchToTab(li.dataset.tabId ? parseInt(li.dataset.tabId) : undefined, mockEvent);
          }
        }
        break;
      case 'Delete':
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < lis.length) {
          const li = lis[selectedIndex];
          if (li) {
            const tabId = parseInt(li.dataset.tabId);
            const tabUrl = li.dataset.tabUrl || null;
            // 即使 tabId 无效，也可以用 URL 匹配
            closeTabAndRemoveFromPinnedList(isNaN(tabId) ? undefined : tabId, tabUrl);
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
    let usedPinyinFallback = false;
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

      // --- 拼音回退逻辑 ---
      if (pinnedTabs.length === 0 && isPureEnglish(query)) {
        usedPinyinFallback = true;

        // 重新加载完整列表用于拼音搜索
        const allTabs = result.pinnedTabs || [];
        pinnedTabs = allTabs.filter((tab) => {
          const pinyinTitle = toPinyin(tab.title || '');
          return keywords.every(keyword => {
            return searchMatchService.matchSync(keyword, pinyinTitle, '1');
          });
        });

        pinnedTabs.sort((a, b) => {
          const scoreA = calculateMatchScore(toPinyin(a.title), keywords);
          const scoreB = calculateMatchScore(toPinyin(b.title), keywords);
          return scoreB - scoreA;
        });
      }
    }
    
    renderPinnedTabs(pinnedTabs, targetTabId, keywords, searchMatchMode, usedPinyinFallback);
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

// 拼音感知高亮：当拼音回退匹配成功时，反向映射中文字符进行高亮
// @param text - 原始文本（含中文）
// @param keywords - 英文字关键字数组
function highlightPinyinMatches(text, keywords) {
  if (!keywords || keywords.length === 0 || !text) {
    return text;
  }

  // 逐字获取拼音映射
  const charMap = toPinyinPerChar(text);

  // 构建全拼音字符串并记录每个字符的位置范围
  let pinyinStr = '';
  const ranges = []; // [{charIndex, start, end}]
  for (let i = 0; i < charMap.length; i++) {
    const start = pinyinStr.length;
    pinyinStr += charMap[i].pinyin;
    const end = pinyinStr.length;
    ranges.push({ charIndex: i, start, end });
  }

  const lowerPinyinStr = pinyinStr.toLowerCase();
  const matched = new Array(text.length).fill(false);

  // 每个关键字在拼音串中查找，命中区间对应的汉字标记为需高亮
  keywords.forEach(keyword => {
    const lowerKw = keyword.toLowerCase();
    let pos = 0;
    while (pos < lowerPinyinStr.length) {
      const idx = lowerPinyinStr.indexOf(lowerKw, pos);
      if (idx === -1) break;
      const matchEnd = idx + lowerKw.length;
      for (const range of ranges) {
        if (range.start < matchEnd && range.end > idx) {
          matched[range.charIndex] = true;
        }
      }
      pos = idx + 1;
    }
  });

  // 构建高亮 HTML
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
// @param usedPinyinFallback 可选，是否使用了拼音回退（用于切换高亮逻辑）
function renderPinnedTabs(pinnedTabs, targetTabId = null, keywords = [], matchMode = '1', usedPinyinFallback = false) {
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
      // 存储 tabId、url 和 title，便于后续查找（tabId 可能无效，url 和 title 作为备选）
      li.dataset.tabId = tab.tabId !== undefined && tab.tabId !== null ? tab.tabId : '';
      li.dataset.tabUrl = tab.url || '';
      li.dataset.tabTitle = tab.title || '';
      
      // 如果是长期固定的Tab，添加专属底色
      if (tab.isLongTermPinned) {
        li.classList.add('long-term-pinned');
      }
      
      // 标签图标
      const icon = document.createElement('img');
      icon.classList.add('li-icon');
      icon.src = getFaviconURL(tab.url);
      applyFaviconFallback(icon);
      
      const listItemDiv = document.createElement('div');
      listItemDiv.classList.add('li-item');
      
      // 标题和 URL
      const titleDiv = document.createElement('div');
      titleDiv.classList.add('tab-title');
      if (usedPinyinFallback) {
        titleDiv.innerHTML = highlightPinyinMatches(tab.title, keywords);
      } else {
        titleDiv.innerHTML = highlightMatches(tab.title, keywords, matchMode);
      }
      
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
      
      // 展开区域布局：从左到右 [刷新] [长期固定] [取消固定] [关闭]

      // 创建刷新按钮（新增 - 最左边）
      const refreshBtn = document.createElement('button');
      refreshBtn.classList.add('action-btn', 'refresh-btn');
      refreshBtn.innerHTML = '<svg viewBox="0 0 1024 1024" width="14" height="14" fill="currentColor"><path d="M962.074 490.554L647.271 355.638l125.831-89.881c-65.56-69.108-157.968-112.493-260.747-112.493-174.244 0-319.503 123.884-352.634 288.369l-83.949-34.777C123.56 209.825 300.628 63.32 512.355 63.32c132.973 0 252.063 58.09 334.393 149.833l115.326-82.375v359.776z m-710.47 269.773c65.556 69.108 157.973 112.488 260.752 112.488 174.918 0 320.546-124.873 352.931-290.307l83.868 35.874c-47.481 197.458-224.77 344.377-436.799 344.377-132.973 0-252.068-58.086-334.398-149.828l-115.322 82.37V535.525L377.44 670.441l-125.836 89.886z"></path></svg>';
      refreshBtn.title = i18n.getMessage('refreshTab') || '刷新此标签页';
      refreshBtn.addEventListener('click', async function (e) {
        e.stopPropagation();
        const result = await refreshTabIfOpen(tab.tabId, chrome.tabs);
        if (!result.success && !result.skipped) {
          showToast(i18n.getMessage('refreshTabFailed') || '刷新失败');
        }
      });

      // 创建关闭按钮（展开时显示）
      const closeBtn = document.createElement('button');
      closeBtn.classList.add('action-btn', 'close-btn');
      closeBtn.innerHTML = "✕";
      closeBtn.title = i18n.getMessage('closeTab') || '关闭标签页';
closeBtn.addEventListener('click', function (e) {
  e.stopPropagation();
  closeTabAndRemoveFromPinnedList(tab.tabId, tab.url);
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
        removeFromPinnedList(tab.tabId, tab.url);
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
        await handleLongTermPinnedClick(tab.tabId, tab.isLongTermPinned, tab);
      });
      
      // 组装展开区域（从左到右：刷新 → 长期固定 → 取消固定 → 关闭）
      expandActions.appendChild(refreshBtn);
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
      li.addEventListener('click', (e) => {
        switchToTab(tab.tabId, e);
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

// ============== URL 回退匹配工具函数 ==============

/**
 * 生成 URL 回退匹配规则列表
 * @param {string} targetUrl - 目标 URL
 * @returns {Array<{level: number, pattern: string, matchType: string, description: string}>}
 */
function generateUrlFallbackRules(targetUrl) {
  try {
    const urlObj = new URL(targetUrl);
    const rules = [];

    // 级别 1: 完全匹配
    rules.push({
      level: 1,
      pattern: targetUrl,
      matchType: 'exact',
      description: '完全匹配'
    });

    // 级别 2: 去掉 query 和 hash，保留完整路径（仅当 URL 包含 query 或 hash 时）
    const pathOnly = `${urlObj.origin}${urlObj.pathname}`;
    let currentLevel = 2;

    if (pathOnly !== targetUrl) {
      rules.push({
        level: currentLevel++,
        pattern: pathOnly,
        matchType: 'startsWith',
        description: `路径匹配: ${pathOnly}`
      });
    }

    // 级别 3+: 逐级回退路径（从长到短，先匹配更具体的路径）
    const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);

    // 从完整路径开始，逐级向上回退（仅当路径段数 > 1 时才生成中间规则）
    // 例如：/api/v1/users/list → /api/v1/users → /api/v1 → /api
    // 对于单级路径如 /api，不生成中间规则，直接到域名
    if (pathParts.length > 1) {
      for (let i = pathParts.length - 1; i >= 1; i--) {
        const currentPath = urlObj.origin + '/' + pathParts.slice(0, i).join('/');
        rules.push({
          level: currentLevel++,
          pattern: currentPath,
          matchType: 'startsWith',
          description: `父路径匹配: ${currentPath}`
        });
      }
    }

    // 最后一级: 仅域名
    rules.push({
      level: currentLevel,
      pattern: urlObj.origin,
      matchType: 'startsWith',
      description: `域名匹配: ${urlObj.origin}`
    });

    return rules;
  } catch (error) {
    console.error('[URL Fallback] Failed to parse URL:', error);
    return [{ level: 1, pattern: targetUrl, matchType: 'exact', description: '完全匹配' }];
  }
}

/**
 * 对多个候选 tab 进行智能评分和排序
 * @param {Array} tabs - 匹配的 tab 列表
 * @param {Object} storedTab - 存储中的固定 tab（含 url, title）
 * @returns {Array<{tab: Object, score: number}>} 按评分降序排列的候选列表
 */
function rankTabs(tabs, storedTab) {
  if (!tabs || tabs.length === 0) return [];

  return tabs
    .map(tab => ({
      tab,
      score: calculateTabMatchScore(tab, storedTab)
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * 计算单个 tab 的匹配评分（0-100）
 * 评分维度：URL 相似度(40%) + 标题相似度(30%) + 访问新鲜度(20%) + 激活状态(10%)
 * @param {Object} tab - 浏览器 tab 对象
 * @param {Object} storedTab - 存储中的固定 tab
 * @returns {number} 评分 0-100
 */
function calculateTabMatchScore(tab, storedTab) {
  let score = 0;

  // 1. URL 相似度（40%）
  score += calculateUrlSimilarity(tab.url, storedTab?.url || '') * 40;

  // 2. 标题相似度（30%）
  if (storedTab?.title && tab.title) {
    score += calculateTitleSimilarity(tab.title, storedTab.title) * 30;
  }

  // 3. 访问新鲜度（20%）- 100 小时内线性衰减
  if (tab.lastAccessed) {
    const hoursAgo = (Date.now() - tab.lastAccessed) / (1000 * 60 * 60);
    score += Math.max(0, 100 - hoursAgo) / 100 * 20;
  }

  // 4. 激活状态（10%）
  if (tab.active) {
    score += 10;
  }

  return Math.round(score);
}

/**
 * URL 相似度：最长公共前缀长度 / 较长 URL 长度
 * @param {string} urlA
 * @param {string} urlB
 * @returns {number} 0-1 之间的相似度
 */
function calculateUrlSimilarity(urlA, urlB) {
  if (!urlA || !urlB) return 0;
  const maxLen = Math.max(urlA.length, urlB.length);
  if (maxLen === 0) return 0;

  let commonLen = 0;
  for (let i = 0; i < maxLen; i++) {
    if (urlA[i] === urlB[i]) {
      commonLen++;
    } else {
      break;
    }
  }
  return commonLen / maxLen;
}

/**
 * 标题相似度：词集合 Jaccard 相似度
 * @param {string} titleA
 * @param {string} titleB
 * @returns {number} 0-1 之间的相似度
 */
function calculateTitleSimilarity(titleA, titleB) {
  const wordsA = new Set(titleA.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(titleB.toLowerCase().split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 && wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// 保留 selectBestTab 作为向后兼容（取评分最高的）
function selectBestTab(tabs) {
  if (!tabs || tabs.length === 0) return null;

  // 优先选择当前激活的 tab
  const activeTab = tabs.find(t => t.active);
  if (activeTab) return activeTab;

  // 其次选择最近访问的 tab
  const sortedTabs = [...tabs].sort((a, b) => {
    if (a.lastAccessed && b.lastAccessed) {
      return b.lastAccessed - a.lastAccessed;
    }
    return a.id - b.id;
  });

  return sortedTabs[0];
}

/**
 * 判断是否是扩展自身的页面（不应该作为匹配结果）
 * @param {string} url - tab 的 URL
 * @returns {boolean} 是否是扩展页面
 */
function isExtensionPage(url) {
  if (!url) return false;

  // 扩展页面的特征：包含 html/ 目录下的页面
  const extensionPages = [
    'html/pinned-list.html',
    'html/popup.html',
    'html/settings.html',
    'html/about.html',
    'html/help.html',
    'html/help-tour.html'
  ];

  return extensionPages.some(page => url.includes(page));
}

/**
 * 按回退规则查找匹配的 tab
 * @param {string} targetUrl - 目标 URL
 * @param {Array} allTabs - 所有已打开的 tab
 * @returns {{matchedTab: Object|null, matchedTabs: Array, matchLevel: number, matchDescription: string, matchedUrl: string}}
 */
function findTabWithFallback(targetUrl, allTabs) {
  const rules = generateUrlFallbackRules(targetUrl);

  for (const rule of rules) {
    let matchedTabs = [];

    if (rule.matchType === 'exact') {
      matchedTabs = allTabs.filter(t =>
        t.url === rule.pattern &&
        !isExtensionPage(t.url)  // 排除扩展页面
      );
    } else if (rule.matchType === 'startsWith') {
      // 确保是完整的路径段匹配，避免 /api 匹配到 /api-v2
      // 包含 /、?、# 三种边界情况
      matchedTabs = allTabs.filter(t =>
        !isExtensionPage(t.url) &&  // 排除扩展页面
        (t.url === rule.pattern ||
         t.url.startsWith(rule.pattern + '/') ||
         t.url.startsWith(rule.pattern + '?') ||
         t.url.startsWith(rule.pattern + '#'))
      );
    }

    if (matchedTabs.length > 0) {
      // 选择优先级最高的 tab 作为默认（向后兼容）
      const bestMatch = selectBestTab(matchedTabs);
      return {
        matchedTab: bestMatch,
        matchedTabs: matchedTabs,  // 返回所有匹配的 tab
        matchLevel: rule.level,
        matchDescription: rule.description,
        matchedUrl: bestMatch.url
      };
    }
  }

  return { matchedTab: null, matchedTabs: [], matchLevel: 0, matchDescription: null, matchedUrl: null };
}

/**
 * 生成匹配规则信息的国际化描述
 * @param {number} matchLevel - 匹配级别
 * @param {string} matchPattern - 匹配模式（URL）
 * @returns {string} 国际化后的匹配规则描述
 */
function getMatchRuleDescription(matchLevel, matchPattern) {
  const ruleKey = {
    1: 'matchLevelExact',      // 完全匹配
    2: 'matchLevelPath',       // 路径匹配
    3: 'matchLevelParentPath', // 父路径匹配
    4: 'matchLevelDomain'      // 域名匹配
  }[matchLevel] || 'matchLevelExact';

  const ruleText = i18n.getMessage(ruleKey) || '完全匹配';
  const matchRuleLabel = i18n.getMessage('matchRule') || '匹配规则：';

  return `${matchRuleLabel}${ruleText} (${matchPattern})`;
}

/**
 * 显示 URL 匹配确认弹窗
 * 支持单候选（原有行为）和多候选列表展示
 * @param {Object} options - 配置选项
 * @param {string} options.targetUrl - 目标 URL（pinned-list 中固定的）
 * @param {string} options.targetTitle - 目标标题（pinned-list 中固定的）
 * @param {string} options.matchedUrl - 匹配到的 URL（单候选时使用）
 * @param {string} options.matchedTitle - 匹配到的标题（单候选时使用）
 * @param {number} options.matchLevel - 匹配级别
 * @param {string} options.matchPattern - 匹配模式
 * @param {Array<{tab: Object, score: number}>} options.candidates - 候选列表（多候选时使用）
 * @returns {Promise<{action: string, selectedTab: Object|null}>} 用户选择和选中的 tab
 */
function showUrlMatchConfirmDialog({ targetUrl, targetTitle, matchedUrl, matchedTitle, matchLevel, matchPattern, candidates }) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('url-match-confirm-dialog');
    const dialogTitleEl = document.getElementById('confirm-dialog-title');
    const targetTitleEl = document.getElementById('confirm-target-title');
    const targetUrlEl = document.getElementById('confirm-target-url');
    const matchedLabelEl = document.getElementById('confirm-matched-label');
    const singleMatchEl = document.getElementById('confirm-single-match');
    const matchedTitleEl = document.getElementById('confirm-matched-title');
    const matchedUrlEl = document.getElementById('confirm-matched-url');
    const candidatesListEl = document.getElementById('confirm-candidates-list');
    const matchInfoEl = document.getElementById('confirm-match-info');

    const switchUpdateBtn = document.getElementById('confirm-switch-update-btn');
    const switchOnlyBtn = document.getElementById('confirm-switch-only-btn');
    const openNewBtn = document.getElementById('confirm-open-new-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    const overlay = dialog.querySelector('.confirm-dialog-overlay');

    // 判断是否多候选模式
    const isMultiCandidate = candidates && candidates.length > 1;

    // 按钮数组，方便键盘导航（顺序与 HTML 中一致）
    const buttons = [switchOnlyBtn, switchUpdateBtn, openNewBtn, cancelBtn];
    let currentButtonIndex = 0;

    // 多候选模式下当前选中的候选索引
    let selectedCandidateIndex = 0;

    // 获取当前选中的 tab
    const getSelectedTab = () => {
      if (isMultiCandidate && candidates[selectedCandidateIndex]) {
        return candidates[selectedCandidateIndex].tab;
      }
      return null;
    };

    // 填充固定页面信息
    targetTitleEl.textContent = targetTitle || i18n.getMessage('untitled') || '(无标题)';
    targetUrlEl.textContent = targetUrl;
    matchInfoEl.textContent = getMatchRuleDescription(matchLevel, matchPattern);

    if (isMultiCandidate) {
      // 多候选模式：显示列表
      dialogTitleEl.textContent = (i18n.getMessage('multipleMatchesTitle') || '找到 {count} 个相似页面')
        .replace('{count}', candidates.length);
      matchedLabelEl.textContent = i18n.getMessage('selectCandidate') || '相似页面（点击选择）：';
      singleMatchEl.style.display = 'none';
      candidatesListEl.style.display = 'flex';

      // 清空并重建候选列表
      candidatesListEl.innerHTML = '';
      candidates.forEach((candidate, index) => {
        const item = document.createElement('div');
        item.className = 'confirm-candidate-item' + (index === 0 ? ' selected' : '');
        item.dataset.index = index;
        item.setAttribute('role', 'radio');
        item.setAttribute('aria-checked', index === 0 ? 'true' : 'false');
        item.setAttribute('tabindex', '0');

        const radio = document.createElement('div');
        radio.className = 'confirm-candidate-radio';

        const info = document.createElement('div');
        info.className = 'confirm-candidate-info';

        const title = document.createElement('div');
        title.className = 'confirm-candidate-title';
        title.textContent = candidate.tab.title || i18n.getMessage('untitled') || '(无标题)';
        title.title = candidate.tab.title || '';

        const url = document.createElement('div');
        url.className = 'confirm-candidate-url';
        url.textContent = candidate.tab.url;
        url.title = candidate.tab.url;

        info.appendChild(title);
        info.appendChild(url);

        const score = document.createElement('div');
        score.className = 'confirm-candidate-score';
        score.textContent = candidate.score + '%';

        item.appendChild(radio);
        item.appendChild(info);
        item.appendChild(score);

        // 点击选择
        item.addEventListener('click', () => {
          selectCandidate(index);
        });

        candidatesListEl.appendChild(item);
      });

      // 选中候选项
      const selectCandidate = (index) => {
        selectedCandidateIndex = index;
        const items = candidatesListEl.querySelectorAll('.confirm-candidate-item');
        items.forEach((item, i) => {
          const isSelected = i === index;
          item.classList.toggle('selected', isSelected);
          item.setAttribute('aria-checked', isSelected ? 'true' : 'false');
        });
      };
    } else {
      // 单候选模式：原有行为
      dialogTitleEl.textContent = i18n.getMessage('urlMatchTitle') || '找到相似页面';
      matchedLabelEl.textContent = i18n.getMessage('matchedPage') || '已打开的相似页面：';
      singleMatchEl.style.display = 'block';
      candidatesListEl.style.display = 'none';
      matchedTitleEl.textContent = matchedTitle || i18n.getMessage('untitled') || '(无标题)';
      matchedUrlEl.textContent = matchedUrl;
    }

    // 清理之前的事件监听器
    const cleanup = () => {
      dialog.style.display = 'none';
      switchUpdateBtn.onclick = null;
      switchOnlyBtn.onclick = null;
      openNewBtn.onclick = null;
      cancelBtn.onclick = null;
      overlay.onclick = null;
      document.removeEventListener('keydown', handleKeydown);
      // 清空候选列表，避免残留 DOM 和事件监听器
      candidatesListEl.innerHTML = '';
    };

    // 更新按钮焦点
    const updateButtonFocus = () => {
      buttons.forEach((btn, index) => {
        if (index === currentButtonIndex) {
          btn.focus();
        }
      });
    };

    // 处理键盘事件
    const handleKeydown = (e) => {
      // 阻止事件冒泡，避免影响 pinned-list 的键盘事件处理
      e.stopPropagation();

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          cleanup();
          resolve({ action: 'cancel', selectedTab: null });
          break;

        case 'ArrowUp':
          e.preventDefault();
          currentButtonIndex = (currentButtonIndex - 1 + buttons.length) % buttons.length;
          updateButtonFocus();
          break;

        case 'ArrowDown':
          e.preventDefault();
          currentButtonIndex = (currentButtonIndex + 1) % buttons.length;
          updateButtonFocus();
          break;

        case 'Enter':
        case ' ':  // 空格键
          e.preventDefault();
          // 触发当前焦点按钮的点击事件
          buttons[currentButtonIndex].click();
          break;
      }
    };

    // 绑定按钮事件
    switchUpdateBtn.onclick = () => {
      cleanup();
      resolve({ action: 'updateAndJump', selectedTab: getSelectedTab() });
    };

    switchOnlyBtn.onclick = () => {
      cleanup();
      resolve({ action: 'jumpOnly', selectedTab: getSelectedTab() });
    };

    openNewBtn.onclick = () => {
      cleanup();
      resolve({ action: 'openNew', selectedTab: null });
    };

    cancelBtn.onclick = () => {
      cleanup();
      resolve({ action: 'cancel', selectedTab: null });
    };

    // 点击 overlay 关闭弹窗
    overlay.onclick = () => {
      cleanup();
      resolve({ action: 'cancel', selectedTab: null });
    };

    // 添加键盘监听
    document.addEventListener('keydown', handleKeydown);

    // 显示弹窗
    dialog.style.display = 'flex';

    // 聚焦到第一个按钮
    updateButtonFocus();
  });
}

// 切换到标签页
// @param tabOrId - tab对象或tabId（tab对象可能包含url信息）
// @param event - 点击事件（可选）
async function switchToTab(tabOrId, event) {
  try {
    // 优先从 tabOrId 中获取 URL（如果它是对象）
    let targetUrl = null;
    let targetTab = null;  // 保存固定的 tab 信息
    let tabId = null;

    if (tabOrId && typeof tabOrId === 'object') {
      // 传入的是 tab 对象
      targetUrl = tabOrId.url;
      targetTab = tabOrId;  // 保存完整的 tab 对象
      tabId = tabOrId.tabId;
    } else {
      // 传入的是 tabId
      tabId = tabOrId;
    }
    
    // 检查 tabId 有效性
    const isTabIdValid = tabId !== undefined && tabId !== null && !isNaN(tabId);
    
    if (isTabIdValid) {
      // 先尝试通过tabId直接获取标签页
      let tab;
      try {
        tab = await chrome.tabs.get(tabId);
      } catch (e) {
        // tab不存在，后续处理
      }
      
      // 如果标签页存在，检查 URL 是否完全匹配
      if (tab) {
        const result = await chrome.storage.local.get('pinnedTabs');
        const pinnedTabs = result.pinnedTabs || [];
        const storedTab = pinnedTabs.find(t => t.tabId === tabId);

        if (storedTab && storedTab.url && storedTab.url !== tab.url) {
          // URL 不匹配，用存储中的 URL 作为目标
          targetUrl = storedTab.url;
          targetTab = storedTab;  // 也要设置 targetTab，确保标题能正确显示
        } else {
          // URL 完全匹配，委托 background 执行切换并关闭窗口
          await delegateToBackground({
            operation: 'switchDirect',
            tabId: tabId,
            windowId: tab.windowId
          });
          return;
        }
      } else {
        // tab 不存在，需要通过 URL 查找
        targetUrl = null;
      }
    }
    
    // 如果还没有 targetUrl，从点击事件或存储中获取
    if (!targetUrl && event?.target) {
      const clickedLi = event.target.closest('li');
      if (clickedLi) {
        targetUrl = clickedLi.dataset.tabUrl || clickedLi.querySelector('.tab-url-hostname')?.title;
        // 从 dataset 中获取 title
        if (clickedLi.dataset.tabTitle) {
          targetTab = { url: targetUrl, title: clickedLi.dataset.tabTitle };
        }
      }
    }

    // 如果还没有，从存储中查找
    if (!targetUrl) {
      const result = await chrome.storage.local.get('pinnedTabs');
      const pinnedTabs = result.pinnedTabs || [];
      const tab = pinnedTabs.find(t => t.tabId === tabId);
      if (tab) {
        targetUrl = tab.url;
        targetTab = tab;  // 保存完整的 tab 对象
      }
    }
    
    if (!targetUrl) {
      return;
    }
    
    // 用 targetUrl 查找浏览器中已打开的标签页
    const allTabs = await chrome.tabs.query({});

    // 特殊处理：chrome://extensions/ 系列页面，复用已存在的同类页面
    if (targetUrl.startsWith('chrome://extensions')) {
      const extensionsTabs = allTabs.filter(t => t.url.startsWith('chrome://extensions'));
      if (extensionsTabs.length > 0) {
        // 委托 background 执行操作并关闭窗口
        const existingTab = extensionsTabs[0];
        await delegateToBackground({
          operation: 'extensionsSpecial',
          existingTabId: existingTab.id,
          targetUrl: targetUrl
        });
        return;
      }
    }

    // 使用回退匹配机制查找 tab
    const { matchedTab, matchedTabs, matchLevel, matchDescription, matchedUrl } =
      findTabWithFallback(targetUrl, allTabs);

    if (matchedTab) {
      if (matchLevel === 1) {
        // 完全匹配，直接切换（无需确认）
        // 委托 background 执行操作并关闭窗口
        await delegateToBackground({
          operation: 'switchDirect',
          tabId: matchedTab.id,
          windowId: matchedTab.windowId,
          targetUrl: targetUrl
        });
        return;
      } else {
        // 回退匹配，对候选进行智能评分
        const ranked = rankTabs(matchedTabs, targetTab);

        // 高置信度自动跳转：第一名评分领先第二名 ≥ 20 分时，直接跳转
        if (ranked.length >= 2 && ranked[0].score - ranked[1].score >= 20) {
          const bestTab = ranked[0].tab;
          await delegateToBackground({
            operation: 'switchAndUpdate',
            tabId: bestTab.id,
            windowId: bestTab.windowId,
            targetUrl: targetUrl,
            matchedUrl: bestTab.url,
            matchedTitle: bestTab.title || ''
          });
          return;
        }

        // 获取匹配规则中的 pattern（用于显示）
        const rules = generateUrlFallbackRules(targetUrl);
        const matchedRule = rules.find(r => r.level === matchLevel);
        const matchPattern = matchedRule ? matchedRule.pattern : targetUrl;

        // 弹窗确认（传入候选列表）
        const { action, selectedTab } = await showUrlMatchConfirmDialog({
          targetUrl,
          targetTitle: targetTab?.title || '',
          matchedUrl,
          matchedTitle: matchedTab.title || '',
          matchLevel,
          matchPattern,
          candidates: ranked
        });

        // 确定最终操作的 tab：多候选时用用户选中的，单候选时用默认匹配的
        const actionTab = selectedTab || matchedTab;

        switch (action) {
          case 'updateAndJump':
            // 选项 1：切换并更新
            // 委托 background 执行 tab 操作、storage 更新和服务器同步，并关闭窗口
            await delegateToBackground({
              operation: 'switchAndUpdate',
              tabId: actionTab.id,
              windowId: actionTab.windowId,
              targetUrl: targetUrl,
              matchedUrl: actionTab.url,
              matchedTitle: actionTab.title || ''
            });
            return;

          case 'jumpOnly':
            // 选项 2：仅切换（不更新）
            // 委托 background 执行操作并关闭窗口
            await delegateToBackground({
              operation: 'switchOnly',
              tabId: actionTab.id,
              windowId: actionTab.windowId
            });
            return;

          case 'openNew':
            // 选项 3：新页面打开
            // 委托 background 执行操作并关闭窗口
            await delegateToBackground({
              operation: 'openNew',
              targetUrl: targetUrl
            });
            return;

          case 'cancel':
          default:
            // 选项 4：取消
            // 只关闭确认弹窗，保留在 pinned-list 窗口内
            // 不调用 window.close()，直接 return
            return;
        }
      }
    } else {
      // 没找到，委托 background 创建新标签页并关闭窗口
      await delegateToBackground({
        operation: 'noMatch',
        targetUrl: targetUrl
      });
      return;
    }
  } catch (error) {
    console.error('Switch to tab error:', error);
  }
}

/**
 * 委托操作给 background.js 执行，然后关闭当前窗口
 * 避免 blur 事件与 tab 操作的竞态条件
 *
 * 修复方案：先发送消息，确认成功后再关闭窗口
 * - 确保消息成功送达 background.js
 * - 失败时不关闭窗口，让用户能看到错误提示
 * - 检查 background 返回的响应，利用错误信息
 *
 * @param {Object} data - 操作数据，包含 operation 类型和参数
 * @returns {Promise<void>}
 */
async function delegateToBackground(data) {
  console.log('[pinned-list] Delegating to background:', data.operation);

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'pinnedListTabAction',
      data: data
    });

    if (response && response.success) {
      console.log('[pinned-list] Background operation completed successfully');
    } else {
      console.error('[pinned-list] Background operation failed:', response?.error);
      showToast('操作失败，请重试');
      return;  // 失败时不关闭窗口，让用户看到错误提示
    }
  } catch (err) {
    console.error('[pinned-list] Failed to send message to background:', err);
    showToast('操作失败，请重试');
    return;  // 失败时不关闭窗口
  }

  // 成功后再关闭窗口
  window.close();
}

// 从固定列表中移除（不关闭标签页）
// @param tabId - 标签页ID（可能无效）
// @param tabUrl - 标签页URL（作为备选标识）
async function removeFromPinnedList(tabId, tabUrl = null) {
  try {
    // 读取最新数据后立即修改并写回，最小化竞态窗口
    const result = await chrome.storage.local.get('pinnedTabs');
    let pinnedTabs = result.pinnedTabs || [];
    
    // 优先使用 URL 匹配（服务器同步的tab没有有效tabId）
    const targetTab = pinnedTabs.find(t => 
      (tabUrl && t.url === tabUrl) || (tabId !== undefined && tabId !== null && t.tabId === tabId)
    );
    
    // 检查是否是长期固定的tab，如果是则不执行移除
    if (targetTab && targetTab.isLongTermPinned) {
      console.log('[removeFromPinnedList] Cannot remove long-term pinned tab:', tabId, tabUrl);
      return;
    }
    
    // 找到要移除的标签页的索引
    const removedIndex = pinnedTabs.findIndex(tab => 
      (tabUrl && tab.url === tabUrl) || (tabId !== undefined && tabId !== null && tab.tabId === tabId)
    );
    
    // 过滤掉要移除的标签页
    pinnedTabs = pinnedTabs.filter(tab => 
      !((tabUrl && tab.url === tabUrl) || (tabId !== undefined && tabId !== null && tab.tabId === tabId))
    );
    
    // 保存到存储
    await chrome.storage.local.set({ pinnedTabs });
    
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
// @param tabId - 标签页ID（可能无效或与当前浏览器tab不一致）
// @param tabUrl - 标签页URL（用于查找实际的浏览器tab）
async function closeTabAndRemoveFromPinnedList(tabId, tabUrl = null) {
  try {
    const result = await chrome.storage.local.get('pinnedTabs');
    const pinnedTabs = result.pinnedTabs || [];
    // 优先使用 URL 匹配（服务器同步的tab没有有效tabId），其次用 tabId 匹配
    const targetTab = pinnedTabs.find(t => 
      (tabUrl && t.url === tabUrl) || (tabId !== undefined && tabId !== null && t.tabId === tabId)
    );
    const isLongTermPinned = targetTab && targetTab.isLongTermPinned;
    
    // 尝试关闭浏览器标签页
    let browserTabClosed = false;
    
    // 首先尝试用 tabId 关闭
    if (tabId !== undefined && tabId !== null && tabId !== '') {
      try {
        await chrome.tabs.get(tabId);
        await chrome.tabs.remove(tabId);
        browserTabClosed = true;
      } catch (tabError) {
        console.log('[closeTabAndRemoveFromPinnedList] Tab ID not valid:', tabId);
      }
    }
    
    // 如果 tabId 无效，尝试用 URL 查找并关闭
    if (!browserTabClosed && tabUrl) {
      try {
        const allTabs = await chrome.tabs.query({});
        const matchingTabs = allTabs.filter(t => t.url === tabUrl);
        if (matchingTabs.length > 0) {
          await chrome.tabs.remove(matchingTabs[0].id);
          browserTabClosed = true;
          console.log('[closeTabAndRemoveFromPinnedList] Closed tab by URL match:', tabUrl);
        }
      } catch (tabError) {
        console.log('[closeTabAndRemoveFromPinnedList] Failed to close tab by URL:', tabUrl, tabError);
      }
    }
    
    // 根据是否是长期固定tab决定是否从列表中移除
    if (isLongTermPinned) {
      // 长期固定的tab：关闭了浏览器tab，但仍保留在列表中
      showToast('长期固定的Tab已关闭，但仍保留在列表中');
      await loadPinnedTabs();
    } else {
      // 普通tab：从列表中移除（传入 tabUrl 用于匹配）
      await removeFromPinnedList(tabId, tabUrl);
    }
  } catch (error) {
    console.error('Error closing tab and removing from pinned list:', error);
  }
}

// 获取网站图标
function getFaviconURL(url) {
  try {
    return buildFaviconURL(url);
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
async function handleLongTermPinnedClick(tabId, isCurrentlyLongTermPinned, tab) {
  try {
    // 检查是否已完成邮箱验证或OAuth登录
    const isEmailVerified = await authService.isEmailVerified();
    
    console.log('[pinned-list] isEmailVerified:', isEmailVerified);
    console.log('[pinned-list] userInfo:', await authService.getUserInfo());
    
    if (!isEmailVerified) {
      // 静默注册用户：不允许使用长期固定功能
      showToast(i18n.getMessage('longTermPinnedRequireVerification') || `长期固定功能需要完成邮箱验证后才能使用哦！`);
      return;
    }
    
    // 获取当前标签页信息
    const result = await chrome.storage.local.get('pinnedTabs');
    const pinnedTabs = result.pinnedTabs || [];
    // 优先使用 URL 匹配（服务器同步的tab没有有效tabId，tabId可能为undefined）
    const currentTab = pinnedTabs.find(t => (tab && t.url === tab.url) || (tabId !== undefined && t.tabId === tabId));
    
    // 已完成邮箱验证的用户：根据体验期/VIP状态决定
    // 乐观模式：优先使用本地缓存，服务器异常时不影响用户操作
    
    let localTrialStatus = null;
    let trialStatusError = null;
    try {
      // 使用 getTrialStatus 获取本地缓存状态
      localTrialStatus = await trialService.getTrialStatus();
    } catch (e) {
      console.info('[pinned-list] Failed to get local trial status:', e);
      trialStatusError = e;
    }
    
    // 如果本地状态显示在体验期内，允许操作（限制100个）
    if (localTrialStatus && localTrialStatus.isInTrialPeriod) {
      console.log('[pinned-list] User in trial period, checking limit');
      const limit = await featureLimitService.getFeatureLimit('longTermPinned', false, true);
      const longTermCount = pinnedTabs.filter(t => t.isLongTermPinned).length;
      
      if (!isCurrentlyLongTermPinned && limit !== -1 && longTermCount >= limit) {
        showToast(i18n.getMessage('pinnedTabsLimit', limit.toString()) || `长期固定标签页数量已达上限（最多${limit}个）`);
        return;
      }
      
      if (isCurrentlyLongTermPinned) {
        await cancelLongTermPinned(tabId, currentTab);
      } else {
        await setLongTermPinned(tabId, currentTab);
      }
      // 后台异步刷新状态
      trialService.fetchTrialStatus().catch(err => console.info('[pinned-list] Failed to fetch trial status:', err));
      return;
    }
    
    // 获取VIP状态（使用本地缓存，不强制刷新）
    let vipStatus = null;
    let vipStatusError = null;
    try {
      vipStatus = await vipService.getVipStatus(false);
    } catch (e) {
      console.info('[pinned-list] Failed to get VIP status:', e);
      vipStatusError = e;
    }
    
    // VIP用户可以正常使用（限制100个）
    if (vipStatus && vipStatus.isVip) {
      const limit = await featureLimitService.getFeatureLimit('longTermPinned', false, true);
      const longTermCount = pinnedTabs.filter(t => t.isLongTermPinned).length;
      
      if (!isCurrentlyLongTermPinned && limit !== -1 && longTermCount >= limit) {
        showToast(i18n.getMessage('pinnedTabsLimit', limit.toString()) || `长期固定标签页数量已达上限（最多${limit}个）`);
        return;
      }
      
      if (isCurrentlyLongTermPinned) {
        await cancelLongTermPinned(tabId, currentTab);
      } else {
        await setLongTermPinned(tabId, currentTab);
      }
      return;
    }
    
    // 如果获取状态时出错（服务器异常），使用乐观模式允许操作
    // 因为用户已完成邮箱验证，应该有基本的使用权限
    if (trialStatusError || vipStatusError) {
      console.log('[pinned-list] Server error detected, using optimistic mode');
      // 检查长期固定数量，使用前端限制作为fallback（100个）
      const limit = await featureLimitService.getFeatureLimit('longTermPinned', false, true);
      const longTermCount = pinnedTabs.filter(t => t.isLongTermPinned).length;
      
      if (!isCurrentlyLongTermPinned && limit !== -1 && longTermCount >= limit) {
        showToast(i18n.getMessage('pinnedTabsLimit', limit.toString()) || `长期固定标签页数量已达上限（最多${limit}个）`);
        return;
      }
      
      if (isCurrentlyLongTermPinned) {
        await cancelLongTermPinned(tabId, currentTab);
      } else {
        await setLongTermPinned(tabId, currentTab);
      }
      return;
    }
    
    // 体验期结束且非VIP的普通用户：限制5个长期固定（引导购买VIP）
    const limit = await featureLimitService.getFeatureLimit('longTermPinned', false, true);
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
      await cancelLongTermPinned(tabId, currentTab);
    } else {
      await setLongTermPinned(tabId, currentTab);
    }
  } catch (error) {
    console.error('Long term pinned error:', error);
    showToast(i18n.getMessage('longTermPinnedFailed'));
  }
}

// 设置长期固定Tab
async function setLongTermPinned(tabId, tab) {
  try {
    // 先执行同步操作，再读取storage，最小化竞态窗口
    const timestamp = new Date().toISOString();
    
    // 读取最新数据后立即修改并写回
    const result = await chrome.storage.local.get('pinnedTabs');
    const tabs = result.pinnedTabs || [];
    
    const updatedTabs = tabs.map(t => {
      // 优先使用 URL 匹配（服务器同步的tab没有有效tabId，tabId可能为undefined）
      // tabId 仅在有效时才用于匹配，避免 undefined === undefined 误匹配所有 tab
      if ((tab && t.url === tab.url) || (tabId !== undefined && t.tabId === tabId)) {
        return {
          ...t,
          isLongTermPinned: true,
          longTermPinnedAt: timestamp
        };
      }
      return t;
    });
    
    await chrome.storage.local.set({ pinnedTabs: updatedTabs });
    
    // 异步同步到服务器（携带 tabId 用于队列去重，url 用于实际标识）
    const syncUrl = (tab && tab.url) || updatedTabs.find(t => (tabId !== undefined && t.tabId === tabId))?.url;
    if (syncUrl) {
      syncQueueService.addOperation('updateTab', {
        tabId: tabId || 'url:' + syncUrl,
        url: syncUrl,
        isLongTermPinned: true,
        longTermPinnedAt: timestamp
      }).catch(err => console.info('Sync updateTab failed:', err));
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
async function cancelLongTermPinned(tabId, tab) {
  try {
    // 读取最新数据后立即修改并写回，最小化竞态窗口
    const result = await chrome.storage.local.get('pinnedTabs');
    const tabs = result.pinnedTabs || [];
    
    const updatedTabs = tabs.map(t => {
      // 优先使用 URL 匹配（服务器同步的tab没有有效tabId，tabId可能为undefined）
      // tabId 仅在有效时才用于匹配，避免 undefined === undefined 误匹配所有 tab
      if ((tab && t.url === tab.url) || (tabId !== undefined && t.tabId === tabId)) {
        return {
          ...t,
          isLongTermPinned: false,
          longTermPinnedAt: null
        };
      }
      return t;
    });
    
    await chrome.storage.local.set({ pinnedTabs: updatedTabs });
    
    // 异步同步到服务器（携带 tabId 用于队列去重，url 用于实际标识）
    const syncUrl = (tab && tab.url) || updatedTabs.find(t => (tabId !== undefined && t.tabId === tabId))?.url;
    if (syncUrl) {
      syncQueueService.addOperation('updateTab', {
        tabId: tabId || 'url:' + syncUrl,
        url: syncUrl,
        isLongTermPinned: false,
        longTermPinnedAt: null
      }).catch(err => console.info('Sync updateTab failed:', err));
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
