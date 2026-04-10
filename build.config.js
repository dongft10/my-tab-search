/**
 * esbuild 构建配置
 * 用于 Chrome Extension 项目
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// 解析命令行参数
const args = process.argv.slice(2);
let env = 'dev';

args.forEach(arg => {
  if (arg.startsWith('--env=')) {
    env = arg.split('=')[1];
  }
});

console.log(`Building for environment: ${env}`);

// 环境配置
const API_BASE_URLS = {
  dev: 'http://localhost:41532',
  qa: 'https://habpbyhrqiik.ap-southeast-1.clawcloudrun.com',
  prod: 'https://habpbyhrqiik.ap-southeast-1.clawcloudrun.com'
};

// 定义环境变量替换
const define = {
  'process.env.ENV_TYPE': JSON.stringify(env),
  'process.env.API_BASE_URL': JSON.stringify(API_BASE_URLS[env]),
  'globalThis.ENV_TYPE': JSON.stringify(env)
};

// 输出目录
const outDir = 'pack/out/build';

// 确保输出目录存在
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
if (!fs.existsSync(path.join(outDir, 'js'))) {
  fs.mkdirSync(path.join(outDir, 'js'), { recursive: true });
}

// 入口点配置
const entryPoints = {
  // Service Worker - 使用 IIFE 格式
  'js/background': 'js/background.js',
  // Regular scripts (loaded via <script> without type="module")
  'js/utils/theme-early': 'js/utils/theme-early.js',
  'js/utils/theme': 'js/utils/theme.js',
  'js/utils/theme-init': 'js/utils/theme-init.js',
  'js/utils/theme-settings': 'js/utils/theme-settings.js',
  'js/i18n': 'js/i18n.js',
  // ESM modules (loaded via <script type="module">)
  'js/popup': 'js/popup.js',
  'js/popup-icons': 'js/popup-icons.js',
  'js/settings': 'js/settings.js',
  'js/pinned-list': 'js/pinned-list.js',
  'js/about': 'js/about.js',
  'js/auth': 'js/auth.js'
};

async function build() {
  try {
    // 构建 Service Worker (IIFE 格式，兼容 importScripts)
    console.log('Building background.js (Service Worker)...');
    await esbuild.build({
      entryPoints: ['js/background.js'],
      bundle: true,
      outfile: path.join(outDir, 'js/background.js'),
      format: 'iife',
      platform: 'browser',
      target: ['chrome120'],
      define,
      minify: env === 'prod',
      sourcemap: env !== 'prod' ? 'inline' : false,
      banner: {
        js: '// Built with esbuild - Service Worker Bundle'
      }
    });
    console.log('  ✓ background.js');

    // 构建普通脚本 (IIFE 格式，兼容普通 <script> 标签)
    const iifeEntries = [
      'js/utils/theme-early',
      'js/utils/theme',
      'js/utils/theme-init',
      'js/utils/theme-settings',
      'js/i18n'
    ];
    
    console.log('Building IIFE scripts...');
    for (const entry of iifeEntries) {
      await esbuild.build({
        entryPoints: [`${entry}.js`],
        bundle: true,
        outfile: path.join(outDir, `${entry}.js`),
        format: 'iife',
        platform: 'browser',
        target: ['chrome120'],
        define,
        minify: env === 'prod',
        sourcemap: env !== 'prod' ? 'inline' : false
      });
      console.log(`  ✓ ${entry}.js`);
    }

    // 构建 ESM 模块
    const esmEntries = [
      'js/popup',
      'js/popup-icons',
      'js/settings',
      'js/pinned-list',
      'js/about',
      'js/auth'
    ];
    
    console.log('Building ESM modules...');
    for (const entry of esmEntries) {
      await esbuild.build({
        entryPoints: [`${entry}.js`],
        bundle: true,
        outfile: path.join(outDir, `${entry}.js`),
        format: 'esm',
        platform: 'browser',
        target: ['chrome120'],
        define,
        minify: env === 'prod',
        sourcemap: env !== 'prod' ? 'inline' : false,
        splitting: false
      });
      console.log(`  ✓ ${entry}.js`);
    }

    // 复制静态资源
    console.log('Copying static assets...');
    copyStaticAssets();

    // 复制 manifest.json 并更新路径
    console.log('Processing manifest.json...');
    processManifest();

    console.log('\n✅ Build completed successfully!');
    console.log(`Output directory: ${outDir}/`);
    
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

/**
 * 复制静态资源到输出目录
 */
function copyStaticAssets() {
  // 复制根目录文件 (manifest.json, index.html, etc.)
  const rootFiles = ['manifest.json', 'index.html', 'PRIVACY_POLICY.html', 'LICENSE', 'README.md', 'README.en.md'];
  for (const file of rootFiles) {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, path.join(outDir, file));
    }
  }

  // 复制 HTML 文件
  const htmlDir = path.join(outDir, 'html');
  if (!fs.existsSync(htmlDir)) {
    fs.mkdirSync(htmlDir, { recursive: true });
  }
  copyDir('html', htmlDir, ['.html']);
  
  // 复制 CSS 文件
  const cssDir = path.join(outDir, 'css');
  if (!fs.existsSync(cssDir)) {
    fs.mkdirSync(cssDir, { recursive: true });
  }
  copyDir('css', cssDir, ['.css']);
  
  // 复制图片文件
  const imagesDir = path.join(outDir, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  copyDir('images', imagesDir, ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico']);
  
  // 复制 _locales 目录
  const localesDir = path.join(outDir, '_locales');
  if (!fs.existsSync(localesDir)) {
    fs.mkdirSync(localesDir, { recursive: true });
  }
  copyDir('_locales', localesDir);
}

/**
 * 复制目录
 */
function copyDir(src, dest, extensions = null) {
  if (!fs.existsSync(src)) return;
  
  const items = fs.readdirSync(src);
  
  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const stat = fs.statSync(srcPath);
    
    if (stat.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      copyDir(srcPath, destPath, extensions);
    } else if (stat.isFile()) {
      // 如果指定了扩展名，只复制匹配的文件
      if (extensions) {
        const ext = path.extname(item).toLowerCase();
        if (!extensions.includes(ext)) continue;
      }
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 处理 manifest.json
 */
function processManifest() {
  const manifestPath = 'manifest.json';
  const destPath = path.join(outDir, 'manifest.json');
  
  let content = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(content);
  
  // 更新 Service Worker 路径（指向打包后的文件）
  if (manifest.background && manifest.background.service_worker) {
    manifest.background.service_worker = 'js/background.js';
  }
  
  // 更新 web_accessible_resources 中的 JS 路径
  if (manifest.web_accessible_resources) {
    manifest.web_accessible_resources = manifest.web_accessible_resources.map(resource => ({
      ...resource,
      resources: resource.resources.map(r => {
        // JS 文件现在都在 js/ 目录下
        if (r.startsWith('js/') && r.endsWith('.js')) {
          return r; // 保持原路径
        }
        return r;
      })
    }));
  }
  
  fs.writeFileSync(destPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('  ✓ manifest.json');
}

// 执行构建
build();
