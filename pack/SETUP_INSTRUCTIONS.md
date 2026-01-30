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