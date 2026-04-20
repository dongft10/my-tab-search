# Help Tour Page 设计文档

## 概述

Help Tour Page 是一个交互式引导页面，用于帮助新用户了解 MyTabSearch 扩展的核心功能。采用浏览器模拟界面作为背景，通过高亮区域和引导卡片逐步介绍各项功能。HELP\_PAGE\_DESIGN.md

## 文件结构

```
chrome-extension/
├── html/
│   └── help-tour.html          # 引导页面 HTML
├── css/
│   └── help-tour.css           # 引导页面样式
├── js/
│   └── help-tour-page.js       # 引导页面逻辑
└── images/
    └── help/
        ├── browser-preview.png # 浏览器模拟背景图
        └── pin-extension.png   # 固定扩展图标叠加图
```

## 核心功能

### 1. 五步骤引导流程

| 步骤 | ID           | 功能     | 快捷键   |
| -- | ------------ | ------ | ----- |
| 1  | search       | 标签页搜索  | Alt+Q |
| 2  | switch       | 标签切换   | Alt+W |
| 3  | pin          | 固定标签列表 | Alt+E |
| 4  | pinExtension | 固定扩展图标 | -     |
| 5  | shortcuts    | 快捷键汇总  | -     |

### 2. 视觉效果

- **背景图**：全屏浏览器模拟界面 (`browser-preview.png`)
- **高亮区域**：带有脉冲动画的半透明遮罩，突出当前功能区域
- **引导卡片**：浮动的提示卡片，包含标题、描述、快捷键和操作按钮
- **叠加图片**：用于步骤4，在背景图上叠加固定扩展图标的演示

### 3. 响应式布局

背景图采用 `contain` 模式适配不同视口比例，所有 UI 元素位置使用百分比计算，确保在各种屏幕尺寸下正确显示。

```javascript
const BG_IMAGE_WIDTH = 1920;
const BG_IMAGE_HEIGHT = 1049;
const BG_IMAGE_RATIO = BG_IMAGE_WIDTH / BG_IMAGE_HEIGHT;
```

## 样式设计

### 背景层

```css
.help-tour-bg {
  position: fixed;
  background-image: url('../images/help/browser-preview.png');
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  background-color: #0a0a0f;
}
```

### 高亮区域

```css
.help-tour-highlight {
  border-radius: 12px;
  box-shadow: 
    0 0 0 9999px rgba(0, 0, 0, 0.7),    /* 遮罩层 */
    0 0 0 3px rgba(99, 102, 241, 0.9),   /* 边框 */
    0 0 20px rgba(99, 102, 241, 0.5),    /* 外发光 */
    0 0 40px rgba(99, 102, 241, 0.3);
}
```

### 引导卡片

- 渐变背景：`linear-gradient(145deg, #1e1e32, #1a1a2e)`
- 紫色主题边框和阴影
- 支持四个方向的箭头指示器 (`arrow-left`, `arrow-right`, `arrow-top`, `arrow-bottom`)

## 位置配置

每个步骤支持以下位置配置：

```javascript
{
  cardPosition: {
    topPercent: 15,           // 卡片顶部位置（百分比）
    rightPercent: 33.6,       // 卡片右侧位置（百分比）
    centerOffsetXPercent: 0,  // 水平居中偏移量（百分比）
    centerOffsetYPercent: 0   // 垂直居中偏移量（百分比）
  },
  highlight: {
    topPercent: 4,
    rightPercent: 7.8,
    widthPercent: 23,
    heightPercent: 62,
    centerOffsetXPercent: 0,
    centerOffsetYPercent: 0
  },
  overlayImage: "../images/pin-extension.png",  // 可选：叠加图片
  overlayPosition: {
    topPercent: 4,
    rightPercent: 0.9,
    widthPercent: 28,
    heightPercent: 36
  },
  arrow: "arrow-right"  // 箭头方向
}
```

## 交互功能

### 键盘导航

| 按键            | 功能       |
| ------------- | -------- |
| ← / ↑         | 上一步      |
| → / ↓         | 下一步      |
| Enter / Space | 下一步 / 完成 |
| Escape        | 跳过引导     |

### 鼠标交互

- 点击卡片外部区域：进入下一步
- 点击步骤指示器（圆点）：跳转到对应步骤
- 点击"跳过"按钮：结束引导

### 按钮功能

- **上一步**：返回上一引导步骤
- **下一步**：进入下一引导步骤
- **设置快捷键**：打开 `chrome://extensions/shortcuts`
- **完成**：保存完成状态并关闭页面

## 状态存储

引导完成后，在 `chrome.storage.local` 中存储：

```javascript
chrome.storage.local.set({ helpTourCompleted: true });
```

## 国际化

所有文案使用 i18n 系统，支持中英文切换。主要翻译键：

- `tourStep1Title` \~ `tourStep5Title`：各步骤标题
- `tourStep1Desc` \~ `tourStep5Desc`：各步骤描述
- `tourStep1Tip` \~ `tourStep5Tip`：各步骤提示
- `tourShortcutOpenSearch`、`tourShortcutSwitchTab`、`tourShortcutOpenPin`：快捷键描述
- `tourBtnNext`、`tourBtnPrev`、`tourBtnDone`、`tourBtnSkip`、`tourBtnSetupShortcuts`：按钮文案

## 主题支持

页面通过 `theme-early.js` 和 `theme.js` 支持明暗主题切换。HELP\_PAGE\_DESIGN.md
