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

## 目录结构

- `run-packaging.ps1` - 主要打包脚本，用于通过 Node.js 工具链压缩和打包扩展
- `PACKAGING.md` - 详细的打包说明文档
- `out/` - 打包输出目录
- `my-tab-search.pem` - 私钥文件，用于保持扩展的唯一标识符（推荐放在项目根目录）

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