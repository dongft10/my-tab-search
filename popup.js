document.addEventListener("DOMContentLoaded", () => {

  const searchInput = document.getElementById("search-input");
  const tabList = document.getElementById("tab-list");
  let tabsCount = document.getElementById("tab-count");

  // 搜索框所在行高度
  const headLineHeight = 59;

  // 当前选中的tab item
  let selectedIndex = -1;
  // 标签列表
  let lis = tabList.childNodes;
  // 标签Id与列表索引id的对应关系
  let tabIdMap = new Map();

  // 焦点默认定位到搜索输入框
  searchInput.focus();

  // Function to update the displayed tabs based on search input
  function updateTabs(nextSelectedTabId) {
    const query = searchInput.value.toLowerCase();

    chrome.tabs.query({}, (tabs) => {
      const filteredTabs = tabs.filter((tab) =>
        tab.title.toLowerCase().includes(query)
      );

      tabList.innerHTML = "";
      tabIdMap.clear();

      // tabList index
      let i = 0;

      // populate the tab list with the filtered tabs
      filteredTabs.forEach((tab) => {
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
          titleDiv.textContent = tab.title;

          const urlHostNameDiv = document.createElement("div");
          urlHostNameDiv.classList.add("tab-url-hostname");
          urlHostNameDiv.textContent = new URL(tab.url).hostname;

          listItemDiv.appendChild(titleDiv);
          listItemDiv.appendChild(urlHostNameDiv);

          const closeBtn = document.createElement("div");
          closeBtn.classList.add("close-btn");
          closeBtn.textContent = "";
          closeBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            handleCloseBtnClicked(tab.id);
          });

          li.appendChild(icon);
          li.appendChild(listItemDiv);
          li.appendChild(closeBtn);

          // 处理 list item 关闭按钮控制逻辑
          li.addEventListener("mouseenter", function () {
            closeBtn.textContent = "X";
          });
          li.addEventListener("mouseleave", function () {
            closeBtn.textContent = "";
          });

          // add click event to switch to the selected tab
          li.addEventListener("click", function () {
            chrome.tabs.update(tab.id, {active: true});
            chrome.windows.update(tab.windowId, {focused: true});
            window.close();
          });

          tabList.appendChild(li);
          tabIdMap.set(i++, tab.id);
        } catch (error) {
          // 如果try块中抛出错误，这里将捕获到错误
          // console.error("An error occurred:", error.message);
        }
      });
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
        chrome.tabs.query({windowType: 'normal'}, function (tabs) {
          tabsCount.textContent = `${tabs.length} Tabs`;
        });
      } else {
        tabsCount.textContent = `${filteredTabs.length} Tabs`;
      }
    });
  }

  function faviconURL(u) {
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", u);
    url.searchParams.set("size", "26");
    return url.toString();
  }

  // 处理List item 关闭标签事件
  function handleCloseBtnClicked(tabId) {
    if (tabId !== undefined) {
      chrome.tabs.remove(tabId, () => {
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
    chrome.tabs.get(tabId, (tab) => {
      chrome.tabs.update(tab.id, {active: true});
      chrome.windows.update(tab.windowId, {focused: true});
      window.close();
    });
  }

  function handleDeleteButtonEvent() {
    let tabId = tabIdMap.get(selectedIndex);
    handleCloseBtnClicked(tabId);
  }

  function scrollIntoView(selectedIndex, event, behavior) {
    event.preventDefault();
    if (lis.length === 0) {
      return;
    }
    let eventKey = event.key;
    let itemRect = lis[selectedIndex].getBoundingClientRect();

    let offset;
    if (eventKey === 'ArrowDown') {
      // 如果selectedItem在window下方
      if (itemRect.bottom > window.innerHeight) {
        offset = itemRect.bottom - window.innerHeight + window.scrollY;
      }
      // 如果selectedItem在window上方
      if (itemRect.top < 0 && window.scrollY > 0) {
        // itemRect.top 此时是负数
        offset = itemRect.top + window.scrollY;
      }
    } else if (eventKey === 'ArrowUp' || eventKey === 'Delete') {
      // 如果selectedItem在window下方
      if (itemRect.bottom > window.innerHeight + headLineHeight) {
        // 计算拖动柄要补偿移动的距离
        offset = itemRect.bottom - window.innerHeight + window.scrollY;
      }
      // 如果selectedItem在window上方
      if (itemRect.top < 0 && window.scrollY > 0) {
        offset = window.scrollY + itemRect.top;
      }
    }
    if (offset <= headLineHeight) {
      offset = 0;
    }
    if (offset !== undefined) {
      window.scrollTo({
        top: offset,
        left: 0,
        behavior: behavior === undefined ? 'smooth' : behavior
      });
    }
  }

  window.addEventListener("keydown", function (event) {
    if (event.key === "ArrowUp") {
      selectedIndex = Math.max(0, selectedIndex - 1);
      updateSelection();
      scrollIntoView(selectedIndex, event);
    } else if (event.key === "ArrowDown") {
      selectedIndex = Math.min(lis.length - 1, selectedIndex + 1);
      updateSelection();
      scrollIntoView(selectedIndex, event);
    } else if (event.key === "Enter") {
      handleEnterButtonEvent();
    } else if (event.key === "Delete") {
      handleDeleteButtonEvent();
      scrollIntoView(selectedIndex, event, 'auto');
    }
  });

  // event listener for search input changes
  searchInput.addEventListener("input", updateTabs);

  // initial tab update
  updateTabs();
});