const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 主构建函数
 */
async function main() {
  // 解析命令行参数，识别 --skip-compress 标志
  const args = process.argv.slice(2);
  const skipCompressIndex = args.indexOf('--skip-compress');
  const skipCompress = skipCompressIndex !== -1;
  
  // 如果找到了标志，则从参数数组中移除它
  if (skipCompress) {
    args.splice(skipCompressIndex, 1);
  }
  
  const sourceDir = args[0] || '.'; // 当前目录作为源目录
  let outputDir = args[1];

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