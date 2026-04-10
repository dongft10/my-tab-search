/**
 * 版本管理器 - ES6 模块版本
 * 用于 popup 等页面
 * 
 * 注意：此文件用于 ES6 模块导入
 * Service Worker 请使用 version-manager.sw.js
 */

class VersionManager {
  constructor() {
    this.version = null;
  }

  async getVersion() {
    if (this.version) {
      return this.version;
    }

    try {
      const manifest = chrome.runtime.getManifest();
      this.version = manifest.version;
      return this.version;
    } catch (error) {
      console.error('[VersionManager] Failed to get version:', error);
      return 'unknown';
    }
  }

  async getHeaders() {
    const version = await this.getVersion();
    return { 'X-App-Version': version };
  }
}

const versionManager = new VersionManager();

export default versionManager;
export { VersionManager };
