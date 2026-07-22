/**
 * Tab 刷新工具模块
 * 提供刷新标签页的功能，支持存在性检查
 */

/**
 * 验证 tabId 是否有效
 * @param {*} tabId - 标签页 ID
 * @returns {boolean}
 */
function isValidTabId(tabId) {
  return typeof tabId === 'number' && !isNaN(tabId);
}

/**
 * 验证 chromeTabs API 是否可用
 * @param {*} chromeTabs - chrome.tabs API
 * @returns {boolean}
 */
function isValidChromeTabs(chromeTabs) {
  return chromeTabs && typeof chromeTabs.reload === 'function';
}

/**
 * 刷新指定的标签页
 * @param {number} tabId - 标签页 ID
 * @param {object} chromeTabs - chrome.tabs API（用于测试注入）
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function refreshTab(tabId, chromeTabs) {
  if (!isValidTabId(tabId)) {
    return { success: false, error: 'Invalid tab ID' };
  }

  if (!isValidChromeTabs(chromeTabs)) {
    return { success: false, error: 'Invalid chrome.tabs API' };
  }

  try {
    await chromeTabs.reload(tabId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 刷新标签页（仅当标签页存在时）
 * 用于 pinned-list 场景，长期固定的 tab 可能未在浏览器中打开
 * @param {number} tabId - 标签页 ID
 * @param {object} chromeTabs - chrome.tabs API（用于测试注入）
 * @returns {Promise<{success: boolean, skipped: boolean, error?: string}>}
 */
export async function refreshTabIfOpen(tabId, chromeTabs) {
  if (!isValidTabId(tabId)) {
    return { success: false, skipped: true, error: 'Invalid tab ID' };
  }

  if (!isValidChromeTabs(chromeTabs)) {
    return { success: false, skipped: true, error: 'Invalid chrome.tabs API' };
  }

  try {
    // 先检查 tab 是否存在
    await chromeTabs.get(tabId);
    // tab 存在，执行刷新
    await chromeTabs.reload(tabId);
    return { success: true, skipped: false };
  } catch (error) {
    // tab 不存在或其他错误，静默忽略
    return { success: false, skipped: true };
  }
}
