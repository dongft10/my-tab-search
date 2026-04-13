// Import i18n manager
import i18n from './i18n.js';
// Import config for environment detection
import { ENV_TYPE } from './config.js';
// Import feature limit service
import featureLimitService from './services/feature-limit.service.js';
// Import sync queue service
import syncQueueService from './services/sync-queue.service.js';
// Import auth service (ESM version for popup)
import authService from './services/auth.service.js';
// Import auth API (ESM version for popup)
import authApi from './api/auth.js';
// Import trial service
import trialService from './services/trial.service.js';
// Import search match service
import searchMatchService from './services/search-match.service.js';

// 检查并上报设备活跃状态
async function checkAndReportActive() {
  const today = new Date().toISOString().split('T')[0];
  const result = await chrome.storage.local.get(['deviceActiveReported', 'deviceId']);
  const lastReported = result.deviceActiveReported;

  if (lastReported !== today && result.deviceId) {
    // 先保存缓存（不管上报是否成功），避免重复无效请求
    await chrome.storage.local.set({ deviceActiveReported: today });
    
    // 再尝试上报（失败静默处理，不影响用户体验）
    try {
      await authApi.reportDeviceActive(result.deviceId);
      console.log('[Device] Active status reported for today');
    } catch (error) {
      // 上报失败不影响用户体验，使用 warn 而非 error
      console.info('[Device] Failed to report active status:', error.message);
    }
  }
}

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

document.addEventListener("DOMContentLoaded", async () => {

  // 显示环境标识（仅 dev/qa 环境显示）
  const envBadge = document.getElementById('env-badge');
  if (envBadge && ENV_TYPE !== 'prod') {
    envBadge.style.display = 'block';
    envBadge.textContent = ENV_TYPE.toUpperCase();
    envBadge.classList.add(`env-${ENV_TYPE}`);
  }

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
    console.error('[Popup] Failed to check pending toast:', e);
  }

  // 监听 OAuth 登录成功消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'AUTH_SUCCESS') {
      console.log('[Popup] OAuth login success, refreshing page...');
      // 重新加载页面以更新 Token
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
    if (message.action === 'SHOW_TOAST') {
      showToast(message.message);
    }
    sendResponse({ success: true });
    return true;
  });

  const searchInput = document.getElementById("search-input");
  const tabList = document.getElementById("tab-list");
  let tabCount = document.getElementById("tab-count");

  // 当前选中的tab item
  let selectedIndex = -1;
  // 标签列表
  let lis = tabList.childNodes;
  // 标签Id与列表索引id的对应关系
  let tabIdMap = new Map();

  // 子序列匹配函数：检查 keyword 是否是 text 的子序列
  // 例如："spb" 是 "spring boot" 的子序列
  function subsequenceMatch(keyword, text) {
    if (keyword.length === 0) return true;
    if (text.length === 0) return false;

    let keywordIndex = 0;

    for (let i = 0; i < text.length && keywordIndex < keyword.length; i++) {
      if (text[i] === keyword[keywordIndex]) {
        keywordIndex++;
      }
    }

    return keywordIndex === keyword.length;
  }

  // 高亮匹配的字符 - 根据模式高亮
  // @param text - 要高亮的文本
  // @param keywords - 关键字数组
  // @param matchMode - 搜索匹配模式 (1: 完整关键字匹配, 2: 子序列匹配)
  function highlightMatches(text, keywords, matchMode = '1') {
    if (!keywords || keywords.length === 0) {
      return text;
    }

    // 创建一个标记数组，记录每个字符是否被匹配
    const matched = new Array(text.length).fill(false);
    const lowerText = text.toLowerCase();

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
          const char = keyword[k];
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

  // 计算匹配度分数
  // 考虑因素：完整单词匹配、连续字符匹配、匹配数量、匹配位置
  function calculateMatchScore(text, keywords) {
    if (!keywords || keywords.length === 0) {
      return 0;
    }

    const lowerText = text.toLowerCase();
    let totalScore = 0;

    keywords.forEach(keyword => {
      let keywordScore = 0;

      // 1. 检查完整单词匹配（最高优先级）
      const wordRegex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (wordRegex.test(lowerText)) {
        keywordScore += 1000;
      }

      // 2. 检查连续字符串匹配
      const exactMatchIndex = lowerText.indexOf(keyword);
      if (exactMatchIndex !== -1) {
        keywordScore += 500;
        // 开头位置匹配加分
        if (exactMatchIndex === 0) {
          keywordScore += 200;
        }
      }

      // 3. 计算子序列匹配的连续性
      let maxConsecutive = 0;
      let currentConsecutive = 0;
      let matchedCount = 0;
      let keywordIndex = 0;

      for (let i = 0; i < lowerText.length && keywordIndex < keyword.length; i++) {
        if (lowerText[i] === keyword[keywordIndex]) {
          currentConsecutive++;
          matchedCount++;
          if (currentConsecutive > maxConsecutive) {
            maxConsecutive = currentConsecutive;
          }
          keywordIndex++;
        } else {
          currentConsecutive = 0;
        }
      }

      // 4. 根据匹配的连续性给分
      keywordScore += maxConsecutive * 50;

      // 5. 根据匹配到的字符数量给分
      keywordScore += matchedCount * 10;

      // 6. 根据关键字长度给分（越长的关键字匹配越重要）
      keywordScore += keyword.length * 5;

      totalScore += keywordScore;
    });

    return totalScore;
  }

  // 焦点默认定位到搜索输入框
  searchInput.focus();

  // Function to update the displayed tabs based on search input
  // @param nextSelectedTabId 可选，指定下一个选中的索引
  // @param targetTabId 可选，指定要滚动到的标签页ID
  // @param relativeOffset 可选，指定目标标签页相对于视口顶部的偏移量
  async function updateTabs(nextSelectedTabId, targetTabId = null, relativeOffset = null) {
    const query = searchInput.value.trim().toLowerCase();

    // 检查并上报活跃状态（只在有搜索词时）
    if (query.length > 0) {
      checkAndReportActive();
    }

    // 预先获取 pinnedTabs（只需要 1 次 I/O），构建 Map 用于快速查找
    const pinnedResult = await new Promise((resolve) => {
      chrome.storage.local.get('pinnedTabs', resolve);
    });
    const pinnedTabs = pinnedResult.pinnedTabs || [];
    const pinnedMap = new Map();
    pinnedTabs.forEach(t => {
      pinnedMap.set(t.tabId, t);
      pinnedMap.set(t.url, t);
    });

    // URL 解析缓存
    const urlCache = new Map();
    function getCachedHostname(url) {
      if (urlCache.has(url)) return urlCache.get(url);
      const hostname = new URL(url).hostname;
      urlCache.set(url, hostname);
      return hostname;
    }

    // 使用 Promise 包装 chrome.tabs.query
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({}, resolve);
    });
    
    // 获取当前搜索匹配模式
    const searchMatchMode = await searchMatchService.getSearchMatchMode();
    
    let filteredTabs;

    // 按空格分割查询字符串，得到多个关键字
    const keywords = query.split(/\s+/).filter(kw => kw.length > 0);

    if (!query || keywords.length === 0) {
      // 如果查询为空或没有有效关键字，则返回所有标签页
      filteredTabs = tabs;
    } else {
      // 根据当前搜索匹配模式过滤标签页
      filteredTabs = tabs.filter((tab) => {
        const lowerTitle = tab.title.toLowerCase();
        
        // 多关键字时，所有关键字都必须满足匹配条件（AND逻辑）
        return keywords.every(keyword => {
          return searchMatchService.matchSync(keyword, lowerTitle, searchMatchMode);
        });
      });

      // 根据匹配度对过滤后的标签页进行排序（匹配度高的排在前面）
      filteredTabs.sort((a, b) => {
        const scoreA = calculateMatchScore(a.title, keywords);
        const scoreB = calculateMatchScore(b.title, keywords);
        return scoreB - scoreA;
      });
    }

    tabList.innerHTML = "";
    tabIdMap.clear();

    // 使用 DocumentFragment 批量添加，减少回流
    const fragment = document.createDocumentFragment();

    // populate the tab list with the filtered tabs
    for (let i = 0; i < filteredTabs.length; i++) {
      const tab = filteredTabs[i];
      try {
        const li = document.createElement("li");

        // tab icon
        const icon = document.createElement('img');
        icon.classList.add("li-icon");
        icon.src = faviconURL(tab.url);

        const listItemDiv = document.createElement("div");
        listItemDiv.classList.add("li-item");

        // create elements for tab title and URL info
        const titleDiv = document.createElement("div");
        titleDiv.classList.add("tab-title");

        // 高亮匹配的字符
        if (keywords.length > 0) {
          titleDiv.innerHTML = highlightMatches(tab.title, keywords, searchMatchMode);
        } else {
          titleDiv.textContent = tab.title;
        }

        const urlHostNameDiv = document.createElement("div");
        urlHostNameDiv.classList.add("tab-url-hostname");
        urlHostNameDiv.textContent = getCachedHostname(tab.url);
        const lastElement = tab.url.substring(tab.url.lastIndexOf('/') + 1);
        if (lastElement.length > 0) {
          urlHostNameDiv.textContent = urlHostNameDiv.textContent + "/.../" + lastElement;
        }
        urlHostNameDiv.title = tab.url;


        listItemDiv.appendChild(titleDiv);
        listItemDiv.appendChild(urlHostNameDiv);

        // 创建操作按钮容器
        const actionContainer = document.createElement("div");
        actionContainer.classList.add("action-container");

        // 检查标签页是否已固定（使用预构建的 pinnedMap）
        const isPinned = isTabPinnedSync(tab.id, tab.url, pinnedMap);

        // 如果已固定，给列表项添加橙色底色
        if (isPinned) {
          li.classList.add("pinned-tab");
        }

        // 创建固定/取消固定按钮
        const pinBtn = document.createElement("button");
        pinBtn.classList.add("action-btn", "pin-btn");
        if (isPinned) {
          pinBtn.classList.add("pinned");
          pinBtn.innerHTML = "🟠";
          pinBtn.title = i18n.getMessage('unpinTab') || '取消固定标签页';
        } else {
          pinBtn.innerHTML = "⚪";
          pinBtn.title = i18n.getMessage('pinToFavorites') || '固定到常用列表';
        }
        pinBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          handlePinTab(tab, i);
        });

        // 创建关闭按钮
        const closeBtn = document.createElement("button");
        closeBtn.classList.add("action-btn", "close-btn");
        closeBtn.innerHTML = "✕";
        closeBtn.title = i18n.getMessage('closeTab') || 'Close tab';
        closeBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          handleCloseBtnClicked(tab.id);
        });

        // 创建三点按钮（默认显示）
        const menuBtn = document.createElement("button");
        menuBtn.classList.add("action-btn", "menu-btn");
        menuBtn.innerHTML = "≡";
        menuBtn.title = i18n.getMessage('menuLabel') || '菜单';

        // 组装按钮容器
        actionContainer.appendChild(pinBtn);
        actionContainer.appendChild(closeBtn);
        actionContainer.appendChild(menuBtn);

        li.appendChild(icon);
        li.appendChild(listItemDiv);
        li.appendChild(actionContainer);

        // add click event to switch to the selected tab
        li.addEventListener("click", function () {
          chrome.tabs.get(tab.id, (tab) => {
            if (chrome.runtime.lastError) {
              const errorMessage = i18n.getMessage('errorGetTabInfo', chrome.runtime.lastError.message);
              console.info(errorMessage || `Failed to get tab information: ${chrome.runtime.lastError.message}`);
              window.close();
              return;
            }

            const windowId = tab.windowId;
            // 只发送消息给 background.js 处理
            chrome.runtime.sendMessage({
              action: "switchToTab",
              data: {
                tabId: tab.id,
                windowId: windowId
              }
            });
            window.close();
          });
        });

        fragment.appendChild(li);
        tabIdMap.set(i, tab.id);
      } catch (error) {
        // 如果try块中抛出错误，这里将捕获到错误
        // console.error("An error occurred:", error.message);
      }
    }
    
    // 一次性添加所有元素到 DOM，只触发一次回流
    tabList.appendChild(fragment);
    
    lis = tabList.childNodes;

    // 默认选中，方便enter直接跳转
    if (lis.length > 0) {
      // 确定要选中的索引：优先使用 nextSelectedTabId（如果有效），其次使用 targetTabId 查找，最后默认选中第一个
      let targetIndex = -1;
      
      // 首先检查 nextSelectedTabId 是否有效
      if (nextSelectedTabId !== 'undefined' && nextSelectedTabId >= 0 && nextSelectedTabId < lis.length) {
        targetIndex = nextSelectedTabId;
      } 
      // 如果 nextSelectedTabId 无效，尝试使用 targetTabId 查找
      else if (targetTabId !== null) {
        for (let i = 0; i < lis.length; i++) {
          if (tabIdMap.get(i) === targetTabId) {
            targetIndex = i;
            break;
          }
        }
      }
      
      // 如果找到了有效的目标索引
      if (targetIndex >= 0) {
        selectedIndex = targetIndex;
        lis[selectedIndex].classList.add("selected");
        // 滚动到目标标签页
        setTimeout(() => {
          const container = tabList.parentElement;
          const targetItem = lis[selectedIndex];
          if (relativeOffset !== null) {
            // 使用记录的相对位置，保持目标 tab 在视野内的相同位置
            container.scrollTop = targetItem.offsetTop - relativeOffset;
          } else {
            // 默认滚动到中央
            targetItem.scrollIntoView({
              block: 'center',
              behavior: 'smooth'
            });
          }
        }, 50);
      } else {
        lis[0].classList.add("selected");
        selectedIndex = 0;
      }
    }

    // 已打开标签总数展示控制
    if (query.length === 0) {
      chrome.tabs.query({ windowType: 'normal' }, function (allTabs) {
        const message = i18n.getMessage('tabCount', allTabs.length.toString());
        tabCount.textContent = message ? message.replace('$COUNT$', allTabs.length) : `${allTabs.length} Tabs`;
      });
    } else {
      const message = i18n.getMessage('tabCount', filteredTabs.length.toString());
      tabCount.textContent = message ? message.replace('$COUNT$', filteredTabs.length) : `${filteredTabs.length} Tabs`;
    }
  }

  function faviconURL(u) {
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", u);
    url.searchParams.set("size", "26");
    return url.toString();
  }

  // 检查标签页是否已固定（同步版本，使用预构建的 pinnedMap）
  function isTabPinnedSync(tabId, tabUrl, pinnedMap) {
    if (pinnedMap.has(tabId)) {
      return true;
    }
    if (tabUrl && pinnedMap.has(tabUrl)) {
      return true;
    }
    return false;
  }

  // 检查标签页是否已固定（异步版本，兼容旧调用）
  async function isTabPinned(tabId, tabUrl = null) {
    const result = await new Promise((resolve) => {
      chrome.storage.local.get('pinnedTabs', resolve);
    });
    const pinnedTabs = result.pinnedTabs || [];
    
    // 先通过 tabId 判断
    if (pinnedTabs.some(tab => tab.tabId === tabId)) {
      return true;
    }
    
    // 如果没有通过 tabId 找到，但提供了 URL，则通过 URL 辅助判断
    if (tabUrl) {
      return pinnedTabs.some(tab => tab.url === tabUrl);
    }
    
    return false;
  }

  // 添加标签页到固定列表
  async function pinTab(tab) {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get('pinnedTabs', resolve);
      });
      let pinnedTabs = result.pinnedTabs || [];

      // 检查是否已固定（通过 tabId）
      if (pinnedTabs.some(t => t.tabId === tab.id)) {
        return { success: true, message: '已固定' };
      }

      // 检查是否通过 URL 匹配到已固定的长期 tab（长期固定的 tab 重新打开的情况）
      const existingIndex = pinnedTabs.findIndex(t => t.url === tab.url);
      if (existingIndex !== -1) {
        const existingTab = pinnedTabs[existingIndex];
        // 更新 tabId 为当前新打开的 tab
        existingTab.tabId = tab.id;
        existingTab.title = tab.title;
        // 如果是长期固定 tab，更新长期固定时间
        if (existingTab.isLongTermPinned) {
          existingTab.longTermPinnedAt = new Date().toISOString();
        }
        // 保存到存储
        await new Promise((resolve) => {
          chrome.storage.local.set({ pinnedTabs }, resolve);
        });
        
        // 异步同步到服务器（仅在 tab.id 存在时）
        if (tab.id) {
          syncQueueService.addOperation('updateTab', {
            tabId: tab.id,
            url: tab.url,
            title: tab.title,
            isLongTermPinned: existingTab.isLongTermPinned,
            longTermPinnedAt: existingTab.longTermPinnedAt
          }).catch(err => console.info('Sync updateTab failed:', err));
        }
        
        return { success: true, message: '已重新固定' };
      }

      // 检查用户是否已完成邮箱验证或OAuth登录
      const isEmailVerified = await authService.isEmailVerified();
      
      // 检查容量限制
      // 静默注册用户（未完成邮箱验证）：限制5个
      // 已完成注册用户（体验期/VIP）：限制100个
      let limit = 5; // 默认静默用户限制
      if (isEmailVerified) {
        // 已完成注册用户，使用乐观模式获取限制（服务器异常时使用本地缓存）
        try {
          limit = await featureLimitService.getFeatureLimit('pinnedTabs', false, true);
        } catch (e) {
          console.info('[pinTab] Failed to get feature limit, using default 100');
          limit = 100;
        }
      }
      
      if (pinnedTabs.length >= limit) {
        let message;
        if (!isEmailVerified) {
          message = i18n.getMessage('pinnedTabsLimitUnverified') || `固定标签页数量已达上限（最多5个），请完成邮箱验证解锁更多功能`;
        } else {
          // 已验证用户，检查体验期状态
          let localTrialStatus = null;
          try {
            localTrialStatus = await trialService.getTrialStatus();
          } catch (e) {
            console.info('[pinTab] Failed to get trial status:', e);
          }
          
          const trialEnabled = localTrialStatus && localTrialStatus.trialEnabled;
          const isInTrial = localTrialStatus && localTrialStatus.isInTrialPeriod;
          
          if (isInTrial) {
            message = i18n.getMessage('pinnedTabsLimit', limit.toString()) || `固定标签页数量已达上限（最多${limit}个）`;
          } else {
            // 体验期已结束或无体验期
            const messageKey = trialEnabled ? 'pinnedTabsLimitExpired' : 'pinnedTabsLimitNoTrial';
            message = i18n.getMessage(messageKey) || (trialEnabled 
              ? `固定标签页数量已达上限（最多${limit}个），体验期已结束，升级VIP会员即可继续使用更多功能哦！`
              : `固定标签页数量已达上限（最多${limit}个），升级VIP会员即可继续使用更多功能！`);
          }
        }
        return { success: false, message };
      }

      // 添加到固定列表
      pinnedTabs.push({
        tabId: tab.id,
        title: tab.title,
        url: tab.url,
        icon: faviconURL(tab.url),
        pinnedAt: new Date().toISOString(),
        synced: false // 标记为未同步
      });

      // 保存到存储
      await new Promise((resolve) => {
        chrome.storage.local.set({ pinnedTabs }, resolve);
      });

      // 异步同步到服务器（不阻塞用户操作）
      syncQueueService.addOperation('pinTab', {
        tabId: tab.id,
        title: tab.title,
        url: tab.url,
        icon: faviconURL(tab.url)
      }).catch(err => console.info('Sync pinTab failed:', err));

      return { success: true, message: '固定成功' };
    } catch (error) {
      // 固定标签页失败不应阻止用户操作，使用 warn
      console.info('Error pinning tab:', error.message);
      return { success: false, message: '固定失败' };
    }
  }

  // 从固定列表中移除
  async function unpinTab(tabId) {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get('pinnedTabs', resolve);
      });
      let pinnedTabs = result.pinnedTabs || [];

      // 检查是否是长期固定的tab，如果是则不执行移除
      const targetTab = pinnedTabs.find(t => t.tabId === tabId);
      if (targetTab && targetTab.isLongTermPinned) {
        return { success: false, message: '长期固定的Tab无法取消固定' };
      }

      // 过滤掉要移除的标签页
      pinnedTabs = pinnedTabs.filter(tab => tab.tabId !== tabId);

      // 保存到存储
      await new Promise((resolve) => {
        chrome.storage.local.set({ pinnedTabs }, resolve);
      });

      // 异步同步到服务器（不阻塞用户操作）
      syncQueueService.addOperation('unpinTab', {
        tabId: tabId
      }).catch(err => console.info('Sync unpinTab failed:', err));

      return { success: true, message: '取消固定成功' };
    } catch (error) {
      // 取消固定标签页失败不应阻止用户操作，使用 warn
      console.info('Error unpinning tab:', error.message);
      return { success: false, message: '取消固定失败' };
    }
  }

  // 处理List item 关闭标签事件
  function handleCloseBtnClicked(tabId) {
    if (tabId === undefined) return;
    
    // 检查是否是长期固定的tab
    chrome.storage.local.get('pinnedTabs', (result) => {
      const pinnedTabs = result.pinnedTabs || [];
      const targetTab = pinnedTabs.find(t => t.tabId === tabId);
      
      if (targetTab && targetTab.isLongTermPinned) {
        // 长期固定的tab：关闭浏览器标签页，但只从当前列表移除，不从pinnedTabList中移除
        chrome.tabs.remove(tabId, () => {
          // 从当前列表中移除该tab（通过更新tab列表）
          updateTabs(-1);
        });
        return;
      }
      
      // 普通tab：关闭浏览器标签页并从列表中移除
      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          const errorMessage = i18n.getMessage('closeTabFailed', chrome.runtime.lastError.message);
            console.info(errorMessage || `Failed to close tab: ${chrome.runtime.lastError.message}`);
          return;
        }
        let nextTabId;
        if (selectedIndex >= 0) {
          nextTabId = selectedIndex - 1;
        } else {
          nextTabId = -1;
        }
        updateTabs(nextTabId);
      });
    });
  }

  // 处理固定/取消固定事件
  // @param tab 要固定/取消固定的标签页
  // @param tabIndex 标签页在列表中的索引
  async function handlePinTab(tab, tabIndex) {
    // 预先获取 pinnedTabs 构建 Map
    const pinnedResult = await new Promise((resolve) => {
      chrome.storage.local.get('pinnedTabs', resolve);
    });
    const pinnedTabs = pinnedResult.pinnedTabs || [];
    const pinnedMap = new Map();
    pinnedTabs.forEach(t => {
      pinnedMap.set(t.tabId, t);
      pinnedMap.set(t.url, t);
    });
    
    // 检查标签页是否已固定（使用预构建的 pinnedMap）
    const isPinned = isTabPinnedSync(tab.id, tab.url, pinnedMap);
    let result;

    if (isPinned) {
      result = await unpinTab(tab.id);
    } else {
      result = await pinTab(tab);
    }

    // 显示提示
    if (!result.success) {
      showToast(result.message);
    } else {
      // 操作成功，只更新当前 tab 的样式，不刷新整个列表
      if (tabIndex >= 0 && lis.length > tabIndex) {
        const li = lis[tabIndex];
        const pinBtn = li.querySelector('.pin-btn');
        
        // 使用 isPinned 判断操作前的状态，从而确定当前操作是固定还是取消固定
        if (isPinned) {
          // 原来是固定的，现在取消固定：移除橙色底色，更新按钮样式
          li.classList.remove('pinned-tab');
          if (pinBtn) {
            pinBtn.classList.remove('pinned');
            pinBtn.innerHTML = '⚪';
            pinBtn.title = i18n.getMessage('pinToFavorites') || '固定到常用列表';
          }
        } else {
          // 原来未固定，现在固定成功：添加橙色底色，更新按钮样式
          li.classList.add('pinned-tab');
          if (pinBtn) {
            pinBtn.classList.add('pinned');
            pinBtn.innerHTML = '🟠';
            pinBtn.title = i18n.getMessage('unpinTab') || '取消固定标签页';
          }
        }
      }
    }
  }

  function updateSelection() {
    if (lis.length > 0 && selectedIndex === -1) {
      lis[0].classList.add("selected");
      selectedIndex = 0;
    }
    lis.forEach((li, index) => {
      if (index === selectedIndex) {
        li.classList.add("selected");
      } else {
        li.classList.remove("selected");
      }
    });
  }

  function handleEnterButtonEvent() {
    let tabId = tabIdMap.get(selectedIndex);
    if (tabId !== undefined) {
      chrome.tabs.get(tabId, (tab) => {
        const windowId = tab.windowId;
        // 只发送消息给 background.js 处理
        chrome.runtime.sendMessage({
          action: "switchToTab",
          data: {
            tabId: tabId,
            windowId: windowId
          }
        });
        window.close();
      });
    }
  }

  function handleDeleteButtonEvent() {
    let tabId = tabIdMap.get(selectedIndex);
    if (tabId !== undefined) {
      handleCloseBtnClicked(tabId);
    }
  }

  function scrollIntoView(selectedIndex, event, behavior) {
    event.preventDefault();
    if (lis.length === 0) {
      return;
    }
    const selectedItem = lis[selectedIndex];

    if (!selectedItem) {
      return;
    }

    // behavior参数控制是否平滑滚动
    const scrollBehavior = behavior === undefined ? 'smooth' : behavior;

    // 使用Element.scrollIntoView()方法，这是一个更可靠的方法。确保元素滚动到可视区域
    selectedItem.scrollIntoView({
      block: 'nearest',  // 只在必要时滚动，尽量保持元素在视图内
      behavior: scrollBehavior
    });
  }

  window.addEventListener("keydown", function (event) {
    if (event.key === "ArrowUp") {
      if (selectedIndex <= 0) {
        selectedIndex = lis.length - 1; // 如果已经在顶部，则跳转到底部
      } else {
        selectedIndex--;
      }
      updateSelection();
      scrollIntoView(selectedIndex, event);
    } else if (event.key === "ArrowDown") {
      if (selectedIndex >= lis.length - 1) {
        selectedIndex = 0; // 如果已经在底部，则跳转到顶部
      } else {
        selectedIndex++;
      }
      updateSelection();
      scrollIntoView(selectedIndex, event);
    } else if (event.key === "Enter") {
      handleEnterButtonEvent();
    } else if (event.key === "Delete") {
      handleDeleteButtonEvent();
      scrollIntoView(selectedIndex, event, 'auto');
    }
  });

  // Set up i18n for UI elements
  function setupI18n() {
    // Set placeholder and aria-label for search input
    searchInput.placeholder = i18n.getMessage('searchPlaceholder') || '搜索已打开的标签页...';
    searchInput.setAttribute('aria-label', i18n.getMessage('ariaLabelSearch') || '搜索已打开的标签页');
  }

  // Initialize i18n
  await i18n.initialize();
  
  // 更新页面国际化元素
  i18n.updatePageI18n();

  // Set initial loading text with i18n
  tabCount.textContent = i18n.getMessage('loadingText') || 'Loading...';

  // initial tab update
  updateTabs();

  // Set up i18n after DOM is loaded
  setupI18n();

  // event listener for search input changes
  searchInput.addEventListener("input", updateTabs);

  // Add language change listener
  i18n.addListener(() => {
    setupI18n();
    updateTabs();
  });

  // Listen for language change messages from other parts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'languageChanged') {
      // Update i18n language
      i18n.setLanguage(message.language).then(() => {
        // Reapply i18n after language change
        setupI18n();
        updateTabs();
      });
    }
  });

  // 固定标签页按钮点击事件
  const pinnedTabsBtn = document.getElementById('pinned-tabs-btn');
  if (pinnedTabsBtn) {
    pinnedTabsBtn.addEventListener('click', () => {
      // 发送消息给 background script 打开固定标签页弹窗
      chrome.runtime.sendMessage({ action: 'openPinnedTabs' });
      // 关闭当前弹窗
      window.close();
    });
  }

  // 设置按钮点击事件
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openSettings' });
      window.close();
    });
  }

  // 关于按钮点击事件
  const aboutBtn = document.getElementById('about-btn');
  if (aboutBtn) {
    aboutBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openAbout' });
      window.close();
    });
  }
});