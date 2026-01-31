# Chrome 扩展打包说明

本项目提供了一套用于压缩和打包 Chrome 扩展的工具脚本。

## 脚本说明

### 1. run-packaging.ps1
主要的打包脚本，执行以下操作：
- 安装项目依赖
- 调用 Node.js 工具链进行构建
- 压缩项目中的所有 JS、CSS、HTML 文件
- 生成优化后的构建目录
- 自动生成 CRX 和 ZIP 文件

### 2. Node.js 打包脚本
使用 Node.js 工具链进行打包，包含：
- `scripts/clean.js` - 清理构建输出目录
- `scripts/compress.js` - 使用 terser 和 clean-css 压缩 JS/CSS 文件
- `scripts/package.js` - 使用 archiver 创建 ZIP 包并生成 CRX 文件
- `scripts/build.js` - 综合构建脚本

## 使用方法

### 方法零：使用 npm 命令（推荐）

windows资源管理器打开路径my-tab-search-project\chrome-extension\pack， 然后鼠标双击`pack.bat`即可开始执行打包任务。 双击`clean.bat` 则清理构建输出。



### 方法一：使用 npm 命令（推荐）

从项目根目录运行：

```bash
# 安装依赖
npm install

# 生产构建（包含代码压缩）
npm run build

# 开发构建（跳过压缩，速度快）
npm run build-dev

# 清理构建输出
npm run clean
```

### 方法二：使用 PowerShell 脚本

```powershell
# 从项目根目录运行
.\pack\run-packaging.ps1

# 清理构建输出
.\pack\clean.ps1
```

## 目录结构

- `pack/` - 打包工具和输出目录
  - `run-packaging.ps1` - 主要打包脚本
  - `clean.ps1` - 清理构建输出脚本
  - `scripts/` - Node.js 打包脚本目录
    - `build.js` - 综合构建脚本
    - `clean.js` - 清理脚本
    - `compress.js` - 压缩脚本
    - `package.js` - 打包脚本（生成 CRX 和 ZIP）
  - `PACKAGING.md` - 本文档
  - `README.md` - 快速使用说明
  - `out/` - 输出目录
    - `build/` - 构建结果（包含所有源文件）
    - `my-tab-search-v{version}.crx` - CRX 扩展文件
    - `my-tab-search-v{version}.zip` - ZIP 压缩包（用于 Chrome Web Store）

## 输出文件说明

构建完成后，会在 `pack/out` 目录下生成以下文件：

- `build/` - 包含所有经过压缩优化的源文件
- `my-tab-search-v{version}.crx` - CRX 扩展文件，用于本地安装
- `my-tab-search-v{version}.zip` - ZIP 压缩包，用于发布到 Chrome Web Store

其中 `{version}` 是 [manifest.json](file:///d:/workspace/my-tab-search-project/chrome-extension/manifest.json#L3) 中定义的版本号。

例如，如果 manifest.json 中的版本号是 "1.8.0"，则会生成：
- `my-tab-search-v1.8.0.crx` (约 140 KB)
- `my-tab-search-v1.8.0.zip` (约 135 KB)

### CRX vs ZIP 格式

- **CRX 格式**：Chrome 扩展的标准安装格式，包含数字签名，可直接拖拽到 Chrome 扩展页面进行安装
- **ZIP 格式**：通用压缩格式，用于上传到 Chrome Web Store 进行发布

**注意**：打包流程会同时生成这两种格式，CRX 用于本地测试和安装，ZIP 用于发布到 Chrome Web Store。



## 注意事项

1. **私钥文件**（my-tab-search.pem）用于保持扩展的唯一标识符（ID），如果不存在会自动生成
   - PEM 文件位于总工程根目录（`my-tab-search.pem`），不建议放在 chrome-extension 子工程中
   - 打包脚本会自动查找并使用该文件
2. 如果没有私钥文件，每次打包都会生成新的扩展 ID
3. 压缩过程会移除注释和多余空白，但会保留重要的注释（如 eslint、jshint 等）
4. 建议在发布前测试压缩后的扩展功能是否正常
5. 打包流程会同时生成 CRX 和 ZIP 文件，CRX 用于本地安装，ZIP 用于 Chrome Web Store 发布

## 安装依赖

如果要使用 Node.js 自动化打包功能，需要安装以下工具：

- **Node.js**: 用于运行打包脚本和 crx 工具
- **npm packages**: terser, clean-css, archiver (通过 npm install 安装)

运行以下命令安装依赖：
```bash
npm install
```

## 清理输出目录

如果需要清理 `pack/out` 目录中的旧构建文件，可以运行：

```bash
npm run clean
```

或使用 PowerShell 脚本：
```powershell
.\pack\clean.ps1
```

这将删除 `pack/out` 目录中的所有内容，为您提供一个干净的构建环境。

## 手动打包

如果不想使用自动化脚本，也可以通过 Chrome 浏览器手动打包：

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions`
3. 启用 "开发者模式"
4. 点击 "打包扩展程序"
5. 输入扩展目录路径（chrome-extension 目录）
6. （可选）输入私钥路径（总工程根目录的 `my-tab-search.pem`）
7. 点击 "打包扩展程序" 按钮