/**
 * 自动化测试：URL 回退匹配机制
 * 测试 pinned-list 中的 URL 回退匹配逻辑
 */

// ============== URL 回退匹配工具函数（从 pinned-list.js 复制） ==============

/**
 * 生成 URL 回退匹配规则列表
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
 * 从多个匹配的 tab 中选择最佳的一个
 */
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
 * 按回退规则查找匹配的 tab
 */
function findTabWithFallback(targetUrl, allTabs) {
  const rules = generateUrlFallbackRules(targetUrl);

  for (const rule of rules) {
    let matchedTabs = [];

    if (rule.matchType === 'exact') {
      matchedTabs = allTabs.filter(t => t.url === rule.pattern);
    } else if (rule.matchType === 'startsWith') {
      // 确保是完整的路径段匹配，避免 /api 匹配到 /api-v2
      // 包含 /、?、# 三种边界情况
      matchedTabs = allTabs.filter(t =>
        t.url === rule.pattern ||
        t.url.startsWith(rule.pattern + '/') ||
        t.url.startsWith(rule.pattern + '?') ||
        t.url.startsWith(rule.pattern + '#')
      );
    }

    if (matchedTabs.length > 0) {
      const bestMatch = selectBestTab(matchedTabs);
      return {
        matchedTab: bestMatch,
        matchLevel: rule.level,
        matchDescription: rule.description,
        matchedUrl: bestMatch.url
      };
    }
  }

  return { matchedTab: null, matchLevel: 0, matchDescription: null, matchedUrl: null };
}

// ============== 测试用例 ==============

async function runTests() {
  const results = [];

  console.log('========================================');
  console.log('URL 回退匹配机制自动化测试');
  console.log('========================================\n');

  // 测试1: generateUrlFallbackRules - 简单 URL
  console.log('测试1: generateUrlFallbackRules - 简单 URL');
  {
    const rules = generateUrlFallbackRules('https://example.com/api/checkQuery?param=v1');

    const expected = [
      { level: 1, pattern: 'https://example.com/api/checkQuery?param=v1', matchType: 'exact' },
      { level: 2, pattern: 'https://example.com/api/checkQuery', matchType: 'startsWith' },
      { level: 3, pattern: 'https://example.com/api', matchType: 'startsWith' },
      { level: 4, pattern: 'https://example.com', matchType: 'startsWith' }
    ];

    const passed = rules.length === expected.length &&
      rules.every((r, i) => r.level === expected[i].level && r.pattern === expected[i].pattern);

    results.push({ name: '测试1', passed, expected: '生成4级回退规则' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  规则数量: ${rules.length}`);
    console.log(`  规则: ${rules.map(r => `L${r.level}:${r.pattern}`).join(', ')}\n`);
  }

  // 测试2: generateUrlFallbackRules - 复杂路径
  console.log('测试2: generateUrlFallbackRules - 复杂路径');
  {
    const rules = generateUrlFallbackRules('https://domain.com/api/v1/users/list?page=1');

    const expectedPatterns = [
      'https://domain.com/api/v1/users/list?page=1',
      'https://domain.com/api/v1/users/list',
      'https://domain.com/api/v1/users',
      'https://domain.com/api/v1',
      'https://domain.com/api',
      'https://domain.com'
    ];

    const passed = rules.length === expectedPatterns.length &&
      rules.every((r, i) => r.pattern === expectedPatterns[i]);

    results.push({ name: '测试2', passed, expected: '生成6级回退规则（复杂路径）' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  规则数量: ${rules.length}`);
    console.log(`  规则: ${rules.map(r => `L${r.level}:${r.pattern}`).join(', ')}\n`);
  }

  // 测试3: generateUrlFallbackRules - 无效 URL
  console.log('测试3: generateUrlFallbackRules - 无效 URL');
  {
    const rules = generateUrlFallbackRules('not-a-valid-url');

    const passed = rules.length === 1 && rules[0].level === 1 && rules[0].matchType === 'exact';

    results.push({ name: '测试3', passed, expected: '无效URL返回单条规则' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  规则: ${JSON.stringify(rules[0])}\n`);
  }

  // 测试4: selectBestTab - 优先选择 active tab
  console.log('测试4: selectBestTab - 优先选择 active tab');
  {
    const tabs = [
      { id: 1, url: 'https://a.com', active: false, lastAccessed: 1000 },
      { id: 2, url: 'https://b.com', active: true, lastAccessed: 500 },
      { id: 3, url: 'https://c.com', active: false, lastAccessed: 2000 }
    ];

    const best = selectBestTab(tabs);
    const passed = best.id === 2; // active tab

    results.push({ name: '测试4', passed, expected: '选择 active tab' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  选择: tab id=${best.id}, active=${best.active}\n`);
  }

  // 测试5: selectBestTab - 无 active 时选择最近访问
  console.log('测试5: selectBestTab - 无 active 时选择最近访问');
  {
    const tabs = [
      { id: 1, url: 'https://a.com', active: false, lastAccessed: 1000 },
      { id: 2, url: 'https://b.com', active: false, lastAccessed: 3000 },
      { id: 3, url: 'https://c.com', active: false, lastAccessed: 2000 }
    ];

    const best = selectBestTab(tabs);
    const passed = best.id === 2; // lastAccessed 最大

    results.push({ name: '测试5', passed, expected: '选择 lastAccessed 最大的 tab' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  选择: tab id=${best.id}, lastAccessed=${best.lastAccessed}\n`);
  }

  // 测试6: findTabWithFallback - 完全匹配
  console.log('测试6: findTabWithFallback - 完全匹配');
  {
    const targetUrl = 'https://example.com/api/checkQuery?param=v1';
    const allTabs = [
      { id: 1, url: 'https://example.com/api/checkQuery?param=v1', active: false },
      { id: 2, url: 'https://example.com/api/checkQuery?param=v2', active: false }
    ];

    const result = findTabWithFallback(targetUrl, allTabs);
    const passed = result.matchLevel === 1 && result.matchedTab.id === 1;

    results.push({ name: '测试6', passed, expected: '完全匹配（level 1）' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  匹配级别: ${result.matchLevel}, tab id=${result.matchedTab?.id}\n`);
  }

  // 测试7: findTabWithFallback - query 参数不同（路径匹配）
  console.log('测试7: findTabWithFallback - query 参数不同（路径匹配）');
  {
    const targetUrl = 'https://example.com/api/checkQuery?param=v1';
    const allTabs = [
      { id: 1, url: 'https://example.com/api/checkQuery?param=v2', active: false },
      { id: 2, url: 'https://example.com/other', active: false }
    ];

    const result = findTabWithFallback(targetUrl, allTabs);
    const passed = result.matchLevel === 2 && result.matchedTab.id === 1;

    results.push({ name: '测试7', passed, expected: '路径匹配（level 2）' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  匹配级别: ${result.matchLevel}, tab id=${result.matchedTab?.id}, url=${result.matchedUrl}\n`);
  }

  // 测试8: findTabWithFallback - 同路径下不同页面（父路径匹配）
  console.log('测试8: findTabWithFallback - 同路径下不同页面（父路径匹配）');
  {
    const targetUrl = 'https://example.com/api/checkQuery?param=v1';
    const allTabs = [
      { id: 1, url: 'https://example.com/api/list?page=1', active: false },
      { id: 2, url: 'https://other.com/page', active: false }
    ];

    const result = findTabWithFallback(targetUrl, allTabs);
    const passed = result.matchLevel === 3 && result.matchedTab.id === 1;

    results.push({ name: '测试8', passed, expected: '父路径匹配（level 3）' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  匹配级别: ${result.matchLevel}, tab id=${result.matchedTab?.id}, url=${result.matchedUrl}\n`);
  }

  // 测试9: findTabWithFallback - 同域名下不同路径（域名匹配）
  console.log('测试9: findTabWithFallback - 同域名下不同路径（域名匹配）');
  {
    const targetUrl = 'https://example.com/api/checkQuery?param=v1';
    const allTabs = [
      { id: 1, url: 'https://example.com/dashboard', active: false },
      { id: 2, url: 'https://other.com/page', active: false }
    ];

    const result = findTabWithFallback(targetUrl, allTabs);
    const passed = result.matchLevel === 4 && result.matchedTab.id === 1;

    results.push({ name: '测试9', passed, expected: '域名匹配（level 4）' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  匹配级别: ${result.matchLevel}, tab id=${result.matchedTab?.id}, url=${result.matchedUrl}\n`);
  }

  // 测试10: findTabWithFallback - 无匹配
  console.log('测试10: findTabWithFallback - 无匹配');
  {
    const targetUrl = 'https://example.com/api/checkQuery?param=v1';
    const allTabs = [
      { id: 1, url: 'https://other.com/page', active: false },
      { id: 2, url: 'https://another.com/test', active: false }
    ];

    const result = findTabWithFallback(targetUrl, allTabs);
    const passed = result.matchedTab === null && result.matchLevel === 0;

    results.push({ name: '测试10', passed, expected: '无匹配返回 null' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  匹配级别: ${result.matchLevel}, matchedTab=${result.matchedTab}\n`);
  }

  // 测试11: findTabWithFallback - 边界处理：hash URL
  console.log('测试11: findTabWithFallback - 边界处理：hash URL');
  {
    const targetUrl = 'https://example.com/api';
    const allTabs = [
      { id: 1, url: 'https://example.com/api#section1', active: false }
    ];

    const result = findTabWithFallback(targetUrl, allTabs);
    const passed = result.matchLevel === 2 && result.matchedTab.id === 1;

    results.push({ name: '测试11', passed, expected: 'hash URL 边界处理' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  匹配级别: ${result.matchLevel}, tab id=${result.matchedTab?.id}\n`);
  }

  // 测试12: findTabWithFallback - 避免误匹配（/api 不应匹配 /api-v2）
  console.log('测试12: findTabWithFallback - 避免误匹配');
  {
    const targetUrl = 'https://example.com/api/check';
    const allTabs = [
      { id: 1, url: 'https://example.com/api-v2/check', active: false }
    ];

    const result = findTabWithFallback(targetUrl, allTabs);
    // 应该匹配到域名级别（对于2级路径，域名是level 3）
    const passed = result.matchLevel === 3 && result.matchedTab.id === 1;

    results.push({ name: '测试12', passed, expected: '避免误匹配 /api-v2，匹配到域名级别' });
    console.log(`  结果: ${passed ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  匹配级别: ${result.matchLevel}, tab id=${result.matchedTab?.id}\n`);
  }

  // 测试总结
  console.log('========================================');
  console.log('测试总结');
  console.log('========================================');
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  console.log(`通过: ${passedCount}/${totalCount}`);
  console.log(`通过率: ${(passedCount / totalCount * 100).toFixed(1)}%`);

  if (passedCount === totalCount) {
    console.log('\n✓ 所有测试通过！');
  } else {
    console.log('\n✗ 部分测试失败：');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.expected}`);
    });
  }

  return { passed: passedCount === totalCount, results };
}

// 运行测试
runTests().then(({ passed }) => {
  process.exit(passed ? 0 : 1);
}).catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});
