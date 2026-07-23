import assert from 'node:assert/strict';
import { refreshTab, refreshTabIfOpen } from '../js/utils/tab-refresh.mjs';

// ====== refreshTab 测试 ======

// 测试 1: 正常刷新标签页
{
  let reloadedTabId = null;
  const mockChromeTabs = {
    async reload(id) { reloadedTabId = id; }
  };

  const result = await refreshTab(42, mockChromeTabs);
  assert.equal(result.success, true);
  assert.equal(reloadedTabId, 42);
  console.log('[PASS] refreshTab: normal refresh');
}

// 测试 2: 无效 tabId - undefined
{
  const mockChromeTabs = {
    async reload() { throw new Error('Should not be called'); }
  };

  const result = await refreshTab(undefined, mockChromeTabs);
  assert.equal(result.success, false);
  assert.equal(result.error, 'Invalid tab ID');
  console.log('[PASS] refreshTab: invalid tabId (undefined)');
}

// 测试 3: 无效 tabId - null
{
  const mockChromeTabs = {
    async reload() { throw new Error('Should not be called'); }
  };

  const result = await refreshTab(null, mockChromeTabs);
  assert.equal(result.success, false);
  assert.equal(result.error, 'Invalid tab ID');
  console.log('[PASS] refreshTab: invalid tabId (null)');
}

// 测试 4: 无效 tabId - NaN
{
  const mockChromeTabs = {
    async reload() { throw new Error('Should not be called'); }
  };

  const result = await refreshTab(NaN, mockChromeTabs);
  assert.equal(result.success, false);
  assert.equal(result.error, 'Invalid tab ID');
  console.log('[PASS] refreshTab: invalid tabId (NaN)');
}

// 测试 5: 刷新失败时返回错误信息
{
  const mockChromeTabs = {
    async reload() { throw new Error('No tab with id 999'); }
  };

  const result = await refreshTab(999, mockChromeTabs);
  assert.equal(result.success, false);
  assert.equal(result.error, 'No tab with id 999');
  console.log('[PASS] refreshTab: reload failure returns error');
}

// 测试 6: chromeTabs 为 null
{
  const result = await refreshTab(42, null);
  assert.equal(result.success, false);
  assert.equal(result.error, 'Invalid chrome.tabs API');
  console.log('[PASS] refreshTab: chromeTabs is null');
}

// 测试 7: chromeTabs 为 undefined
{
  const result = await refreshTab(42, undefined);
  assert.equal(result.success, false);
  assert.equal(result.error, 'Invalid chrome.tabs API');
  console.log('[PASS] refreshTab: chromeTabs is undefined');
}

// 测试 8: chromeTabs.reload 不是函数
{
  const result = await refreshTab(42, { reload: 'not-a-function' });
  assert.equal(result.success, false);
  assert.equal(result.error, 'Invalid chrome.tabs API');
  console.log('[PASS] refreshTab: chromeTabs.reload is not a function');
}

// 测试 9: 字符串类型 tabId 应被拒绝
{
  const mockChromeTabs = {
    async reload() { throw new Error('Should not be called'); }
  };

  const result = await refreshTab('42', mockChromeTabs);
  assert.equal(result.success, false);
  assert.equal(result.error, 'Invalid tab ID');
  console.log('[PASS] refreshTab: string tabId rejected');
}

// ====== refreshTabIfOpen 测试 ======

// 测试 10: tab 存在时正常刷新
{
  let reloadedTabId = null;
  const mockChromeTabs = {
    async get(id) { return { id, title: 'Test Tab' }; },
    async reload(id) { reloadedTabId = id; }
  };

  const result = await refreshTabIfOpen(42, mockChromeTabs);
  assert.equal(result.success, true);
  assert.equal(result.skipped, false);
  assert.equal(reloadedTabId, 42);
  console.log('[PASS] refreshTabIfOpen: refresh when tab exists');
}

// 测试 11: tab 不存在时静默跳过
{
  let reloadCalled = false;
  const mockChromeTabs = {
    async get() { throw new Error('No tab with id 999'); },
    async reload() { reloadCalled = true; }
  };

  const result = await refreshTabIfOpen(999, mockChromeTabs);
  assert.equal(result.success, false);
  assert.equal(result.skipped, true);
  assert.equal(reloadCalled, false);
  console.log('[PASS] refreshTabIfOpen: skip silently when tab not found');
}

// 测试 12: 无效 tabId 时跳过
{
  const mockChromeTabs = {
    async get() { throw new Error('Should not be called'); },
    async reload() { throw new Error('Should not be called'); }
  };

  const result = await refreshTabIfOpen(undefined, mockChromeTabs);
  assert.equal(result.success, false);
  assert.equal(result.skipped, true);
  console.log('[PASS] refreshTabIfOpen: skip on invalid tabId');
}

// 测试 13: tab 存在但刷新失败时跳过
{
  const mockChromeTabs = {
    async get(id) { return { id, title: 'Test Tab' }; },
    async reload() { throw new Error('Reload failed'); }
  };

  const result = await refreshTabIfOpen(42, mockChromeTabs);
  assert.equal(result.success, false);
  assert.equal(result.skipped, true);
  console.log('[PASS] refreshTabIfOpen: skip when reload fails');
}

// 测试 14: tabId 为 0 时应正常处理（合法 tabId）
{
  let reloadedTabId = null;
  const mockChromeTabs = {
    async get(id) { return { id, title: 'Test Tab' }; },
    async reload(id) { reloadedTabId = id; }
  };

  const result = await refreshTabIfOpen(0, mockChromeTabs);
  assert.equal(result.success, true);
  assert.equal(result.skipped, false);
  assert.equal(reloadedTabId, 0);
  console.log('[PASS] refreshTabIfOpen: tabId 0 is valid');
}

// 测试 15: chromeTabs 为 null 时跳过
{
  const result = await refreshTabIfOpen(42, null);
  assert.equal(result.success, false);
  assert.equal(result.skipped, true);
  assert.equal(result.error, 'Invalid chrome.tabs API');
  console.log('[PASS] refreshTabIfOpen: skip when chromeTabs is null');
}

console.log('\n[SUCCESS] All 15 tab-refresh tests passed!');
