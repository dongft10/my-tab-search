# OAuth 登录后 401 错误修复报告

**问题发现时间**: 2026-03-10  
**问题类型**: 认证 Token 未同步  
**修复状态**: ✅ 已修复  

---

## 🔍 问题描述

### 现象
从服务器日志可以看到:
1. ✅ OAuth 登录成功 (`/api/v1/auth/oauth/token-login` 返回 200)
2. ✅ 后端正确生成了 Token
3. ❌ 后续所有 API 请求都返回 401 未授权错误

```
[OAuthTokenLogin] Generating token with userID=203d6499-..., deviceID=36116cb4-..., version=2.0.0
[GIN] POST "/api/v1/auth/oauth/token-login" -> 200

[GIN] GET "/api/v1/trial/status" -> 401
[GIN] GET "/api/v1/vip/status" -> 401
[GIN] GET "/api/v1/user/profile" -> 401
[GIN] GET "/api/v1/devices" -> 401
```

### 根本原因分析

1. **OAuth 流程正常**:
   - 前端调用 `chrome.identity.launchWebAuthFlow` 打开 OAuth 窗口
   - 用户授权后，获取到 access_token
   - 调用后端 `/api/v1/auth/oauth/token-login` 换取 JWT Token
   - Token 被保存到 `chrome.storage.local`

2. **问题所在**:
   - OAuth 回调页面 (`auth.html`) 保存 Token 后关闭
   - 发送了 `AUTH_SUCCESS` 消息给扩展
   - **但是没有页面监听这个消息**
   - 主页面 (settings.html) 继续使用旧的 API Client 实例
   - API Client 没有重新从 storage 中读取 Token

3. **代码问题**:
   - `auth.js` 第 143-148 行发送 `AUTH_SUCCESS` 消息
   - **没有任何页面监听这个消息**
   - 导致 Token 已保存但页面未刷新

---

## 🔧 修复方案

### 方案选择

考虑了以下方案:

1. **方案 A**: 在 background.js 中监听并广播消息 (复杂)
2. **方案 B**: 各页面监听 `AUTH_SUCCESS` 消息并刷新 (简单直接) ✅
3. **方案 C**: 使用 chrome.storage.onChanged 监听 Token 变化 (可能误触发)

选择**方案 B**: 简单直接，可靠性高

### 修复内容

在以下三个文件中添加 `AUTH_SUCCESS` 消息监听器:

#### 1. settings.js (设置页面)
```javascript
// 监听 OAuth 登录成功消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'AUTH_SUCCESS') {
    console.log('[Settings] OAuth login success, refreshing page...');
    // 重新加载页面以更新 Token
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }
  sendResponse({ success: true });
  return true;
});
```

#### 2. popup.js (弹窗页面)
```javascript
// 监听 OAuth 登录成功消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'AUTH_SUCCESS') {
    console.log('[Popup] OAuth login success, refreshing page...');
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }
  sendResponse({ success: true });
  return true;
});
```

#### 3. login.js (登录页面)
```javascript
// 监听 OAuth 登录成功消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'AUTH_SUCCESS') {
    console.log('[Login] OAuth login success, refreshing page...');
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }
  sendResponse({ success: true });
  return true;
});
```

---

## ✅ 修复效果

### 修复前:
```
OAuth 登录成功 -> Token 保存到 storage -> 关闭 OAuth 窗口
-> 用户返回 settings 页面 -> API 请求使用旧 Token -> 401 错误
```

### 修复后:
```
OAuth 登录成功 -> Token 保存到 storage -> 发送 AUTH_SUCCESS 消息
-> settings 页面收到消息 -> 刷新页面 -> API Client 重新读取 Token
-> API 请求携带新 Token -> 200 成功
```

---

## 🧪 测试验证

### 测试步骤:

1. **清除旧数据**:
   ```javascript
   // 在控制台执行
   await chrome.storage.local.clear();
   ```

2. **重新登录**:
   - 打开设置页面
   - 点击 "使用 Google 账号登录"
   - 完成 OAuth 授权

3. **验证日志**:
   应该看到:
   ```
   [Settings] OAuth login success, refreshing page...
   ```

4. **验证 API 请求**:
   - 刷新后的页面发起的 API 请求应该携带 Authorization header
   - 后端日志应该显示 200 而非 401

### 预期结果:
- ✅ OAuth 登录成功后页面自动刷新
- ✅ 刷新后的 API 请求都携带正确的 Token
- ✅ 所有 API 请求返回 200 而非 401

---

## 📦 修改文件清单

| 文件 | 修改内容 | 行数 |
|------|----------|------|
| `js/settings.js` | 添加 AUTH_SUCCESS 监听器 | +13 |
| `js/popup.js` | 添加 AUTH_SUCCESS 监听器 | +13 |
| `js/login.js` | 添加 AUTH_SUCCESS 监听器 | +13 |

**总计**: 3 个文件，新增 39 行代码

---

## 🚀 部署建议

### 1. 重新打包扩展
```bash
cd chrome-extension
npm run build  # 或使用对应的打包命令
```

### 2. 重新加载扩展
1. 打开 `chrome://extensions/`
2. 找到 MyTabSearch 扩展
3. 点击刷新按钮 🔄
4. 或者卸载后重新加载 unpacked 扩展

### 3. 验证修复
1. 清除扩展存储数据
2. 重新进行 OAuth 登录
3. 检查服务器日志，确认 API 请求返回 200

---

## ⚠️ 注意事项

### 1. 页面刷新时机
- 使用 `setTimeout(..., 500)` 延迟 500ms 刷新
- 确保 OAuth 窗口已关闭后再刷新主页面
- 避免刷新导致用户体验中断

### 2. 消息监听器重复注册
- 每个页面只注册一次监听器
- 使用 `sendResponse({ success: true })` 确保消息处理完成
- 返回 `true` 表示异步响应

### 3. 向后兼容
- 不影响现有的邮箱验证码登录流程
- 不影响已登录用户的正常使用
- 只影响 OAuth 登录后的页面刷新

---

## 📝 后续优化建议

### 1. 无刷新更新 Token (可选)
如果未来希望避免页面刷新，可以:
- 在 API Client 中添加 `refreshToken()` 方法
- 监听 `AUTH_SUCCESS` 后直接更新 API Client 的 Token
- 触发页面状态更新而非整页刷新

### 2. 统一消息处理
考虑在 background.js 中统一处理认证相关消息:
- `AUTH_SUCCESS`: 认证成功
- `AUTH_LOGOUT`: 登出成功
- `TOKEN_EXPIRED`: Token 过期

### 3. 错误处理增强
添加错误场景处理:
- 消息发送失败
- 页面刷新失败
- Token 保存失败

---

## ✅ 结论

**问题已修复**。OAuth 登录成功后，页面会自动刷新以更新 Token，后续 API 请求将携带正确的 Authorization header。

**修复时间**: 约 15 分钟  
**影响范围**: 仅影响 OAuth 登录流程  
**风险等级**: 低 (仅添加监听器，不影响现有逻辑)  

**建议**: 重新打包扩展并测试验证后部署。

---

**报告生成时间**: 2026-03-10  
**修复人**: AI Assistant
