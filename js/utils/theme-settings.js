import i18n from '../i18n.js';

document.addEventListener('DOMContentLoaded', () => {
  if (window.ThemeManager) {
    window.ThemeManager.init();
    
    // 确保默认主题已设置
    if (!localStorage.getItem('theme')) {
      window.ThemeManager.setTheme('light');
    }
    
    const savedTheme = localStorage.getItem('theme') || 'light';
    const themeRadio = document.querySelector(`input[name="theme"][value="${savedTheme}"]`);
    if (themeRadio) {
      themeRadio.checked = true;
    }
    
    document.querySelectorAll('input[name="theme"]').forEach(radio => {
      radio.addEventListener('change', async (e) => {
        const newTheme = e.target.value;
        
        // 如果切换到暗色主题，检查邮箱验证
        if (newTheme === 'dark') {
          const isVerified = await checkEmailVerification();
          if (!isVerified) {
            // 验证失败，恢复之前的选中状态
            e.target.checked = false;
            const savedRadio = document.querySelector(`input[name="theme"][value="${savedTheme}"]`);
            if (savedRadio) {
              savedRadio.checked = true;
            }
            return;
          }
        }
        
        window.ThemeManager.setTheme(newTheme);
      });
    });
  }
});

// 检查邮箱验证
async function checkEmailVerification() {
  try {
    const data = await chrome.storage.local.get('registeredAt');
    const isRegistered = !!(data.registeredAt);
    
    if (!isRegistered) {
      // 获取国际化消息
      const message = i18n.getMessage('featureRequireVerification') || 
                     'Please complete email verification to use this feature';
      showMessage(message);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Check email verification error:', error);
    return true; // 出错时允许操作
  }
}

// 显示提示消息（使用 settings.js 相同的样式）
function showMessage(message) {
  const statusEl = document.getElementById('status-message');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = 'status-message status-error';
    statusEl.style.display = 'block';
    
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }
}
