const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

/**
 * 创建 ZIP 文件
 */
function createZipFile(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    output.on('close', () => {
      console.log(`ZIP file created: ${outputPath}`);
      console.log(`Total bytes: ${archive.pointer()}`);
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

    // 检查 crx 是否已安装，如果没有则自动安装
    let crxAvailable = false;
    try {
      const helpResult = execSync('crx --help', { stdio: ['pipe', 'pipe', 'pipe'], shell: true });
      if (helpResult && helpResult.toString().includes('pack')) {
        crxAvailable = true;
      }
    } catch (error) {
      // 如果命令失败，说明 crx 不可用，尝试安装
      console.log('CRX tool not found. Installing crx...');
      try {
        execSync('npm install -g crx', { stdio: 'inherit', shell: true });
        console.log('CRX tool installed successfully!');
        crxAvailable = true;
      } catch (installError) {
        console.error('Failed to install crx tool:', installError.message);
        crxAvailable = false;
      }
    }

    // 创建带版本号的 CRX 文件
    const crxPath = path.join(outputDir, `my-tab-search-v${version}.crx`);
    // 创建带版本号的 ZIP 文件
    const zipPath = path.join(outputDir, `my-tab-search-v${version}.zip`);

    if (crxAvailable) {
      // 使用 crx 工具来创建 CRX 文件，使用现有的 PEM 密钥文件
      // 优先从项目根目录查找 PEM 文件，然后回退到 pack 目录
      const rootPemPath = path.join(__dirname, '..', '..', '..', 'my-tab-search.pem'); // 项目根目录
      const packPemPath = path.join(__dirname, '..', '..', 'pack', 'my-tab-search.pem'); // pack 目录
      
      let pemPath = '';
      if (fs.existsSync(rootPemPath)) {
        pemPath = rootPemPath;
        console.log('Using PEM key from project root directory.');
      } else if (fs.existsSync(packPemPath)) {
        pemPath = packPemPath;
        console.log('Using PEM key from pack directory.');
      } else {
        console.log('PEM key file not found in either root or pack directory. Generating new PEM key in root directory...');
        try {
          execSync(`crx keygen "${path.dirname(rootPemPath)}" -o my-tab-search.pem`, { stdio: 'inherit', shell: true });
          console.log('PEM key generated successfully in project root directory!');
          pemPath = rootPemPath;
        } catch (keygenError) {
          console.error('Failed to generate PEM key:', keygenError.message);
          throw new Error('Cannot proceed without PEM key file');
        }
      }
      
      execSync(`crx pack "${buildDir}" -o "${crxPath}" --private-key="${pemPath}"`, { stdio: 'inherit', shell: true });
      console.log(`CRX file created: ${crxPath}`);

      // 创建 ZIP 文件（用于 Chrome Web Store 发布）
      console.log('Creating ZIP file for Chrome Web Store...');
      await createZipFile(buildDir, zipPath);

      console.log('\nPackaging completed successfully!');
      console.log(`Build directory: ${buildDir}`);
      console.log(`CRX file: ${crxPath}`);
      console.log(`ZIP file: ${zipPath}`);
    } else {
      throw new Error('CRX tool is not available. Please install it manually with: npm install -g crx');
    }
  } catch (error) {
    console.error('Error during packaging process:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}