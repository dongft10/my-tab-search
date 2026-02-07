// Import i18n manager
import i18n from './i18n.js';

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

  const searchInput = document.getElementById("search-input");
  const tabList = document.getElementById("tab-list");
  let tabsCount = document.getElementById("tab-count");

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

  // 高亮匹配的字符
  function highlightMatches(text, keywords) {
    if (!keywords || keywords.length === 0) {
      return text;
    }

    // 创建一个标记数组，记录每个字符是否被匹配
    const matched = new Array(text.length).fill(false);
    const lowerText = text.toLowerCase();
    
    // 对每个关键字进行匹配
    keywords.forEach(keyword => {
      let keywordIndex = 0;
      for (let i = 0; i < text.length && keywordIndex < keyword.length; i++) {
        if (lowerText[i] === keyword[keywordIndex]) {
          matched[i] = true;
          keywordIndex++;
        }
      }
    });

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

  // 焦点默认定位到搜索输入框
  searchInput.focus();

  // Function to update the displayed tabs based on search input
  async function updateTabs(nextSelectedTabId) {
    const query = searchInput.value.trim().toLowerCase();
    
    // 使用 Promise 包装 chrome.tabs.query
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({}, resolve);
    });
    let filteredTabs;
    
    // 按空格分割查询字符串，得到多个关键字
    const keywords = query.split(/\s+/).filter(kw => kw.length > 0);
    
    if (!query || keywords.length === 0) {
      // 如果查询为空或没有有效关键字，则返回所有标签页
      filteredTabs = tabs;
    } else {
      // 过滤标签页，确保标题包含所有关键字（使用子序列匹配）
      filteredTabs = tabs.filter((tab) => {
        const lowerTitle = tab.title.toLowerCase();
        return keywords.every(keyword => subsequenceMatch(keyword, lowerTitle));
      });
    }

    tabList.innerHTML = "";
    tabIdMap.clear();

    // tabList index
    let i = 0;

    // populate the tab list with the filtered tabs
    for (const tab of filteredTabs) {
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
            titleDiv.innerHTML = highlightMatches(tab.title, keywords);
          } else {
            titleDiv.textContent = tab.title;
          }

          const urlHostNameDiv = document.createElement("div");
          urlHostNameDiv.classList.add("tab-url-hostname");
          urlHostNameDiv.textContent = new URL(tab.url).hostname;
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
          
          // 检查标签页是否已固定
          const isPinned = await isTabPinned(tab.id);
          
          // 创建固定/取消固定按钮
          const pinBtn = document.createElement("button");
          pinBtn.classList.add("action-btn", "pin-btn");
          if (isPinned) {
            pinBtn.innerHTML = "📌";
            pinBtn.title = i18n.getMessage('unpinTab') || '取消固定标签页';
          } else {
            pinBtn.innerHTML = "📌";
            pinBtn.title = i18n.getMessage('pinToFavorites') || '固定到常用列表';
          }
          pinBtn.style.opacity = "0";
          pinBtn.style.visibility = "hidden";
          pinBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            handlePinTab(tab);
          });
          
          // 创建关闭按钮
          const closeBtn = document.createElement("button");
          closeBtn.classList.add("action-btn", "close-btn");
          closeBtn.innerHTML = "✕";
          closeBtn.title = i18n.getMessage('closeTab') || 'Close tab';
          closeBtn.style.opacity = "0";
          closeBtn.style.visibility = "hidden";
          closeBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            handleCloseBtnClicked(tab.id);
          });
          
          // 创建三点按钮（始终可见）
          const menuBtn = document.createElement("button");
          menuBtn.classList.add("action-btn", "menu-btn");
          menuBtn.innerHTML = "⋯";
          menuBtn.title = i18n.getMessage('menuLabel') || '菜单';
          menuBtn.style.opacity = "0";
          menuBtn.style.visibility = "hidden";
          
          // 组装按钮容器
          actionContainer.appendChild(pinBtn);
          actionContainer.appendChild(closeBtn);
          actionContainer.appendChild(menuBtn);

          li.appendChild(icon);
          li.appendChild(listItemDiv);
          li.appendChild(actionContainer);

          // 处理按钮显示/隐藏 - 悬停标签项时显示所有按钮
          li.addEventListener("mouseenter", function () {
            pinBtn.style.opacity = "1";
            pinBtn.style.visibility = "visible";
            closeBtn.style.opacity = "1";
            closeBtn.style.visibility = "visible";
            menuBtn.style.opacity = "1";
            menuBtn.style.visibility = "visible";
          });
          
          li.addEventListener("mouseleave", function (e) {
            // 只有当鼠标真正离开 li 元素时才隐藏（不是移动到子元素）
            if (!li.contains(e.relatedTarget)) {
              pinBtn.style.opacity = "0";
              pinBtn.style.visibility = "hidden";
              closeBtn.style.opacity = "0";
              closeBtn.style.visibility = "hidden";
              menuBtn.style.opacity = "0";
              menuBtn.style.visibility = "hidden";
            }
          });

          // add click event to switch to the selected tab
          li.addEventListener("click", function () {
            chrome.tabs.get(tab.id, (tab) => {
              if (chrome.runtime.lastError) {
                const errorMessage = i18n.getMessage('errorGetTabInfo', chrome.runtime.lastError.message);
                console.warn(errorMessage || `Failed to get tab information: ${chrome.runtime.lastError.message}`);
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

          tabList.appendChild(li);
          tabIdMap.set(i++, tab.id);
        } catch (error) {
          // 如果try块中抛出错误，这里将捕获到错误
          // console.error("An error occurred:", error.message);
        }
      }
      lis = tabList.childNodes;

      // 默认选中，方便enter直接跳转
      if (lis.length > 0) {
        if (nextSelectedTabId !== 'undefined' && nextSelectedTabId >= 0) {
          selectedIndex = nextSelectedTabId;
          lis[selectedIndex].classList.add("selected");
        } else {
          lis[0].classList.add("selected");
          selectedIndex = 0;
        }
      }

      // 已打开标签总数展示控制
      if (query.length === 0) {
        chrome.tabs.query({windowType: 'normal'}, function (allTabs) {
          const message = i18n.getMessage('tabsCount', allTabs.length.toString());
          tabsCount.textContent = message ? message.replace('$COUNT$', allTabs.length) : `${allTabs.length} Tabs`;
        });
      } else {
        const message = i18n.getMessage('tabsCount', filteredTabs.length.toString());
        tabsCount.textContent = message ? message.replace('$COUNT$', filteredTabs.length) : `${filteredTabs.length} Tabs`;
      }
  }

  function faviconURL(u) {
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", u);
    url.searchParams.set("size", "26");
    return url.toString();
  }

  // 固定标签页容量限制
  const MAX_PINNED_TABS = 5;

  // 检查标签页是否已固定
  async function isTabPinned(tabId) {
    const result = await new Promise((resolve) => {
      chrome.storage.sync.get('pinnedTabs', resolve);
    });
    const pinnedTabs = result.pinnedTabs || [];
    return pinnedTabs.some(tab => tab.tabId === tabId);
  }

  // 添加标签页到固定列表
  async function pinTab(tab) {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get('pinnedTabs', resolve);
      });
      let pinnedTabs = result.pinnedTabs || [];
      
      // 检查是否已固定
      if (pinnedTabs.some(t => t.tabId === tab.id)) {
        return { success: true, message: '已固定' };
      }
      
      // 检查容量限制
      if (pinnedTabs.length >= MAX_PINNED_TABS) {
        return { success: false, message: i18n.getMessage('pinnedTabsLimit', MAX_PINNED_TABS.toString()) || `固定标签页数量超过${MAX_PINNED_TABS}个的限制` };
      }
      
      // 添加到固定列表
      pinnedTabs.push({
        tabId: tab.id,
        title: tab.title,
        url: tab.url,
        icon: faviconURL(tab.url)
      });
      
      // 保存到存储
      await new Promise((resolve) => {
        chrome.storage.sync.set({ pinnedTabs }, resolve);
      });
      
      return { success: true, message: '固定成功' };
    } catch (error) {
      console.error('Error pinning tab:', error);
      return { success: false, message: '固定失败' };
    }
  }

  // 从固定列表中移除
  async function unpinTab(tabId) {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get('pinnedTabs', resolve);
      });
      let pinnedTabs = result.pinnedTabs || [];
      
      // 过滤掉要移除的标签页
      pinnedTabs = pinnedTabs.filter(tab => tab.tabId !== tabId);
      
      // 保存到存储
      await new Promise((resolve) => {
        chrome.storage.sync.set({ pinnedTabs }, resolve);
      });
      
      return { success: true, message: '取消固定成功' };
    } catch (error) {
      console.error('Error unpinning tab:', error);
      return { success: false, message: '取消固定失败' };
    }
  }

  // 处理List item 关闭标签事件
  function handleCloseBtnClicked(tabId) {
    if (tabId !== undefined) {
      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          const errorMessage = i18n.getMessage('closeTabFailed', chrome.runtime.lastError.message);
          console.warn(errorMessage || `Failed to close tab: ${chrome.runtime.lastError.message}`);
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
    }
  }

  // 处理固定/取消固定事件
  async function handlePinTab(tab) {
    const isPinned = await isTabPinned(tab.id);
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
      // 操作成功，更新列表显示
      updateTabs(selectedIndex);
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
  
  // Set initial loading text with i18n
  tabsCount.textContent = i18n.getMessage('loadingText') || 'Loading...';
  
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
});