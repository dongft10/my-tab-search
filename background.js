// background.js

let curTabId = null;
let preTabId = null;

// 监听标签页激活事件
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const newTabId = activeInfo.tabId;
    if (curTabId !== null && curTabId !== newTabId) {
        preTabId = curTabId;
        // 存储到storage 中，防止Service Worker 重启后丢失数据
        await chrome.storage.local.set({preTabId});
    }
    curTabId = newTabId;
});

// 监听窗口变化（切换窗口时也要记录）
chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;

    try {
        const tabs = await chrome.tabs.query({active: true, windowId});
        if (tabs.length > 0) {
            const newTabId = tabs[0].id;
            if (curTabId !== null && curTabId !== newTabId) {
                preTabId = curTabId;
                await chrome.storage.local.set({preTabId});
            }
            curTabId = newTabId;
        }
    } catch (e) {
        console.log("Error querying active tab on window focus:", e);
    }
});

// 注册快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
    if (command === "switch-to-previous-tab") {
        try {
            // 优先使用内存中的值，否则从 storage 加载
            let targetTabId = preTabId;
            if (targetTabId === null) {
                let result = await chrome.storage.local.get(["preTabId"]);
                targetTabId = result.preTabId;
            }
            if (targetTabId !== null) {
                // 激活目标标签页并聚焦窗口
                await chrome.tabs.update(targetTabId, {active: true});
                const tab = chrome.tabs.get(targetTabId);
                await chrome.windows.update(tab.windowId, {focused: true});

                // 切换后，更新记录：当前 Tab 为上一个，目标tab变成当前tab
                const temp = curTabId;
                curTabId = targetTabId;
                preTabId = temp;

                await chrome.storage.local.set({preTabId});
                console.log("快捷键按下了：preTabId=" + preTabId + " curTabId=" + curTabId);
            }
        } catch (e) {
            console.log('Could not switch to the previous tab:', e);
            // preTab 可能已经关闭，清空记录
            preTabId = null;
            await chrome.storage.local.remove("preTabId");
        }
    }
});

// 监听标签页关闭，清理无效 ID
chrome.tabs.onRemoved.addListener(async (tabId) => {
    if (curTabId === tabId) {
        curTabId = null;
    }
    if (preTabId === tabId) {
        preTabId = null;
        await chrome.storage.local.remove("preTabId");
    }
});