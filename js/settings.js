/**
 * 设置页面脚本
 * 处理用户账户信息、VIP状态、设备管理等功能
 */

import authApi from './api/auth.esm.js';
import authService from './services/auth.service.esm.js';
import vipService from './services/vip.service.js';
import trialService from './services/trial.service.js';
import deviceService from './services/device.service.js';
import featureLimitService from './services/feature-limit.service.js';
import searchMatchService from './services/search-match.service.js';
import i18n from './i18n.js';

// Toast 提示函数
function showToast(message, duration = 3000) {
  // 移除已存在的 toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  // 创建 toast 元素
  const toast = document.createElement('div');
  toast.classList.add('toast');
  toast.textContent = message;

  // 添加到 body
  document.body.appendChild(toast);

  // 自动移除
  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }, duration);
}

// DOM 元素缓存
const elements = {
  languageSelect: document.getElementById('language-select'),
  searchMatchModeSelect: document.getElementById('search-match-mode'),
  appVersion: document.getElementById('app-version'),
  btnLogout: document.getElementById('btn-logout'),
  btnLogin: document.getElementById('btn-login'),
  accountEmail: document.getElementById('account-email'),
  avatarLetter: document.getElementById('avatar-letter'),
  vipBadge: document.getElementById('vip-badge'),
  vipStatus: document.getElementById('vip-status'),
  vipStatusValue: document.getElementById('vip-status-value'),
  vipExpires: document.getElementById('vip-expires'),
  trialStatus: document.getElementById('trial-status'),
  trialLabel: document.getElementById('trial-label'),
  trialDaysLeft: document.getElementById('trial-days-left'),
  btnExtendTrial: document.getElementById('btn-extend-trial'),
  btnSetupShortcut: document.getElementById('btn-setup-shortcut')
};

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize i18n
  await i18n.initialize();

  // 更新页面国际化元素
  i18n.updatePageI18n();

  // Apply internationalization
  applyI18n();

  // 检查是否有待显示的初次同步 toast
  try {
    const result = await chrome.storage.local.get(['pendingFirstSyncToast']);
    if (result.pendingFirstSyncToast) {
      const toastMessage = result.pendingFirstSyncToast;
      // 清除存储的 toast 消息
      await chrome.storage.local.remove(['pendingFirstSyncToast']);
      // 延迟显示 toast，确保页面已完全加载
      setTimeout(() => {
        showToast(toastMessage);
      }, 500);
    }
  } catch (e) {
    console.error('[Settings] Failed to check pending toast:', e);
  }

  // 监听 OAuth 登录成功消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'AUTH_SUCCESS') {
      // 重新加载页面以更新 Token
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
    if (message.action === 'SHOW_TOAST') {
      showToast(message.message);
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

async function applyI18n() {
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

  // Update shortcut button text
  const shortcutBtn = document.getElementById('btn-setup-shortcut');
  if (shortcutBtn) {
    const i18nKey = shortcutBtn.getAttribute('data-i18n');
    if (i18nKey) {
      const message = i18n.getMessage(i18nKey);
      if (message) {
        shortcutBtn.textContent = message;
      }
    }
  }

  // Update shortcut tip text
  const shortcutTip = document.querySelector('.shortcut-tip');
  if (shortcutTip) {
    const i18nKey = shortcutTip.getAttribute('data-i18n');
    if (i18nKey) {
      const message = i18n.getMessage(i18nKey);
      if (message) {
        shortcutTip.textContent = message;
      }
    }
  }

  // Update trial status elements
  const trialLabel = document.getElementById('trial-label');
  if (trialLabel) {
    const i18nKey = trialLabel.getAttribute('data-i18n');
    if (i18nKey) {
      const message = i18n.getMessage(i18nKey);
      if (message) {
        trialLabel.textContent = message;
      }
    }
  }

  const btnExtendTrial = document.getElementById('btn-extend-trial');
  if (btnExtendTrial) {
    const i18nKey = btnExtendTrial.getAttribute('data-i18n');
    if (i18nKey) {
      const message = i18n.getMessage(i18nKey);
      if (message) {
        btnExtendTrial.textContent = message;
      }
    }
  }

  // Update theme labels
  const themeLabels = document.querySelectorAll('.theme-label');
  themeLabels.forEach((label) => {
    const i18nKey = label.getAttribute('data-i18n');
    if (i18nKey) {
      const message = i18n.getMessage(i18nKey);
      if (message) {
        label.textContent = message;
      }
    }
  });

  // Update search match mode elements
  const searchMatchLabelText = document.querySelector('label[for="search-match-mode"]');
  if (searchMatchLabelText) {
    const i18nKey = searchMatchLabelText.getAttribute('data-i18n');
    if (i18nKey) {
      const message = i18n.getMessage(i18nKey);
      if (message) {
        searchMatchLabelText.textContent = message;
      }
    }
  }

  // Update select options
  const selectElements = document.querySelectorAll('select');
  selectElements.forEach((select) => {
    select.querySelectorAll('option').forEach((option) => {
      const i18nKey = option.getAttribute('data-i18n');
      if (i18nKey) {
        const message = i18n.getMessage(i18nKey);
        if (message) {
          option.textContent = message;
        }
      }
    });
  });

  const settingDesc = document.querySelector('.setting-description');
  if (settingDesc) {
    const i18nKey = settingDesc.getAttribute('data-i18n');
    if (i18nKey) {
      const message = i18n.getMessage(i18nKey);
      if (message) {
        settingDesc.textContent = message;
      }
    }
  }

  // Reload trial status to update dynamic content like "X days"
  // Note: Not awaiting to avoid blocking UI
  loadTrialStatus();
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

    // 加载设备列表（已移除，替换为快捷键设置）
    // await loadDevices();
  } catch (error) {
    // 设置加载失败时的优雅降级处理
    console.info('[Settings] Failed to load settings:', error.message);
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
    // 账户信息加载失败时的优雅降级处理
    console.info('[Account Info] Failed to load account info:', error.message);
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
      // 后端服务不稳定时的优雅降级处理
      // 不记录 console.error 以避免在扩展管理页面显示错误
      // 因为这种情况不影响用户正常使用
      console.info('[VIP Status] Backend service temporarily unavailable, using cached data');
    }
  } catch (error) {
    // 外层错误也使用 warn 而非 error
    console.info('[VIP Status] Failed to load VIP status:', error.message);
  }
}

// 加载体验期状态
async function loadTrialStatus() {
  try {
    // 未登录用户不显示体验期信息
    const isRegistered = await authService.isRegistered();
    if (!isRegistered) {
      elements.trialStatus.style.display = 'none';
      return;
    }

    const trialData = await trialService.getTrialStatus();

    if (!trialData) {
      return;
    }

    // 使用后端返回的 statusType 进行判断
    switch (trialData.statusType) {
      case 'promotion':
        // 推广期（trialEnabled = false）
        elements.trialStatus.style.display = 'block';
        elements.trialLabel.style.display = 'none';
        elements.trialDaysLeft.textContent = i18n.getMessage('promotionPeriodMessage') || '✨应用推广试用期，全功能免费使用，欢迎提供宝贵的使用体验反馈🎯😄';
        elements.btnExtendTrial.style.display = 'none';
        break;

      case 'unverified':
        // 未验证邮箱，不显示体验期状态
        elements.trialStatus.style.display = 'none';
        break;

      case 'active':
      case 'expired':
        // 体验中或已结束
        elements.trialStatus.style.display = 'block';
        elements.trialLabel.style.display = 'inline';
        
        if (trialData.statusType === 'expired') {
          elements.trialDaysLeft.textContent = i18n.getMessage('trialExpired') || '体验期已结束';
        } else {
          const daysLeftText = i18n.getMessage('trialDaysLeft', [trialData.trialDaysLeft.toString()]) || `体验期剩余 ${trialData.trialDaysLeft} 天`;
          elements.trialDaysLeft.textContent = daysLeftText;
        }

        if (trialData.showExtendButton) {
          elements.btnExtendTrial.style.display = 'block';
          elements.btnExtendTrial.disabled = !trialData.extendButtonEnabled;
          elements.btnExtendTrial.textContent = i18n.getMessage('extendTrial') || '延展体验期';
        } else {
          elements.btnExtendTrial.style.display = 'none';
        }
        break;

      default:
        // 兜底处理：使用旧逻辑
        if (!trialData.trialEnabled) {
          elements.trialStatus.style.display = 'block';
          elements.trialLabel.style.display = 'none';
          elements.trialDaysLeft.textContent = i18n.getMessage('promotionPeriodMessage') || '✨应用推广试用期，全功能免费使用，欢迎提供宝贵的使用体验反馈🎯😄';
          elements.btnExtendTrial.style.display = 'none';
        } else {
          const isEmailVerified = await authService.isEmailVerified();
          if (!isEmailVerified) {
            elements.trialStatus.style.display = 'none';
            return;
          }

          if (trialData.isInTrialPeriod) {
            elements.trialStatus.style.display = 'block';
            elements.trialLabel.style.display = 'inline';
            const daysLeftText = i18n.getMessage('trialDaysLeft', [trialData.trialDaysLeft.toString()]) || `体验期剩余 ${trialData.trialDaysLeft} 天`;
            elements.trialDaysLeft.textContent = daysLeftText;

            if (trialData.canExtend) {
              elements.btnExtendTrial.style.display = 'block';
              const isNearExpiry = trialData.trialDaysLeft <= 3;
              elements.btnExtendTrial.disabled = !isNearExpiry;
              elements.btnExtendTrial.textContent = i18n.getMessage('extendTrial') || '延展体验期';
            }
          } else {
            elements.trialStatus.style.display = 'block';
            elements.trialLabel.style.display = 'inline';
            elements.trialDaysLeft.textContent = i18n.getMessage('trialExpired') || '体验期已结束';

            if (trialData.canExtend) {
              elements.btnExtendTrial.style.display = 'block';
              elements.btnExtendTrial.disabled = false;
              elements.btnExtendTrial.textContent = i18n.getMessage('extendTrial') || '延展体验期';
            }
          }
        }
    }
  } catch (e) {
    // 后端服务不可用时的优雅降级处理
    console.info('[Trial Status] Failed to load trial status:', e.message);
    elements.trialStatus.style.display = 'none';
  }
}


// 转义 HTML 防止 XSS 攻击
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

  if (elements.btnSetupShortcut) {
    elements.btnSetupShortcut.addEventListener('click', handleSetupShortcut);
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
    const trialStatus = await trialService.getTrialStatus();
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
async function handleLogin() {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
  // 恢复验证码倒计时状态
  await restoreLoginResendCountdown();
}

// 关闭登录弹窗
function closeLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  // 重置表单
  const emailInput = document.getElementById('login-email-input');
  const btnSendCode = document.getElementById('login-btn-send-code');
  if (emailInput) {
    emailInput.value = '';
    emailInput.disabled = false;
  }
  if (btnSendCode) {
    btnSendCode.style.display = 'block';
    btnSendCode.disabled = false;
  }
  document.getElementById('login-code-input').value = '';
  document.getElementById('login-verify-section').style.display = 'none';
  document.getElementById('login-status-message').textContent = '';
  document.getElementById('login-status-message').className = 'status-message';
  // 注意：不清除 storage 中的倒计时状态，因为 popup 关闭后仍需恢复
}

// 设置登录弹窗事件
function setupLoginModalEvents() {
  // 关闭按钮
  const closeBtn = document.getElementById('login-modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeLoginModal);
  }

  // 点击遮罩不关闭（阻止事件冒泡）
  const modal = document.getElementById('login-modal');
  const overlay = document.querySelector('#login-modal .login-modal-overlay');
  const content = document.querySelector('#login-modal .login-modal-content');

  if (modal) {
    modal.addEventListener('click', (e) => {
      // 如果点击的是 modal 本身（遮罩层），不关闭
      if (e.target === modal) {
        e.stopPropagation();
      }
    });
  }

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  if (content) {
    content.addEventListener('click', (e) => {
      e.stopPropagation();
    });
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

  // 邮箱输入框 Enter 键监听
  const emailInput = document.getElementById('login-email-input');
  if (emailInput) {
    emailInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleLoginSendCode();
      }
    });
  }

  // 验证码输入框 Enter 键监听
  const codeInput = document.getElementById('login-code-input');
  if (codeInput) {
    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleLoginVerify();
      }
    });
  }
}

// 登录弹窗 - 发送验证码
let loginResendTimer = null;
let loginResendSeconds = 0;
const LOGIN_RESEND_COOLDOWN = 60;
const LOGIN_RESEND_COOLDOWN_KEY = 'verificationCodeLastSent';
const LOGIN_RESEND_EMAIL_KEY = 'verificationCodeLastEmail';

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
      startLoginResendCountdown(email);
    } else {
      showLoginMessage(response.msg || '发送失败', 'error');
      btnSendCode.disabled = false;
      btnSendCode.textContent = '发送验证码';
    }
  } catch (error) {
    console.error('Send code error:', error);
    const errorMsg = error.message || '发送失败，请重试';
    showLoginMessage(errorMsg, 'error');
    btnSendCode.disabled = false;
    btnSendCode.textContent = '发送验证码';
  }
}

function startLoginResendCountdown(email = null, initialSeconds = null, updateStorage = true) {
  // 如果没有传入初始秒数，使用默认值
  if (initialSeconds === null) {
    initialSeconds = LOGIN_RESEND_COOLDOWN;
  }
  loginResendSeconds = initialSeconds;

  // 只有在真正发送验证码时才更新 storage（用于防止60秒内重复发送）
  // 恢复倒计时时不更新 storage，避免时间计算错误
  if (updateStorage) {
    const now = Date.now();
    chrome.storage.local.set({
      [LOGIN_RESEND_COOLDOWN_KEY]: now,
      [LOGIN_RESEND_EMAIL_KEY]: email
    });
  }

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
      // 清除 storage 中的倒计时状态
      chrome.storage.local.remove([LOGIN_RESEND_COOLDOWN_KEY, LOGIN_RESEND_EMAIL_KEY]);
    }
  }, 1000);
}

// 恢复登录倒计时状态
async function restoreLoginResendCountdown() {
  try {
    const result = await chrome.storage.local.get([LOGIN_RESEND_COOLDOWN_KEY, LOGIN_RESEND_EMAIL_KEY]);
    const lastSent = result[LOGIN_RESEND_COOLDOWN_KEY];
    const lastEmail = result[LOGIN_RESEND_EMAIL_KEY];

    if (lastSent) {
      const elapsed = (Date.now() - lastSent) / 1000;
      const remaining = LOGIN_RESEND_COOLDOWN - Math.floor(elapsed);

      if (remaining > 0) {
        loginResendSeconds = remaining;

        const emailInput = document.getElementById('login-email-input');
        const verifySection = document.getElementById('login-verify-section');
        const btnSendCode = document.getElementById('login-btn-send-code');

        if (lastEmail && emailInput) {
          emailInput.value = lastEmail;
          emailInput.disabled = true;
        }
        if (btnSendCode) btnSendCode.style.display = 'none';
        if (verifySection) {
          verifySection.style.display = 'block';
        }

        startLoginResendCountdown(lastEmail, remaining, false);
        return true;
      } else {
        chrome.storage.local.remove([LOGIN_RESEND_COOLDOWN_KEY, LOGIN_RESEND_EMAIL_KEY]);
        const btnSendCode = document.getElementById('login-btn-send-code');
        if (btnSendCode) {
          btnSendCode.disabled = false;
          btnSendCode.textContent = '发送验证码';
          btnSendCode.style.display = 'block';
        }
        const verifySection = document.getElementById('login-verify-section');
        if (verifySection) {
          verifySection.style.display = 'none';
        }
        const emailInput = document.getElementById('login-email-input');
        if (emailInput) {
          emailInput.disabled = false;
        }
        return false;
      }
    }
    const btnSendCode = document.getElementById('login-btn-send-code');
    if (btnSendCode) {
      btnSendCode.disabled = false;
      btnSendCode.textContent = '发送验证码';
      btnSendCode.style.display = 'block';
    }
    const verifySection = document.getElementById('login-verify-section');
    if (verifySection) {
      verifySection.style.display = 'none';
    }
    const emailInput = document.getElementById('login-email-input');
    if (emailInput) {
      emailInput.disabled = false;
    }
    return false;
  } catch (error) {
    return false;
  }
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
      console.info('Failed to get device info:', e);
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

      setTimeout(async () => {
        closeLoginModal();
        loadAccountInfo();
        loadVipStatus();
        loadTrialStatus();
        showMessage('登录成功！', 'success');

        try {
          await chrome.runtime.sendMessage({
            action: 'AUTH_SUCCESS',
            data: data
          });
        } catch (err) {
          console.info('[settings] AUTH_SUCCESS send failed:', err);
        }
        window.location.reload();
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
  if (provider === 'microsoft') {
    showLoginMessage(i18n.getMessage('microsoftLoginDeveloping'), 'info');
    return;
  }
  
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

        setTimeout(async () => {
          try {
            await chrome.runtime.sendMessage({
              action: 'AUTH_SUCCESS',
              data: data
            });
          } catch (err) {
            console.info('[OAuth] AUTH_SUCCESS send failed:', err);
          }
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

// 处理快捷键设置按钮点击
function handleSetupShortcut() {
  try {
    // chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    // Open Chrome keyboard shortcuts settings page
    chrome.tabs.query({ url: 'chrome://extensions/*' }, (tabs) => {
      if (tabs.length > 0) {
        // 如果已存在 chrome://extensions 标签页，切换到该标签页并导航到快捷键设置
        chrome.tabs.update(tabs[0].id, { url: 'chrome://extensions/shortcuts', active: true });
        chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        // 如果没有，创建新标签页
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
      }
    });
  } catch (error) {
    console.error('Open shortcuts page error:', error);
    showMessage('Failed to open shortcuts page', 'error');
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
  if (message.action === 'SHOW_TOAST') {
    showToast(message.message);
  }
  sendResponse({ success: true });
  return true;
});

// 全局调试方法：强制刷新体验期状态
window.forceRefreshTrialStatus = async function() {
  try {
    const trialData = await trialService.getTrialStatus(true);
    console.log('[Debug] Trial status refreshed:', trialData);
    await loadTrialStatus();
    return trialData;
  } catch (e) {
    console.error('[Debug] Force refresh failed:', e);
  }
};
