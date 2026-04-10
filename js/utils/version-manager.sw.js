/**
 * 版本管理器
 * 负责管理扩展版本信息
 * 
 * 注意：此文件用于 importScripts（Service Worker）
 * popup 等页面请使用 version-manager.esm.js
 */

const _vmFileGlobal = typeof self !== 'undefined' ? self : {};

if (typeof _vmFileGlobal._versionManagerInitialized === 'undefined') {
  _vmFileGlobal._versionManagerInitialized = true;

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

  _vmFileGlobal.versionManager = new VersionManager();
  _vmFileGlobal.VersionManager = VersionManager;
}
