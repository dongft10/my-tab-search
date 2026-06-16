/**
 * 自动化测试：取消固定Tab功能
 * 测试服务器同步的长期固定tab取消固定功能
 */

// 模拟 Chrome API
const mockChromeAPI = () => {
  const state = {
    tabs: [],
    windows: [{ id: 1, focused: true }],
    storage: { pinnedTabs: [] },
    consoleLogs: []
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
        if (queryObj && queryObj.url) {
          return state.tabs.filter(t => t.url === queryObj.url);
        }
        return [...state.tabs];
      },
      remove: async (tabId) => {
        const index = state.tabs.findIndex(t => t.id === tabId);
        if (index !== -1) {
          state.tabs.splice(index, 1);
        }
      }
    },
    windows: {
      update: async (windowId, updateProps) => {
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
        },
        remove: async (keys) => {
          // No-op for test
        }
      }
    }
  };

  // Mock console
  const originalConsole = {
    log: console.log,
    error: console.error,
    info: console.info
  };

  return { chrome, state };
};

// 提取 removeFromPinnedList 核心逻辑
async function removeFromPinnedListCore(tabId, tabUrl, chrome, mockConsole = null) {
  try {
    const result = await chrome.storage.local.get('pinnedTabs');
    let pinnedTabs = result.pinnedTabs || [];

    // 优先使用 URL 匹配（服务器同步的tab没有有效tabId）
    const targetTab = pinnedTabs.find(t =>
      (tabUrl && t.url === tabUrl) || (tabId !== undefined && tabId !== null && t.tabId === tabId)
    );

    // 检查是否是长期固定的tab，如果是则不执行移除
    if (targetTab && targetTab.isLongTermPinned) {
      if (mockConsole) mockConsole.log('[removeFromPinnedList] Cannot remove long-term pinned tab:', tabId, tabUrl);
      return { success: false, reason: 'long_term_pinned', tabId, tabUrl };
    }

    // 找到要移除的标签页的索引
    const removedIndex = pinnedTabs.findIndex(tab =>
      (tabUrl && tab.url === tabUrl) || (tabId !== undefined && tabId !== null && tab.tabId === tabId)
    );

    if (removedIndex === -1) {
      return { success: false, reason: 'not_found', tabId, tabUrl };
    }

    // 过滤掉要移除的标签页
    pinnedTabs = pinnedTabs.filter(tab =>
      !((tabUrl && tab.url === tabUrl) || (tabId !== undefined && tabId !== null && tab.tabId === tabId))
    );

    // 保存到存储
    await chrome.storage.local.set({ pinnedTabs });

    return {
      success: true,
      removedIndex,
      remainingCount: pinnedTabs.length,
      tabId,
      tabUrl
    };
  } catch (error) {
    if (mockConsole) mockConsole.error('Error removing from pinned list:', error);
    return { success: false, reason: 'error', error: error.message, tabId, tabUrl };
  }
}

// 测试用例
async function runTests() {
  const results = [];
  const consoleLogs = [];
  const mockConsole = {
    log: (...args) => consoleLogs.push(['log', ...args]),
    error: (...args) => consoleLogs.push(['error', ...args]),
    info: (...args) => consoleLogs.push(['info', ...args])
  };

  console.log('========================================');
  console.log('取消固定Tab功能自动化测试');
  console.log('测试服务器同步tab的取消固定功能');
  console.log('========================================\n');

  // 测试1: 正常情况 - tabId有效，非长期固定
  console.log('测试1: 正常情况 - tabId有效，非长期固定');
  {
    const { chrome, state } = mockChromeAPI();
    state.storage.pinnedTabs = [
      { tabId: 100, url: 'https://www.google.com', title: 'Google', isLongTermPinned: false },
      { tabId: 101, url: 'https://www.github.com', title: 'GitHub', isLongTermPinned: false }
    ];

    // 只传tabId，不传url（旧代码行为）
    const result = await removeFromPinnedListCore(100, null, chrome, mockConsole);

    const passed = result.success && result.remainingCount === 1;
    results.push({ name: '测试1', passed, result, expected: '正常移除' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  详情: success=${result.success}, remainingCount=${result.remainingCount}\n`);
  }

  // 测试2: BUG场景 - 服务器同步的长期固定tab，取消长期固定后再取消固定
  console.log('测试2: BUG场景 - 服务器同步tab，tabId无效，只传tabId（旧代码BUG）');
  {
    const { chrome, state } = mockChromeAPI();
    // 模拟服务器同步的tab，tabId无效（undefined或不存在）
    state.storage.pinnedTabs = [
      { tabId: undefined, url: 'https://www.synced-tab.com', title: 'Synced Tab', isLongTermPinned: false }
    ];

    // 旧代码：只传tabId（undefined），不传url -> 无法匹配，操作无效
    const result = await removeFromPinnedListCore(undefined, null, chrome, mockConsole);

    const passed = !result.success && result.reason === 'not_found';
    results.push({ name: '测试2-旧代码BUG', passed, result, expected: '无法找到目标tab，操作无效（这是BUG）' });
    console.log(`  结果: ${passed ? '✓ 通过（复现BUG）' : '✗ 失败'}`);
    console.log(`  详情: success=${result.success}, reason=${result.reason}`);
    console.log(`  说明: 这展示了旧代码的BUG行为\n`);
  }

  // 测试3: 修复后 - 服务器同步tab，传递url参数（修复后行为）
  console.log('测试3: 修复后 - 服务器同步tab，传递url参数');
  {
    const { chrome, state } = mockChromeAPI();
    state.storage.pinnedTabs = [
      { tabId: undefined, url: 'https://www.synced-tab.com', title: 'Synced Tab', isLongTermPinned: false }
    ];

    // 修复后：传递url参数 -> 通过url匹配成功
    const result = await removeFromPinnedListCore(undefined, 'https://www.synced-tab.com', chrome, mockConsole);

    const passed = result.success && result.remainingCount === 0;
    results.push({ name: '测试3-修复后', passed, result, expected: '通过url匹配成功移除' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  详情: success=${result.success}, remainingCount=${result.remainingCount}`);
    console.log(`  说明: 修复后传递url参数，可以正常移除\n`);
  }

  // 测试4: 完整流程 - 取消长期固定后再取消固定
  console.log('测试4: 完整流程 - 先取消长期固定，再取消固定');
  {
    const { chrome, state } = mockChromeAPI();
    // 模拟服务器同步的长期固定tab
    state.storage.pinnedTabs = [
      { tabId: undefined, url: 'https://www.synced-tab.com', title: 'Synced Tab', isLongTermPinned: true }
    ];

    // 第一步：取消长期固定
    const updatedTabs = state.storage.pinnedTabs.map(t => {
      if (t.url === 'https://www.synced-tab.com') {
        return { ...t, isLongTermPinned: false };
      }
      return t;
    });
    await chrome.storage.local.set({ pinnedTabs: updatedTabs });

    // 第二步：取消固定（使用修复后的方式，传递url）
    const result = await removeFromPinnedListCore(undefined, 'https://www.synced-tab.com', chrome, mockConsole);

    const passed = result.success && result.remainingCount === 0;
    results.push({ name: '测试4-完整流程', passed, result, expected: '取消长期固定后可以正常取消固定' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  详情: success=${result.success}, remainingCount=${result.remainingCount}\n`);
  }

  // 测试5: 长期固定tab直接取消固定 - 应该被阻止
  console.log('测试5: 长期固定tab直接取消固定 - 应该被阻止');
  {
    const { chrome, state } = mockChromeAPI();
    state.storage.pinnedTabs = [
      { tabId: undefined, url: 'https://www.synced-tab.com', title: 'Synced Tab', isLongTermPinned: true }
    ];

    // 直接尝试取消固定（不先取消长期固定）
    const result = await removeFromPinnedListCore(undefined, 'https://www.synced-tab.com', chrome, mockConsole);

    const passed = !result.success && result.reason === 'long_term_pinned';
    results.push({ name: '测试5-阻止长期固定移除', passed, result, expected: '长期固定tab不能直接取消固定' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  详情: success=${result.success}, reason=${result.reason}\n`);
  }

  // 测试6: 多个tab混合场景
  console.log('测试6: 多个tab混合场景 - 本地tab和服务器同步tab');
  {
    const { chrome, state } = mockChromeAPI();
    state.storage.pinnedTabs = [
      { tabId: 100, url: 'https://www.local-tab.com', title: 'Local Tab', isLongTermPinned: false },
      { tabId: undefined, url: 'https://www.synced-tab.com', title: 'Synced Tab', isLongTermPinned: false }
    ];

    // 移除服务器同步的tab
    const result = await removeFromPinnedListCore(undefined, 'https://www.synced-tab.com', chrome, mockConsole);

    const passed = result.success
      && result.remainingCount === 1
      && state.storage.pinnedTabs[0].url === 'https://www.local-tab.com';
    results.push({ name: '测试6-混合场景', passed, result, expected: '正确移除服务器同步tab，保留本地tab' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  详情: success=${result.success}, remainingCount=${result.remainingCount}`);
    console.log(`  剩余: ${state.storage.pinnedTabs.map(t => t.url).join(', ')}\n`);
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
    if (!r.passed) {
      console.log(`   预期: ${r.expected}`);
      console.log(`   实际: success=${r.result.success}, reason=${r.result.reason || 'N/A'}`);
    }
  });

  console.log('\n========================================');
  console.log('修复验证');
  console.log('========================================');
  console.log('测试3和测试4验证了修复后的正确行为：');
  console.log('- 传递url参数后，服务器同步的tab可以被正确匹配和移除');
  console.log('- 取消长期固定后再取消固定，流程完整可用');
  console.log('');

  return { passed, total, results, consoleLogs };
}

// 运行测试
runTests().then(({ passed, total }) => {
  process.exit(passed === total ? 0 : 1);
});