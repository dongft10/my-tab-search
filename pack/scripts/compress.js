const fs = require('fs');
const path = require('path');
const Terser = require('terser');
const CleanCSS = require('clean-css');

/**
 * 压缩 JavaScript 文件
 */
async function compressJS(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  
  try {
    const result = await Terser.minify(code, {
      compress: {
        drop_console: true,
        drop_debugger: true
      },
      mangle: true
    });
    
    fs.writeFileSync(filePath, result.code);
    return code.length - result.code.length; // 返回节省的字节数
  } catch (error) {
    console.warn(`Warning: Could not compress ${filePath}:`, error.message);
    return 0;
  }
}

/**
 * 压缩 CSS 文件
 */
function compressCSS(filePath) {
  const css = fs.readFileSync(filePath, 'utf8');
  
  try {
    const result = new CleanCSS({
      level: 2,
      format: 'keep-breaks'
    }).minify(css);
    
    fs.writeFileSync(filePath, result.styles);
    return css.length - result.styles.length; // 返回节省的字节数
  } catch (error) {
    console.warn(`Warning: Could not compress ${filePath}:`, error.message);
    return 0;
  }
}

/**
 * 压缩 HTML 文件
 */
function compressHTML(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const originalLength = html.length;
  
  // 移除注释，但保留条件注释
  html = html.replace(/<!--(?!\s*build|endif|if).*?-->/gi, '');
  
  // 移除多余的空白和换行
  html = html.replace(/\s+/g, ' ');
  html = html.replace(/\s*([{}:=,\[\]])\s*/g, '$1');
  html = html.trim();
  
  fs.writeFileSync(filePath, html);
  return originalLength - html.length; // 返回节省的字节数
}

/**
 * 递归遍历目录并压缩文件
 */
async function compressDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  let totalSaved = 0;
  let fileCount = 0;

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // 排除特定目录
      const dirName = path.basename(filePath);
      if (dirName !== 'node_modules' && dirName !== '.git' && dirName !== 'out' && 
          dirName !== 'pack' && dirName !== '.vscode' && dirName !== 'dist' && 
          dirName !== 'build' && dirName !== '.idea') {
        const result = await compressDirectory(filePath);
        totalSaved += result.saved;
        fileCount += result.count;
      }
    } else {
      let saved = 0;
      const ext = path.extname(file).toLowerCase();

      if (ext === '.js') {
        saved = await compressJS(filePath);
        fileCount++;
      } else if (ext === '.css') {
        saved = compressCSS(filePath);
        fileCount++;
      } else if (ext === '.html' || ext === '.htm') {
        saved = compressHTML(filePath);
        fileCount++;
      }

      totalSaved += saved;
      
      if (saved > 0) {
        console.log(`Compressed ${filePath} (${saved} bytes saved)`);
      }
    }
  }

  return { saved: totalSaved, count: fileCount };
}

/**
 * 主函数
 */
async function main() {
  const sourceDir = process.argv[2] || '.';
  
  console.log('Starting compression of Chrome extension files...');
  console.log(`Source directory: ${sourceDir}`);
  
  try {
    const result = await compressDirectory(sourceDir);
    
    console.log('\nCompression completed!');
    console.log(`Files processed: ${result.count}`);
    console.log(`Total space saved: ${result.saved} bytes (${Math.round(result.saved / 1024 * 100) / 100} KB)`);
  } catch (error) {
    console.error('Error during compression:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { compressJS, compressCSS, compressHTML, compressDirectory };