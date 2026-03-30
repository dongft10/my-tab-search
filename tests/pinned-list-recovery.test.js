/**
 * 自动化测试：固定Tab列表恢复功能
 * 测试浏览器崩溃/强制关闭后，tabId失效时的恢复逻辑
 */

// 模拟 Chrome API
const mockChromeAPI = () => {
  const state = {
    tabs: [],
    windows: [{ id: 1, focused: true }],
    storage: { pinnedTabs: [] },
    createdTabs: [],
    lastActiveTabId: null,
    lastFocusedWindowId: null
  };

  const chrome = {
    tabs: {
      get: async (tabId) => {
        const tab = state.tabs.find(t => t.id === tabId);
        if (!tab) {
          throw new Error(`Tab ${tabId} not found`);
        }
        return tab;
      },
      query: async (queryObj) => {
        if (queryObj.url) {
          return state.tabs.filter(t => t.url === queryObj.url);
        }
        return [...state.tabs];
      },
      update: async (tabId, updateProps) => {
        const tab = state.tabs.find(t => t.id === tabId);
        if (tab && updateProps.active) {
          state.lastActiveTabId = tabId;
        }
        return tab;
      },
      create: async (createProps) => {
        const newTab = {
          id: 1000 + state.createdTabs.length,
          url: createProps.url,
          windowId: 1,
          active: createProps.active !== false
        };
        state.tabs.push(newTab);
        state.createdTabs.push(newTab);
        return newTab;
      }
    },
    windows: {
      update: async (windowId, updateProps) => {
        if (updateProps.focused) {
          state.lastFocusedWindowId = windowId;
        }
        return state.windows.find(w => w.id === windowId);
      }
    },
    storage: {
      local: {
        get: async (key) => {
          if (key === 'pinnedTabs') {
            return { pinnedTabs: [...state.storage.pinnedTabs] };
          }
          return {};
        },
        set: async (data) => {
          if (data.pinnedTabs) {
            state.storage.pinnedTabs = [...data.pinnedTabs];
          }
        }
      }
    }
  };

  return { chrome, state };
};

// 提取 switchToTab 核心逻辑（不依赖 window.close）
async function switchToTabCore(tabId, chrome) {
  try {
    let tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch (e) {
      // tab不存在，后续处理
    }
    
    if (tab) {
      await chrome.tabs.update(tabId, { active: true });
      if (tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
      return { success: true, action: 'direct_switch', tabId };
    }
    
    const result = await chrome.storage.local.get('pinnedTabs');
    const pinnedTabs = result.pinnedTabs || [];
    const targetTab = pinnedTabs.find(t => t.tabId === tabId);
    
    if (!targetTab) {
      console.warn('[switchToTab] Target tab not found in pinned list:', tabId);
      return { success: false, action: 'not_found', tabId };
    }
    
    const existingTabs = await chrome.tabs.query({ url: targetTab.url });
    
    if (existingTabs.length > 0) {
      const existingTab = existingTabs[0];
      const updatedTabs = pinnedTabs.map(t => {
        if (t.tabId === tabId) {
          return { ...t, tabId: existingTab.id };
        }
        return t;
      });
      await chrome.storage.local.set({ pinnedTabs: updatedTabs });
      await chrome.tabs.update(existingTab.id, { active: true });
      if (existingTab.windowId) {
        await chrome.windows.update(existingTab.windowId, { focused: true });
      }
      return { success: true, action: 'url_match_switch', oldTabId: tabId, newTabId: existingTab.id, url: targetTab.url };
    } else {
      const newTab = await chrome.tabs.create({ url: targetTab.url });
      const updatedTabs = pinnedTabs.map(t => {
        if (t.tabId === tabId) {
          return { ...t, tabId: newTab.id };
        }
        return t;
      });
      await chrome.storage.local.set({ pinnedTabs: updatedTabs });
      return { success: true, action: 'create_new_tab', oldTabId: tabId, newTabId: newTab.id, url: targetTab.url };
    }
  } catch (error) {
    console.error('Switch to tab error:', error);
    return { success: false, action: 'error', error: error.message, tabId };
  }
}

// 测试用例
async function runTests() {
  const results = [];
  
  console.log('========================================');
  console.log('固定Tab恢复功能自动化测试');
  console.log('========================================\n');
  
  // 测试1: 正常情况 - tabId有效
  console.log('测试1: 正常情况 - tabId有效');
  {
    const { chrome, state } = mockChromeAPI();
    state.tabs = [
      { id: 100, url: 'https://www.google.com', windowId: 1 },
      { id: 101, url: 'https://www.github.com', windowId: 1 }
    ];
    state.storage.pinnedTabs = [
      { tabId: 100, url: 'https://www.google.com', title: 'Google' }
    ];
    
    const result = await switchToTabCore(100, chrome);
    
    const passed = result.success && result.action === 'direct_switch' && state.lastActiveTabId === 100;
    results.push({ name: '测试1', passed, result, expected: '直接切换到已存在的tab' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  详情: action=${result.action}, lastActiveTabId=${state.lastActiveTabId}\n`);
  }
  
  // 测试2: 场景1 - 浏览器崩溃恢复后，tabId失效但URL匹配的tab存在
  console.log('测试2: 场景1 - tabId失效，URL匹配的tab存在（浏览器恢复后场景）');
  {
    const { chrome, state } = mockChromeAPI();
    // 模拟浏览器恢复后：tab存在但id变了
    state.tabs = [
      { id: 200, url: 'https://www.google.com', windowId: 1 }, // 新id=200
      { id: 201, url: 'https://www.github.com', windowId: 1 }
    ];
    // localStorage中存储的是旧的tabId
    state.storage.pinnedTabs = [
      { tabId: 999, url: 'https://www.google.com', title: 'Google' } // 旧id=999，已失效
    ];
    
    const result = await switchToTabCore(999, chrome);
    
    const passed = result.success 
      && result.action === 'url_match_switch' 
      && result.oldTabId === 999 
      && result.newTabId === 200
      && state.storage.pinnedTabs[0].tabId === 200; // 验证tabId已更新
    
    results.push({ name: '测试2', passed, result, expected: '通过URL匹配找到tab，更新tabId' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  详情: action=${result.action}, oldTabId=${result.oldTabId}, newTabId=${result.newTabId}`);
    console.log(`  tabId已更新: ${state.storage.pinnedTabs[0].tabId === 200 ? '是' : '否'}\n`);
  }
  
  // 测试3: 场景2 - tabId失效且URL匹配的tab不存在，需要新建
  console.log('测试3: 场景2 - tabId失效且URL匹配的tab不存在，创建新tab');
  {
    const { chrome, state } = mockChromeAPI();
    state.tabs = [
      { id: 300, url: 'https://www.github.com', windowId: 1 }
    ];
    // localStorage中存储的是已关闭的tab
    state.storage.pinnedTabs = [
      { tabId: 888, url: 'https://www.google.com', title: 'Google' } // tab已关闭
    ];
    
    const result = await switchToTabCore(888, chrome);
    
    const passed = result.success 
      && result.action === 'create_new_tab' 
      && result.oldTabId === 888 
      && result.newTabId === 1000 // 新创建的tab id
      && state.storage.pinnedTabs[0].tabId === 1000; // 验证tabId已更新
    
    results.push({ name: '测试3', passed, result, expected: '创建新tab并更新tabId' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  详情: action=${result.action}, oldTabId=${result.oldTabId}, newTabId=${result.newTabId}`);
    console.log(`  新tab已创建: ${state.createdTabs.length === 1 ? '是' : '否'}`);
    console.log(`  tabId已更新: ${state.storage.pinnedTabs[0].tabId === 1000 ? '是' : '否'}\n`);
  }
  
  // 测试4: 场景3 - 长期固定tab，tabId失效但URL存在
  console.log('测试4: 场景3 - 长期固定tab，tabId失效但URL存在');
  {
    const { chrome, state } = mockChromeAPI();
    state.tabs = [
      { id: 400, url: 'https://www.example.com', windowId: 1 }
    ];
    state.storage.pinnedTabs = [
      { tabId: 777, url: 'https://www.example.com', title: 'Example', isLongTermPinned: true }
    ];
    
    const result = await switchToTabCore(777, chrome);
    
    const passed = result.success 
      && result.action === 'url_match_switch' 
      && result.newTabId === 400
      && state.storage.pinnedTabs[0].tabId === 400;
    
    results.push({ name: '测试4', passed, result, expected: '长期固定tab也能正常恢复' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  详情: action=${result.action}, newTabId=${result.newTabId}\n`);
  }
  
  // 测试5: 边界情况 - pinnedTabs中没有对应的记录
  console.log('测试5: 边界情况 - pinnedTabs中没有对应的记录');
  {
    const { chrome, state } = mockChromeAPI();
    state.tabs = [
      { id: 500, url: 'https://www.google.com', windowId: 1 }
    ];
    state.storage.pinnedTabs = [
      { tabId: 600, url: 'https://www.github.com', title: 'GitHub' }
    ];
    
    const result = await switchToTabCore(999, chrome);
    
    const passed = !result.success && result.action === 'not_found';
    results.push({ name: '测试5', passed, result, expected: '返回not_found' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  详情: action=${result.action}\n`);
  }
  
  // 测试6: 多个固定tab场景
  console.log('测试6: 多个固定tab - 只更新目标tab的tabId');
  {
    const { chrome, state } = mockChromeAPI();
    state.tabs = [
      { id: 601, url: 'https://www.google.com', windowId: 1 },
      { id: 602, url: 'https://www.github.com', windowId: 1 },
      { id: 603, url: 'https://www.example.com', windowId: 1 }
    ];
    state.storage.pinnedTabs = [
      { tabId: 111, url: 'https://www.google.com', title: 'Google' },
      { tabId: 222, url: 'https://www.github.com', title: 'GitHub' },
      { tabId: 333, url: 'https://www.example.com', title: 'Example' }
    ];
    
    // 只恢复第二个tab
    const result = await switchToTabCore(222, chrome);
    
    const passed = result.success 
      && result.action === 'url_match_switch'
      && result.newTabId === 602
      && state.storage.pinnedTabs[0].tabId === 111 // 未变
      && state.storage.pinnedTabs[1].tabId === 602 // 已更新
      && state.storage.pinnedTabs[2].tabId === 333; // 未变
    
    results.push({ name: '测试6', passed, result, expected: '只更新目标tab的tabId，其他不变' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  详情: tabIds=[${state.storage.pinnedTabs.map(t => t.tabId).join(', ')}]`);
    console.log(`  预期: [111, 602, 333]\n`);
  }
  
  // 输出汇总
  console.log('========================================');
  console.log('测试汇总');
  console.log('========================================');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`总计: ${passed}/${total} 通过`);
  console.log('');
  
  results.forEach(r => {
    console.log(`${r.passed ? '✓' : '✗'} ${r.name}: ${r.passed ? '通过' : '失败'}`);
  });
  
  console.log('\n========================================');
  console.log('详细结果');
  console.log('========================================');
  console.log(JSON.stringify(results, null, 2));
  
  return { passed, total, results };
}

// 运行测试
runTests().then(({ passed, total }) => {
  process.exit(passed === total ? 0 : 1);
});
