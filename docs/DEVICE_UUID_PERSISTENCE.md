# 静默注册改造 - 设备 UUID 持久化方案

## 📋 概述

### 背景

当前实现中，`userDeviceUuid` 存储在 `chrome.storage.local` 中，存在以下问题：

- `chrome.storage.local` 的数据在扩展卸载后会被**完全清除**
- 重新安装扩展时，会生成**新的** `userDeviceUuid`
- 导致无法识别同一台电脑上的不同安装

### 改造目标

使用 **IndexedDB** 替代 `chrome.storage.local` 来存储 `userDeviceUuid`，实现：

- ✅ 扩展卸载后数据**保留**
- ✅ 重新安装时可恢复**相同的 UUID**
- ✅ 无需额外权限
- ✅ 用户无感知

---

## 🔧 当前代码分析

### 现有流程

```
扩展安装 → chrome.storage.local.set('userDeviceUuid', uuid)
    ↓
扩展卸载 → chrome.storage.local.clear() （数据被清除）
    ↓
重新安装 → 生成新的 uuid （无法恢复）
```

### 问题

当前 `clearAllStorage()` 函数尝试保留 `userDeviceUuid`：

```javascript
// 第 1492-1511 行
async function clearAllStorage() {
  // 先获取 userDeviceUuid
  const result = await chrome.storage.local.get(STORAGE_KEYS_LOCAL.userDeviceUuid);
  const userDeviceUuid = result[STORAGE_KEYS_LOCAL.userDeviceUuid];

  // 清除所有数据
  await chrome.storage.local.clear();

  // 恢复 userDeviceUuid
  if (userDeviceUuid) {
    await chrome.storage.local.set({ [STORAGE_KEYS_LOCAL.userDeviceUuid]: userDeviceUuid });
  }
}
```

**问题**：`chrome.storage.local.clear()` 会在扩展卸载时被 Chrome 自动清除，无法恢复。

---

## 🛠️ 改造方案

### 改造后的流程

```
扩展首次安装
    ↓
IndexedDB 不存在 → 生成 UUID → 存入 IndexedDB
    ↓
扩展卸载 → IndexedDB 数据保留
    ↓
重新安装
    ↓
IndexedDB 存在 → 读取已有 UUID
    ↓
继续使用相同的 UUID
```

### 核心改动

| 序号 | 改动内容 | 文件 |
|------|---------|------|
| 1 | 新增 IndexedDB 工具类 | background.js |
| 2 | 修改 getUserDeviceUUID() 使用 IndexedDB | background.js |
| 3 | 移除 clearAllStorage() 中的 UUID 保留逻辑 | background.js |
| 4 | 扩展安装时从 IndexedDB 恢复 UUID | background.js |

---

## 📝 详细改造说明

### 1. 新增 IndexedDB 工具类

**位置**: background.js 顶部

```javascript
// ==================== IndexedDB 工具类 ====================

const DB_NAME = 'TabSearchDeviceDB';
const STORE_NAME = 'deviceInfo';
const DB_VERSION = 1;

/**
 * 打开 IndexedDB 数据库
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(new Error(`IndexedDB open error: ${event.target.error}`));
    };
  });
}

/**
 * 从 IndexedDB 获取设备 UUID
 */
async function getDeviceUUIDFromIndexedDB() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('deviceUUID');

    request.onsuccess = () => {
      resolve(request.result ? request.result.value : null);
    };

    request.onerror = () => {
      reject(new Error(`IndexedDB read error: ${event.target.error}`));
    };

    transaction.oncomplete = () => db.close();
  });
}

/**
 * 保存设备 UUID 到 IndexedDB
 */
async function saveDeviceUUIDToIndexedDB(uuid) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({
      id: 'deviceUUID',
      value: uuid,
      createdAt: new Date().toISOString()
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`IndexedDB write error: ${event.target.error}`));

    transaction.oncomplete = () => db.close();
  });
}
```

### 2. 修改 getUserDeviceUUID() 函数

**位置**: background.js（约第 1159-1178 行）

**改造前**:
```javascript
async getUserDeviceUUID() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS_LOCAL.userDeviceUuid, (result) => {
      if (result[STORAGE_KEYS_LOCAL.userDeviceUuid]) {
        resolve(result[STORAGE_KEYS_LOCAL.userDeviceUuid]);
      } else {
        // 生成新的 UUID
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ...);
        chrome.storage.local.set({ [STORAGE_KEYS_LOCAL.userDeviceUuid]: uuid }, () => {
          resolve(uuid);
        });
      }
    });
  });
}
```

**改造后（双层缓存）**:
```javascript
// 内存缓存（L1）
let _cachedUUID = null;

/**
 * 生成 UUID
 */
function generateUUID() {
  if (crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 获取设备 UUID（双层缓存策略）
 * L1: 内存缓存（最快）
 * L2: chrome.storage.local（较快）
 * L3: IndexedDB（持久化）
 */
async getUserDeviceUUID() {
  try {
    // L1: 优先从内存获取（~0ms）
    if (_cachedUUID) {
      console.log('[Background] UUID from memory cache:', _cachedUUID);
      return _cachedUUID;
    }

    // L2: 从 chrome.storage.local 获取（~1-5ms）
    const localResult = await chrome.storage.local.get(STORAGE_KEYS_LOCAL.userDeviceUuid);
    let uuid = localResult[STORAGE_KEYS_LOCAL.userDeviceUuid];

    if (uuid) {
      console.log('[Background] UUID from chrome.storage.local:', uuid);
      _cachedUUID = uuid;
      return uuid;
    }

    // L3: 从 IndexedDB 获取（~5-20ms）
    uuid = await getDeviceUUIDFromIndexedDB();

    if (uuid) {
      console.log('[Background] UUID from IndexedDB:', uuid);
      // 同步到 L2
      await chrome.storage.local.set({ [STORAGE_KEYS_LOCAL.userDeviceUuid]: uuid });
      _cachedUUID = uuid;
      return uuid;
    }

    // 没有找到，生成新的
    uuid = generateUUID();
    console.log('[Background] Generated new UUID:', uuid);

    // 保存到所有层级
    await saveDeviceUUIDToIndexedDB(uuid);
    await chrome.storage.local.set({ [STORAGE_KEYS_LOCAL.userDeviceUuid]: uuid });
    _cachedUUID = uuid;

    return uuid;
  } catch (error) {
    console.error('[Background] UUID recovery failed, fallback to memory:', error);
    // 降级方案：使用 chrome.storage.local
    return this.getUserDeviceUUIDLegacy();
  }
}

/**
 * 降级方案：使用 chrome.storage.local（原有逻辑）
 */
async getUserDeviceUUIDLegacy() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS_LOCAL.userDeviceUuid, (result) => {
      if (result[STORAGE_KEYS_LOCAL.userDeviceUuid]) {
        _cachedUUID = result[STORAGE_KEYS_LOCAL.userDeviceUuid];
        resolve(_cachedUUID);
      } else {
        const uuid = generateUUID();
        chrome.storage.local.set({ [STORAGE_KEYS_LOCAL.userDeviceUuid]: uuid }, () => {
          _cachedUUID = uuid;
          resolve(uuid);
        });
      }
    });
  });
}
```

### 3. 修改 clearAllStorage() 函数

**位置**: background.js（约第 1492-1511 行）

**改造前**:
```javascript
async function clearAllStorage() {
  // 尝试保留 userDeviceUuid
  const result = await chrome.storage.local.get(STORAGE_KEYS_LOCAL.userDeviceUuid);
  const userDeviceUuid = result[STORAGE_KEYS_LOCAL.userDeviceUuid];

  await chrome.storage.local.clear();

  if (userDeviceUuid) {
    await chrome.storage.local.set({ [STORAGE_KEYS_LOCAL.userDeviceUuid]: userDeviceUuid });
  }
}
```

**改造后**:
```javascript
async function clearAllStorage() {
  // 不再需要保留 userDeviceUuid
  // 因为 IndexedDB 会自动保留
  await chrome.storage.local.clear();
  console.log('[Background] Storage cleared (UUID preserved in IndexedDB)');
}
```

### 4. 修改扩展安装事件处理

**位置**: background.js（约第 1025-1040 行）

**改造后**:
```javascript
chrome.runtime.onInstalled.addListener(async (details) => {
  const { reason } = details;

  if (reason === 'install') {
    console.log('[TabSearch] Extension newly installed');
    // 全新安装：清除 chrome.storage.local，但 UUID 从 IndexedDB 恢复
    await clearAllStorage();

    // 确保 UUID 存在（会从 IndexedDB 恢复或生成新的）
    const auth = new AuthService();
    await auth.getUserDeviceUUID();
  } else if (reason === 'update') {
    console.log('[TabSearch] Extension updated');
  } else if (reason === 'chrome_update') {
    console.log('[TabSearch] Chrome updated');
  }

  await initializeAll();
});
```

---

## 📊 数据流程对比

### 改造前

```
首次安装：chrome.storage.local → uuid
卸载：数据清除
重装：新 uuid（不同）
```

### 改造后

```
首次安装：IndexedDB → uuid → chrome.storage.local
卸载：IndexedDB 保留
重装：IndexedDB → uuid → chrome.storage.local（相同）
```

---

## 🧪 测试场景

### 场景 1: 首次安装

**预期**:
- IndexedDB 中没有数据
- 生成新的 UUID
- 存入 IndexedDB 和 chrome.storage.local

### 场景 2: 卸载后重装

**预期**:
- IndexedDB 中保留原有 UUID
- 读取并使用相同的 UUID
- 同步到 chrome.storage.local

### 场景 3: 浏览器清除数据

**预期**:
- 如果用户清除"Cookie 及其他网站数据"，IndexedDB 会被清除
- 会生成新的 UUID
- 这是预期行为

---

## ⚠️ 注意事项

1. **数据隔离**：IndexedDB 数据仅存储在本地，不会跨设备同步
2. **隐私合规**：存储设备标识符需要在隐私政策中说明
3. **浏览器清除**：用户主动清除浏览器数据时，UUID 会丢失（正常行为）
4. **兼容性**：`crypto.randomUUID()` 需要 Chrome 92+，已包含降级方案

---

## 🔄 恢复机制：扩展卸载时保存 UUID

### 问题场景

1. 用户清除浏览器数据 → IndexedDB 被清除，但 chrome.storage.local 还在
2. 扩展正在正常使用 → 需要将 chrome.storage.local 中的 UUID 写回 IndexedDB

### 解决方案

利用 `chrome.runtime.onSuspend` 事件，在扩展即将被卸载时，将 UUID 保存回 IndexedDB。

**添加代码**：

```javascript
// 扩展即将被卸载时触发
chrome.runtime.onSuspend.addListener(async () => {
  console.log('[Background] Extension suspending, saving UUID to IndexedDB...');

  try {
    // 获取当前 chrome.storage.local 中的 UUID
    const result = await chrome.storage.local.get(STORAGE_KEYS_LOCAL.userDeviceUuid);
    const uuid = result[STORAGE_KEYS_LOCAL.userDeviceUuid];

    if (uuid) {
      // 保存到 IndexedDB
      await saveDeviceUUIDToIndexedDB(uuid);
      console.log('[Background] UUID saved to IndexedDB on suspend:', uuid);
    }
  } catch (error) {
    console.error('[Background] Failed to save UUID on suspend:', error);
  }
});
```

### 恢复流程

```
场景：用户清除浏览器数据，但扩展还在使用

1. 扩展正常运行
   → chrome.storage.local 有 UUID
   → IndexedDB 没有 UUID

2. 扩展即将被卸载（用户关闭浏览器或扩展）
   → chrome.runtime.onSuspend 触发
   → 将 UUID 从 chrome.storage.local 写入 IndexedDB

3. 扩展重新安装
   → 从 IndexedDB 读取 UUID
   → 使用相同的 UUID
```

### 额外保护：每次静默注册时同步

还可以在每次静默注册时，检查并同步 UUID：

```javascript
async getUserDeviceUUID() {
  try {
    // 1. 优先从 IndexedDB 获取
    let uuid = await getDeviceUUIDFromIndexedDB();

    // 2. 如果没有，检查 chrome.storage.local
    if (!uuid) {
      const result = await chrome.storage.local.get(STORAGE_KEYS_LOCAL.userDeviceUuid);
      uuid = result[STORAGE_KEYS_LOCAL.userDeviceUuid];

      // 3. 如果有，从 chrome.storage.local 恢复到 IndexedDB
      if (uuid) {
        await saveDeviceUUIDToIndexedDB(uuid);
        console.log('[Background] UUID restored to IndexedDB:', uuid);
      }
    }

    // 4. 如果还是没有，生成新的
    if (!uuid) {
      uuid = generateUUID();
      await saveDeviceUUIDToIndexedDB(uuid);
      await chrome.storage.local.set({ [STORAGE_KEYS_LOCAL.userDeviceUuid]: uuid });
    }

    // 5. 同步到 chrome.storage.local（兼容其他模块）
    await chrome.storage.local.set({ [STORAGE_KEYS_LOCAL.userDeviceUuid]: uuid });

    return uuid;
  } catch (error) {
    console.error('[Background] UUID recovery failed:', error);
    // 降级：使用 chrome.storage.local
    return this.getUserDeviceUUIDLegacy();
  }
}
```

### 完整恢复机制总结

| 时机 | 操作 |
|------|------|
| 扩展卸载前 (`onSuspend`) | 保存 UUID 到 IndexedDB ✅ |
| 静默注册时 (`getUserDeviceUUID`) | 检查并恢复 UUID ✅ |
| 首次安装 | 生成并保存 UUID ✅ |
| 重新安装 | 从 IndexedDB 读取 UUID ✅ |

---

## ✅ 总结

通过使用 IndexedDB 存储 `userDeviceUuid`，可以实现：

| 特性 | 效果 |
|------|------|
| 扩展卸载 | UUID 保留 ✅ |
| 重新安装 | 相同 UUID ✅ |
| 无需权限 | 不需要 manifest 声明 ✅ |
| 用户无感 | 完全自动运行 ✅ |
| 多设备 | 不同设备不同 UUID ✅ |

---

**文档版本**: 1.0
**创建日期**: 2026-03-10
**状态**: 待确认后实施
