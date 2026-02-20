/**
 * 设备唯一标识生成工具
 * 生成并管理 user_device_uuid
 */

class UserDeviceUUID {
  constructor() {
    this.storageKey = 'userDeviceUuid';
  }

  /**
   * 获取或生成 user_device_uuid
   * @returns {Promise<string>} - 返回 uuid
   */
  async getOrCreate() {
    try {
      // 先检查本地是否已存储
      const stored = await this.getStored();
      if (stored) {
        return stored;
      }

      // 生成新的 UUID
      const uuid = this.generateUUID();
      
      // 存储起来
      await this.store(uuid);
      
      console.log('[UserDeviceUUID] Generated new UUID:', uuid);
      return uuid;
    } catch (error) {
      console.error('[UserDeviceUUID] Failed to get or create UUID:', error);
      return this.generateFallbackUUID();
    }
  }

  /**
   * 生成 UUID (使用 crypto.randomUUID)
   * @returns {string} - 返回 UUID
   */
  generateUUID() {
    // Chrome 88+ 支持 crypto.randomUUID()
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // 备用方案
    return this.generateFallbackUUID();
  }

  /**
   * 生成备用 UUID (不支持 crypto.randomUUID 时使用)
   * @returns {string} - 返回 UUID
   */
  generateFallbackUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * 获取存储的 UUID
   * @returns {Promise<string|null>} - 返回存储的 UUID
   */
  async getStored() {
    return new Promise((resolve) => {
      chrome.storage.local.get(this.storageKey, (result) => {
        resolve(result[this.storageKey] || null);
      });
    });
  }

  /**
   * 存储 UUID
   * @param {string} uuid - UUID
   * @returns {Promise} - 返回结果
   */
  async store(uuid) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.storageKey]: uuid }, () => {
        resolve();
      });
    });
  }

  /**
   * 清除存储的 UUID
   * @returns {Promise} - 返回结果
   */
  async clear() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(this.storageKey, () => {
        resolve();
      });
    });
  }
}

// 导出单例实例
const userDeviceUUID = new UserDeviceUUID();

export default userDeviceUUID;
export { UserDeviceUUID };
