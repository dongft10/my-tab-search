/**
 * 登录弹窗脚本
 * 处理邮箱验证码登录流程
 */

import authApi from '../api/auth.js';
import authService from '../services/auth.service.js';

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
  bindEvents();
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
    showError('请输入有效的邮箱地址');
    return;
  }
  
  try {
    setLoading(true);
    elements.btnSendEmail.disabled = true;
    
    const response = await authApi.sendVerificationCode(state.email);
    
    if (response.data.code === 0) {
      showCodeInput();
      startCountdown(60);
      showSuccess('验证码已发送到您的邮箱');
    } else {
      showError(response.data.message || '发送失败，请稍后重试');
    }
  } catch (error) {
    console.error('Send verification code error:', error);
    showError('网络错误，请稍后重试');
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
    showError('请输入6位验证码');
    return;
  }
  
  try {
    setLoading(true);
    elements.btnVerify.disabled = true;
    
    const response = await authApi.verifyEmail(state.email, state.code);
    
    if (response.data.code === 0) {
      // 保存用户信息
      await authService.saveUserInfo({
        userId: response.data.data.userId,
        deviceId: response.data.data.userId, // 临时使用userId作为deviceId
        accessToken: response.data.data.accessToken,
        registeredAt: new Date().toISOString()
      });
      
      showSuccess('登录成功');
      
      // 通知扩展并关闭弹窗
      setTimeout(() => {
        chrome.runtime.sendMessage({
          action: 'AUTH_SUCCESS',
          data: response.data.data
        });
        window.close();
      }, 1000);
    } else {
      showError(response.data.message || '验证码错误');
    }
  } catch (error) {
    console.error('Verify code error:', error);
    showError('网络错误，请稍后重试');
  } finally {
    setLoading(false);
    elements.btnVerify.disabled = false;
  }
}

// OAuth 登录 - Google
function handleOAuthGoogle() {
  showError('Google OAuth 登录即将上线');
  // TODO: 实现 Google OAuth 登录
}

// OAuth 登录 - Microsoft
function handleOAuthMicrosoft() {
  showError('Microsoft OAuth 登录即将上线');
  // TODO: 实现 Microsoft OAuth 登录
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
