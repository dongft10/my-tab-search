# 错误处理优化指南

## 问题背景

当后端服务不稳定或其他异常情况发生时,Chrome 扩展会在扩展管理页面显示 `Errors`。这些错误实际上不影响用户正常使用,但会给用户造成困扰。

## 优化策略

### 1. 错误分级

根据错误的影响程度,将错误分为以下级别:

- **Critical Error (严重错误)**: 影响核心功能的错误,使用 `console.error`
- **Warning (警告)**: 不影响用户使用的非关键错误,使用 `console.warn`
- **Info (信息)**: 调试信息,使用 `console.log` 或 `console.info`

### 2. 判断标准

**使用 console.warn 而非 console.error 的情况:**

1. **后端服务不可用**
   - VIP 状态加载失败
   - 体验期状态加载失败
   - 设备活跃度上报失败
   - Token 刷新失败(已有降级方案)

2. **非关键功能失败**
   - 固定标签页同步失败
   - 设置加载失败(可以使用默认值)
   - 账户信息加载失败(可以显示未登录状态)

3. **已有降级方案**
   - API 调用失败但有缓存数据
   - 后端不可用但有模拟数据

**必须使用 console.error 的情况:**

1. **核心功能失败**
   - 用户登录失败
   - 数据丢失
   - 扩展初始化失败

2. **需要用户关注的问题**
   - 权限缺失
   - 配置错误

### 3. 实施细节

#### 已优化的文件:

1. **js/settings.js**
   - `loadVipStatus()`: VIP 状态加载失败 → `console.warn`
   - `loadTrialStatus()`: 体验期状态加载失败 → `console.warn`
   - `loadSettings()`: 设置加载失败 → `console.warn`
   - `loadAccountInfo()`: 账户信息加载失败 → `console.warn`

2. **js/popup.js**
   - `checkAndReportActive()`: 设备活跃度上报失败 → `console.warn`
   - `pinTab()`: 固定标签页失败 → `console.warn`
   - `unpinTab()`: 取消固定标签页失败 → `console.warn`

3. **js/api/client.js**
   - 添加 `isServerError` 标记,方便识别服务器错误
   - 优化重试逻辑的日志输出

#### 待优化的文件:

以下文件中的错误处理需要根据实际业务逻辑进行评估:

- `js/services/trial.service.js`
- `js/services/vip.service.js`
- `js/services/device.service.js`
- `js/services/auth.service.js`
- `js/services/sync-queue.service.js`
- `js/services/pinned-tabs-sync.service.js`
- `js/services/feature-limit.service.js`

### 4. 错误处理模式

#### 模式 1: API 调用失败(推荐)

```javascript
try {
  const response = await api.someMethod();
  // 处理响应
} catch (error) {
  // 不影响用户使用的错误,使用 warn
  console.warn('[Feature Name] Failed to load data:', error.message);
  // 优雅降级处理
  return defaultValue;
}
```

#### 模式 2: 带 isServerError 判断

```javascript
try {
  const response = await api.someMethod();
  // 处理响应
} catch (error) {
  if (error.isServerError) {
    // 服务器错误,使用 warn
    console.warn('[Feature Name] Server temporarily unavailable');
  } else {
    // 其他错误,可能需要用户关注
    console.error('[Feature Name] Failed to load data:', error);
  }
  return defaultValue;
}
```

### 5. 日志格式规范

为了便于调试和问题追踪,建议使用统一的日志格式:

```javascript
console.warn('[Feature Name] Description:', error.message);
```

示例:
```javascript
console.warn('[VIP Status] Backend service temporarily unavailable');
console.warn('[Trial Status] Failed to load trial status:', error.message);
```

### 6. 测试验证

优化后,需要验证:

1. 后端服务不可用时,扩展管理页面不再显示错误
2. 核心功能仍然正常工作
3. 非关键功能有合理的降级方案
4. 开发者仍能通过 console.warn 看到警告信息

## 后续优化建议

1. **统一错误处理中间件**
   - 创建统一的错误处理工具类
   - 自动根据错误类型和上下文选择日志级别

2. **错误监控**
   - 集成错误监控服务(如 Sentry)
   - 区分开发环境和生产环境的日志级别

3. **用户友好提示**
   - 对于重要的错误,考虑显示用户友好的提示
   - 提供"稍后重试"等恢复选项

## 参考资料

- [Chrome Extension Error Handling](https://developer.chrome.com/docs/extensions/mv3/error_handling/)
- [Web API Error Handling Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#Checking_that_the_fetch_was_successful)
