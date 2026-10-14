# AGENTS.md - Chrome Extension Guidelines

This is the Chrome extension frontend for MyTabSearch project.

> **项目总览**: 请先阅读 `../backend-module/docs/PROJECT_OVERVIEW.md` 了解整体架构和跨模块协作指南。

## Build, Lint, and Test Commands

```bash
cd chrome-extension

# Install dependencies
npm install

# Build for production (minified)
npm run build

# Build for development (no compression)
npm run build:dev

# Create zip package
npm run package

# Clean build artifacts
npm run clean

# Sync version with manifest
npm run sync-version
```

## Code Style Guidelines

### JavaScript Code Style

#### Import Organization

- Use ES6 modules with `import/export` syntax
- No strict grouping requirements
- Named imports for specific exports: `import { CONFIG } from './config.js'`

#### Naming Conventions

- **Variables/functions**: camelCase (`selectedIndex`, `updateTabs`)
- **Classes**: PascalCase (`I18nManager`, `ApiClient`)
- **Constants**: UPPER\_SNAKE\_CASE (`MAX_PINNED_TABS`, `STORAGE_KEYS`)
- **Private methods**: Leading underscore convention (`_getMessage`)
- **Files**: kebab-case (`auth.service.js`, `user-device-uuid.js`)

#### Error Handling

- Use try-catch with async/await
- Log errors with `console.error()`
- Provide graceful degradation

#### Comments

- Use JSDoc-style for functions
- Use Chinese for comments (existing convention)

## Project Structure

```
chrome-extension/
├── js/
│   ├── api/           # API clients
│   ├── services/      # Business logic
│   └── utils/         # Utilities
├── _locales/          # i18n files
├── css/               # Stylesheets
├── html/              # HTML pages
├── images/            # Image assets
└── manifest.json
```

## Key Technologies

- Vanilla JavaScript (ES6+)
- Chrome Extension APIs
- Node.js build tools

## Notes

- No ESLint/Prettier config - follow manual style guidelines
- During the development and testing phase, after each front-end code adjustment is executed, remember to execute "npm run build:dev && npm run package"

## Git 远程仓库访问（固定走 SSH）

本仓库远程名为 `github`（`git@github.com:dongft10/my-tab-search.git`）。

**规则：所有读写远程仓库的操作（fetch / pull / push）一律使用 SSH，不要用 HTTPS。**

原因：本机 HTTPS 走本地代理 `127.0.0.1:7897`，代理客户端（Clash 等）未启动时所有 HTTPS 操作直接失败：

```
fatal: unable to access 'https://github.com/dongft10/my-tab-search.git/':
Failed to connect to 127.0.0.1 port 7897 after 2095 ms: Couldn't connect to server
```

SSH 不经过该代理，实测稳定可用：`~/.ssh/config` 中 `Host github.com` 已绑定密钥 `~/.ssh/id_ed25519_github_dongft10`（端口 22 直连正常）。

### 命令

```bash
# 连通性自检（输出 "Hi dongft10! You've successfully authenticated" 即正常）
ssh -T git@github.com

# 查看远端分支与 SHA
git ls-remote git@github.com:dongft10/my-tab-search.git

# 拉取全部远程分支到 github/*（不切换分支，仅更新远程跟踪引用）
git fetch git@github.com:dongft10/my-tab-search.git '+refs/heads/*:refs/remotes/github/*' --tags --prune

# 推送分支
git push git@github.com:dongft10/my-tab-search.git <branch>
```

远程 `github` 的 URL 已设为 SSH，因此 `git fetch github` / `git push github <branch>` 可直接使用；
如需临时切回 HTTPS（代理正常时）：`git remote set-url github https://github.com/dongft10/my-tab-search.git`

### 排查顺序

1. HTTPS 报 `Failed to connect to 127.0.0.1 port 7897` → 代理没启动，**不要去调代理配置，直接改用 SSH**。
2. `ssh -T git@github.com` 失败 → 检查 `~/.ssh/config` 的 `Host github.com` 段与私钥 `id_ed25519_github_dongft10` 是否存在。
3. 若网络封锁 22 端口，可走 `ssh.github.com:443`，但需在 `~/.ssh/config` 为 `Host ssh.github.com` 单独指定同一密钥（当前未配置）。

