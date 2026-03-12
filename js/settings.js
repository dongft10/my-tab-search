/**
 * 设置页面脚本
 * 处理用户账户信息、VIP状态、设备管理等功能
 */

import authApi from './api/auth.js';
import authService from './services/auth.service.js';
import vipService from './services/vip.service.js';
import trialService from './services/trial.service.js';
import deviceService from './services/device.service.js';
import featureLimitService from './services/feature-limit.service.js';
import searchMatchService from './services/search-match.service.js';

// Import i18n manager
import i18n from './i18n.js';

// DOM 元素
const elements = {
  accountSection: document.getElementById('account-section'),
  accountAvatar: document.getElementById('account-avatar'),
  avatarLetter: document.getElementById('avatar-letter'),
  accountEmail: document.getElementById('account-email'),
  accountStatus: document.getElementById('account-status'),
  vipBadge: document.getElementById('vip-badge'),
  vipStatus: document.getElementById('vip-status'),
  vipStatusValue: document.getElementById('vip-status-value'),
  vipExpires: document.getElementById('vip-expires'),
  trialStatus: document.getElementById('trial-status'),
  trialLabel: document.getElementById('trial-label'),
  trialDaysLeft: document.getElementById('trial-days-left'),
  btnExtendTrial: document.getElementById('btn-extend-trial'),
  btnLogin: document.getElementById('btn-login'),
  btnLogout: document.getElementById('btn-logout'),
  devicesSection: document.getElementById('devices-section'),
  deviceList: document.getElementById('device-list'),
  languageSelect: document.getElementById('language-select'),
  searchMatchModeSelect: document.getElementById('search-match-mode'),
  appVersion: document.getElementById('app-version'),
  statusMessage: document.getElementById('status-message')
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize i18n
  await i18n.initialize();
  
  // 更新页面国际化元素
  i18n.updatePageI18n();
  
  // Apply internationalization
  applyI18n();
  
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
  
  // 加载设置
  await loadSettings();
  
  // 设置事件监听
  setupEventListeners();
  
  // Add language change listener
  i18n.addListener(applyI18n);
});

function applyI18n() {
  // Update page title
  document.title = i18n.getMessage('settingsTitle') || 'Settings - MyTabSearch';
  
  // Update section titles - 动态获取data-i18n属性
  const sections = document.querySelectorAll('.settings-section h2');
  sections.forEach((section) => {
    const i18nKey = section.getAttribute('data-i18n');
    if (i18nKey) {
      const message = i18n.getMessage(i18nKey);
      if (message) {
        section.textContent = message;
      }
    }
  });
  
  // Update other text elements
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.textContent = i18n.getMessage('logout') || '退出登录';
  }
  
  const languageLabel = document.querySelector('.setting-item label');
  if (languageLabel) {
    languageLabel.textContent = i18n.getMessage('selectLanguage') || '选择语言:';
  }
}

async function loadSettings() {
  try {
    // 加载语言设置（从 sync 存储读取，与 i18n 初始化保持一致）
    // 使用 i18n 实例中已保存的语言，确保一致性
    const currentLang = i18n.language;
    elements.languageSelect.value = currentLang;

    // 加载搜索匹配模式（从 local 存储读取，如果没有保存过则根据当前语言设置默认值）
    let searchMode = await searchMatchService.getSearchMatchMode();
    if (!searchMode) {
      searchMode = '1';
    }
    if (elements.searchMatchModeSelect) {
      elements.searchMatchModeSelect.value = searchMode;
    }

    // 获取扩展版本（如果元素存在）
    if (elements.appVersion) {
      const manifest = chrome.runtime.getManifest();
      elements.appVersion.textContent = manifest.version;
    }

    // 加载账户信息
    await loadAccountInfo();
    
    // 加载VIP状态
    await loadVipStatus();
    
    // 加载体验期状态
    await loadTrialStatus();
    
    // 加载设备列表
    await loadDevices();
  } catch (error) {
    console.error('Load settings error:', error);
    showMessage(i18n.getMessage('loadSettingsFailed') || 'Failed to load settings', 'error');
  }
}

// 加载账户信息
async function loadAccountInfo() {
  try {
    const userInfo = await authService.getUserInfo();
    const userIdKey = authService.storageKey.userId;
    const userId = userInfo[userIdKey];
    
    // 尝试获取 accessToken
    let accessToken = null;
    let profileEmail = null;
    try {
      accessToken = await authService.getValidAccessToken();
      if (accessToken) {
        const response = await authApi.getUserProfile(accessToken);
        // 兼容两种格式: {code: 0, data: {...}} 或 {success: true, ...}
        const data = response?.data;
        if (data) {
          profileEmail = data.email;
        }
      }
    } catch (e) {
      // 忽略错误，继续判断
    }
    
    // 根据是否有 userId 和 accessToken 来判断是否登录
    // 静默注册后只有 userId，但没有 accessToken，不算已登录
    if (userId && accessToken) {
      // 已登录
      if (elements.btnLogout) elements.btnLogout.style.display = 'block';
      if (elements.btnLogin) elements.btnLogin.style.display = 'none';
      
      // 如果有邮箱则显示邮箱，否则显示 userId 的一部分
      if (profileEmail) {
        elements.accountEmail.textContent = profileEmail;
        elements.avatarLetter.textContent = profileEmail.charAt(0).toUpperCase();
      } else {
        // 显示 userId 的前 8 位
        const shortUserId = userId.substring(0, 8);
        elements.accountEmail.textContent = `User: ${shortUserId}`;
        elements.avatarLetter.textContent = 'U';
      }
    } else {
      // 未登录（包括静默注册但未登录的情况）
      elements.accountEmail.textContent = i18n.getMessage('notLoggedIn') || '未登录';
      elements.avatarLetter.textContent = '?';
      if (elements.btnLogout) elements.btnLogout.style.display = 'none';
      if (elements.btnLogin) elements.btnLogin.style.display = 'block';
    }
  } catch (error) {
    console.error('Load account info error:', error);
    elements.accountEmail.textContent = i18n.getMessage('notLoggedIn') || '未登录';
    elements.avatarLetter.textContent = '?';
    if (elements.btnLogout) elements.btnLogout.style.display = 'none';
    if (elements.btnLogin) elements.btnLogin.style.display = 'block';
  }
}

// 加载VIP状态
async function loadVipStatus() {
  try {
    let accessToken = null;
    try {
      accessToken = await authService.getValidAccessToken();
    } catch (e) {
      return;
    }
    
    if (!accessToken) {
      return;
    }

    try {
      const response = await authApi.getVipStatus(accessToken);
      
      if (response.code === 0) {
        const vipData = response.data;
        
        if (vipData.userType === 'vip') {
          elements.vipBadge.style.display = 'inline-block';
          elements.vipStatus.style.display = 'block';
          elements.vipStatusValue.textContent = 'Active';
          
          if (vipData.vipExpiresAt) {
            const expiresDate = new Date(vipData.vipExpiresAt);
            elements.vipExpires.textContent = formatDate(expiresDate);
          }
        } else {
          elements.vipBadge.style.display = 'none';
        }
      }
    } catch (e) {
      console.error('Load VIP status API error:', e);
    }
  } catch (error) {
    console.error('Load VIP status error:', error);
  }
}

// 加载体验期状态
async function loadTrialStatus() {
  try {
    let accessToken = null;
    try {
      accessToken = await authService.getValidAccessToken();
    } catch (e) {
      return;
    }
    
    if (!accessToken) {
      return;
    }

    try {
      const response = await authApi.getTrialStatus(accessToken);
      
      if (response.code === 0) {
        const trialData = response.data;
        
        // 检查是否处于应用推广试用期（trial_enabled = false）
        if (!trialData.trialEnabled) {
          elements.trialStatus.style.display = 'block';
          // 不显示"体验期剩余:"标签
          elements.trialLabel.style.display = 'none';
          elements.trialDaysLeft.textContent = i18n.getMessage('promotionPeriodMessage') || '✨应用推广试用期，全功能免费使用，欢迎提供宝贵的使用体验反馈🎯😄';
          // 隐藏延展按钮
          elements.btnExtendTrial.style.display = 'none';
          return;
        }
        
        // 对于正式体验期（trial_enabled = true），只有已验证邮箱的用户才显示
        const isEmailVerified = await authService.isEmailVerified();
        if (!isEmailVerified) {
          // 未验证邮箱的用户不显示正式体验期状态
          elements.trialStatus.style.display = 'none';
          return;
        }
        
        if (trialData.isInTrialPeriod) {
          elements.trialStatus.style.display = 'block';
          // 显示"体验期剩余:"标签
          elements.trialLabel.style.display = 'inline';
          elements.trialDaysLeft.textContent = `${trialData.trialDaysLeft} days`;
          
          if (trialData.canExtend) {
            elements.btnExtendTrial.style.display = 'block';
          }
        }
      }
    } catch (e) {
      console.error('Load trial status API error:', e);
      // 不显示体验期状态（错误情况下隐藏）
      elements.trialStatus.style.display = 'none';
    }
  } catch (error) {
    console.error('Load trial status error:', error);
  }
}

// 加载设备列表
async function loadDevices() {
  try {
    let accessToken = null;
    let userId = null;
    
    // 获取用户信息和 token
    try {
      const userInfo = await authService.getUserInfo();
      userId = userInfo[authService.storageKey.userId];
      accessToken = await authService.getValidAccessToken();
    } catch (e) {
      // 未登录，隐藏设备管理区块
      if (elements.devicesSection) {
        elements.devicesSection.style.display = 'none';
      }
      return;
    }
    
    // 检查是否有设备管理权限（需要同时有 userId 和 accessToken）
    if (!userId || !accessToken) {
      if (elements.devicesSection) {
        elements.devicesSection.style.display = 'none';
      }
      return;
    }
    
    // 已登录，显示设备管理区块
    if (elements.devicesSection) {
      elements.devicesSection.style.display = 'block';
    }

    try {
      // 获取当前设备的 deviceId
      const userInfo = await authService.getUserInfo();
      const currentDeviceId = userInfo?.[authService.storageKey.deviceId];

      if (!currentDeviceId) {
        elements.deviceList.innerHTML = '<p class="empty-text">暂无设备信息</p>';
        return;
      }

      // 触发feature-limit请求以更新设备最后活跃时间
      try {
        await featureLimitService.getFeatureLimit('pinnedTabs', true, false);
      } catch (e) {
        console.error('Refresh feature limits error:', e);
      }

      // 获取当前设备详情
      const devices = await deviceService.getDevices();
      const currentDevice = devices?.find(d => d.id === currentDeviceId);

      if (!currentDevice) {
        elements.deviceList.innerHTML = '<p class="empty-text">当前设备信息不可用</p>';
        return;
      }

      // 只渲染当前设备
      elements.deviceList.innerHTML = `
        <div class="device-item" data-device-id="${escapeHtml(currentDevice.id)}">
          <div class="device-icon">${getDeviceIcon(currentDevice.browserName)}</div>
          <div class="device-info">
            <div class="device-name">
              ${escapeHtml(currentDevice.browserName || 'Unknown')} ${escapeHtml(currentDevice.browserVersion || '')}
              <span class="current-badge">当前设备</span>
            </div>
            <div class="device-meta">
              <span class="device-platform">${escapeHtml(currentDevice.platform || 'Unknown')}</span>
              <span class="device-last-seen">最后活跃：${formatLastSeen(currentDevice.lastSeenAt)}</span>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      console.error('Load devices API error:', e);
      elements.deviceList.innerHTML = '<p class="error-text">加载设备失败</p>';
    }
  } catch (error) {
    console.error('Load devices error:', error);
    elements.deviceList.innerHTML = '<p class="error-text">加载设备失败</p>';
  }
}

// 转义 HTML 防止 XSS 攻击
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 获取设备图标
function getDeviceIcon(browserName) {
  const icons = {
    'Chrome': '🌐',
    'Firefox': '🦊',
    'Safari': '🧭',
    'Edge': '🌊',
    'Opera': '🔴'
  };
  return icons[browserName] || '💻';
}

// 格式化最后活跃时间
function formatLastSeen(lastSeenAt) {
  if (!lastSeenAt) return '未知';
  
  try {
    const date = new Date(lastSeenAt);
    const now = new Date();
    const diff = now - date;
    
    // 小于1分钟
    if (diff < 60000) return '刚刚';
    // 小于1小时
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    // 小于1天
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    // 小于30天
    if (diff < 2592000000) return `${Math.floor(diff / 86400000)}天前`;
    
    return date.toLocaleDateString();
  } catch (error) {
    return '未知';
  }
}

// 设置事件监听
function setupEventListeners() {
  elements.languageSelect.addEventListener('change', handleLanguageChange);
  
  if (elements.searchMatchModeSelect) {
    elements.searchMatchModeSelect.addEventListener('change', handleSearchMatchModeChange);
  }
  
  if (elements.btnLogin) {
    elements.btnLogin.addEventListener('click', handleLogin);
  }
  
  if (elements.btnLogout) {
    elements.btnLogout.addEventListener('click', handleLogout);
  }
  
  if (elements.btnExtendTrial) {
    elements.btnExtendTrial.addEventListener('click', handleExtendTrial);
  }
  
  const saveButton = document.getElementById('save-settings');
  if (saveButton) {
    saveButton.addEventListener('click', handleLanguageChange);
  }
  
  // 设置登录弹窗事件
  setupLoginModalEvents();
}

// 处理语言变更
async function handleLanguageChange(e) {
  const language = e.target.value;
  
  try {
    await chrome.storage.sync.set({ language });
    await i18n.setLanguage(language);
    applyI18n();
    showMessage(i18n.getMessage('settingsSaved') || 'Settings saved', 'success');
    
    chrome.runtime.sendMessage({
      action: 'languageChanged',
      language: language
    });
  } catch (error) {
    console.error('Save language error:', error);
    showMessage('Failed to save settings', 'error');
  }
}

// 处理搜索匹配模式变更
async function handleSearchMatchModeChange(e) {
  const mode = e.target.value;
  
  // 模式3和4需要VIP或体验期用户才能使用
  if (mode === '3' || mode === '4') {
    const isEligible = await checkUserEligibilityForAdvancedMode();
    if (!isEligible) {
      showMessage(i18n.getMessage('searchMatchModeVIPRequired') || '该模式需要VIP身份或体验期用户才能使用', 'error');
      // 恢复为之前的选中值
      const currentMode = await searchMatchService.getSearchMatchMode();
      elements.searchMatchModeSelect.value = currentMode;
      return;
    }
    // 即使有权限，模式3/4目前仍在开发中，不允许使用
    showMessage(i18n.getMessage('searchMatchModeDeveloping') || '功能持续迭代开发中，敬请期待！', 'info');
    // 恢复为之前的选中值
    const currentMode = await searchMatchService.getSearchMatchMode();
    elements.searchMatchModeSelect.value = currentMode;
    return;
  }
  
  try {
    await searchMatchService.setSearchMatchMode(mode);
    showMessage(i18n.getMessage('settingsSaved') || 'Settings saved', 'success');
  } catch (error) {
    console.error('Save search match mode error:', error);
    showMessage('Failed to save settings', 'error');
  }
}

// 检查用户是否有资格使用高级模式（模式3/4）
async function checkUserEligibilityForAdvancedMode() {
  try {
    // 检查是否是VIP用户
    const vipStatus = await vipService.getLocalVipStatus();
    if (vipStatus && vipStatus.isVip) {
      return true;
    }
    
    // 检查是否在体验期
    const trialStatus = await trialService.getLocalTrialStatus();
    if (trialStatus && trialStatus.isInTrialPeriod) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[SearchMatch] Check eligibility error:', error);
    return false;
  }
}

// 处理登录 - 显示登录弹窗
function handleLogin() {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

// 关闭登录弹窗
function closeLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  // 重置表单
  document.getElementById('login-email-input').value = '';
  document.getElementById('login-code-input').value = '';
  document.getElementById('login-verify-section').style.display = 'none';
  document.getElementById('login-status-message').textContent = '';
  document.getElementById('login-status-message').className = 'status-message';
}

// 设置登录弹窗事件
function setupLoginModalEvents() {
  // 关闭按钮
  const closeBtn = document.getElementById('login-modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeLoginModal);
  }
  
  // 点击遮罩关闭
  const overlay = document.querySelector('#login-modal .login-modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', closeLoginModal);
  }
  
  // 发送验证码
  const btnSendCode = document.getElementById('login-btn-send-code');
  if (btnSendCode) {
    btnSendCode.addEventListener('click', handleLoginSendCode);
  }
  
  // 验证登录
  const btnVerify = document.getElementById('login-btn-verify');
  if (btnVerify) {
    btnVerify.addEventListener('click', handleLoginVerify);
  }
  
  // 重新发送
  const btnResendCode = document.getElementById('login-btn-resend-code');
  if (btnResendCode) {
    btnResendCode.addEventListener('click', handleLoginSendCode);
  }
  
  // Google OAuth
  const btnGoogle = document.getElementById('login-btn-google');
  if (btnGoogle) {
    btnGoogle.addEventListener('click', () => handleLoginOAuth('google'));
  }
  
  // Microsoft OAuth
  const btnMicrosoft = document.getElementById('login-btn-microsoft');
  if (btnMicrosoft) {
    btnMicrosoft.addEventListener('click', () => handleLoginOAuth('microsoft'));
  }
  
  // 跳过
  const btnSkip = document.getElementById('login-btn-skip');
  if (btnSkip) {
    btnSkip.addEventListener('click', closeLoginModal);
  }
}

// 登录弹窗 - 发送验证码
let loginResendTimer = null;
let loginResendSeconds = 0;

async function handleLoginSendCode() {
  const emailInput = document.getElementById('login-email-input');
  const email = emailInput.value.trim();
  
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showLoginMessage('请输入有效的邮箱地址', 'error');
    return;
  }
  
  if (loginResendSeconds > 0) {
    showLoginMessage(`请等待 ${loginResendSeconds}s 后重试`, 'error');
    return;
  }
  
  const btnSendCode = document.getElementById('login-btn-send-code');
  const btnResendCode = document.getElementById('login-btn-resend-code');
  
  btnSendCode.disabled = true;
  btnSendCode.textContent = '发送中...';
  
  try {
    const { default: authApi } = await import('./api/auth.js');
    const response = await authApi.sendVerificationCode(email);
    
    if (response.code === 0) {
      showLoginMessage('验证码已发送到您的邮箱', 'success');
      document.getElementById('login-verify-section').style.display = 'block';
      btnSendCode.style.display = 'none';
      emailInput.disabled = true;
      startLoginResendCountdown();
    } else {
      showLoginMessage(response.msg || '发送失败', 'error');
      btnSendCode.disabled = false;
      btnSendCode.textContent = '发送验证码';
    }
  } catch (error) {
    console.error('Send code error:', error);
    showLoginMessage('发送失败，请重试', 'error');
    btnSendCode.disabled = false;
    btnSendCode.textContent = '发送验证码';
  }
}

function startLoginResendCountdown() {
  loginResendSeconds = 60;
  const btnResendCode = document.getElementById('login-btn-resend-code');
  
  if (btnResendCode) {
    btnResendCode.style.display = 'inline-block';
    updateLoginResendButton();
  }
  
  if (loginResendTimer) clearInterval(loginResendTimer);
  
  loginResendTimer = setInterval(() => {
    loginResendSeconds--;
    updateLoginResendButton();
    
    if (loginResendSeconds <= 0) {
      clearInterval(loginResendTimer);
      loginResendTimer = null;
      if (btnResendCode) {
        btnResendCode.disabled = false;
        btnResendCode.textContent = '重新发送';
      }
    }
  }, 1000);
}

function updateLoginResendButton() {
  const btnResendCode = document.getElementById('login-btn-resend-code');
  if (btnResendCode) {
    btnResendCode.textContent = `重新发送 (${loginResendSeconds}s)`;
    btnResendCode.disabled = true;
  }
}

// 登录弹窗 - 验证登录
async function handleLoginVerify() {
  const email = document.getElementById('login-email-input').value.trim();
  const code = document.getElementById('login-code-input').value.trim();
  
  if (!code || code.length !== 6) {
    showLoginMessage('请输入6位验证码', 'error');
    return;
  }
  
  const btnVerify = document.getElementById('login-btn-verify');
  btnVerify.disabled = true;
  btnVerify.textContent = '验证中...';
  
  try {
    const { default: authApi } = await import('./api/auth.js');
    const { default: authService } = await import('./services/auth.service.js');
    const { default: featureLimitService } = await import('./services/feature-limit.service.js');
    
    // 获取本地存储的设备信息
    const userInfo = await authService.getUserInfo();
    const deviceId = userInfo[authService.storageKey.deviceId];
    
    // 获取浏览器信息
    let deviceInfo = null;
    try {
      const browserInfo = authService.getBrowserInfo();
      const extensionVersion = chrome.runtime.getManifest().version;
      deviceInfo = {
        browserInfo,
        extensionVersion
      };
    } catch (e) {
      console.warn('Failed to get device info:', e);
    }

    // 必须传递 deviceId，否则提示升级
    if (!deviceId) {
      showMessage('请升级扩展到最新版本', 'error');
      return;
    }

    const response = await authApi.verifyEmail(email, code, deviceId, deviceInfo);
    
    if (response.code === 0 || response.data?.success) {
      const data = response.data;
      
      const storageData = {
        [authService.storageKey.userId]: data.userId,
        [authService.storageKey.registeredAt]: new Date().toISOString()
      };
      
      if (data.deviceId) {
        storageData[authService.storageKey.deviceId] = data.deviceId;
      }
      
      if (data.accessToken) {
        storageData[authService.storageKey.accessToken] = data.accessToken;
        storageData[authService.storageKey.tokenExpiresAt] = data.expiresAt;
      }
      
      await chrome.storage.local.set(storageData);
      
      if (featureLimitService) {
        await featureLimitService.clearCache();
      }
      
      showLoginMessage('登录成功！', 'success');
      
      setTimeout(() => {
        closeLoginModal();
        loadAccountInfo();
        loadVipStatus();
        loadTrialStatus();
        loadDevices();
        showMessage('登录成功！', 'success');
      }, 1000);
    } else {
      showLoginMessage(response.msg || '登录失败', 'error');
      btnVerify.disabled = false;
      btnVerify.textContent = '验证并登录';
    }
  } catch (error) {
    console.error('Verify error:', error);
    showLoginMessage('登录失败，请重试', 'error');
    btnVerify.disabled = false;
    btnVerify.textContent = '验证并登录';
  }
}

// 登录弹窗 - OAuth 登录
async function handleLoginOAuth(provider) {
  try {
    const clientId = provider === 'google' 
      ? '45721927150-pphehddi5o6ttqrnv7mlrfk1i24m9e6d.apps.googleusercontent.com'
      : 'YOUR_MICROSOFT_CLIENT_ID';
    
    const extensionId = chrome.runtime.id;
    const redirectBase = `https://${extensionId}.chromiumapp.org`;
    const redirectUri = `${redirectBase}/${provider}`;
    
    let authUrl;
    if (provider === 'google') {
      authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'token');
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('state', 'google');
      authUrl.searchParams.set('access_type', 'online');
    } else {
      authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'token');
      authUrl.searchParams.set('scope', 'openid email profile User.read');
      authUrl.searchParams.set('state', 'microsoft');
    }
    
    showLoginMessage('正在跳转...', 'info');
    
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    });
    
    if (responseUrl) {
      const url = new URL(responseUrl);
      const hashParams = new URLSearchParams(url.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const error = url.searchParams.get('error');
      
      if (accessToken) {
        await handleLoginOAuthToken(provider, accessToken);
      } else if (error) {
        showLoginMessage(decodeURIComponent(error), 'error');
      } else {
        showLoginMessage('未收到授权令牌', 'error');
      }
    }
  } catch (error) {
    console.error('OAuth error:', error);
    showLoginMessage('授权失败，请重试', 'error');
  }
}

async function handleLoginOAuthToken(provider, accessToken) {
  try {
    showLoginMessage('处理中...', 'info');
    
    const { default: authApi } = await import('./api/auth.js');
    const { default: authService } = await import('./services/auth.service.js');
    const { default: featureLimitService } = await import('./services/feature-limit.service.js');
    
    let userInfo;
    if (provider === 'google') {
      const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      userInfo = await resp.json();
    }
    
    if (userInfo && userInfo.email) {
      // 发送 OAuth 登录请求
      const response = await authApi.verifyOAuthToken(provider, accessToken, userInfo);
      
      if (response.code === 0 || response.data?.success) {
        const data = response.data;
        
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
        
        if (featureLimitService) {
          await featureLimitService.clearCache();
        }
        
        showLoginMessage('登录成功！', 'success');
        
        // 刷新页面以更新 UI (确保 Token 被正确加载)
        console.log('[OAuth] Login successful, will reload page in 1 second...');
        setTimeout(() => {
          console.log('[OAuth] Reloading page now...');
          window.location.reload();
        }, 1000);
      } else {
        showLoginMessage(response.msg || '登录失败', 'error');
      }
    } else {
      showLoginMessage('获取用户信息失败', 'error');
    }
  } catch (error) {
    console.error('OAuth token error:', error);
    showLoginMessage('登录失败: ' + error.message, 'error');
  }
}

function showLoginMessage(message, type = 'info') {
  const statusEl = document.getElementById('login-status-message');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status-message status-${type}`;
    statusEl.classList.add('show');
    setTimeout(() => statusEl.classList.remove('show'), 3000);
  }
}

// 处理退出登录
async function handleLogout() {
  if (!confirm('确定要退出登录吗？')) {
    return;
  }

  try {
    // 使用设备服务进行登出
    await deviceService.logout();
    showMessage(i18n?.getMessage('logoutSuccess') || 'Logged out successfully', 'success');
    
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  } catch (error) {
    console.error('Logout error:', error);
    showMessage(i18n?.getMessage('logoutFailed') || 'Logout failed', 'error');
  }
}

// 处理延展体验期
async function handleExtendTrial() {
  try {
    elements.btnExtendTrial.disabled = true;
    elements.btnExtendTrial.textContent = 'Processing...';
    
    const result = await trialService.extendTrial();
    
    if (result.success) {
      showMessage(`Trial extended! Days left: ${result.trialDaysLeft}`, 'success');
      await loadTrialStatus();
    } else {
      showMessage(result.message || 'Extension failed', 'error');
    }
  } catch (error) {
    console.error('Extend trial error:', error);
    showMessage('Failed to extend trial', 'error');
  } finally {
    elements.btnExtendTrial.disabled = false;
    elements.btnExtendTrial.textContent = 'Extend Trial';
  }
}

// 格式化日期
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 显示消息
function showMessage(message, type = 'info') {
  const statusEl = document.getElementById('status-message');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status-message status-${type}`;
    statusEl.style.display = 'block';
    
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }
}

// Listen for language change messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'languageChanged') {
    applyI18n();
  }
});
