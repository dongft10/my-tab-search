# 打包脚本使用说明

## 📦 两个批处理文件

### 1. pack.bat - 生产版本（压缩）
**用途**：打包压缩的 Chrome 扩展，用于发布到 Chrome Web Store

**使用方法**：
- 直接双击 `pack\pack.bat` 文件
- 或在命令行运行：`.\pack\pack.bat`

**特点**：
- ✅ 压缩所有 JS 和 CSS 文件（节省约 183 KB）
- ✅ 生成 CRX 和 ZIP 文件
- ✅ 适合生产环境部署

---

### 2. pack-no-compress.bat - 开发版本（不压缩）
**用途**：打包未压缩的 Chrome 扩展，用于开发调试

**使用方法**：
- 直接双击 `pack\pack-no-compress.bat` 文件
- 或在命令行运行：`.\pack\pack-no-compress.bat`

**特点**：
- ✅ 保留原始 JS 和 CSS 文件，便于调试
- ✅ 生成 CRX 和 ZIP 文件
- ✅ 适合开发和测试阶段使用

---

## 🎯 推荐使用方式

### Windows 用户（推荐）
直接双击批处理文件即可：
- 📦 **生产发布** → 双击 `pack.bat`
- 🔧 **开发调试** → 双击 `pack-no-compress.bat`

### 命令行用户
```bash
# 生产版本（压缩）
npm run build

# 开发版本（不压缩）
npm run build:dev
```

---

## 📂 输出文件

打包完成后，输出文件在 `pack/out/` 目录：
- `my-tab-search-v{version}.crx` - 用于本地安装
- `my-tab-search-v{version}.zip` - 用于 Chrome Web Store 发布

---

## ⚠️ 注意事项

1. **PEM 密钥文件**：需要将 `my-tab-search.pem` 文件放置在项目根目录或 pack 目录
2. **Node.js**：确保已安装 Node.js
3. **依赖安装**：首次运行会自动安装依赖

---

## 🔍 如何区分开发和生产版本？

| 特征 | pack.bat (生产) | pack-no-compress.bat (开发) |
|------|----------------|---------------------------|
| 文件大小 | 较小（压缩后） | 较大（未压缩） |
| 调试难度 | 困难（代码已压缩） | 容易（保留源代码） |
| 适用场景 | 发布到 Chrome Web Store | 开发、测试、调试 |
| 打包时间 | 稍长（需要压缩） | 较短（跳过压缩） |

---

## 💡 开发建议

- **开发阶段**：使用 `pack-no-compress.bat`，方便查看和调试代码
- **测试阶段**：使用 `pack-no-compress.bat`，快速验证功能
- **发布阶段**：使用 `pack.bat`，优化文件大小和性能
