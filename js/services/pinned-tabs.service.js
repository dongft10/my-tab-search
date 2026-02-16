/**
 * 固定Tab服务
 * 处理固定Tab的存储、长期固定Tab管理等
 */

import featureLimitService from './feature-limit.service.js';

class PinnedTabsService {
  constructor() {
    this.storageKey = 'pinnedTabs';
    this.longTermStorageKey = 'longTermPinnedTabs';
  }

  /**
   * 获取所有固定Tab
   * @returns {Promise<Array>} - 返回固定Tab列表
   */
  async getPinnedTabs() {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      return result[this.storageKey] || [];
    } catch (error) {
      console.error('Get pinned tabs error:', error);
      return [];
    }
  }

  /**
   * 保存固定Tab列表
   * @param {Array} tabs - Tab列表
   * @returns {Promise} - 返回保存结果
   */
  async savePinnedTabs(tabs) {
    try {
      await chrome.storage.local.set({
        [this.storageKey]: tabs
      });
    } catch (error) {
      console.error('Save pinned tabs error:', error);
      throw error;
    }
  }

  /**
   * 清除所有固定Tab（退登时使用）
   * @returns {Promise}
   */
  async clearPinnedTabs() {
    try {
      await chrome.storage.local.remove([this.storageKey, this.longTermStorageKey]);
    } catch (error) {
      console.error('Clear pinned tabs error:', error);
    }
  }

  /**
   * 添加固定Tab
   * @param {Object} tab - Tab信息
   * @returns {Promise<{success: boolean, message: string}>} - 返回添加结果
   */
  async addPinnedTab(tab) {
    try {
      // 检查固定Tab上限（缓存超过1天自动刷新）
      const limit = await featureLimitService.getFeatureLimit('pinnedTabs');
      const tabs = await this.getPinnedTabs();
      
      if (limit !== -1 && tabs.length >= limit) {
        return {
          success: false,
          message: `固定Tab已达上限(${limit}个)`
        };
      }

      // 检查是否已存在
      const exists = tabs.some(t => t.tabId === tab.tabId);
      if (exists) {
        return {
          success: false,
          message: '该Tab已在固定列表中'
        };
      }

      // 添加新Tab
      const newTab = {
        ...tab,
        pinnedAt: new Date().toISOString(),
        isLongTermPinned: false
      };

      tabs.push(newTab);
      await this.savePinnedTabs(tabs);

      return {
        success: true,
        message: 'Tab已添加'
      };
    } catch (error) {
      console.error('Add pinned tab error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 移除固定Tab
   * @param {number} tabId - Tab ID
   * @returns {Promise} - 返回移除结果
   */
  async removePinnedTab(tabId) {
    try {
      const tabs = await this.getPinnedTabs();
      const filteredTabs = tabs.filter(t => t.tabId !== tabId);
      await this.savePinnedTabs(filteredTabs);
      return { success: true };
    } catch (error) {
      console.error('Remove pinned tab error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 设置长期固定Tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<{success: boolean, message: string}>} - 返回设置结果
   */
  async setLongTermPinned(tabId) {
    try {
      // 检查权限
      const hasAccess = await featureLimitService.hasFeatureAccess('longTermPinned');
      if (!hasAccess) {
        return {
          success: false,
          message: '您暂无长期固定Tab权限，请升级VIP'
        };
      }

      // 检查长期固定Tab上限
      const limit = await featureLimitService.getFeatureLimit('longTermPinned');
      const longTermTabs = await this.getLongTermPinnedTabs();
      
      // 检查当前Tab是否已经是长期固定
      const isAlreadyLongTerm = longTermTabs.some(t => t.tabId === tabId);
      
      if (!isAlreadyLongTerm && limit !== -1 && longTermTabs.length >= limit) {
        return {
          success: false,
          message: `长期固定Tab已达上限(${limit}个)`
        };
      }

      // 更新Tab状态
      const tabs = await this.getPinnedTabs();
      const updatedTabs = tabs.map(t => {
        if (t.tabId === tabId) {
          return {
            ...t,
            isLongTermPinned: true,
            longTermPinnedAt: new Date().toISOString()
          };
        }
        return t;
      });

      await this.savePinnedTabs(updatedTabs);

      return {
        success: true,
        message: '已设置为长期固定'
      };
    } catch (error) {
      console.error('Set long term pinned error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 取消长期固定Tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<{success: boolean, message: string}>} - 返回取消结果
   */
  async cancelLongTermPinned(tabId) {
    try {
      const tabs = await this.getPinnedTabs();
      const updatedTabs = tabs.map(t => {
        if (t.tabId === tabId) {
          return {
            ...t,
            isLongTermPinned: false,
            longTermPinnedAt: null
          };
        }
        return t;
      });

      await this.savePinnedTabs(updatedTabs);

      return {
        success: true,
        message: '已取消长期固定'
      };
    } catch (error) {
      console.error('Cancel long term pinned error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 获取长期固定Tab列表
   * @returns {Promise<Array>} - 返回长期固定Tab列表
   */
  async getLongTermPinnedTabs() {
    try {
      const tabs = await this.getPinnedTabs();
      return tabs.filter(t => t.isLongTermPinned);
    } catch (error) {
      console.error('Get long term pinned tabs error:', error);
      return [];
    }
  }

  /**
   * 检查Tab是否为长期固定
   * @param {number} tabId - Tab ID
   * @returns {Promise<boolean>} - 是否为长期固定
   */
  async isLongTermPinned(tabId) {
    try {
      const tabs = await this.getPinnedTabs();
      const tab = tabs.find(t => t.tabId === tabId);
      return tab ? tab.isLongTermPinned : false;
    } catch (error) {
      console.error('Check long term pinned error:', error);
      return false;
    }
  }

  /**
   * 清理失效的长期固定Tab
   * 长期固定Tab的源Tab被关闭后，重启浏览器时重新打开
   * @returns {Promise} - 返回清理结果
   */
  async cleanupLongTermTabs() {
    try {
      const tabs = await this.getPinnedTabs();
      const updatedTabs = [];

      for (const tab of tabs) {
        if (tab.isLongTermPinned) {
          // 检查源Tab是否存在
          try {
            await chrome.tabs.get(tab.tabId);
            // Tab存在，保留
            updatedTabs.push(tab);
          } catch (e) {
            // Tab不存在，检查是否需要重新打开
            if (tab.url) {
              // 尝试重新打开Tab
              try {
                const newTab = await chrome.tabs.create({
                  url: tab.url,
                  active: false
                });
                // 更新Tab ID
                updatedTabs.push({
                  ...tab,
                  tabId: newTab.id,
                  reopenedAt: new Date().toISOString()
                });
              } catch (createError) {
                console.error('Reopen tab error:', createError);
                // 保留原Tab信息但不打开
                updatedTabs.push(tab);
              }
            }
          }
        } else {
          // 非长期固定Tab，直接保留
          updatedTabs.push(tab);
        }
      }

      await this.savePinnedTabs(updatedTabs);
      return { success: true, cleaned: updatedTabs.length !== tabs.length };
    } catch (error) {
      console.error('Cleanup long term tabs error:', error);
      return { success: false, message: error.message };
    }
  }
}

// 导出单例实例
const pinnedTabsService = new PinnedTabsService();

export default pinnedTabsService;
export { PinnedTabsService };
