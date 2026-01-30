// Import i18n manager
import i18n from './i18n.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize i18n
  await i18n.initialize();

  // Apply internationalization
  applyI18n();

  // Load saved settings
  loadSettings();

  // Set up event listeners
  setupEventListeners();

  // Add language change listener
  i18n.addListener(applyI18n);
});

function applyI18n() {
  // Update page title
  document.title = i18n.getMessage('settingsTitle') || 'Settings - MyTabSearch';

  // Update language options with localized text
  const enOption = document.getElementById('en-option');
  const zhCnOption = document.getElementById('zh-cn-option');

  if (enOption) {
    enOption.textContent = i18n.getMessage('englishOption') || 'English';
  }

  if (zhCnOption) {
    zhCnOption.textContent = i18n.getMessage('simplifiedChineseOption') || '中文';
  }

  // Update other UI elements
  const languageLabel = document.querySelector('label[for="language-select"]');
  if (languageLabel) {
    languageLabel.textContent = i18n.getMessage('languageLabel') || 'Select Language:';
  }

  // Update other labels if they exist
  document.querySelector('h1').textContent = i18n.getMessage('settingsTitle') || 'Extension Settings';

  // Update Language Settings heading
  const languageSettingsHeading = document.querySelector('.setting-group h3');
  if (languageSettingsHeading) {
    // Directly set text based on current language
    languageSettingsHeading.textContent = i18n.language === 'zh_CN' ? '语言设置' : 'Language Settings';
  }

  // Update Save Settings button
  const saveButton = document.getElementById('save-settings');
  if (saveButton) {
    // Directly set text based on current language
    saveButton.textContent = i18n.language === 'zh_CN' ? '保存设置' : 'Save Settings';
  }
}

function loadSettings() {
  chrome.storage.sync.get(['language'], (result) => {
    // Set language
    if (result.language) {
      document.getElementById('language-select').value = result.language;
    } else {
      // Set default language to system preference if not set
      document.getElementById('language-select').value = chrome.i18n.getUILanguage() || 'en';
    }
  });
}

function setupEventListeners() {
  // Save button
  document.getElementById('save-settings').addEventListener('click', saveSettings);
}

async function saveSettings() {
  const settings = {
    language: document.getElementById('language-select').value
  };

  try {
    await chrome.storage.sync.set(settings);

    // Update i18n language
    if (settings.language) {
      await i18n.setLanguage(settings.language);
      // Force reapply i18n after language change
      applyI18n();
    }

    const successMsg = i18n.getMessage('settingsSaved') || 'Settings saved successfully!';
    showMessage(successMsg, 'success');

    // Notify other parts of the extension about the language change
    if (settings.language) {
      chrome.runtime.sendMessage({
        action: 'languageChanged',
        language: settings.language
      });
    }
  } catch (error) {
    const errorMsg = i18n.getMessage('errorSavingSettings') || 'Error saving settings: ';
    showMessage(errorMsg + error.message, 'error');
  }
}

function showMessage(message, type) {
  const statusEl = document.getElementById('status-message');
  statusEl.textContent = message;
  statusEl.className = 'status-message status-' + type;
  statusEl.style.display = 'block';

  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 3000);
}

// Listen for language change messages from other parts of the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'languageChanged') {
    // Reapply i18n when language changes from elsewhere
    applyI18n();
  }
});