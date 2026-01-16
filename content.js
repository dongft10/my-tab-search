// Content script for My Tab Search Extension with rounded corners popup

(function() {
    // Check if the popup already exists
    if (document.getElementById('my-tab-search-popup')) {
        return;
    }

    // Flag to track if popup is active
    let isPopupActive = false;

    // Layout containing styles and HTML template for the popup
    const layout = {
        styles: `
            .my-tab-search-popup {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 400px;
                min-height: 300px;
                background: linear-gradient(135deg, #f5f7fa 0%, #e4edf5 100%);
                color: #333333;
                padding: 20px;
                border-radius: 20px;
                box-shadow: 
                    0 1px 3px rgba(0, 0, 0, 0.1),
                    0 4px 12px rgba(0, 0, 0, 0.15),
                    0 10px 30px rgba(0, 0, 0, 0.1);
                z-index: 1000000;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                transition: opacity 0.3s ease-in-out, transform 0.2s ease;
                overflow: hidden;
                border: 1px solid rgba(255, 255, 255, 0.5);
            }

            .my-tab-search-popup::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 8px;
                background: linear-gradient(90deg, #4285f4, #546bc9);
                border-radius: 20px 20px 0 0;
                z-index: 1;
            }

            .search-container {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 15px;
                margin: 10px 0 15px 0;
                background-color: rgba(255, 255, 255, 0.9);
                border-radius: 16px;
                backdrop-filter: blur(10px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.3);
            }

            #magnifying-glass {
                width: 24px;
                height: 24px;
                padding: 0 8px;
                vertical-align: middle;
                justify-content: center;
                opacity: 0.7;
            }

            #search-input {
                flex-grow: 1;
                margin: 0 12px;
                padding: 10px 15px;
                vertical-align: middle;
                border: none;
                border-radius: 12px;
                outline: none;
                background-color: transparent;
                font-size: 14px;
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
            }

            #tab-count {
                font-weight: 600;
                color: #4285f4;
                font-size: 14px;
                min-width: 80px;
                text-align: right;
            }

            #tab-list {
                list-style: none;
                padding: 0;
                margin: 0 0;
                max-height: 350px;
                overflow-y: auto;
                border-radius: 12px;
                padding: 5px;
                margin: 0 -5px;
            }

            #tab-list::-webkit-scrollbar {
                width: 8px;
            }

            #tab-list::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.3);
                border-radius: 4px;
            }

            #tab-list::-webkit-scrollbar-thumb {
                background: rgba(136, 136, 136, 0.4);
                border-radius: 4px;
            }

            #tab-list::-webkit-scrollbar-thumb:hover {
                background: rgba(136, 136, 136, 0.6);
            }

            #tab-list li {
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: pointer;
                padding: 14px 16px;
                margin: 8px 0;
                background-color: rgba(255, 255, 255, 0.9);
                transition: all 0.3s ease;
                border-radius: 14px;
                box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
                backdrop-filter: blur(5px);
                border: 1px solid rgba(255, 255, 255, 0.3);
            }

            #tab-list li > .close-btn {
                float: right;
                vertical-align: middle;
                justify-content: center;
                padding: 6px;
                border-radius: 50%;
                width: 26px;
                height: 26px;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: #f1f3f4;
                color: #666;
                border: none;
                cursor: pointer;
                transition: all 0.2s ease;
                font-size: 14px;
                font-weight: bold;
            }

            #tab-list li > .close-btn:hover {
                background-color: #ff4757;
                color: white;
                transform: scale(1.1);
            }

            #tab-list li:hover {
                background-color: rgba(248, 250, 252, 0.95);
                transform: translateY(-2px);
                box-shadow: 0 6px 15px rgba(0, 0, 0, 0.12);
            }

            #tab-list li.selected {
                background: linear-gradient(90deg, #e8f0fe, #d2e3fc);
                border: 1px solid #a0c3ff;
                box-shadow: 0 4px 10px rgba(66, 133, 244, 0.2);
            }

            .li-icon {
                margin-left: 0;
                border-radius: 6px;
                width: 20px;
                height: 20px;
            }

            .tab-title {
                font-weight: 600;
                max-width: 280px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                font-size: 14px;
                color: #202124;
            }

            .tab-url-hostname {
                color: #5f6368;
                font-size: 12px;
                margin-top: 3px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 280px;
            }

            .li-item {
                width: 90%;
                padding: 0 0 0 12px;
                display: flex;
                flex-direction: column;
                justify-content: center;
            }

            .popup-close-btn {
                position: absolute;
                top: 10px;
                right: 10px;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.7);
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                color: #666;
                z-index: 1000001;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }

            .popup-close-btn:hover {
                background: #ff4757;
                color: white;
            }
        `,

        getTemplate: function() {
            let imageUrl;
            try {
                imageUrl = chrome.runtime.getURL('images/magnifying-glass.png');
            } catch(e) {
                // 如果chrome.runtime不可用，使用base64编码的占位符图像
                imageUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="%23666" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>';
            }
            
            return `
                <div class="my-tab-search-popup" id="my-tab-search-popup">
                    <button class="popup-close-btn" id="close-popup">✕</button>
                    <div class="search-container">
                        <img id="magnifying-glass" src="${imageUrl}" alt="搜索"/>
                        <input id="search-input" aria-label="搜索已打开的标签页" type="text" placeholder="搜索已打开的标签页...">
                        <div id="tab-count">Loading...</div>
                    </div>
                    <ul id="tab-list"></ul>
                </div>
            `;
        }
    };

    // Add styles to the document
    const styleSheet = document.createElement('style');
    styleSheet.textContent = layout.styles;
    document.head.appendChild(styleSheet);

    // Add the popup HTML to the page
    document.body.insertAdjacentHTML('beforeend', layout.getTemplate());

    // Now add the functionality
    initializePopup();

    function initializePopup() {
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

            // 使用 chrome.tabs.query 查询标签页
            chrome.tabs.query({windowType: 'normal'}, (tabs) => {
                if (chrome.runtime.lastError) {
                    console.error('获取标签页数据失败:', chrome.runtime.lastError);
                    return;
                }

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
                        try {
                            urlHostNameDiv.textContent = new URL(tab.url).hostname;
                        } catch (e) {
                            // 如果URL无效，使用完整的URL
                            urlHostNameDiv.textContent = tab.url;
                        }

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
                            // 发送消息到background脚本切换标签页
                            chrome.runtime.sendMessage({
                                action: "switchToTab",
                                data: {
                                    tabId: tab.id,
                                    windowId: tab.windowId
                                }
                            });
                            // 关闭弹窗
                            closePopup();
                        });

                        tabList.appendChild(li);
                        tabIdMap.set(i++, tab.id);
                    } catch (error) {
                        // 如果try块中抛出错误，这里将捕获到错误
                        console.error("An error occurred:", error.message);
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
            try {
                // 在内容脚本中构建favicon URL
                return chrome.runtime.getURL('/_favicon/?pageUrl=' + encodeURIComponent(u) + '&size=26');
            } catch (e) {
                // 如果出错，返回一个默认图标
                try {
                    return chrome.runtime.getURL('images/icon-16.png');
                } catch(e2) {
                    // 如果连默认图标都无法获取，返回base64编码的占位符
                    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><rect width="16" height="16" fill="%23e0e0e0"/><circle cx="8" cy="8" r="6" fill="%23bdbdbd"/></svg>';
                }
            }
        }

        // 处理List item 关闭标签事件
        function handleCloseBtnClicked(tabId) {
            if (tabId !== undefined) {
                chrome.runtime.sendMessage({action: "closeTab", tabId: tabId}, (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn('关闭标签页失败:', chrome.runtime.lastError.message);
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
                // 获取标签页信息，然后发送切换消息
                chrome.tabs.get(tabId, (tab) => {
                    if (chrome.runtime.lastError) {
                        console.warn('获取标签页信息失败:', chrome.runtime.lastError.message);
                        return;
                    }
                    
                    const windowId = tab.windowId;
                    chrome.runtime.sendMessage({
                        action: "switchToTab",
                        data: {
                            tabId: tabId,
                            windowId: windowId
                        }
                    });
                    closePopup();
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
                    behavior: behavior === undefined ? 'smooth' : 'auto'
                });
            }
        }

        // Add keyboard event listeners
        document.addEventListener("keydown", function (event) {
            if (!isPopupActive) return;
            
            if (event.key === "Escape") {
                closePopup();
                return;
            }
            
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

        // event listener for search input changes
        searchInput.addEventListener("input", updateTabs);

        // initial tab update
        updateTabs();
    }

    // Add event listener to close button
    document.getElementById('close-popup').addEventListener('click', closePopup);

    function closePopup() {
        const popup = document.getElementById('my-tab-search-popup');
        if (popup) {
            popup.style.opacity = '0';
            popup.style.transform = 'translateY(-10px)';
            
            setTimeout(() => {
                const popupElement = document.getElementById('my-tab-search-popup');
                const styleSheet = document.querySelector(`style:contains("${layout.styles.substring(0, 50)}")`);
                
                if (popupElement) {
                    popupElement.remove();
                }
                if (styleSheet) {
                    styleSheet.remove();
                }
                
                isPopupActive = false;
            }, 300);
        }
    }

    // Function to show the popup
    function showPopup() {
        const popup = document.getElementById('my-tab-search-popup');
        if (popup) {
            popup.style.display = 'block';
            popup.style.opacity = '1';
            popup.style.transform = 'translateY(0)';
            isPopupActive = true;
            
            // Focus on search input
            const searchInput = document.getElementById("search-input");
            if (searchInput) {
                searchInput.focus();
            }
        }
    }

    // Listen for messages from background script to show the popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "showTabSearchPopup") {
            // Show the popup if not already shown
            const existingPopup = document.getElementById('my-tab-search-popup');
            if (!existingPopup) {
                // Add the popup to the page
                document.body.insertAdjacentHTML('beforeend', layout.getTemplate());
                
                // Add event listener for close button
                document.getElementById('close-popup').addEventListener('click', closePopup);
                
                // Initialize functionality
                initializePopup();
            } else {
                showPopup();
            }
            
            sendResponse({success: true});
            return true; // Keep message channel open for async response
        }
    });

    isPopupActive = true;
})();