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
    
    // 根据是否已绑定邮箱来区分显示
    // 有邮箱 = 已绑定邮箱的正式用户（显示退出按钮）
    // 无邮箱 = 匿名用户（显示登录按钮）
    if (userId && profileEmail) {
      // 已绑定邮箱的正式用户
      if (elements.btnLogout) elements.btnLogout.style.display = 'block';
      if (elements.btnLogin) elements.btnLogin.style.display = 'none';
      elements.accountEmail.textContent = profileEmail;
      elements.avatarLetter.textContent = profileEmail.charAt(0).toUpperCase();
    } else {
      // 未绑定邮箱（匿名用户或未注册），显示未登录
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
    // 检查是否是匿名用户（未完成邮箱验证）
    const isEmailVerified = await authService.isEmailVerified();
    if (!isEmailVerified) {
      // 匿名用户不显示体验期状态
      elements.trialStatus.style.display = 'none';
      return;
    }

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
    }
  } catch (error) {
    console.error('Load trial status error:', error);
  }
}

// 加载设备列表
async function loadDevices() {
  try {
    let accessToken = null;
    try {
      accessToken = await authService.getValidAccessToken();
    } catch (e) {
      elements.deviceList.innerHTML = '<p class="empty-text">请先登录</p>';
      return;
    }
    
    if (!accessToken) {
      elements.deviceList.innerHTML = '<p class="empty-text">请先登录</p>';
      return;
    }

    try {
      const devices = await deviceService.getDevices();
      
      // 触发feature-limit请求以更新设备最后活跃时间
      try {
        await featureLimitService.getFeatureLimit('pinnedTabs', true, false);
      } catch (e) {
        console.error('Refresh feature limits error:', e);
      }
      
      if (!devices || devices.length === 0) {
        elements.deviceList.innerHTML = '<p class="empty-text">暂无设备</p>';
        return;
      }

      // 渲染设备列表
      elements.deviceList.innerHTML = devices.map(device => `
        <div class="device-item" data-device-id="${device.id}">
          <div class="device-icon">${getDeviceIcon(device.browserName)}</div>
          <div class="device-info">
            <div class="device-name">
              ${device.browserName || 'Unknown'} ${device.browserVersion || ''}
              ${device.isCurrentDevice ? '<span class="current-badge">当前设备</span>' : ''}
            </div>
            <div class="device-meta">
              <span class="device-platform">${device.platform || 'Unknown'}</span>
              <span class="device-last-seen">最后活跃: ${formatLastSeen(device.lastSeenAt)}</span>
            </div>
          </div>
          ${!device.isCurrentDevice ? `
            <button class="btn-remove-device" data-device-id="${device.id}" title="移除设备">
              ✕
            </button>
          ` : ''}
        </div>
      `).join('');

      // 绑定删除设备事件
      document.querySelectorAll('.btn-remove-device').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const deviceId = btn.dataset.deviceId;
          if (confirm('确定要移除此设备吗？')) {
            const result = await deviceService.deleteDevice(deviceId);
            if (result.success) {
              showMessage(i18n?.getMessage('deviceRemoved') || 'Device removed', 'success');
              await loadDevices();
            } else {
              showMessage(result.message || '移除设备失败', 'error');
            }
          }
        });
      });
    } catch (e) {
      console.error('Load devices API error:', e);
      elements.deviceList.innerHTML = '<p class="error-text">加载设备失败</p>';
    }
  } catch (error) {
    console.error('Load devices error:', error);
    elements.deviceList.innerHTML = '<p class="error-text">加载设备失败</p>';
  }
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

// 处理登录 - 打开登录页面
function handleLogin() {
  // 打开登录页面
  chrome.tabs.create({ url: chrome.runtime.getURL('html/login.html') });
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
