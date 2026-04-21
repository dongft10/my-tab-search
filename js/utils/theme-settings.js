import i18n from '../i18n.js';

const THEME_KEY = 'theme';

let currentTheme = 'light';
let i18nInitialized = false;

function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === 'light') {
    html.setAttribute('data-theme', 'light');
  } else {
    html.removeAttribute('data-theme');
  }
  localStorage.setItem(THEME_KEY, theme);
}

function initThemeSettings() {
  if (!localStorage.getItem(THEME_KEY)) {
    applyTheme('light');
  }
  
  currentTheme = localStorage.getItem(THEME_KEY) || 'light';
  
  const themeRadio = document.querySelector(`input[name="theme"][value="${currentTheme}"]`);
  if (themeRadio) {
    themeRadio.checked = true;
  }
  
  document.querySelectorAll('input[name="theme"]').forEach(radio => {
    radio.addEventListener('change', async (e) => {
      const newTheme = e.target.value;
      
      if (newTheme === 'dark') {
        const isVerified = await checkEmailVerification();
        if (!isVerified) {
          e.target.checked = false;
          const savedRadio = document.querySelector(`input[name="theme"][value="${currentTheme}"]`);
          if (savedRadio) {
            savedRadio.checked = true;
          }
          return;
        }
      }
      
      applyTheme(newTheme);
      currentTheme = newTheme;
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await i18n.initialize();
  i18nInitialized = true;
  initThemeSettings();
});

async function checkEmailVerification() {
  try {
    const data = await chrome.storage.local.get('registeredAt');
    const isRegistered = !!(data.registeredAt);
    
    if (!isRegistered) {
      const message = i18nInitialized 
        ? i18n.getMessage('featureRequireVerification')
        : 'Please complete email verification to use this feature';
      showMessage(message || 'Please complete email verification to use this feature');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Check email verification error:', error);
    return true;
  }
}

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
