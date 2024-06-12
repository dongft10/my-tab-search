document.addEventListener("DOMContentLoaded", () => {

  const searchInput = document.getElementById("search-input");
  const tabList = document.getElementById("tab-list");
  let tabsCount = document.getElementById("tab-count");

  let selectedIndex = -1;

  let lis = tabList.childNodes;

  let tabIdMap = new Map();

  searchInput.focus();

  // Function to update the displayed tabs based on search input
  function updateTabs(nextSelectedTabId) {
    const query = searchInput.value.toLowerCase();

    chrome.tabs.query({}, (tabs) => {
      const filteredTabs = tabs.filter((tab) =>
        tab.title.toLowerCase().includes(query)
      );

      // clear the existing tab list
      tabList.innerHTML = "";

      let i = 0;

      tabIdMap.clear();

      // populate the tab list with the filtered tabs
      filteredTabs.forEach((tab) => {
        try {
          const li = document.createElement("li");

          // tab icon
          const img = document.createElement('img');
          img.classList.add("li-img");
          img.src = faviconURL(tab.url);


          const listItemDiv = document.createElement("div");
          listItemDiv.classList.add("li-item");

          // create elements for tab title and URL info
          const titleDiv = document.createElement("div");
          titleDiv.classList.add("tab-title");
          titleDiv.textContent = tab.title;

          const urlInfoDiv = document.createElement("div");
          urlInfoDiv.classList.add("tab-info");
          urlInfoDiv.textContent = new URL(tab.url).hostname;

          listItemDiv.appendChild(titleDiv);
          listItemDiv.appendChild(urlInfoDiv);


          const closeBtn = document.createElement("div");
          closeBtn.classList.add("close-btn");
          closeBtn.textContent = "";
          closeBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            handleCloseBtnClicked(tab.id);
          });

          li.appendChild(img);
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

          // add the list item to the tab list
          tabList.appendChild(li);

          tabIdMap.set(i, tab.id);
          i++;
        } catch (error) {
          // 如果try块中抛出错误，这里将捕获到错误
          // console.error("An error occurred:", error.message);
        }
      });
      lis = tabList.childNodes;

      // 默认选中，方便enter直接跳转
      if (lis.length > 0) {
        if (nextSelectedTabId !== 'undefined' && nextSelectedTabId >= 0) {
          lis[nextSelectedTabId].classList.add("selected");
          selectedIndex = nextSelectedTabId;
          scrollIntoView(selectedIndex, "ArrowUp", 'auto');
        } else {
          lis[0].classList.add("selected");
          selectedIndex = 0;
        }
      }

      // 已打开标签总数展示控制
      let totalTabsCount = 0;
      if (query.length === 0) {
        chrome.tabs.query({currentWindow: true}, function (tabs) {
          totalTabsCount += tabs.length;
          chrome.tabs.query({currentWindow: false}, function (tabs) {
            totalTabsCount += tabs.length;
            tabsCount.textContent = `${totalTabsCount} Tabs`;
          });
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

  function scrollIntoView(selectedIndex, eventKey, behavior) {
    let itemRect = lis[selectedIndex].getBoundingClientRect();

    let headLineHeight = 59;

    let offset;
    if (eventKey === 'ArrowDown') {
      // 如果selectedItem在window下方
      if (itemRect.bottom > (window.innerHeight)) {
        offset = itemRect.bottom - window.innerHeight + window.scrollY;
      }
      // 如果selectedItem在window上方
      if (itemRect.y < 0 && window.scrollY > 0) {
        // itemRect.y 此时是负数
        offset = itemRect.y + window.scrollY;
      }
    } else if (eventKey === 'ArrowUp') {
      // 如果selectedItem在window下方
      if (itemRect.bottom > window.innerHeight) {
        // 计算拖动柄要补偿移动的距离
        offset = itemRect.bottom - window.innerHeight + window.scrollY;
      }
      // 如果selectedItem在window上方
      if (itemRect.y < 0 && window.scrollY > 0) {
        offset = window.scrollY + itemRect.y;
      }
    }
    if (offset <= headLineHeight) {
      offset = 0;
    }
    window.scrollTo({
      top: offset,
      left: 0,
      behavior: behavior === undefined ? 'smooth' : behavior
    });
  }

  searchInput.addEventListener("keydown", function (event) {
    if (event.key === "ArrowUp") {
      selectedIndex = Math.max(0, selectedIndex - 1);
      updateSelection();
      scrollIntoView(selectedIndex, event.key);
    } else if (event.key === "ArrowDown") {
      selectedIndex = Math.min(lis.length - 1, selectedIndex + 1);
      updateSelection();
      scrollIntoView(selectedIndex, event.key);
    } else if (event.key === "Enter") {
      handleEnterButtonEvent();
    } else if (event.key === "Delete") {
      handleDeleteButtonEvent();
    }
  });

  // event listener for search input changes
  searchInput.addEventListener("input", updateTabs);

  // initial tab update
  updateTabs();
});
