/**
 * 设备指纹生成工具
 * 生成唯一的设备标识
 */

class FingerprintUtil {
  constructor() {
    this.storageKey = 'mytabsearch_device_fingerprint';
  }

  /**
   * 生成设备指纹
   * @returns {Promise} - 返回设备指纹
   */
  async generate() {
    try {
      // 尝试从存储中获取
      const storedFingerprint = await this.getStoredFingerprint();
      if (storedFingerprint) {
        return storedFingerprint;
      }

      // 生成新的指纹
      const fingerprint = await this.calculateFingerprint();
      
      // 存储指纹
      await this.storeFingerprint(fingerprint);
      
      return fingerprint;
    } catch (error) {
      console.error('Failed to generate fingerprint:', error);
      // 失败时生成一个临时指纹
      return this.generateTemporaryFingerprint();
    }
  }

  /**
   * 计算设备指纹
   * @returns {Promise} - 返回计算结果
   */
  async calculateFingerprint() {
    const components = [];

    // 1. 浏览器信息
    components.push(navigator.userAgent);
    components.push(navigator.platform);
    components.push(navigator.language || navigator.userLanguage);
    components.push(navigator.vendor || '');

    // 2. 屏幕信息
    if (typeof screen !== 'undefined') {
      components.push(screen.width?.toString() || '0');
      components.push(screen.height?.toString() || '0');
      components.push(screen.colorDepth?.toString() || '0');
    } else {
      components.push('0', '0', '0');
    }

    // 3. 硬件信息
    components.push(navigator.hardwareConcurrency.toString());
    components.push(navigator.deviceMemory?.toString() || '0');

    // 4. 时区信息
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

    // 5. Cookie 启用状态
    components.push(navigator.cookieEnabled.toString());

    // 6. 插件信息（仅用于指纹，不收集具体插件）
    const pluginCount = navigator.plugins?.length || 0;
    components.push(pluginCount.toString());

    // 7. Canvas 指纹
    const canvasFingerprint = await this.getCanvasFingerprint();
    components.push(canvasFingerprint);

    // 8. WebGL 指纹
    const webglFingerprint = await this.getWebGLFingerprint();
    components.push(webglFingerprint);

    // 9. 扩展 ID
    components.push(chrome.runtime.id);

    // 组合所有组件并哈希
    const combined = components.join('|');
    return this.hash(combined);
  }

  /**
    * Canvas 指纹
    * @returns {Promise} - 返回 Canvas 指纹
    */
  async getCanvasFingerprint() {
    return new Promise((resolve) => {
      try {
        // Service Worker 中不支持 document
        if (typeof document === 'undefined') {
          resolve('canvas-not-available');
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.fillStyle = '#f5f5f5';
          ctx.fillRect(0, 0, 200, 200);
          ctx.font = '16px Arial';
          ctx.fillStyle = '#333';
          ctx.fillText('MyTabSearch', 10, 50);
          ctx.beginPath();
          ctx.arc(100, 100, 50, 0, Math.PI * 2);
          ctx.stroke();

          const data = canvas.toDataURL('image/png');
          resolve(this.hash(data));
        } else {
          resolve('canvas-not-supported');
        }
      } catch (error) {
        resolve('canvas-error');
      }
    });
  }

  /**
   * WebGL 指纹
   * @returns {Promise} - 返回 WebGL 指纹
   */
  async getWebGLFingerprint() {
    return new Promise((resolve) => {
      try {
        // Service Worker 中不支持 document
        if (typeof document === 'undefined') {
          resolve('webgl-not-available');
          return;
        }

        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';
          const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown';
          resolve(this.hash(renderer + vendor));
        } else {
          resolve('webgl-not-supported');
        }
      } catch (error) {
        resolve('webgl-error');
      }
    });
  }

  /**
   * 哈希函数
   * @param {string} input - 输入字符串
   * @returns {string} - 返回哈希值
   */
  hash(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * 获取存储的指纹
   * @returns {Promise} - 返回存储的指纹
   */
  async getStoredFingerprint() {
    return new Promise((resolve) => {
      chrome.storage.local.get(this.storageKey, (result) => {
        resolve(result[this.storageKey] || null);
      });
    });
  }

  /**
   * 存储指纹
   * @param {string} fingerprint - 设备指纹
   * @returns {Promise} - 返回结果
   */
  async storeFingerprint(fingerprint) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.storageKey]: fingerprint }, () => {
        resolve();
      });
    });
  }

  /**
   * 生成临时指纹
   * @returns {string} - 返回临时指纹
   */
  generateTemporaryFingerprint() {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    return this.hash(timestamp + random + chrome.runtime.id);
  }

  /**
   * 清除存储的指纹
   * @returns {Promise} - 返回结果
   */
  async clearFingerprint() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(this.storageKey, () => {
        resolve();
      });
    });
  }
}

// 导出单例实例
const fingerprintUtil = new FingerprintUtil();

export default fingerprintUtil;
export { FingerprintUtil };
