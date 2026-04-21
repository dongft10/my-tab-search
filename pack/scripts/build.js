const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 主构建函数
 */
async function main() {
  // 解析命令行参数，识别 --skip-compress 或 --compress=false 标志
  const args = process.argv.slice(2);
  let skipCompress = false;
  
  // 检查 --skip-compress
  const skipCompressIndex = args.indexOf('--skip-compress');
  if (skipCompressIndex !== -1) {
    skipCompress = true;
    args.splice(skipCompressIndex, 1);
  }
  
  // 检查 --compress=false
  const compressFalseIndex = args.findIndex(arg => arg.startsWith('--compress='));
  if (compressFalseIndex !== -1) {
    const compressValue = args[compressFalseIndex].split('=')[1];
    if (compressValue && compressValue.toLowerCase() === 'false') {
      skipCompress = true;
    }
    args.splice(compressFalseIndex, 1);
  }
  
  const sourceDir = args[0] && !args[0].startsWith('--') ? args[0] : path.join(__dirname, '..', 'out', 'build'); // 默认从 pack/out/build 读取
  let outputDir = args[1] && !args[1].startsWith('--') ? args[1] : undefined;

  // 如果没有指定输出目录，则默认为项目根目录下的 pack/out
  if (!outputDir) {
    outputDir = path.join(__dirname, '..', '..', 'pack', 'out');
  }

  console.log('Starting build process for Chrome extension...');
  console.log(`Source directory: ${sourceDir}`);
  console.log(`Output directory: ${outputDir}`);

  try {
    // 运行打包脚本（这将包含压缩步骤）
    const packageScript = path.join(__dirname, 'package.js');
    console.log('Running package script...');
    
    let cmd = `node "${packageScript}" "${sourceDir}" "${outputDir}"`;
    if (skipCompress) {
        cmd += ' --skip-compression';
        console.log('Skipping compression step...');
    }
    
    execSync(cmd, { stdio: 'inherit' });

    console.log('\nBuild process completed successfully!');
    console.log(`Output files are in: ${outputDir}`);
  } catch (error) {
    console.error('Error during build process:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}