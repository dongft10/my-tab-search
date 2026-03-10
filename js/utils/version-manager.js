/**
 * 版本管理器
 * 负责管理扩展版本信息
 */
class VersionManager {
  constructor() {
    this.version = null;
  }

  /**
   * 获取扩展版本号
   * 从 manifest.json 读取
   */
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

  /**
   * 获取 HTTP Headers
   * 用于 fetch 请求
   */
  async getHeaders() {
    const version = await this.getVersion();
    
    return {
      'X-App-Version': version
    };
  }
}

// 导出单例
export const versionManager = new VersionManager();
