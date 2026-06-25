/**
 * 登录弹窗脚本
 * 处理邮箱验证码登录流程
 */

import authApi from './api/auth.js';
import authService from './services/auth.service.js';
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
  authTip: document.getElementById('auth-tip'),
  authStatus: document.getElementById('auth-status')
};

// 初始化
async function init() {
  // 重置状态（确保每次打开页面都是干净的状态）
  resetState();

  // 确保 deviceId 存在（静默注册可能失败）
  try {
    const userInfo = await authService.getUserInfo();
    if (!userInfo[authService.storageKey.deviceId]) {
      console.log('[Auth] deviceId not found, triggering silent registration...');
      const result = await authService.silentRegister();
      if (result) {
        console.log('[Auth] Silent registration successful, deviceId:', result.deviceId);
      } else {
        console.error('[Auth] Silent registration failed');
      }
    } else {
      console.log('[Auth] deviceId exists:', userInfo[authService.storageKey.deviceId]);
    }
  } catch (e) {
    console.error('[Auth] Failed to check/perform silent registration:', e);
  }

  // 初始化 i18n（添加错误处理，避免卡住）
  i18n.initialize().then(() => {
    i18n.updatePageI18n();
  }).catch(err => {
    console.error('i18n init error:', err);
  });

  bindEvents();
}

// 重置状态
function resetState() {
  // 重置状态对象
  state.email = '';
  state.code = '';
  state.step = 'email';
  state.countdown = 0;
  state.loading = false;

  // 重置 DOM 元素状态
  if (elements.inputEmail) elements.inputEmail.value = '';
  if (elements.inputCode) elements.inputCode.value = '';
  if (elements.codeGroup) elements.codeGroup.style.display = 'none';
  if (elements.btnSendEmail) elements.btnSendEmail.style.display = 'none';
  if (elements.btnVerify) elements.btnVerify.style.display = 'none';
  if (elements.btnSendCode) {
    elements.btnSendCode.disabled = false;
    elements.btnSendCode.textContent = i18n.getMessage('sendVerificationCode') || '发送验证码';
  }
  if (elements.authTip) elements.authTip.style.display = 'block';
  if (elements.authStatus) {
    elements.authStatus.style.display = 'none';
    elements.authStatus.className = 'auth-status';
    elements.authStatus.textContent = '';
  }
  if (elements.codeHint) {
    elements.codeHint.className = 'form-hint';
    elements.codeHint.textContent = '';
  }
  if (elements.btnVerify) {
    elements.btnVerify.disabled = true;
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
    console.log('[Auth] Sending verification code to:', state.email);

    const response = await authApi.sendVerificationCode(state.email);
    console.log('[Auth] sendVerificationCode response:', response);

    if (response.code === 0 && response.data?.success) {
      showCodeInput();
      startCountdown(60);
      showSuccess(i18n.getMessage('verificationCodeSent'));
    } else if (response.data?.code) {
      const errorKey = 'errorCode' + response.data.code;
      const errorMsg = i18n.getMessage(errorKey) || i18n.getMessage('sendFailed');
      showError(errorMsg);
    } else {
      showError(response.msg || i18n.getMessage('sendFailed'));
    }
  } catch (error) {
    console.error('[Auth] Send verification code error:', error);
    // 根据错误类型显示不同的错误信息
    if (error.isTimeout) {
      showError('The request has timed out. Please check the network connection and try again');
    } else if (error.message === 'Failed to fetch' || error.message === 'NetworkError') {
      showError('The network connection failed. Please check the network Settings');
    } else {
      showError(i18n.getMessage('networkError'));
    }
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
    console.log('[Auth] Starting email verification for:', state.email);

    // 获取本地存储的设备信息
    const userInfo = await authService.getUserInfo();
    const deviceId = userInfo[authService.storageKey.deviceId];
    console.log('[Auth] Device ID from storage:', deviceId);

    // 获取浏览器信息
    let deviceInfo = null;
    try {
      const browserInfo = authService.getBrowserInfo();
      const extensionVersion = chrome.runtime.getManifest().version;
      deviceInfo = {
        browserInfo,
        extensionVersion
      };
      console.log('[Auth] Device info:', deviceInfo);
    } catch (e) {
      console.info('Failed to get device info:', e);
    }

    // 必须传递 deviceId
    if (!deviceId) {
      console.error('[Auth] No deviceId found in storage after silent registration attempt');
      showError('设备注册失败，请刷新页面重试');
      setLoading(false);
      elements.btnVerify.disabled = false;
      return;
    }

    console.log('[Auth] Calling verifyEmail API...');
    const response = await authApi.verifyEmail(state.email, state.code, deviceId, deviceInfo);
    console.log('[Auth] verifyEmail response:', response);

    if (response.code === 0 && response.data?.success) {
      // 保存用户信息
      await authService.saveUserInfo({
        userId: response.data.userId,
        deviceId: response.data.deviceId || deviceId,
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
    } else if (response.data?.code) {
      const errorKey = 'errorCode' + response.data.code;
      const errorMsg = i18n.getMessage(errorKey) || i18n.getMessage('codeError');
      showError(errorMsg);
    } else {
      showError(response.msg || i18n.getMessage('codeError'));
    }
  } catch (error) {
    console.error('[Auth] Verify code error:', error);
    if (error.isTimeout) {
      showError('The request has timed out. Please check the network connection and try again');
    } else if (error.message === 'Failed to fetch' || error.message === 'NetworkError') {
      showError('The network connection failed. Please check the network Settings');
    } else if (error.bizCode) {
      const errorMsg = i18n.getMessage('errorCode' + error.bizCode) || error.message;
      showError(errorMsg);
    } else {
      showError(error.message || i18n.getMessage('networkError'));
    }
  } finally {
    setLoading(false);
    elements.btnVerify.disabled = false;
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
    const countdownText = i18n.getMessage('resendCountdown') || '{seconds}秒后重发';
    elements.btnSendCode.textContent = countdownText.replace('{seconds}', state.countdown).replace('{seconds}s', state.countdown);
  } else {
    elements.btnSendCode.disabled = false;
    elements.btnSendCode.textContent = i18n.getMessage('sendVerificationCode') || '发送验证码';
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
    elements.authStatus.textContent = i18n.getMessage('loadingText') || '请稍候...';
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
