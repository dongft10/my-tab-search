# 扩展卸载后重新安装存储数据清理说明

**问题描述**:  
用户移除扩展后重新安装，`chrome.storage.local` 的数据默认会被保留，导致重新安装后仍然显示"已登录"状态。这不符合用户预期。

**解决方案**:  
在扩展全新安装时（`chrome.runtime.onInstalled` 事件的 `install` 原因），清除所有本地存储数据，但**保留 `userDeviceUuid`**。

---

## 📋 实现细节

### 1. 修改文件
- `js/background.js` - 添加存储清理逻辑

### 2. 核心逻辑

```javascript
chrome.runtime.onInstalled.addListener(async (details) => {
  const { reason } = details;
  
  if (reason === 'install') {
    console.log('[TabSearch] Extension newly installed');
    // 全新安装，清除所有旧的存储数据（但保留 userDeviceUuid）
    await clearAllStorage();
  } else if (reason === 'update') {
    console.log('[TabSearch] Extension updated');
    // 更新时不清除数据，保留用户状态
  }
  
  await initializeAll();
});
```

### 3. 清理函数

```javascript
async function clearAllStorage() {
  try {
    // 先获取 userDeviceUuid
    const result = await chrome.storage.local.get(STORAGE_KEYS_LOCAL.userDeviceUuid);
    const userDeviceUuid = result[STORAGE_KEYS_LOCAL.userDeviceUuid];
    
    // 清除所有数据
    await chrome.storage.local.clear();
    
    // 恢复 userDeviceUuid
    if (userDeviceUuid) {
      await chrome.storage.local.set({ [STORAGE_KEYS_LOCAL.userDeviceUuid]: userDeviceUuid });
      console.log('[Background] Storage cleared but userDeviceUuid preserved:', userDeviceUuid);
    } else {
      console.log('[Background] All storage cleared (no existing userDeviceUuid)');
    }
  } catch (error) {
    console.error('[Background] Failed to clear storage:', error);
  }
}
```

---

## 🎯 数据保留策略

### ✅ 保留的数据
- **`userDeviceUuid`** - 设备的唯一标识符
  - **原因**: 即使用户卸载扩展后重新安装，也应该视为同一台设备
  - **好处**: 后端可以识别这是老用户，而不是全新的设备

### ❌ 清除的数据
- **`userId`** - 用户 ID
- **`deviceId`** - 设备 ID（后端分配的）
- **`accessToken`** - 访问令牌
- **`tokenExpiresAt`** - 令牌过期时间
- **`registeredAt`** - 注册时间（邮箱验证或 OAuth 登录时间）
- **`pinnedTabsWindowId`** - 固定标签页弹窗 ID
- **`curTabId`, `preTabId`, `curWindowId`, `tabHistory`** - 标签页切换状态
- **所有其他本地存储数据**

---

## 🧪 测试场景

### 场景 1: 全新安装
**步骤**:
1. 在 Chrome 中完全卸载扩展
2. 重新安装扩展
3. 打开 `settings.html` 页面

**预期结果**:
- ✅ 显示"未登录"状态
- ✅ `userDeviceUuid` 仍然存在（与卸载前相同）
- ✅ 所有其他用户数据已清除

### 场景 2: 扩展更新
**步骤**:
1. 用户已登录
2. 更新扩展版本
3. 打开 `settings.html` 页面

**预期结果**:
- ✅ 保持"已登录"状态
- ✅ 所有用户数据保留
- ✅ `userDeviceUuid` 保持不变

### 场景 3: Chrome 浏览器更新
**步骤**:
1. 用户已登录
2. Chrome 浏览器更新
3. 打开 `settings.html` 页面

**预期结果**:
- ✅ 保持"已登录"状态
- ✅ 所有用户数据保留

---

## 📊 数据清理对比

| 数据类型 | 卸载后重装 | 扩展更新 | 说明 |
|---------|-----------|---------|------|
| `userDeviceUuid` | ✅ **保留** | ✅ 保留 | 设备唯一标识符 |
| `userId` | ❌ 清除 | ✅ 保留 | 用户 ID |
| `deviceId` | ❌ 清除 | ✅ 保留 | 后端分配的设备 ID |
| `accessToken` | ❌ 清除 | ✅ 保留 | 访问令牌 |
| `registeredAt` | ❌ 清除 | ✅ 保留 | 注册时间 |
| 标签页状态 | ❌ 清除 | ✅ 保留 | 切换状态数据 |

---

## 🔍 技术说明

### 为什么 `chrome.storage.local` 在卸载后不会被清除？

这是 Chrome 的设计行为：
- `chrome.storage.local` 的数据**默认在扩展卸载后保留**
- 这是为了在扩展意外崩溃或被禁用后恢复数据
- 但这也导致用户重新安装时数据仍然存在

### 我们的解决方案

1. **检测全新安装**: 使用 `chrome.runtime.onInstalled` 事件的 `details.reason === 'install'`
2. **选择性清理**: 清除所有数据，但保留 `userDeviceUuid`
3. **日志记录**: 记录清理操作，便于调试

### 为什么保留 `userDeviceUuid`？

1. **设备识别**: 后端需要识别这是同一台设备
2. **用户体验**: 即使用户卸载重装，后端仍能识别是老用户
3. **数据分析**: 有助于分析用户行为和留存率

---

## 📝 注意事项

1. **同步存储 (`chrome.storage.sync`)**: 
   - 本方案只清理 `chrome.storage.local`
   - 如果使用了 `chrome.storage.sync`，需要额外的清理逻辑

2. **IndexedDB**:
   - 如果扩展使用了 IndexedDB 存储数据
   - 需要在清理函数中也清除 IndexedDB 数据

3. **后端状态**:
   - 清除本地数据不会影响后端数据库
   - 后端的用户和设备记录仍然存在

---

## ✅ 验证方法

### 方法 1: 使用 Chrome 开发者工具
1. 打开扩展的后台页面（`chrome://extensions/` → 详情 → Service Worker）
2. 打开开发者工具
3. 查看控制台日志
4. 卸载并重新安装扩展
5. 检查日志：应该看到 `Storage cleared but userDeviceUuid preserved: xxx`

### 方法 2: 使用 `chrome.storage` API
```javascript
// 在控制台执行
chrome.storage.local.get(null, (result) => {
  console.log('所有存储数据:', result);
});
```

---

## 🎯 总结

通过在全新安装时清除本地存储数据（但保留 `userDeviceUuid`），我们实现了：

- ✅ **用户预期**: 重新安装后是全新的登录状态
- ✅ **设备识别**: 后端仍能识别这是同一台设备
- ✅ **数据一致性**: 本地数据与后端状态保持一致
- ✅ **用户体验**: 更新扩展时不会丢失登录状态

---

**实施日期**: 2026-03-10  
**修改文件**: `js/background.js`  
**影响范围**: 扩展安装/更新流程
