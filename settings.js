document.addEventListener('DOMContentLoaded', () => {
  // Apply internationalization
  applyI18n();
  
  // Load saved settings
  loadSettings();
  
  // Set up event listeners
  setupEventListeners();
});

function applyI18n() {
  // Update page title
  document.title = chrome.i18n.getMessage('settingsTitle') || 'Settings - My Tab Search';
  
  // Update language options with localized text
  const enOption = document.getElementById('en-option');
  const zhCnOption = document.getElementById('zh-cn-option');
  
  if (enOption) {
    enOption.textContent = chrome.i18n.getMessage('englishOption') || 'English';
  }
  
  if (zhCnOption) {
    zhCnOption.textContent = chrome.i18n.getMessage('simplifiedChineseOption') || '中文';
  }
  
  // Update other UI elements
  const languageLabel = document.querySelector('label[for="language-select"]');
  if (languageLabel) {
    languageLabel.textContent = chrome.i18n.getMessage('languageLabel') || 'Select Language:';
  }
  
  // Update other labels if they exist
  document.querySelector('h1').textContent = chrome.i18n.getMessage('settingsTitle') || 'Extension Settings';
}

function loadSettings() {
  chrome.storage.sync.get([
    'language', 
    'maxResults', 
    'theme', 
    'autoClosePopup', 
    'showFavicons'
  ], (result) => {
    // Set language
    if (result.language) {
      document.getElementById('language-select').value = result.language;
    } else {
      // Set default language to system preference if not set
      document.getElementById('language-select').value = chrome.i18n.getUILanguage() || 'en';
    }
    
    // Set max results
    if (result.maxResults) {
      document.getElementById('max-results').value = result.maxResults;
      document.getElementById('max-results-value').textContent = result.maxResults;
    }
    
    // Set theme
    if (result.theme) {
      document.getElementById('theme-select').value = result.theme;
    }
    
    // Set auto close popup
    if (typeof result.autoClosePopup !== 'undefined') {
      document.getElementById('auto-close-popup').checked = result.autoClosePopup;
    }
    
    // Set show favicons
    if (typeof result.showFavicons !== 'undefined') {
      document.getElementById('show-favicons').checked = result.showFavicons;
    }
  });
}

function setupEventListeners() {
  // Max results slider
  const maxResultsSlider = document.getElementById('max-results');
  const maxResultsValue = document.getElementById('max-results-value');
  maxResultsSlider.addEventListener('input', () => {
    maxResultsValue.textContent = maxResultsSlider.value;
  });
  
  // Save button
  document.getElementById('save-settings').addEventListener('click', saveSettings);
}

function saveSettings() {
  const settings = {
    language: document.getElementById('language-select').value,
    maxResults: parseInt(document.getElementById('max-results').value),
    theme: document.getElementById('theme-select').value,
    autoClosePopup: document.getElementById('auto-close-popup').checked,
    showFavicons: document.getElementById('show-favicons').checked
  };
  
  chrome.storage.sync.set(settings, () => {
    if (chrome.runtime.lastError) {
      const errorMsg = chrome.i18n.getMessage('errorSavingSettings') || 'Error saving settings: ';
      showMessage(errorMsg + chrome.runtime.lastError.message, 'error');
    } else {
      const successMsg = chrome.i18n.getMessage('settingsSaved') || 'Settings saved successfully!';
      showMessage(successMsg, 'success');
      
      // Notify other parts of the extension about the language change
      if (settings.language) {
        chrome.runtime.sendMessage({
          action: 'languageChanged',
          language: settings.language
        });
      }
    }
  });
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