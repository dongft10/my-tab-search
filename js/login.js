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
  verifyModal: document.getElementById('verify-modal'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  codeInput: document.getElementById('code-input'),
  btnVerify: document.getElementById('btn-verify'),
  btnResendCode: document.getElementById('btn-resend-code'),
  emailHint: document.getElementById('email-hint'),
  btnGoogle: document.getElementById('btn-google'),
  btnMicrosoft: document.getElementById('btn-microsoft'),
  btnSkip: document.getElementById('btn-skip'),
  statusMessage: document.getElementById('status-message')
};

// 刷新原来的 settings 页面
async function refreshOriginalSettingsPage() {
  const settingsUrl = chrome.runtime.getURL('html/settings.html');
  
  // 如果有 sourceTabId，优先刷新该标签页
  if (sourceTabId) {
    try {
      const tab = await chrome.tabs.get(sourceTabId);
      if (tab && tab.url && tab.url.includes('settings.html')) {
        await chrome.tabs.reload(sourceTabId);
        console.log('[login] Reloaded source settings page, tab ID:', sourceTabId);
        return;
      }
    } catch (e) {
      console.log('[login] Source tab not found or invalid:', e.message);
    }
  }
  
  // 否则查找其他 settings 页面
  const allTabs = await chrome.tabs.query({});
  let settingsTab = null;
  
  for (const tab of allTabs) {
    if (tab.url && tab.url.includes('settings.html')) {
      settingsTab = tab;
      break;
    }
  }
  
  console.log('[login] Found settings tabs:', allTabs.filter(t => t.url && t.url.includes('settings.html')).map(t => ({id: t.id, url: t.url})));
  
  if (settingsTab) {
    try {
      await chrome.tabs.reload(settingsTab.id);
      console.log('[login] Reloaded existing settings page, tab ID:', settingsTab.id);
    } catch (e) {
      console.log('[login] Tab reload error, creating new:', e.message);
      await chrome.tabs.create({ url: settingsUrl });
    }
  } else {
    // 没有找到 settings 页面，创建新页面
    await chrome.tabs.create({ url: settingsUrl });
    console.log('[login] Created new settings page');
  }
}

// 重新发送倒计时相关
let resendTimer = null;
let resendSeconds = 0;
const RESEND_COOLDOWN = 60; // 秒（前端显示60s，后端限制55s）
const RESEND_COOLDOWN_KEY = 'verificationCodeLastSent'; // storage key
const RESEND_EMAIL_KEY = 'verificationCodeLastEmail'; // storage key for email

// 来源 tab ID（用于登录成功后刷新原页面）
let sourceTabId = null;

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
  console.log('[login] DOMContentLoaded fired');
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
  
  // 监听 OAuth 登录成功消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'AUTH_SUCCESS') {
      console.log('[Login] OAuth login success, refreshing page...');
      // 重新加载页面以更新 Token
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
    sendResponse({ success: true });
    return true;
  });
  
  setupEventListeners();

  // 恢复验证码倒计时状态（如果还在倒计时内）
  await restoreResendCountdown();

  // 解析 URL 参数，获取来源 tab ID
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const tabId = urlParams.get('sourceTabId');
    if (tabId) {
      sourceTabId = parseInt(tabId, 10);
      console.log('[login] Source tab ID:', sourceTabId);
    }
  } catch (e) {
    console.warn('[login] Failed to parse sourceTabId:', e);
  }
  
  // 检查是否已登录
  try {
    const userInfo = await authService.getUserInfo();
    console.log('[login] User info:', userInfo);
    const userIdKey = authService.storageKey.userId;
    const accessTokenKey = authService.storageKey.accessToken;
    
    // 只有同时有 userId 和 accessToken 才算已登录
    // 静默注册后只有 userId，但没有 accessToken，不算已登录
    if (userInfo && userInfo[userIdKey] && userInfo[accessTokenKey]) {
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
  if (elements.codeInput) {
    elements.codeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        elements.btnVerify.click();
      }
    });
  }
  if (elements.btnResendCode) {
    elements.btnResendCode.addEventListener('click', handleSendCode);
  }
  if (elements.btnCloseModal) {
    elements.btnCloseModal.addEventListener('click', () => {
      // 关闭验证界面，恢复到输入邮箱状态
      if (elements.verifySection) {
        elements.verifySection.style.display = 'none';
      }
      if (elements.btnSendCode) {
        elements.btnSendCode.style.display = 'block';
        elements.btnSendCode.disabled = false;
      }
      if (elements.emailInput) {
        elements.emailInput.disabled = false;
        elements.emailInput.value = '';
      }
      if (elements.codeInput) {
        elements.codeInput.value = '';
      }
      // 清除 storage 中的倒计时状态
      chrome.storage.local.remove([RESEND_COOLDOWN_KEY, RESEND_EMAIL_KEY]);
    });
  }
  // 阻止点击 verify-modal 外部时关闭 popup（Chrome popup 默认行为）
  if (elements.verifySection) {
    elements.verifySection.addEventListener('click', (e) => {
      // 如果点击的是 verify-section 本身（遮罩层），不关闭
      if (e.target === elements.verifySection) {
        e.stopPropagation();
      }
    });
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
  console.log('[login] handleSendCode called, resendSeconds=', resendSeconds);
  const email = elements.emailInput.value.trim();
  
  if (!email || !isValidEmail(email)) {
    showMessage(i18n?.getMessage('emailRequired') || 'Please enter a valid email address', 'error');
    return;
  }
  
  // 如果正在倒计时，不允许发送
  if (resendSeconds > 0) {
    showMessage(i18n?.getMessage('waitForResend') || `Please wait ${resendSeconds}s before resending`, 'error');
    return;
  }
  
  elements.btnSendCode.disabled = true;
  elements.btnSendCode.textContent = i18n?.getMessage('sending') || 'Sending...';
  if (elements.btnResendCode) {
    elements.btnResendCode.disabled = true;
    elements.btnResendCode.textContent = i18n?.getMessage('sending') || 'Sending...';
  }
  
  try {
    const response = await authApi.sendVerificationCode(email);
    console.log('[login] response:', response);
    
    // 检查是否有错误响应（后端返回 429 或其他错误时，apiClient 会抛出异常）
    // 如果成功，response 应该是 {code: 0, data: {...}}
    if (response.code !== 0) {
      // 后端返回错误
      const errorMsg = response.msg || response.data?.message || i18n?.getMessage('sendFailed') || 'Failed to send';
      showMessage(errorMsg, 'error');
      elements.btnSendCode.disabled = false;
      elements.btnSendCode.textContent = i18n?.getMessage('sendCode') || 'Send verification code';
      if (elements.btnResendCode) {
        elements.btnResendCode.disabled = false;
        elements.btnResendCode.textContent = i18n?.getMessage('resendCode') || 'Resend code';
      }
      return;
    }
    
    // 成功
    showMessage(i18n?.getMessage('verificationCodeSent') || 'Verification code sent to your email', 'success');
    const verifySection = document.getElementById('verify-section');
    const btnSendCode = document.getElementById('btn-send-code');
    const emailInput = document.getElementById('email-input');
    if (verifySection) verifySection.style.display = 'block';
    if (btnSendCode) btnSendCode.style.display = 'none';
    if (emailInput) emailInput.disabled = true;
    
    // 启动倒计时
    startResendCountdown(email);
  } catch (error) {
    console.error('Send code error:', error);
    // 显示错误消息
    const errorMsg = error.message || i18n?.getMessage('sendFailed') || 'Failed to send, please try again';
    showMessage(errorMsg, 'error');
    elements.btnSendCode.disabled = false;
    elements.btnSendCode.textContent = i18n?.getMessage('sendCode') || 'Send verification code';
    if (elements.btnResendCode) {
      elements.btnResendCode.disabled = false;
      elements.btnResendCode.textContent = i18n?.getMessage('resendCode') || 'Resend code';
    }
  }
}

// 启动重新发送倒计时
function startResendCountdown(email = null) {
  console.log('[login] startResendCountdown called with email=', email);
  resendSeconds = RESEND_COOLDOWN;

  // 持久化倒计时状态到 storage
  const now = Date.now();
  chrome.storage.local.set({
    [RESEND_COOLDOWN_KEY]: now,
    [RESEND_EMAIL_KEY]: email
  });
  console.log('[login] startResendCountdown: saved to storage, time=', now);

  if (elements.btnResendCode) {
    elements.btnResendCode.style.display = 'inline-block';
    updateResendButtonText();
  }

  if (resendTimer) {
    clearInterval(resendTimer);
  }

  resendTimer = setInterval(() => {
    resendSeconds--;
    updateResendButtonText();

    if (resendSeconds <= 0) {
      clearInterval(resendTimer);
      resendTimer = null;
      if (elements.btnResendCode) {
        elements.btnResendCode.disabled = false;
        elements.btnResendCode.textContent = i18n?.getMessage('resendCode') || 'Resend code';
      }
      // 清除 storage 中的倒计时状态
      chrome.storage.local.remove([RESEND_COOLDOWN_KEY, RESEND_EMAIL_KEY]);
    }
  }, 1000);
}

// 恢复倒计时状态（从 storage 中读取）
async function restoreResendCountdown() {
  console.log('[login] restoreResendCountdown called');
  console.log('[login] restoreResendCountdown: elements.verifySection =', elements.verifySection);
  console.log('[login] restoreResendCountdown: elements.emailInput =', elements.emailInput);
  try {
    const result = await chrome.storage.local.get([RESEND_COOLDOWN_KEY, RESEND_EMAIL_KEY]);
    const lastSent = result[RESEND_COOLDOWN_KEY];
    const lastEmail = result[RESEND_EMAIL_KEY];
    console.log('[login] restoreResendCountdown: lastSent=', lastSent, 'lastEmail=', lastEmail);

    if (lastSent) {
      const elapsed = (Date.now() - lastSent) / 1000;
      const remaining = RESEND_COOLDOWN - Math.floor(elapsed);
      console.log('[login] restoreResendCountdown: elapsed=', elapsed, 'remaining=', remaining);

      if (remaining > 0) {
        // 仍在倒计时内，恢复状态
        resendSeconds = remaining;

        // 如果有保存的邮箱，自动填充并显示验证界面
        if (lastEmail && elements.emailInput) {
          elements.emailInput.value = lastEmail;
          elements.emailInput.disabled = true;
        }

        if (elements.btnSendCode) {
          elements.btnSendCode.style.display = 'none';
        }

        if (elements.verifySection) {
          console.log('[login] restoreResendCountdown: setting verifySection display to block');
          elements.verifySection.style.display = 'block';
          console.log('[login] restoreResendCountdown: verifySection.style.display now =', elements.verifySection.style.display);
        } else {
          console.log('[login] restoreResendCountdown: elements.verifySection is null!');
        }

        // 启动倒计时
        startResendCountdown(lastEmail);
        return true;
      }
    }
    console.log('[login] restoreResendCountdown: no active countdown found');
    return false;
  } catch (error) {
    console.error('[login] restoreResendCountdown error:', error);
    return false;
  }
}

// 更新重新发送按钮文字
function updateResendButtonText() {
  if (elements.btnResendCode) {
    elements.btnResendCode.textContent = i18n?.getMessage('resendCountdown') 
      ? i18n?.getMessage('resendCountdown').replace('{seconds}', resendSeconds)
      : `重新发送 (${resendSeconds}s)`;
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
    const existingDeviceId = userInfo?.[authService.storageKey.deviceId];
    
    // 获取浏览器信息
    let deviceInfo = null;
    try {
      const browserInfo = {
        name: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Unknown',
        version: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'Unknown',
        platform: navigator.platform,
        language: navigator.language
      };
      
      deviceInfo = {
        browserInfo,
        extensionVersion: chrome.runtime.getManifest().version
      };
    } catch (e) {
      console.warn('[login] Failed to get device info:', e);
    }
    
    const response = await authApi.verifyEmail(email, code, existingDeviceId, deviceInfo);
    
    // 兼容两种响应格式: {code: 0} 或 {success: true}
    const isSuccess = response.code === 0 || response.data?.success === true;
    const data = response.data;
    
    if (isSuccess) {
      const userId = data?.userId;
      const deviceId = data?.deviceId;
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
      
      setTimeout(async () => {
        await refreshOriginalSettingsPage();
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
      
      // 发送给后端验证并创建账户
      const response = await authApi.verifyOAuthToken(provider, accessToken, userInfo);
      console.log('[OAuth] Backend response:', response);
      
      if (response.code === 0 || response.data?.success) {
        const data = response.data;
        
        // 保存用户信息
        const storageData = {
          [authService.storageKey.userId]: data.userId,
          [authService.storageKey.accessToken]: data.accessToken,
          [authService.storageKey.tokenExpiresAt]: data.expiresAt,
          [authService.storageKey.registeredAt]: new Date().toISOString()
        };
        
        if (data.deviceId) {
          storageData[authService.storageKey.deviceId] = data.deviceId;
        }
        
        await chrome.storage.local.set(storageData);
        
        // 清除功能限制缓存，确保获取最新的限制
        if (featureLimitService) {
          await featureLimitService.clearCache();
          console.log('[OAuth] Feature limit cache cleared');
        }
        
        showMessage('Login successful!', 'success');
        
        setTimeout(async () => {
          await refreshOriginalSettingsPage();
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
async function handleSkip() {
  await refreshOriginalSettingsPage();
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
