/**
 * 登录弹窗脚本
 * 处理邮箱验证码登录流程
 */

import authApi from '../api/auth.js';
import authService from '../services/auth.service.js';
import i18n from './i18n.js';

// 状态管理
const state = {
  email: '',
  code: '',
  step: 'email', // email | code
  countdown: 0,
  loading: false
};

// DOM 元素
const elements = {
  inputEmail: document.getElementById('input-email'),
  inputCode: document.getElementById('input-code'),
  codeGroup: document.getElementById('code-group'),
  codeHint: document.getElementById('code-hint'),
  btnSendEmail: document.getElementById('btn-send-email'),
  btnSendCode: document.getElementById('btn-send-code'),
  btnVerify: document.getElementById('btn-verify'),
  btnGoogle: document.getElementById('btn-google'),
  btnMicrosoft: document.getElementById('btn-microsoft'),
  authTip: document.getElementById('auth-tip'),
  authStatus: document.getElementById('auth-status')
};

// 初始化
function init() {
  // 初始化 i18n（添加错误处理，避免卡住）
  i18n.initialize().then(() => {
    i18n.updatePageI18n();
  }).catch(err => {
    console.error('i18n init error:', err);
  });
  
  // 检查是否是 OAuth 回调（非阻塞）
  try {
    checkOAuthCallback();
  } catch (err) {
    console.error('OAuth callback check error:', err);
  }
  
  bindEvents();
}

// 检查是否是 OAuth 回调
function checkOAuthCallback() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    // 检查 URL 中是否有 OAuth 参数
    const code = urlParams.get('code') || hashParams.get('code');
    const provider = urlParams.get('provider') || hashParams.get('provider');
    const error = urlParams.get('error') || hashParams.get('error');
    
    if (code && provider) {
      // 显示加载遮罩
      showOAuthOverlay();
      
      // 处理 OAuth 回调
      handleOAuthCallback(provider, code);
      return;
    }
    
    if (error) {
      showOAuthOverlay();
      showOAuthError(decodeURIComponent(error));
      return;
    }
  } catch (err) {
    console.error('checkOAuthCallback error:', err);
  }
}

// 显示 OAuth 处理遮罩
function showOAuthOverlay() {
  const overlay = document.getElementById('oauth-callback-overlay');
  const main = document.getElementById('auth-main');
  if (overlay) overlay.style.display = 'flex';
  if (main) main.style.display = 'none';
}

// 显示 OAuth 错误
function showOAuthError(message) {
  const overlay = document.getElementById('oauth-callback-overlay');
  if (overlay) {
    const content = overlay.querySelector('.oauth-callback-content');
    if (content) {
      content.innerHTML = `
        <div class="spinner" style="border-top-color: #ea4335;"></div>
        <p class="error">${message || '授权失败，请重试'}</p>
        <p style="margin-top: 16px;">
          <a href="auth.html" style="color: #4285f4; text-decoration: none;">返回登录</a>
        </p>
      `;
    }
    overlay.style.display = 'flex';
  }
}

// 处理 OAuth 回调
async function handleOAuthCallback(provider, code) {
  try {
    const { default: authApi } = await import('../api/auth.js');
    
    // 发送 code 给后端换取 token
    const response = await authApi.verifyOAuthCode(provider, code);
    
    if (response.code === 0 || response.data?.success) {
      const data = response.data;
      
      // 保存用户信息
      const { default: authService } = await import('../services/auth.service.js');
      await authService.saveUserInfo({
        userId: data.userId,
        deviceId: data.deviceId || data.userId,
        accessToken: data.accessToken,
        registeredAt: new Date().toISOString()
      });
      
      // 显示成功
      const overlay = document.getElementById('oauth-callback-overlay');
      if (overlay) {
        const content = overlay.querySelector('.oauth-callback-content');
        if (content) {
          content.innerHTML = `
            <div class="spinner" style="border-top-color: #34a853;"></div>
            <p class="success">登录成功！正在跳转...</p>
          `;
        }
      }
      
      // 通知扩展并关闭
      setTimeout(() => {
        chrome.runtime.sendMessage({
          action: 'AUTH_SUCCESS',
          data: data
        });
        window.close();
      }, 1500);
    } else {
      showOAuthError(response.msg || '登录失败');
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    showOAuthError('网络错误，请重试');
  }
}

// 绑定事件
function bindEvents() {
  // 邮箱输入
  elements.inputEmail.addEventListener('input', handleEmailInput);
  elements.inputEmail.addEventListener('blur', handleEmailBlur);
  
  // 验证码输入
  elements.inputCode.addEventListener('input', handleCodeInput);
  elements.inputCode.addEventListener('keypress', handleCodeKeypress);
  
  // 按钮点击
  elements.btnSendEmail.addEventListener('click', handleSendEmail);
  elements.btnSendCode.addEventListener('click', handleSendCode);
  elements.btnVerify.addEventListener('click', handleVerify);
  
  // OAuth 按钮
  elements.btnGoogle.addEventListener('click', handleOAuthGoogle);
  elements.btnMicrosoft.addEventListener('click', handleOAuthMicrosoft);
}

// 处理邮箱输入
function handleEmailInput(e) {
  state.email = e.target.value.trim();
  
  // 显示/隐藏发送按钮
  if (isValidEmail(state.email)) {
    elements.btnSendEmail.style.display = 'block';
    elements.authTip.style.display = 'none';
  } else {
    elements.btnSendEmail.style.display = 'none';
    elements.authTip.style.display = 'block';
  }
}

// 处理邮箱失焦
function handleEmailBlur() {
  if (isValidEmail(state.email)) {
    elements.btnSendEmail.style.display = 'block';
    elements.authTip.style.display = 'none';
  }
}

// 处理验证码输入
function handleCodeInput(e) {
  state.code = e.target.value.replace(/\D/g, '').slice(0, 6);
  e.target.value = state.code;
  
  // 启用/禁用验证按钮
  if (state.code.length === 6) {
    elements.btnVerify.disabled = false;
  } else {
    elements.btnVerify.disabled = true;
  }
}

// 处理验证码回车
function handleCodeKeypress(e) {
  if (e.key === 'Enter' && state.code.length === 6) {
    handleVerify();
  }
}

// 发送邮箱验证码
async function handleSendEmail() {
  if (!isValidEmail(state.email)) {
    showError(i18n.getMessage('emailRequired'));
    return;
  }
  
  try {
    setLoading(true);
    elements.btnSendEmail.disabled = true;
    
    const response = await authApi.sendVerificationCode(state.email);
    
    if (response.code === 0) {
      showCodeInput();
      startCountdown(60);
      showSuccess(i18n.getMessage('verificationCodeSent'));
    } else {
      showError(response.msg || i18n.getMessage('sendFailed'));
    }
  } catch (error) {
    console.error('Send verification code error:', error);
    showError(i18n.getMessage('networkError'));
  } finally {
    setLoading(false);
    elements.btnSendEmail.disabled = false;
  }
}

// 点击发送验证码按钮
async function handleSendCode() {
  await handleSendEmail();
}

// 验证邮箱验证码
async function handleVerify() {
  if (state.code.length !== 6) {
    showError(i18n.getMessage('codeRequired'));
    return;
  }
  
  try {
    setLoading(true);
    elements.btnVerify.disabled = true;
    
    const response = await authApi.verifyEmail(state.email, state.code);
    
    if (response.code === 0) {
      // 保存用户信息
      await authService.saveUserInfo({
        userId: response.data.userId,
        deviceId: response.data.userId, // 临时使用userId作为deviceId
        accessToken: response.data.accessToken,
        registeredAt: new Date().toISOString()
      });
      
      showSuccess(i18n.getMessage('loginSuccess'));
      
      // 通知扩展并关闭弹窗
      setTimeout(() => {
        chrome.runtime.sendMessage({
          action: 'AUTH_SUCCESS',
          data: response.data
        });
        window.close();
      }, 1000);
    } else {
      showError(response.msg || i18n.getMessage('codeError'));
    }
  } catch (error) {
    console.error('Verify code error:', error);
    showError(i18n.getMessage('networkError'));
  } finally {
    setLoading(false);
    elements.btnVerify.disabled = false;
  }
}

// OAuth 登录 - Google
async function handleOAuthGoogle() {
  try {
    const clientId = '45721927150-pphehddi5o6ttqrnv7mlrfk1i24m9e6d.apps.googleusercontent.com'; // 生产环境替换为实际 Client ID
    const redirectUri = chrome.identity.getRedirectURL();
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', 'google');
    
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    });
    
    if (responseUrl) {
      const url = new URL(responseUrl);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      
      if (code) {
        // 跳转到带参数的页面处理回调
        window.location.href = `auth.html?provider=google&code=${code}`;
      } else if (error) {
        showError(decodeURIComponent(error));
      }
    }
  } catch (error) {
    console.error('Google OAuth error:', error);
    showError('授权失败，请重试');
  }
}

// OAuth 登录 - Microsoft
async function handleOAuthMicrosoft() {
  try {
    const clientId = 'YOUR_MICROSOFT_CLIENT_ID'; // 生产环境替换为实际 Client ID
    const redirectUri = chrome.identity.getRedirectURL();
    
    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', 'microsoft');
    
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    });
    
    if (responseUrl) {
      const url = new URL(responseUrl);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      
      if (code) {
        window.location.href = `auth.html?provider=microsoft&code=${code}`;
      } else if (error) {
        showError(decodeURIComponent(error));
      }
    }
  } catch (error) {
    console.error('Microsoft OAuth error:', error);
    showError('授权失败，请重试');
  }
}

// 显示验证码输入区域
function showCodeInput() {
  state.step = 'code';
  elements.codeGroup.style.display = 'block';
  elements.btnSendEmail.style.display = 'none';
  elements.btnVerify.style.display = 'block';
  elements.authTip.style.display = 'none';
  elements.inputCode.focus();
}

// 验证码倒计时
function startCountdown(seconds) {
  state.countdown = seconds;
  updateCountdown();
  
  const timer = setInterval(() => {
    state.countdown--;
    updateCountdown();
    
    if (state.countdown <= 0) {
      clearInterval(timer);
    }
  }, 1000);
}

// 更新倒计时显示
function updateCountdown() {
  if (state.countdown > 0) {
    elements.btnSendCode.disabled = true;
    elements.btnSendCode.textContent = `${state.countdown}秒后重发`;
  } else {
    elements.btnSendCode.disabled = false;
    elements.btnSendCode.textContent = '发送验证码';
  }
}

// 验证邮箱格式
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// 显示加载状态
function setLoading(loading) {
  state.loading = loading;
  
  if (loading) {
    elements.authStatus.className = 'auth-status loading';
    elements.authStatus.textContent = '请稍候...';
    elements.authStatus.style.display = 'block';
  } else {
    elements.authStatus.style.display = 'none';
  }
}

// 显示成功消息
function showSuccess(message) {
  elements.authStatus.className = 'auth-status success';
  elements.authStatus.textContent = message;
  elements.authStatus.style.display = 'block';
  elements.codeHint.className = 'form-hint success';
  elements.codeHint.textContent = message;
}

// 显示错误消息
function showError(message) {
  elements.authStatus.className = 'auth-status error';
  elements.authStatus.textContent = message;
  elements.authStatus.style.display = 'block';
  elements.codeHint.className = 'form-hint error';
  elements.codeHint.textContent = message;
}

// 初始化
document.addEventListener('DOMContentLoaded', init);
