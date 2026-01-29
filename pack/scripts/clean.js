const fs = require('fs');
const path = require('path');

/**
 * 清理输出目录
 */
function cleanOutputDir(outputDir) {
  if (fs.existsSync(outputDir)) {
    console.log(`Cleaning output directory: ${outputDir}`);
    
    // 读取目录中的所有文件和子目录
    const files = fs.readdirSync(outputDir);
    
    for (const file of files) {
      const filePath = path.join(outputDir, file);
      
      if (fs.statSync(filePath).isDirectory()) {
        // 递归删除子目录
        cleanOutputDir(filePath);
        // 删除空目录
        fs.rmdirSync(filePath);
        console.log(`Removed directory: ${filePath}`);
      } else {
        // 删除文件
        fs.unlinkSync(filePath);
        console.log(`Removed file: ${filePath}`);
      }
    }
    
    console.log(`Output directory cleaned: ${outputDir}`);
  } else {
    console.log(`Output directory does not exist: ${outputDir}`);
  }
}

/**
 * 主函数
 */
function main() {
  // 获取命令行参数
  let outputDir = process.argv[3];
  
  // 如果没有指定输出目录，则默认为项目根目录下的 pack/out
  if (!outputDir) {
    outputDir = path.join(__dirname, '..', 'out');
  }
  
  console.log('Starting clean process for Chrome extension output...');
  console.log(`Output directory: ${outputDir}`);
  
  cleanOutputDir(outputDir);
  
  console.log('Clean process completed!');
}

// 执行主函数
main();