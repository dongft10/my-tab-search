# 主题闪烁问题修复设计方案

## 问题描述

### 现象

当使用亮色主题时，打开 `settings.html`、`about.html`、`pinned-list.html` 页面时，会先短暂显示暗色主题，然后才切换到亮色主题，产生"闪烁"效果。

### 涉及页面

- `popup.html`
- `settings.html`
- `about.html`
- `pinned-list.html`

> 注：`index.html` 不在本次优化范围内。

### 默认主题要求

以上四个页面默认使用亮色主题。

## 问题分析

### 根本原因

**CSS 默认主题是暗色，JavaScript 在 DOMContentLoaded 后才切换**

1. **CSS 层面**：`popup.css`、`settings.css`、`pinned-list.css` 的 `:root` 定义的是暗色主题变量，只有 `[data-theme="light"]` 才会切换到亮色主题。
2. **JS 层面**：`theme-init.js` 在 `DOMContentLoaded` 事件后执行 `ThemeManager.init()`，此时页面已经渲染完成。
3. **时序问题**：
   ```
   浏览器解析 HTML → 应用 CSS（暗色主题）
   浏览器加载 JS → 等待 DOMContentLoaded
   DOMContentLoaded 触发 → JS 切换到亮色主题
   用户看到：暗色 → 亮色的闪烁
   ```
4. **脚本加载顺序**（以 `settings.html` 为例）：
   ```html
   <script type="module" src="../js/settings.js"></script>
   <script src="../js/utils/theme.js"></script>           <!-- 同步加载 -->
   <script type="module" src="../js/utils/theme-settings.js"></script> <!-- 模块延迟 -->
   ```
   `theme.js` 同步加载，但 `theme-init.js` 依赖 DOMContentLoaded 事件。

### 当前文件结构

```
js/utils/
├── theme.js          # ThemeManager 定义，包含 applyTheme、setTheme、toggle 等方法
├── theme-init.js     # DOMContentLoaded 时初始化主题
└── theme-settings.js # settings 页面特有的主题设置逻辑
```

### 当前主题切换逻辑

**theme.js 核心代码**：

```javascript
const ThemeManager = {
  init() {
    this.applyTheme();
    window.addEventListener('storage', (e) => {
      if (e.key === THEME_KEY) {
        this.applyTheme();
      }
    });
  },
  applyTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
    const html = document.documentElement;
    if (savedTheme === 'light') {
      html.setAttribute('data-theme', 'light');
    } else {
      html.removeAttribute('data-theme');
    }
  },
  // ...
};
```

**theme-init.js**：

```javascript
document.addEventListener('DOMContentLoaded', () => {
  if (window.ThemeManager) {
    if (!localStorage.getItem('theme')) {
      window.ThemeManager.setTheme('light');
    }
    window.ThemeManager.init();
  }
});
```

## 方案选型

### 方案 A：内联脚本（已排除）

**思路**：在 `<head>` 中添加内联脚本，在 CSS 加载前读取并应用主题。

**排除原因**：Chrome Extension 默认 CSP（Content Security Policy）禁止内联脚本执行。

> 参考文档：MDN - Content Security Policy
> "Under the default CSP, inline JavaScript is not executed. This disallows both JavaScript placed directly in `<script>` tags..."

### 方案 B：CSS 默认亮色 + JS 动态切换

**思路**：反转 CSS 逻辑，让 `:root` 定义亮色主题，`[data-theme="dark"]` 定义暗色主题。

**优点**：

- 完全兼容 CSP
- 默认亮色主题，无闪烁

**缺点**：

- 需要修改多个 CSS 文件，重写所有变量定义
- 改动量大，容易出错
- 暗色主题用户首次加载会有短暂切换（亮→暗）

### 方案 C：外部早期执行脚本（选定方案）

**思路**：创建一个独立的小型 JS 文件，在 `<head>` 中最早加载（在外部 CSS 之前）。

**优点**：

- 完全兼容 Chrome Extension CSP
- 彻底解决闪烁问题
- 保持现有 CSS 结构不变
- 新增文件极小（\~10行代码）
- 默认亮色主题，符合需求

**缺点**：

- 需要新增一个 JS 文件
- 需要修改 4 个 HTML 的脚本加载顺序

### 方案 D：CSS 预隐藏 + 过渡显示（已排除）

**思路**：页面默认隐藏，主题确定后平滑显示。

**排除原因**：页面有短暂空白感，用户体验差。

## 详细设计

### 修改范围

| 文件                        | 修改类型 | 说明                       |
| ------------------------- | ---- | ------------------------ |
| `js/utils/theme-early.js` | 新增   | 早期执行的轻量脚本                |
| `popup.html`              | 修改   | 在 CSS 前引入 theme-early.js |
| `settings.html`           | 修改   | 在 CSS 前引入 theme-early.js |
| `about.html`              | 修改   | 在 CSS 前引入 theme-early.js |
| `pinned-list.html`        | 修改   | 在 CSS 前引入 theme-early.js |
| `theme-init.js`           | 简化   | 移除重复的默认主题设置逻辑            |

### 核心实现

#### 1. 新增 `js/utils/theme-early.js`

```javascript
(function() {
  try {
    var theme = localStorage.getItem('theme') || 'light';
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } catch(e) {}
})();
```

**设计要点**：

- 使用 IIFE（立即执行函数）避免污染全局作用域
- 同步执行，不依赖任何外部模块
- 使用 `var` 而非 `let/const`，确保最大兼容性
- 默认值为 `'light'`，符合默认亮色主题需求
- 使用 `try-catch` 防止 localStorage 不可用时报错

#### 2. HTML 修改示例

**popup.html**：

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <script src="../js/utils/theme-early.js"></script>  <!-- 新增，放在最前面 -->
  <link rel="stylesheet" href="../css/popup.css" />
  <title>my-tab-search</title>
</head>
```

**settings.html**：

```html
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title data-i18n="settingsTitle">设置 - MyTabSearch</title>
  <script src="../js/utils/theme-early.js"></script>  <!-- 新增，放在最前面 -->
  <link rel="stylesheet" href="../css/settings.css">
</head>
```

**about.html**：

```html
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>About - MyTabSearch</title>
  <script src="../js/utils/theme-early.js"></script>  <!-- 新增，放在最前面 -->
  <link rel="stylesheet" href="../css/about.css">
  <!-- 内嵌样式保持不变 -->
</head>
```

**pinned-list.html**：

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <script src="../js/utils/theme-early.js"></script>  <!-- 新增，放在最前面 -->
  <link rel="stylesheet" href="../css/pinned-list.css" />
  <title data-i18n="pinnedTabsTitle">Pinned Tab List</title>
</head>
```

#### 3. `theme-init.js` 简化

**修改前**：

```javascript
document.addEventListener('DOMContentLoaded', () => {
  if (window.ThemeManager) {
    // 确保默认主题已设置
    if (!localStorage.getItem('theme')) {
      window.ThemeManager.setTheme('light');
    }
    window.ThemeManager.init();
  }
});
```

**修改后**：

```javascript
document.addEventListener('DOMContentLoaded', () => {
  if (window.ThemeManager) {
    window.ThemeManager.init();
  }
});
```

**说明**：移除默认主题设置逻辑，因为 `theme-early.js` 已在页面加载最早阶段处理。

### 执行时序（优化后）

```
1. 浏览器解析 HTML
2. 执行 theme-early.js（同步）→ 读取 localStorage → 设置 data-theme
3. 加载 CSS → 应用正确主题（无闪烁）
4. 加载其他 JS 文件
5. DOMContentLoaded → ThemeManager.init() → 初始化 storage 监听
```

### 跨窗口同步机制

保持现有 `storage` 事件监听机制（`theme.js` 中已有）：

```javascript
window.addEventListener('storage', (e) => {
  if (e.key === THEME_KEY) {
    this.applyTheme();
  }
});
```

当一个窗口修改主题时，其他已打开的窗口会通过 `storage` 事件同步更新。

### 文件依赖关系

```
theme-early.js  (独立，不依赖其他模块)
     ↓
   CSS 加载
     ↓
theme.js (定义 ThemeManager)
     ↓
theme-init.js (DOMContentLoaded 时调用 ThemeManager.init())
     ↓
theme-settings.js (settings 页面特有逻辑)
```

## 测试要点

### 功能测试

1. **默认主题测试**
   - 清除 localStorage 中的 `theme` 键
   - 打开各页面，确认默认显示亮色主题
   - 确认无闪烁现象
2. **主题切换测试**
   - 在 settings 页面切换主题
   - 确认主题正确切换
   - 打开其他页面，确认主题一致
3. **跨窗口同步测试**
   - 打开多个扩展页面
   - 在其中一个页面切换主题
   - 确认其他页面同步更新
4. **持久化测试**
   - 设置亮色主题后关闭扩展
   - 重新打开扩展，确认仍为亮色主题
   - 设置暗色主题后关闭扩展
   - 重新打开扩展，确认仍为暗色主题

### 兼容性测试

1. **Chrome DevTools 测试**
   - 确认控制台无 CSP 相关错误
   - 确认无 JavaScript 错误
2. **localStorage 不可用场景**
   - 在隐私模式下测试
   - 确认不会因 localStorage 不可用而报错

## 风险评估

| 风险               | 等级 | 缓解措施                   |
| ---------------- | -- | ---------------------- |
| CSP 阻止脚本执行       | 低  | 使用外部脚本文件，完全符合 CSP 要求   |
| localStorage 不可用 | 低  | try-catch 包装，优雅降级      |
| 脚本加载顺序问题         | 低  | 放在 `<head>` 最前面，确保最先执行 |
| 暗色用户首次加载闪烁       | 中  | 可接受，后续可考虑优化            |

## 后续优化建议

1. **考虑方案 B 作为长期优化**
   - 反转 CSS 默认主题逻辑
   - 彻底消除所有主题相关的闪烁可能性
   - 需要较大改动量，建议在后续版本中实施
2. **性能监控**
   - 可添加性能指标监控主题切换耗时
   - 确保 theme-early.js 执行时间在可接受范围内

## 变更记录

| 版本  | 日期         | 作者 | 说明     |
| --- | ---------- | -- | ------ |
| 1.0 | 2026-03-31 | -  | 初始设计文档 |

