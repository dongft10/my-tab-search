/**
 * 搜索匹配服务
 * 处理 Tab 搜索的多种匹配模�?
 */

import authService from './auth.service.js';

class SearchMatchService {
  constructor() {
    this.storageKey = 'searchMatchMode';
    this.defaultMode = '1';  // 默认模式1：连续子字符串匹�?
  }

  /**
   * 获取当前搜索匹配模式
   * @returns {Promise<string>} - 返回模式字符�?"1", "2", "3", "4"
   */
  async getSearchMatchMode() {
    try {
      const data = await chrome.storage.local.get(this.storageKey);
      return data[this.storageKey] || this.defaultMode;
    } catch (error) {
      console.error('[SearchMatch] Get mode error:', error);
      return this.defaultMode;
    }
  }

  /**
   * 设置搜索匹配模式
   * @param {string} mode - 模式 "1", "2", "3", "4"
   * @returns {Promise}
   */
  async setSearchMatchMode(mode) {
    try {
      await chrome.storage.local.set({ [this.storageKey]: mode });
      await authService.saveSettings({ searchMatchMode: mode });
    } catch (error) {
      console.error('[SearchMatch] Set mode error:', error);
    }
  }

  /**
   * 模式1：完整关键字包含匹配
   * 用户输入内容不做拆分，作为整体进行包含匹�?
   * @param {string} keyword - 搜索关键�?
   * @param {string} text - 目标文本
   * @returns {boolean} - 是否匹配
   */
  matchMode1(keyword, text) {
    if (!keyword || keyword.length === 0) return true;
    if (!text || text.length === 0) return false;

    const lowerKeyword = keyword.toLowerCase();
    const lowerText = text.toLowerCase();
    return lowerText.includes(lowerKeyword);
  }

  /**
   * 模式2：子序列匹配
   * 用户输入内容拆分为单字符（忽略空格），按顺序匹配
   * @param {string} keyword - 搜索关键�?
   * @param {string} text - 目标文本
   * @returns {boolean} - 是否匹配
   */
  matchMode2(keyword, text) {
    if (!keyword || keyword.length === 0) return true;
    if (!text || text.length === 0) return false;

    const lowerText = text.toLowerCase();
    const chars = keyword.toLowerCase().split('').filter(c => c.length > 0 && c !== ' ');
    
    return this.subsequenceMatch(chars.join(''), lowerText);
  }

  /**
   * 子序列匹配函数：检�?keyword 是否�?text 的子序列
   * 例如�?spb" �?"spring boot" 的子序列
   * @param {string} keyword - 关键�?
   * @param {string} text - 目标文本
   * @returns {boolean} - 是否匹配
   */
  subsequenceMatch(keyword, text) {
    if (keyword.length === 0) return true;
    if (text.length === 0) return false;

    let keywordIndex = 0;

    for (let i = 0; i < text.length && keywordIndex < keyword.length; i++) {
      if (text[i] === keyword[keywordIndex]) {
        keywordIndex++;
      }
    }

    return keywordIndex === keyword.length;
  }

  /**
   * 模式3：连续子字符�?+ 网页内容匹配（预留）
   * @param {string} keyword - 搜索关键�?
   * @param {string} title - 标题
   * @param {string} pageContent - 网页内容（可选）
   * @returns {boolean} - 是否匹配
   */
  matchMode3(keyword, title, pageContent = null) {
    const titleMatch = this.matchMode1(keyword, title);
    if (!titleMatch) return false;
    
    if (pageContent) {
      const contentMatch = this.matchMode1(keyword, pageContent);
      if (!contentMatch) return false;
    }
    
    return true;
  }

  /**
   * 模式4：子序列 + 网页内容匹配（预留）
   * @param {string} keyword - 搜索关键�?
   * @param {string} title - 标题
   * @param {string} pageContent - 网页内容（可选）
   * @returns {boolean} - 是否匹配
   */
  matchMode4(keyword, title, pageContent = null) {
    const titleMatch = this.matchMode2(keyword, title);
    if (!titleMatch) return false;
    
    if (pageContent) {
      const contentMatch = this.matchMode2(keyword, pageContent);
      if (!contentMatch) return false;
    }
    
    return true;
  }

  /**
   * 根据当前模式进行匹配
   * @param {string} keyword - 搜索关键�?
   * @param {string} title - 标题
   * @param {string} pageContent - 网页内容（可选）
   * @param {string} mode - 模式（可选，默认从存储读取）
   * @returns {Promise<boolean>} - 是否匹配
   */
  async match(keyword, title, pageContent = null, mode = null) {
    const searchMode = mode || await this.getSearchMatchMode();
    
    switch (searchMode) {
      case '1':
        return this.matchMode1(keyword, title);
      case '2':
        return this.matchMode2(keyword, title);
      case '3':
        return this.matchMode3(keyword, title, pageContent);
      case '4':
        return this.matchMode4(keyword, title, pageContent);
      default:
        return this.matchMode2(keyword, title);
    }
  }

  /**
   * 同步版本 - 根据指定模式进行匹配（不读取存储�?
   * @param {string} keyword - 搜索关键�?
   * @param {string} title - 标题
   * @param {string} mode - 模式 "1", "2", "3", "4"
   * @param {string} pageContent - 网页内容（可选）
   * @returns {boolean} - 是否匹配
   */
  matchSync(keyword, title, mode, pageContent = null) {
    switch (mode) {
      case '1':
        return this.matchMode1(keyword, title);
      case '2':
        return this.matchMode2(keyword, title);
      case '3':
        return this.matchMode3(keyword, title, pageContent);
      case '4':
        return this.matchMode4(keyword, title, pageContent);
      default:
        return this.matchMode2(keyword, title);
    }
  }
}

const searchMatchService = new SearchMatchService();
export default searchMatchService;
