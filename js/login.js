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
  const [{ default: authApi }, { default: authService }, { default: i18n }, { default: featureLimitService }] = await Promise.all([
    import('../js/api/auth.js'),
    import('../js/services/auth.service.js'),
    import('../js/i18n.js'),
    import('../js/services/feature-limit.service.js')
  ]);
  return { authApi, authService, i18n, featureLimitService };
}

let authApi, authService, i18n, featureLimitService;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const modules = await loadModules();
    authApi = modules.authApi;
    authService = modules.authService;
    i18n = modules.i18n;
    featureLimitService = modules.featureLimitService;
    await i18n.initialize();
    // 更新页面国际化元素
    i18n.updatePageI18n();
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
      showMessage(i18n?.getMessage('alreadyLoggedIn') || 'You are already logged in, redirecting...', 'info');
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
    showMessage(i18n?.getMessage('emailRequired') || 'Please enter a valid email address', 'error');
    return;
  }
  
  elements.btnSendCode.disabled = true;
  elements.btnSendCode.textContent = i18n?.getMessage('sending') || 'Sending...';
  
  try {
    const response = await authApi.sendVerificationCode(email);
    console.log('[login] response.data:', response.data);
    
    // 兼容两种响应格式: {code: 0} 或 {success: true}
    const isSuccess = response.code === 0 || response.data?.success === true;
    
    if (isSuccess) {
      showMessage(i18n?.getMessage('verificationCodeSent') || 'Verification code sent to your email', 'success');
      const verifySection = document.getElementById('verify-section');
      const btnSendCode = document.getElementById('btn-send-code');
      const emailInput = document.getElementById('email-input');
      if (verifySection) verifySection.style.display = 'block';
      if (btnSendCode) btnSendCode.style.display = 'none';
      if (emailInput) emailInput.disabled = true;
    } else {
      showMessage(response.msg || i18n?.getMessage('sendFailed') || 'Failed to send', 'error');
      elements.btnSendCode.disabled = false;
      elements.btnSendCode.textContent = i18n?.getMessage('sendCode') || 'Send verification code';
    }
  } catch (error) {
    console.error('Send code error:', error);
    showMessage(i18n?.getMessage('sendFailed') || 'Failed to send, please try again', 'error');
    elements.btnSendCode.disabled = false;
    elements.btnSendCode.textContent = i18n?.getMessage('sendCode') || 'Send verification code';
  }
}

// 验证登录
async function handleVerify() {
  const email = elements.emailInput.value.trim();
  const code = elements.codeInput.value.trim();
  
  if (!code || code.length !== 6) {
    showMessage(i18n?.getMessage('codeRequired') || 'Please enter 6-digit verification code', 'error');
    return;
  }
  
  elements.btnVerify.disabled = true;
  elements.btnVerify.textContent = i18n?.getMessage('verifying') || 'Verifying...';
  
  try {
    // 获取本地存储的 deviceId 和设备信息（如果有的话）
    const userInfo = await authService.getUserInfo();
    const deviceId = userInfo?.[authService.storageKey.deviceId];
    
    // 获取 user_device_uuid 和浏览器信息
    let deviceInfo = null;
    try {
      const uuidData = await chrome.storage.local.get('userDeviceUuid');
      const userDeviceUuid = uuidData.userDeviceUuid || null;
      
      // 获取浏览器信息
      const browserInfo = {
        name: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Unknown',
        version: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'Unknown',
        platform: navigator.platform,
        language: navigator.language
      };
      
      deviceInfo = {
        userDeviceUuid,
        browserInfo,
        extensionVersion: chrome.runtime.getManifest().version
      };
    } catch (e) {
      console.warn('[login] Failed to get device info:', e);
    }
    
    const response = await authApi.verifyEmail(email, code, deviceId, deviceInfo);
    
    // 兼容两种响应格式: {code: 0} 或 {success: true}
    const isSuccess = response.code === 0 || response.data?.success === true;
    const data = response.data;
    
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
      
      // 清除功能限制缓存，确保获取最新的限制
      if (featureLimitService) {
        await featureLimitService.clearCache();
        console.log('[Email] Feature limit cache cleared');
      }
      
      showMessage(i18n?.getMessage('loginSuccess') || 'Login successful!', 'success');
      
      setTimeout(() => {
        chrome.tabs.create({ url: chrome.runtime.getURL('html/settings.html') });
        window.close();
      }, 1000);
    } else {
      showMessage(response.msg || i18n?.getMessage('loginFailed') || 'Login failed', 'error');
      elements.btnVerify.disabled = false;
      elements.btnVerify.textContent = i18n?.getMessage('verifyAndLogin') || 'Verify and login';
    }
  } catch (error) {
    console.error('Verify error:', error);
    showMessage(i18n?.getMessage('loginFailed') || 'Login failed, please try again', 'error');
    elements.btnVerify.disabled = false;
    elements.btnVerify.textContent = i18n?.getMessage('verifyAndLogin') || 'Verify and login';
  }
}

// OAuth 登录
async function handleOAuth(provider) {
  try {
    const clientId = provider === 'google' 
      ? '45721927150-pphehddi5o6ttqrnv7mlrfk1i24m9e6d.apps.googleusercontent.com'
      : 'YOUR_MICROSOFT_CLIENT_ID';
    const redirectUri = chrome.identity.getRedirectURL();
    
    let authUrl;
    
    // 获取扩展 ID 并构建重定向 URI
    const extensionId = chrome.runtime.id;
    const redirectBase = `https://${extensionId}.chromiumapp.org`;
    
    if (provider === 'google') {
      const redirectUri = `${redirectBase}/google`;
      authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'token');
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('state', 'google');
      authUrl.searchParams.set('access_type', 'online');
    } else if (provider === 'microsoft') {
      const redirectUri = `${redirectBase}/microsoft`;
      authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'token');
      authUrl.searchParams.set('scope', 'openid email profile User.read');
      authUrl.searchParams.set('state', 'microsoft');
    }
    
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    });
    
    if (responseUrl) {
      console.log('[OAuth] Response URL:', responseUrl);
      
      // 解析返回的 token (在 hash fragment 中)
      const url = new URL(responseUrl);
      const hashParams = new URLSearchParams(url.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const expiresIn = hashParams.get('expires_in');
      const error = url.searchParams.get('error');
      
      console.log('[OAuth] Access token:', accessToken ? 'present' : 'missing');
      console.log('[OAuth] Error:', error);
      
      if (accessToken) {
        // 使用 access_token 获取用户信息并登录
        await handleOAuthToken(provider, accessToken);
      } else if (error) {
        showMessage(decodeURIComponent(error), 'error');
      } else {
        showMessage('No access token received', 'error');
      }
    } else {
      showMessage('No response from OAuth', 'error');
    }
  } catch (error) {
    console.error('OAuth error:', error);
    showMessage('Authorization failed, please try again', 'error');
  }
}

// 使用 OAuth token 登录
async function handleOAuthToken(provider, accessToken) {
  try {
    showMessage('Processing...', 'info');
    console.log('[OAuth] handleOAuthToken called, provider:', provider);
    console.log('[OAuth] authApi:', authApi);
    console.log('[OAuth] authService:', authService);
    
    if (!authApi || !authApi.verifyOAuthToken) {
      console.error('[OAuth] authApi.verifyOAuthToken is not defined!');
      showMessage('Error: API not loaded', 'error');
      return;
    }
    
    // 使用 token 获取用户信息
    let userInfo;
    if (provider === 'google') {
      console.log('[OAuth] Fetching user info from Google...');
      const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      userInfo = await resp.json();
      console.log('[OAuth] User info:', userInfo);
    }
    
    if (userInfo && userInfo.email) {
      console.log('[OAuth] Calling backend to verify token...');
      
      // 获取 user_device_uuid
      let userDeviceUuid = null;
      try {
        const uuidData = await chrome.storage.local.get('userDeviceUuid');
        userDeviceUuid = uuidData.userDeviceUuid || null;
      } catch (e) {
        console.warn('[OAuth] Failed to get userDeviceUuid:', e);
      }
      
      // 发送给后端验证并创建账户
      const response = await authApi.verifyOAuthToken(provider, accessToken, userInfo, userDeviceUuid);
      console.log('[OAuth] Backend response:', response);
      
      if (response.code === 0 || response.data?.success) {
        const data = response.data;
        
        // 保存用户信息
        await chrome.storage.local.set({
          [authService.storageKey.userId]: data.userId,
          [authService.storageKey.accessToken]: data.accessToken,
          [authService.storageKey.tokenExpiresAt]: data.expiresAt,
          [authService.storageKey.registeredAt]: new Date().toISOString()
        });
        
        // 清除功能限制缓存，确保获取最新的限制
        if (featureLimitService) {
          await featureLimitService.clearCache();
          console.log('[OAuth] Feature limit cache cleared');
        }
        
        showMessage('Login successful!', 'success');
        
        setTimeout(() => {
          chrome.tabs.create({ url: chrome.runtime.getURL('html/settings.html') });
          window.close();
        }, 1000);
      } else {
        showMessage(response.msg || 'Login failed', 'error');
      }
    } else {
      console.error('[OAuth] No user info or email:', userInfo);
      showMessage('Failed to get user info', 'error');
    }
  } catch (error) {
    console.error('OAuth token handle error:', error);
    showMessage('Login failed: ' + error.message, 'error');
  }
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
