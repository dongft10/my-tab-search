# 打包说明

本目录包含用于打包 Chrome 扩展的相关工具和文件。

## 快速开始

要打包 Chrome 扩展程序，请执行以下步骤：

1. 确保已安装 Node.js
2. （可选）如需生成 CRX 格式，安装 crx 工具：

```bash
npm install -g crx
```

3. 在项目根目录下运行以下命令：

```bash
npm install
npm run build
```

4. 构建完成后，您将在 `pack/out` 目录中找到打包好的文件：
   - 如果安装了 crx 工具：`my-tab-search-v{version}.crx` 文件（其中 {version} 是 manifest.json 中定义的版本号）
   - 如果未安装 crx 工具：`my-tab-search-v{version}.zip` 文件（作为备选方案，其中 {version} 是 manifest.json 中定义的版本号）

## 开发调试模式（不压缩）

在开发和测试阶段，为了方便调试，可以跳过代码压缩步骤：

### 方式 1：使用批处理文件（Windows，推荐）

双击运行以下批处理文件：

```batch
# 生产版本（压缩）- 直接双击 pack.bat
.\pack\pack.bat

# 开发版本（不压缩）- 直接双击 pack-no-compress.bat
.\pack\pack-no-compress.bat
```

### 方式 2：使用 npm 脚本

```bash
# 开发模式（不压缩）
npm run build:dev

# 或使用 compress=false 参数
npm run build:compress=false

# 生产模式（压缩）
npm run build
```

### 方式 3：直接传递参数

```bash
# 使用 --compress=false 参数
node pack/scripts/build.js --compress=false

# 或使用 --skip-compress 参数
node pack/scripts/build.js --skip-compress
```

**注意**：开发模式下打包的文件未经压缩，便于调试，但文件体积会较大。生产环境部署请使用默认的压缩打包。

## 目录结构

- `run-packaging.ps1` - 主要打包脚本，用于通过 Node.js 工具链压缩和打包扩展
- `PACKAGING.md` - 详细的打包说明文档
- `out/` - 打包输出目录
- `my-tab-search.pem` - 私钥文件，用于保持扩展的唯一标识符（**必须手动放置**到项目根目录或 pack 目录，不会自动生成）

## 使用方法

运行便捷脚本进行打包（推荐）：

```powershell
# 从项目根目录运行
.\pack\run-packaging.ps1
```

或直接使用 Node.js 命令：

```bash
npm install
npm run build
```

### 清理输出目录

如果需要清理 `pack/out` 目录中的旧构建文件，可以运行：

```bash
npm run clean
```

这将删除 `pack/out` 目录中的所有内容，为您提供一个干净的构建环境。