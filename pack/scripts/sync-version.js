/**
 * 版本同步脚本
 * 从 manifest.json 读取版本号，同步到 package.json 和 package-lock.json
 */

const fs = require('fs');
const path = require('path');

/**
 * 同步版本号
 */
function syncVersion() {
  try {
    // 获取项目根目录
    const rootDir = path.join(__dirname, '..', '..');
    
    // 读取 manifest.json
    const manifestPath = path.join(rootDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const manifestVersion = manifest.version;
    
    if (!manifestVersion) {
      console.error('Error: version not found in manifest.json');
      process.exit(1);
    }
    
    console.log(`Manifest version: ${manifestVersion}`);
    
    // 更新 package.json
    const packagePath = path.join(rootDir, 'package.json');
    if (fs.existsSync(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const oldVersion = packageJson.version;
      
      if (oldVersion !== manifestVersion) {
        packageJson.version = manifestVersion;
        fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
        console.log(`✅ Updated package.json: ${oldVersion} -> ${manifestVersion}`);
      } else {
        console.log(`ℹ️  package.json version is already up to date (${manifestVersion})`);
      }
    }
    
    // 更新 package-lock.json
    const packageLockPath = path.join(rootDir, 'package-lock.json');
    if (fs.existsSync(packageLockPath)) {
      const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
      const oldLockVersion = packageLock.version;
      const oldLockRootVersion = packageLock.packages?.['']?.version;
      
      let updated = false;
      
      // 更新顶层 version
      if (packageLock.version !== manifestVersion) {
        packageLock.version = manifestVersion;
        updated = true;
      }
      
      // 更新 packages[""] 中的 version
      if (packageLock.packages && packageLock.packages[''] && packageLock.packages[''].version !== manifestVersion) {
        packageLock.packages[''].version = manifestVersion;
        updated = true;
      }
      
      if (updated) {
        fs.writeFileSync(packageLockPath, JSON.stringify(packageLock, null, 2) + '\n');
        console.log(`✅ Updated package-lock.json: ${oldLockVersion} -> ${manifestVersion}`);
      } else {
        console.log(`ℹ️  package-lock.json version is already up to date (${manifestVersion})`);
      }
    }
    
    console.log('\n✨ Version sync completed successfully!');
    console.log(`Current version: ${manifestVersion}`);
    
  } catch (error) {
    console.error('Error syncing version:', error.message);
    process.exit(1);
  }
}

// 执行同步
syncVersion();
