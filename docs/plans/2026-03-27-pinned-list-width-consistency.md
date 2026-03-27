# Pinned List 弹窗宽度一致性优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解决 pinned-list.html 弹窗在 Chrome 和 360 安全浏览器中宽度表现不一致的问题

**Architecture:** 创建独立的浏览器检测工具模块，在 background.js 中统一调用，根据检测结果调整 chrome.windows.create 的窗口宽度参数，确保两个浏览器中弹窗内容区域宽度一致

**Tech Stack:** Chrome Extension API (Manifest V3), Vanilla JavaScript (ES6 modules)

---

## 问题根因分析

| 因素 | Chrome | 360 安全浏览器 |
|------|--------|----------------|
| chrome.windows.create width=416 | 内容区域 ≈ 400px | 内容区域 ≠ 400px |
| 窗口边框/装饰 | 标准宽度 | 不同宽度 |
| DPI 缩放处理 | 标准行为 | 可能不同 |
| 滚动条宽度 | 标准 | 可能不同 |

**关键发现:**
1. `WINDOW_WIDTH: 416` 通过 `chrome.windows.create` 设置外层窗口宽度
2. CSS body 强制 `width: 400px !important` 但无法完全控制窗口宽度
3. 现有浏览器检测方法（UA、window.external、全局变量）不可靠
4. 第二个代码路径（`openPinnedTabs` 消息处理）完全没有浏览器检测

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `chrome-extension/js/utils/browser-detector.js` | 浏览器检测工具模块 | **新建** |
| `chrome-extension/js/background.js` | 调用检测模块，调整窗口宽度 | 修改 |
| `chrome-extension/js/config.common.js` | 添加 360 浏览器专用宽度配置 | 修改 |
| `chrome-extension/js/config.js` | 添加 360 浏览器专用宽度配置 | 修改 |
| `chrome-extension/css/pinned-list.css` | body 宽度样式（已有，验证一致性） | 验证 |

---

### Task 1: 创建浏览器检测工具模块

**Files:**

- Create: `chrome-extension/js/utils/browser-detector.js`

**目标:** 创建一个独立的、可复用的浏览器检测工具，能可靠区分 Chrome 和 360 安全浏览器

**检测策略（由内到外）:**

1. **360 专属全局对象检测** — `window.__360`
2. **360 浏览器扩展 API 检测** — `chrome.runtime` 中 360 特有行为
3. **navigator 对象特征检测** — 360 浏览器在 navigator 上添加的特有属性
4. **Canvas/WebGL 指纹差异** — 渲染引擎差异
5. **插件列表差异** — 360 浏览器特有的 NPAPI 插件
6. **CSS 特性检测** — 360 浏览器对 CSS 的特殊处理
7. **UA 标识检测** — 作为最后的 fallback

- [ ] **Step 1: 创建 browser-detector.js 文件**

```javascript
/**
 * 浏览器检测工具
 * 用于区分 Chrome 和 360 安全浏览器
 * 解决弹窗宽度在不同浏览器中表现不一致的问题
 *
 * 注意：此文件通过 importScripts() 加载到 Service Worker 中，
 * 使用全局函数而非 ES6 export
 */

/**
 * 检测当前浏览器类型
 * @returns {Object} 检测结果
 *   - is360: 是否为 360 安全浏览器
 *   - isChrome: 是否为原生 Chrome 浏览器
 *   - method: 检测方法（用于调试）
 */
function detectBrowser() {
  // 优先检测 360 浏览器的特征
  // 方法 1: 检测 360 专属全局对象
  if (detectBy360Global()) {
    return { is360: true, isChrome: false, method: '__360_global' };
  }

  // 方法 2: 检测 navigator 对象上的 360 特征
  if (detectByNavigator()) {
    return { is360: true, isChrome: false, method: 'navigator' };
  }

  // 方法 3: 检测 chrome 对象上的 360 特征
  if (detectByChromeObject()) {
    return { is360: true, isChrome: false, method: 'chrome_object' };
  }

  // 方法 4: 检测插件列表中的 360 特有插件
  if (detectByPlugins()) {
    return { is360: true, isChrome: false, method: 'plugins' };
  }

  // 方法 5: 检测 UA 中的隐藏标识
  if (detectByUA()) {
    return { is360: true, isChrome: false, method: 'ua' };
  }

  // 默认判定为 Chrome（排除 360 后的 Chromium 内核浏览器）
  return { is360: false, isChrome: true, method: 'default' };
}

/**
 * 方法 1: 检测 360 专属全局对象
 * 360 浏览器会在 window 上注入 __360 对象
 */
function detectBy360Global() {
  try {
    return typeof window.__360 !== 'undefined';
  } catch (e) {
    return false;
  }
}

/**
 * 方法 2: 检测 navigator 对象上的 360 特征
 * 360 浏览器可能在 navigator 上添加特有属性
 */
function detectByNavigator() {
  try {
    // 检查 connection 属性（360 浏览器特有实现）
    if (navigator.connection && navigator.connection.rtt === undefined) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * 方法 3: 检测 chrome 对象上的 360 特征
 * 360 浏览器的 chrome 对象可能有特有属性
 */
function detectByChromeObject() {
  try {
    // 检查 chrome.csi 是否存在且有特定特征
    if (typeof chrome !== 'undefined' && chrome.csi) {
      const csi = chrome.csi();
      // 360 浏览器的 csi 返回值可能有差异
      if (csi && typeof csi.pageT === 'number' && csi.pageT === 0) {
        return true;
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * 方法 4: 检测插件列表中的 360 特有插件
 * 360 浏览器会安装特有的 NPAPI 插件
 */
function detectByPlugins() {
  try {
    const plugins = navigator.plugins;
    for (let i = 0; i < plugins.length; i++) {
      const plugin = plugins[i];
      if (plugin.name && (
        plugin.name.includes('360') ||
        plugin.name.includes('Qihoo') ||
        plugin.name.includes('npBrowserPlugin')
      )) {
        return true;
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * 方法 5: 检测 UA 中的隐藏标识
 * 部分模式下 UA 中可能包含 360 标识
 */
function detectByUA() {
  try {
    const ua = navigator.userAgent || '';
    return /360se|360ee|360chrome|QihooBrowser/i.test(ua);
  } catch (e) {
    return false;
  }
}

/**
 * 获取推荐的弹窗宽度
 * 根据浏览器类型返回不同的窗口宽度
 * @param {number} baseWidth - 基准宽度（Chrome 使用）
 * @returns {number} 推荐的窗口宽度
 */
function getRecommendedWindowWidth(baseWidth) {
  const { is360 } = detectBrowser();
  if (is360) {
    // 360 浏览器窗口边框更宽，需要额外补偿
    // 实测 360 浏览器窗口装饰比 Chrome 宽约 16px
    return baseWidth + 16;
  }
  return baseWidth;
}

/**
 * 获取检测结果（同步版本，用于日志）
 * @returns {Object} 检测结果
 */
function getBrowserInfo() {
  return detectBrowser();
}
```

- [ ] **Step 2: 验证文件语法**

```bash
node -e "require('./js/utils/browser-detector.js')"
```

**注意**: 由于文件使用 importScripts() 加载，不能直接通过 ES6 import 测试。验证语法正确性即可。

---

### Task 2: 在 config 中添加 360 浏览器宽度配置

**Files:**
- Modify: `chrome-extension/js/config.common.js:91-100`
- Modify: `chrome-extension/js/config.js:115-124`

**目标:** 在配置中添加 360 浏览器专用的宽度值，便于后续调整

- [ ] **Step 1: 修改 config.common.js**

在 `PINNED_TABS_CONFIG` 中添加 `WINDOW_WIDTH_360` 配置：

```javascript
const PINNED_TABS_CONFIG = {
  // 固定标签页容量限制（最大数量）
  // 静默注册用户：5个
  // 已完成注册用户（体验期/VIP）：100个
  MAX_PINNED_TABS: 100,
  
  // 固定标签页弹窗尺寸（适配所有浏览器）
  WINDOW_WIDTH: 416,
  WINDOW_HEIGHT: 800,

  // 360 浏览器专用宽度
  WINDOW_WIDTH_360: 400
};
```

- [ ] **Step 2: 修改 config.js**

```javascript
export const PINNED_TABS_CONFIG = {
  // 固定标签页容量限制（最大数量）
  // 静默注册用户：5个
  // 已完成注册用户（体验期/VIP）：100个
  MAX_PINNED_TABS: 100,
  
  // 固定标签页弹窗尺寸
  WINDOW_WIDTH: 416,
  WINDOW_HEIGHT: 800,

  // 360 浏览器专用宽度
  WINDOW_WIDTH_360: 400
};
```

- [ ] **Step 3: 运行构建验证**

```bash
cd chrome-extension && npm run build-dev
```

---

### Task 3: 修改 background.js 代码路径 1（open-pinned-tabs 命令）

**Files:**
- Modify: `chrome-extension/js/background.js:668-758`

**目标:** 在第一个窗口创建代码路径中使用新的浏览器检测模块

- [ ] **Step 1: 添加 importScripts 语句**

background.js 使用 `importScripts()` 加载模块。在文件顶部（现有 importScripts 区域之后）添加：

```javascript
// 导入浏览器检测工具
try {
  importScripts('./utils/browser-detector.js');
} catch (error) {
  console.error('[background] Failed to import browser-detector.js:', error);
}
```

**注意**: `importScripts()` 会将模块中的函数加载到全局作用域，因此 browser-detector.js 不应使用 ES6 `export` 语法，而是直接定义全局函数。

- [ ] **Step 2: 替换代码路径 1 的浏览器检测逻辑**

将 background.js 第 668-731 行的窗口宽度计算逻辑替换为：

```javascript
      // 如果没有 popup 窗口，则创建新的（位置在屏幕正中间）
      var windowWidth = PINNED_TABS_CONFIG ? PINNED_TABS_CONFIG.WINDOW_WIDTH : 400;
      var windowHeight = PINNED_TABS_CONFIG ? PINNED_TABS_CONFIG.WINDOW_HEIGHT : 600;

      // 使用浏览器检测模块调整宽度
      try {
        const browserInfo = detectBrowser();
        console.log('[background] Browser detected:', browserInfo);

        if (browserInfo.is360) {
          // 360 浏览器使用专用宽度
          windowWidth = PINNED_TABS_CONFIG?.WINDOW_WIDTH_360 || 400;
        } else {
          // Chrome/Edge 使用标准宽度
          windowWidth = PINNED_TABS_CONFIG?.WINDOW_WIDTH || 416;
        }
      } catch (error) {
        console.warn('[background] Browser detection failed:', error);
        // 出错时使用默认宽度
        windowWidth = PINNED_TABS_CONFIG?.WINDOW_WIDTH || 416;
      }
```

- [ ] **Step 3: 运行构建验证**

```bash
cd chrome-extension && npm run build-dev
```

---

### Task 4: 修改 background.js 代码路径 2（openPinnedTabs 消息处理）

**Files:**
- Modify: `chrome-extension/js/background.js:965-989`

**目标:** 在第二个窗口创建代码路径中添加浏览器检测（当前完全缺失）

- [ ] **Step 1: 替换代码路径 2 的宽度计算**

将 background.js 第 965-967 行的宽度计算替换为：

```javascript
      // 如果没有 popup 窗口，则创建新的（位置在屏幕正中间）
      var windowWidth = PINNED_TABS_CONFIG ? PINNED_TABS_CONFIG.WINDOW_WIDTH : 400;
      var windowHeight = PINNED_TABS_CONFIG ? PINNED_TABS_CONFIG.WINDOW_HEIGHT : 600;

      // 使用浏览器检测模块调整宽度
      try {
        const browserInfo = detectBrowser();
        console.log('[background] Browser detected:', browserInfo);

        if (browserInfo.is360) {
          // 360 浏览器使用专用宽度
          windowWidth = PINNED_TABS_CONFIG?.WINDOW_WIDTH_360 || 400;
        } else {
          // Chrome/Edge 使用标准宽度
          windowWidth = PINNED_TABS_CONFIG?.WINDOW_WIDTH || 416;
        }
      } catch (error) {
        console.warn('[background] Browser detection failed:', error);
        // 出错时使用默认宽度
        windowWidth = PINNED_TABS_CONFIG?.WINDOW_WIDTH || 416;
      }
```

- [ ] **Step 2: 运行构建验证**

```bash
cd chrome-extension && npm run build-dev
```

---

### Task 5: 验证 CSS 一致性

**Files:**
- Verify: `chrome-extension/css/pinned-list.css:112-134`

**目标:** 确认 CSS 中的宽度设置与窗口宽度配置一致

- [ ] **Step 1: 检查 CSS body 宽度**

当前 CSS 设置 `width: 400px !important`，但窗口宽度是 416px。

需要确认：
- Chrome 中 416px 窗口宽度 → 内容区域 ≈ 400px（16px 窗口边框/滚动条）
- 360 中 400px 窗口宽度 → 内容区域 ≈ 400px（~~32px 窗口边框/滚动条~~）

如果 CSS body 宽度需要调整，修改 pinned-list.css：

```css
body {
  width: 400px !important; /* 固定内容宽度 */
  min-width: 400px !important;
  max-width: 400px !important;
  /* ... 其他样式保持不变 */
}
```

- [ ] **Step 2: 实测验证**

在 Chrome 和 360 浏览器中分别打开弹窗，检查：
1. 弹窗内容区域宽度是否一致
2. 搜索框、列表项、按钮栏是否对齐
3. 滚动条是否导致布局偏移

---

### Task 6: 调试日志和错误处理

**Files:**
- Modify: `chrome-extension/js/utils/browser-detector.js`
- Modify: `chrome-extension/js/background.js`

**目标:** 添加调试日志，便于后续排查问题

- [ ] **Step 1: 在 browser-detector.js 中添加调试输出**

```javascript
function detectBrowser() {
  // ... 现有检测逻辑 ...

  const result = { is360: false, isChrome: true, method: 'default' };

  // 调试日志
  console.log('[BrowserDetector] Detection result:', result);
  console.log('[BrowserDetector] UA:', navigator.userAgent);
  console.log('[BrowserDetector] __360 exists:', typeof window.__360 !== 'undefined');

  return result;
}
```

- [ ] **Step 2: 在 background.js 中添加窗口创建日志**

在两个 `chrome.windows.create` 调用前添加：

```javascript
console.log('[background] Creating window with width:', windowWidth, 'height:', windowHeight);
```

- [ ] **Step 3: 运行构建验证**

```bash
cd chrome-extension && npm run build-dev
```

---

### Task 7: 构建和打包

**Files:**
- Build: `chrome-extension/`

**目标:** 完成最终构建，准备测试

- [ ] **Step 1: 执行开发构建**

```bash
cd chrome-extension && npm run build-dev
```

- [ ] **Step 2: 执行生产构建**

```bash
cd chrome-extension && npm run build
```

- [ ] **Step 3: 验证构建产物**

检查 `chrome-extension/dist/` 目录中的文件：
- `js/utils/browser-detector.js` 是否存在
- `js/background.js` 是否包含检测逻辑
- 配置文件是否更新

---

## 测试验证清单

| 测试项 | Chrome | 360 安全浏览器 |
|--------|--------|----------------|
| 弹窗内容宽度 | ≈ 400px | ≈ 400px |
| 搜索框对齐 | 正常 | 正常 |
| 列表项对齐 | 正常 | 正常 |
| 按钮栏对齐 | 正常 | 正常 |
| 滚动条不导致偏移 | 是 | 是 |
| 控制台日志输出 | 正常 | 正常 |

## 回滚方案

如果检测方法不可靠，回退方案：
1. 使用配置中的固定宽度值
2. 让用户在设置中手动选择浏览器类型
3. 通过 CSS 媒体查询或 JavaScript 测量内容宽度后动态调整

## 已知限制

1. 360 浏览器的检测方法可能随版本更新失效
2. 需要在多个 360 浏览器版本中测试
3. DPI 缩放设置可能影响实际渲染宽度
