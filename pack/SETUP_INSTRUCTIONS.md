# Node.js 打包环境安装说明

## 安装 Node.js

1. 访问 [Node.js 官网](https://nodejs.org/)
2. 下载并安装 LTS 版本
3. 验证安装：
   ```bash
   node --version
   npm --version
   ```

## 安装项目依赖

在项目根目录运行：

```bash
npm install
```

## 安装全局工具（可选）

如需生成 CRX 文件，推荐安装 crx（因为 crx3 在新版 Node.js 中可能存在兼容性问题）：

```bash
npm install -g crx
```

如果 crx 不起作用，可以尝试 crx3：

```bash
npm install -g crx3
```

## 准备 PEM 私钥文件

在打包之前，需要准备 PEM 私钥文件：

1. **放置 PEM 文件**（必须）：
   - 将 `my-tab-search.pem` 文件放到项目根目录（推荐）
   - 或放到 `pack/` 目录下

2. **获取 PEM 文件的方式**：
   - 如果是已有扩展：从 Chrome Web Store 开发者后台下载 ZIP 包并提取
   - 如果是新扩展：手动生成 `npx crx keygen "path/to/directory" -o my-tab-search.pem`
   - 首次发布时 Google 会自动分配

**注意**：PEM 文件用于保持扩展的唯一标识符（ID），每次发布必须使用相同的 PEM 文件。

## 开始打包

安装完成后，可以通过以下方式打包：

```bash
# 使用便捷脚本（推荐）
.\run-packaging.ps1

# 或使用 npm 命令
npm run build
```

## 故障排除

如果遇到权限问题，在 PowerShell 中以管理员身份运行：

```bash
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```