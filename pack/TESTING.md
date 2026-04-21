# 测试打包脚本

## 测试 1: 默认压缩打包（生产版本）
```bash
cd chrome-extension
npm run build
```
预期结果：
- 执行压缩步骤
- 输出 "Compressing files..."
- 显示压缩节省的字节数（约 183 KB）
- Skip compression: false

## 测试 2: 使用 pack.bat（Windows，生产版本）
直接双击 `pack\pack.bat` 文件，或在命令行运行：
```batch
.\pack\pack.bat
```
预期结果：
- 执行压缩步骤
- 输出 "Compressing files..."
- 显示压缩节省的字节数

## 测试 3: 使用 pack-no-compress.bat（Windows，开发版本）
直接双击 `pack\pack-no-compress.bat` 文件，或在命令行运行：
```batch
.\pack\pack-no-compress.bat
```
预期结果：
- 跳过压缩步骤
- 输出 "Skipping compression step..." 两次
- Skip compression: true
- 显示 "[NOTE] Development build: Files are NOT compressed for easier debugging"

## 测试 4: 使用 build:dev 脚本（不压缩）
```bash
cd chrome-extension
npm run build:dev
```
预期结果：
- 跳过压缩步骤
- 输出 "Skipping compression step..."
- Skip compression: true

## 测试 5: 使用 build:compress=false 脚本（不压缩）
```bash
cd chrome-extension
npm run build:compress=false
```
预期结果：
- 跳过压缩步骤
- 输出 "Skipping compression step..."
- Skip compression: true

## 测试 6: 直接传递 --compress=false 参数
```bash
cd chrome-extension
node pack/scripts/build.js --compress=false
```
预期结果：
- 跳过压缩步骤
- 输出 "Skipping compression step..."
- Skip compression: true

## 测试 7: 直接传递 --skip-compress 参数
```bash
cd chrome-extension
node pack/scripts/build.js --skip-compress
```
预期结果：
- 跳过压缩步骤
- 输出 "Skipping compression step..."
- Skip compression: true

## 验证要点

1. ✅ 所有不压缩模式都应该：
   - 在 pack/out/build 目录中保留未压缩的 .js 和 .css 文件
   - 仍然生成 CRX 和 ZIP 文件
   - 输出 "Skipping compression step..." 两次（build.js 和 package.js 各一次）
   - Skip compression: true

2. ✅ 默认压缩模式（pack.bat）应该：
   - 压缩 .js 和 .css 文件
   - 显示 "Compressing files..."
   - 显示压缩节省的字节数（约 183 KB）
   - Skip compression: false

3. ✅ 两个批处理文件应该：
   - pack.bat：简单明了，只用于生产版本打包
   - pack-no-compress.bat：简单明了，只用于开发版本打包
   - 都能正确切换到 chrome-extension 目录
   - 都能正确安装依赖并打包
