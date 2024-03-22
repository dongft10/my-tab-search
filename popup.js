document.addEventListener("DOMContentLoaded", () => {
  //   console.log("DOM fully loaded and parsed");

  const searchInput = document.getElementById("search-input");
  const tabList = document.getElementById("tab-list");

  let selectedIndex = -1;

  let lis = tabList.childNodes;

  let tabIdMap = new Map();

  searchInput.focus();

  // Function to update the displayed tabs based on search input
  function updateTabs() {
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
      });
      lis = tabList.childNodes;
      selectedIndex = -1;

      // 如果搜索结果只有一个，那么默认选中这一个，方便enter直接跳转
      if (lis.length === 1) {
        lis[0].classList.add("selected");
        selectedIndex = 0;
      }
    });
  }

  function faviconURL(u) {
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", u);
    url.searchParams.set("size", "26");
    return url.toString();
  }

  function getFavicon(url) {
    return 'background-image: -webkit-image-set(url(\'chrome://favicon/size/16@1x/' + url + '\') 1x, url(\'chrome://favicon/size/16@2x/' + url + '\') 2x)';
  };

  // 处理List item 关闭标签事件
  function handleCloseBtnClicked(tabId) {
    chrome.tabs.remove(tabId, () => {
      updateTabs();
    });
  }

  function updateSelection() {
    if (lis.length > 0 && selectedIndex === -1) {
      lis[0].classList.add("selected");
      selectedIndex = 0;
    }
    lis.forEach((li, index) => {
      if (index === selectedIndex) {
        console.log("selected index:" + index);
        li.classList.add("selected");
      } else {
        li.classList.remove("selected");
      }
    });
  }

  function handleEnterButtonEvent() {
    let index = tabIdMap.get(selectedIndex);
    console.log("enter index:" + index);
    chrome.tabs.get(index, (tab) => {
      chrome.tabs.update(tab.id, {active: true});
      chrome.windows.update(tab.windowId, {focused: true});
      window.close();
    });
  }

  searchInput.addEventListener("keydown", function (event) {
    if (event.key === "ArrowUp") {
      selectedIndex = Math.max(0, selectedIndex - 1);
      updateSelection();
    } else if (event.key === "ArrowDown") {
      selectedIndex = Math.min(lis.length - 1, selectedIndex + 1);
      updateSelection();
    } else if (event.key === "Enter") {
      handleEnterButtonEvent();
    }
  });

  // event listener for search input changes
  searchInput.addEventListener("input", updateTabs);

  // initial tab update
  updateTabs();
});
