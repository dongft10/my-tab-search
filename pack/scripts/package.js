const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { execSync } = require('child_process');

/**
 * 复制源文件到构建目录，排除不需要的文件和目录
 */
function copySourceFiles(srcDir, destDir) {
  // 定义要排除的目录和文件
  const excludeDirs = ['node_modules', '.git', 'out', 'pack', '.vscode', 'dist', 'build', '.idea', 'scripts', 'rwpt', 'vscode-markdown-editor'];
  const excludeFiles = ['.gitignore', 'package.json', 'package-lock.json', '*.crx', '*.zip', '*.pem', '*.ps1', 'README.md', 'SETUP_INSTRUCTIONS.md'];

  // 确保目标目录存在
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // 读取源目录
  const items = fs.readdirSync(srcDir);

  for (const item of items) {
    const srcPath = path.join(srcDir, item);
    const destPath = path.join(destDir, item);
    const stat = fs.statSync(srcPath);

    // 检查是否为排除的目录
    const isExcludedDir = excludeDirs.includes(item);

    // 检查是否为排除的文件
    const isExcludedFile = excludeFiles.some(pattern => {
      if (pattern.startsWith('*')) {
        const regex = new RegExp(`^.*${pattern.replace(/\*/g, '.*')}$`);
        return regex.test(item);
      }
      return pattern === item;
    });

    if (stat.isDirectory() && !isExcludedDir) {
      copySourceFiles(srcPath, destPath);
    } else if (stat.isFile() && !isExcludedFile) {
      // 只复制项目实际需要的文件
      const allowedExtensions = ['.js', '.json', '.css', '.html', '.htm', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.txt', '.md'];
      const fileExt = path.extname(item).toLowerCase();

      // 如果文件扩展名在允许列表中，则复制
      if (allowedExtensions.includes(fileExt)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

/**
 * 创建 ZIP 格式的扩展包
 */
function createZip(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // 设置最大压缩级别
    });

    output.on('close', () => {
      console.log(`ZIP created: ${archive.pointer()} total bytes`);
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

/**
 * 主函数
 */
async function main() {
  const sourceDir = process.argv[2] || '.';
  let outputDir = process.argv[3];
  const skipCompression = process.argv[4] === '--skip-compression'; // 新增参数控制是否跳过压缩

  // 如果没有指定输出目录，则默认为项目根目录下的 pack/out
  if (!outputDir) {
    outputDir = path.join(__dirname, '..', '..', 'pack', 'out');
  }

  const buildDir = path.join(outputDir, 'build');

  console.log('Starting packaging of Chrome extension...');
  console.log(`Source directory: ${sourceDir}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Skip compression: ${skipCompression}`);

  try {
    // 清理并创建构建目录
    if (fs.existsSync(buildDir)) {
      fs.rmSync(buildDir, { recursive: true, force: true });
    }

    // 复制源文件到构建目录
    console.log('Copying source files...');
    copySourceFiles(sourceDir, buildDir);

    // 如果未指定跳过压缩，则压缩文件
    if (!skipCompression) {
      console.log('Compressing files...');
      const compressScript = path.join(__dirname, 'compress.js');
      execSync(`node "${compressScript}" "${buildDir}"`, { stdio: 'inherit' });
    } else {
      console.log('Skipping compression step...');
    }

    // 创建输出目录
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 从 manifest.json 读取版本号
    const manifestPath = path.join(buildDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const version = manifest.version;

    // 检查 crx 是否已安装（优先使用 crx，因为 crx3 在新版 Node.js 中有问题）
    let crxAvailable = false;
    try {
      const helpResult = execSync('crx --help', { stdio: ['pipe', 'pipe', 'pipe'], shell: true });
      if (helpResult && helpResult.toString().includes('pack')) {
        crxAvailable = true;
      }
    } catch (error) {
      // 如果命令失败，说明 crx 不可用
      crxAvailable = false;
    }

    if (crxAvailable) {
      // 如果 crx 可用，则创建带版本号的 CRX 文件
      const crxPath = path.join(outputDir, `my-tab-search-v${version}.crx`);

      // 使用 crx 工具来创建 CRX 文件，使用现有的 PEM 密钥文件
      execSync(`crx pack "${buildDir}" -o "${crxPath}" --private-key="${path.join(__dirname, '..', '..', 'pack', 'my-tab-search.pem')}"`, { stdio: 'inherit', shell: true });
      console.log(`CRX file created: ${crxPath}`);

      console.log('\nPackaging completed successfully!');
      console.log(`Build directory: ${buildDir}`);
      console.log(`CRX file: ${crxPath}`);
    } else {
      console.log('CRX tool not found. Creating ZIP package as fallback...');

      // 如果 crx 不可用，则创建带版本号的 ZIP 包作为备选
      const zipPath = path.join(outputDir, `my-tab-search-v${version}.zip`);
      console.log('Creating ZIP package...');
      await createZip(buildDir, zipPath);

      console.log('\nPackaging completed successfully!');
      console.log(`Build directory: ${buildDir}`);
      console.log(`Package file: ${zipPath}`);
      console.log('To generate CRX file, install crx with: npm install -g crx');
    }
  } catch (error) {
    console.error('Error during packaging process:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}