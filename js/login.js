/**
 * 登录页面脚本
 * 处理邮箱注册登录和 OAuth 授权
 */

// DOM 元素
const elements = {
  emailSection: document.getElementById('email-section'),
  emailInput: document.getElementById('email-input'),
  btnSendCode: document.getElementById('btn-send-code'),
  verifySection: document.getElementById('verify-section'),
  codeInput: document.getElementById('code-input'),
  btnVerify: document.getElementById('btn-verify'),
  emailHint: document.getElementById('email-hint'),
  btnGoogle: document.getElementById('btn-google'),
  btnMicrosoft: document.getElementById('btn-microsoft'),
  btnSkip: document.getElementById('btn-skip'),
  statusMessage: document.getElementById('status-message')
};

// 动态加载模块
async function loadModules() {
  const [{ default: authApi }, { default: authService }, { default: i18n }] = await Promise.all([
    import('../js/api/auth.js'),
    import('../js/services/auth.service.js'),
    import('../js/i18n.js')
  ]);
  return { authApi, authService, i18n };
}

let authApi, authService, i18n;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const modules = await loadModules();
    authApi = modules.authApi;
    authService = modules.authService;
    i18n = modules.i18n;
    await i18n.initialize();
  } catch (e) {
    console.error('[login] Module load error:', e);
  }
  
  setupEventListeners();
  
  // 检查是否已登录
  try {
    const userInfo = await authService.getUserInfo();
    console.log('[login] User info:', userInfo);
    const userIdKey = authService.storageKey.userId;
    if (userInfo && userInfo[userIdKey]) {
      console.log('[login] Already logged in, redirecting...');
      showMessage('您已登录，正在跳转...', 'info');
      // 不自动跳转，让用户留在登录页面可以注销
      // setTimeout(() => {
      //   chrome.tabs.create({ url: chrome.runtime.getURL('html/settings.html') });
      //   window.close();
      // }, 1000);
    }
  } catch (e) {
    // 忽略检查登录错误
  }
});

function setupEventListeners() {
  if (elements.btnSendCode) {
    elements.btnSendCode.addEventListener('click', handleSendCode);
  }
  if (elements.btnVerify) {
    elements.btnVerify.addEventListener('click', handleVerify);
  }
  if (elements.btnGoogle) {
    elements.btnGoogle.addEventListener('click', () => handleOAuth('google'));
  }
  if (elements.btnMicrosoft) {
    elements.btnMicrosoft.addEventListener('click', () => handleOAuth('microsoft'));
  }
  if (elements.btnSkip) {
    elements.btnSkip.addEventListener('click', handleSkip);
  }
}

// 发送验证码
async function handleSendCode() {
  const email = elements.emailInput.value.trim();
  
  if (!email || !isValidEmail(email)) {
    showMessage('请输入有效的邮箱地址', 'error');
    return;
  }
  
  elements.btnSendCode.disabled = true;
  elements.btnSendCode.textContent = '发送中...';
  
  try {
    const response = await authApi.sendVerificationCode(email);
    console.log('[login] response.data:', response.data);
    
    // 兼容两种响应格式: {code: 0} 或 {success: true}
    const isSuccess = response.data && (response.data.code === 0 || response.data.success === true);
    
    if (isSuccess) {
      showMessage('验证码已发送，请注意查收', 'success');
      const verifySection = document.getElementById('verify-section');
      const btnSendCode = document.getElementById('btn-send-code');
      const emailInput = document.getElementById('email-input');
      if (verifySection) verifySection.style.display = 'block';
      if (btnSendCode) btnSendCode.style.display = 'none';
      if (emailInput) emailInput.disabled = true;
    } else {
      showMessage(response.data?.message || '发送失败', 'error');
      elements.btnSendCode.disabled = false;
      elements.btnSendCode.textContent = '发送验证码';
    }
  } catch (error) {
    console.error('Send code error:', error);
    showMessage('发送失败，请重试', 'error');
    elements.btnSendCode.disabled = false;
    elements.btnSendCode.textContent = '发送验证码';
  }
}

// 验证登录
async function handleVerify() {
  const email = elements.emailInput.value.trim();
  const code = elements.codeInput.value.trim();
  
  if (!code || code.length !== 6) {
    showMessage('请输入6位验证码', 'error');
    return;
  }
  
  elements.btnVerify.disabled = true;
  elements.btnVerify.textContent = '验证中...';
  
  try {
    // 获取本地存储的 deviceId（如果有的话）
    const userInfo = await authService.getUserInfo();
    const deviceId = userInfo?.[authService.storageKey.deviceId];
    
    const response = await authApi.verifyEmail(email, code, deviceId);
    
    // 兼容两种响应格式: {code: 0} 或 {success: true}
    const isSuccess = response.data && (response.data.code === 0 || response.data.success === true);
    const data = response.data?.data || response.data;
    
    if (isSuccess) {
      const userId = data?.userId;
      const accessToken = data?.accessToken;
      const expiresAt = data?.expiresAt;
      
      // 直接存储所有登录信息
      const storageData = {
        [authService.storageKey.userId]: userId,
        [authService.storageKey.registeredAt]: new Date().toISOString()
      };
      
      if (deviceId) {
        storageData[authService.storageKey.deviceId] = deviceId;
      }
      
      if (accessToken) {
        storageData[authService.storageKey.accessToken] = accessToken;
        storageData[authService.storageKey.tokenExpiresAt] = expiresAt;
      }
      
      await chrome.storage.local.set(storageData);
      
      showMessage('登录成功！', 'success');
      
      setTimeout(() => {
        chrome.tabs.create({ url: chrome.runtime.getURL('html/settings.html') });
        window.close();
      }, 1000);
    } else {
      showMessage(response.data.message || '验证失败', 'error');
      elements.btnVerify.disabled = false;
      elements.btnVerify.textContent = '验证并登录';
    }
  } catch (error) {
    console.error('Verify error:', error);
    showMessage('验证失败，请重试', 'error');
    elements.btnVerify.disabled = false;
    elements.btnVerify.textContent = '验证并登录';
  }
}

// OAuth 登录
async function handleOAuth(provider) {
  showMessage(`${provider} 登录功能开发中...`, 'info');
}

// 跳过登录
function handleSkip() {
  chrome.tabs.create({ url: chrome.runtime.getURL('html/settings.html') });
  window.close();
}

// 验证邮箱格式
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 显示消息
function showMessage(message, type = 'info') {
  const statusEl = elements.statusMessage;
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status-message status-${type}`;
    statusEl.classList.add('show');
    setTimeout(() => statusEl.classList.remove('show'), 3000);
  }
}

console.log('[login] Script execution complete');
