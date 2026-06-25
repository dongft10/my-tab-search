/**
 * 自动化测试：shouldSync() 逻辑验证
 * 验证同步队列判断逻辑：只有长期固定标签页数据变动时才触发同步
 */

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

// 旧版 shouldSync（有 bug：取消长期固定时不触发同步）
function oldShouldSync(queue) {
  if (queue.length > 0) {
    const longTermPinnedQueue = queue.filter(item =>
      (item.data && (item.data.isLongTermPinned || item.data.longTermPinnedAt)) ||
      (item.isLongTermPinned && item.longTermPinnedAt)
    );
    return longTermPinnedQueue.length > 0;
  }
  return true;
}

// 修复后的 shouldSync（检查键是否存在，而非值是否为真）
function shouldSync(queue) {
  // 只有长期固定标签页数据变动时才需要同步到服务器
  // 普通 pinTab/unpinTab 是本地浏览器操作，不需要跨设备同步
  if (queue.length > 0) {
    const longTermPinnedQueue = queue.filter(item =>
      (item.data && ('isLongTermPinned' in item.data || 'longTermPinnedAt' in item.data)) ||
      (item.isLongTermPinned !== undefined && item.longTermPinnedAt !== undefined)
    );
    return longTermPinnedQueue.length > 0;
  }
  // 队列为空，也需要同步以从服务器获取最新数据
  return true;
}

// ============ 测试用例 ============

function test1_emptyQueue() {
  console.log('\n【测试1】空队列应该触发同步（从服务器获取数据）');
  assert(shouldSync([]) === true, '空队列返回 true');
}

function test2_setLongTermPinned() {
  console.log('\n【测试2】设置长期固定操作应该触发同步');

  const queue = [
    { type: 'updateTab', data: { tabId: 100, isLongTermPinned: true, longTermPinnedAt: '2026-01-01' } }
  ];

  assert(oldShouldSync(queue) === true, '旧版：设置长期固定返回 true');
  assert(shouldSync(queue) === true, '新版：设置长期固定返回 true');
}

function test3_cancelLongTermPinned() {
  console.log('\n【测试3】取消长期固定操作应该触发同步（旧版 BUG）');

  const queue = [
    { type: 'updateTab', data: { tabId: 100, isLongTermPinned: false, longTermPinnedAt: null } }
  ];

  assert(oldShouldSync(queue) === false, '旧版：取消长期固定返回 false（BUG！isLongTermPinned=false 被当作非长期固定操作）');
  assert(shouldSync(queue) === true, '新版：取消长期固定返回 true（已修复，检查键是否存在）');
}

function test4_updateTabWithoutLongTerm() {
  console.log('\n【测试4】普通 updateTab 操作不应该触发同步');

  const queue = [
    { type: 'updateTab', data: { tabId: 100, title: 'New Title' } }
  ];

  assert(shouldSync(queue) === false, '普通 updateTab 返回 false');
}

function test5_mixedOperations() {
  console.log('\n【测试5】混合操作（包含长期固定）应该触发同步');

  const queue = [
    { type: 'updateTab', data: { tabId: 100, title: 'Updated' } },
    { type: 'updateTab', data: { tabId: 200, isLongTermPinned: true, longTermPinnedAt: '2026-01-01' } }
  ];

  assert(shouldSync(queue) === true, '混合操作中有长期固定，返回 true');
}

function test6_onlyNonLongTermOperations() {
  console.log('\n【测试6】只有非长期固定操作不应该触发同步');

  const queue = [
    { type: 'updateTab', data: { tabId: 100, title: 'Updated 1' } },
    { type: 'updateTab', data: { tabId: 200, title: 'Updated 2' } }
  ];

  assert(shouldSync(queue) === false, '只有非长期固定操作，返回 false');
}

function test7_longTermPinnedAtOnly() {
  console.log('\n【测试7】只有 longTermPinnedAt 字段也应该触发同步');

  const queue = [
    { type: 'updateTab', data: { tabId: 100, longTermPinnedAt: '2026-01-01' } }
  ];

  assert(shouldSync(queue) === true, '有 longTermPinnedAt 字段，返回 true');
}

function test8_legacyFormat() {
  console.log('\n【测试8】兼容旧格式（isLongTermPinned 在顶层）');

  const queue = [
    { type: 'updateTab', data: { tabId: 100 }, isLongTermPinned: true, longTermPinnedAt: '2026-01-01' }
  ];

  assert(shouldSync(queue) === true, '旧格式也能正确识别，返回 true');
}

function test9_longTermTabReopen() {
  console.log('\n【测试9】长期固定 tab 重新打开（pinTab 中 URL 匹配分支）应该触发同步');

  const queue = [
    { type: 'updateTab', data: { tabId: 300, url: 'https://example.com', isLongTermPinned: true, longTermPinnedAt: '2026-06-25' } }
  ];

  assert(shouldSync(queue) === true, '长期固定 tab 重新打开，返回 true');
}

// 运行所有测试
function runAllTests() {
  console.log('========================================');
  console.log('shouldSync() 逻辑验证 - 自动化测试');
  console.log('========================================');

  test1_emptyQueue();
  test2_setLongTermPinned();
  test3_cancelLongTermPinned();
  test4_updateTabWithoutLongTerm();
  test5_mixedOperations();
  test6_onlyNonLongTermOperations();
  test7_longTermPinnedAtOnly();
  test8_legacyFormat();
  test9_longTermTabReopen();

  console.log('\n========================================');
  console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
