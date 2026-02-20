// Import i18n manager
import i18n from './i18n.js';

// Apply internationalization and dynamically load the extension version
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize i18n
  await i18n.initialize();
  
  // 更新页面国际化元素
  i18n.updatePageI18n();

  // Apply i18n to UI elements
  applyI18n();
 
  // Dynamically load the extension version from manifest
  fetch(chrome.runtime.getURL('manifest.json'))
    .then(response => response.json())
    .then(manifest => {
      document.getElementById('version').textContent = manifest.version;
    })
    .catch(error => {
      console.error('Error loading manifest:', error);
    });

  // Add keyboard shortcut setup button handler
  const setupBtn = document.getElementById('btn-setup-shortcut');
  if (setupBtn) {
    setupBtn.addEventListener('click', () => {
      // Open Chrome keyboard shortcuts settings page
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
  }

  // Add language change listener
  i18n.addListener(applyI18n);

  // Listen for language change messages from other parts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'languageChanged') {
      // Update i18n language
      i18n.setLanguage(message.language).then(() => {
        // Reapply i18n after language change
        applyI18n();
      });
    }
  });
});

function applyI18n() {
  // Update page title
  document.title = i18n.getMessage('aboutTitle') || 'About - MyTabSearch';

  // Update main title
  const titleElement = document.getElementById('about-title');
  if (titleElement) {
    titleElement.textContent = i18n.getMessage('extName') || 'MyTabSearch';
  }

  // Update version label
  const versionLabel = document.getElementById('version-label');
  if (versionLabel) {
    versionLabel.textContent = i18n.getMessage('versionLabel') || 'Version:';
  }

  // Update description
  const descElement = document.getElementById('about-description');
  if (descElement) {
    descElement.textContent = i18n.getMessage('aboutDescription') ||
      'Tired of the mediocre functionality of the default tab management? Then switch to the powerful and flexible MyTabSearch extension – you will be amazed! MyTabSearch is a Chrome extension that helps you quickly search and switch between your open tabs. With a simple keyboard shortcut, you can access all your open tabs and find the one you need in seconds.';
  }

  // Update features section
  const featuresHeading = document.getElementById('features-heading');
  if (featuresHeading) {
    featuresHeading.textContent = i18n.getMessage('featuresHeading') || 'Features:';
  }

  // Update features list items
  const featureItems = document.querySelectorAll('.feature-item');
  const featureMessages = [
    'featureSearchTabs',
    'featureKeyboardNav',
    'featureOneClickSwitch',
    'featureCloseFromResults',
    'featureSwitchPrevious',
    'featureRememberState'
  ];

  featureItems.forEach((item, index) => {
    if (featureMessages[index]) {
      const message = i18n.getMessage(featureMessages[index]);
      if (message) {
        item.textContent = message;
      }
    }
  });

  // Update shortcuts section
  const shortcutsHeading = document.getElementById('shortcuts-heading');
  if (shortcutsHeading) {
    shortcutsHeading.textContent = i18n.getMessage('shortcutsHeading') || 'Shortcuts:';
  }

  // Update shortcut descriptions
  const openPopupText = document.getElementById('open-popup-text');
  if (openPopupText) {
    openPopupText.textContent = i18n.getMessage('openPopupText') || 'Open the tab search popup';
  }

  const switchPrevText = document.getElementById('switch-prev-text');
  if (switchPrevText) {
    switchPrevText.textContent = i18n.getMessage('switchPrevText') || 'Switch to the previous tab';
  }

  const openPinnedTabsText = document.getElementById('open-pinned-tabs-text');
  if (openPinnedTabsText) {
    openPinnedTabsText.textContent = i18n.getMessage('openPinnedTabsText') || 'Open pinned tabs list';
  }

  const navResultsText = document.getElementById('nav-results-text');
  if (navResultsText) {
    navResultsText.textContent = i18n.getMessage('navResultsText') || 'Navigate through search results';
  }

  const switchSelectedText = document.getElementById('switch-selected-text');
  if (switchSelectedText) {
    switchSelectedText.textContent = i18n.getMessage('switchSelectedText') || 'Switch to the selected tab';
  }

  const closeTabText = document.getElementById('close-tab-text');
  if (closeTabText) {
    closeTabText.textContent = i18n.getMessage('closeTabText') || 'Close the selected tab';
  }

  // Update usage tips section
  const usageTipsHeading = document.getElementById('usage-tips-heading');
  if (usageTipsHeading) {
    usageTipsHeading.textContent = i18n.getMessage('usageTipsHeading') || 'Usage Tips:';
  }

  const tipShortcutConflict = document.getElementById('tip-shortcut-conflict');
  if (tipShortcutConflict) {
    tipShortcutConflict.textContent = i18n.getMessage('tipShortcutConflict') || 'If the default shortcut keys fail to work, a key conflict may be the cause. You can adjust them manually in chrome://extensions/shortcuts.';
  }

  const shortcutSetupTitle = document.getElementById('shortcut-setup-title');
  if (shortcutSetupTitle) {
    shortcutSetupTitle.textContent = i18n.getMessage('shortcutSetupTitle') || 'Keyboard Shortcuts Setup';
  }

  const shortcutSetupDesc = document.getElementById('shortcut-setup-desc');
  if (shortcutSetupDesc) {
    shortcutSetupDesc.textContent = i18n.getMessage('shortcutSetupDesc') || 'Due to Chrome security restrictions, keyboard shortcuts need to be manually confirmed after installation. Click the button below to set up:';
  }

  const btnSetupShortcut = document.getElementById('btn-setup-shortcut');
  if (btnSetupShortcut) {
    btnSetupShortcut.textContent = i18n.getMessage('btnSetupShortcut') || 'Set Up Keyboard Shortcuts';
  }

  const tipPinExtension = document.getElementById('tip-pin-extension');
  if (tipPinExtension) {
    tipPinExtension.textContent = i18n.getMessage('tipPinExtension') || 'For a smoother user experience, it is recommended to pin the extension to the browser toolbar directly after installation.';
  }

  // Update footer
  const madeWithLove = document.getElementById('made-with-love');
  if (madeWithLove) {
    madeWithLove.textContent = i18n.getMessage('madeWithLove') || 'Made with ❤️ for better browsing experience';
  }

  const copyrightText = document.getElementById('copyright-text');
  if (copyrightText) {
    copyrightText.textContent = i18n.getMessage('copyrightText') || `© 2026 ${i18n.getMessage('extName') || 'MyTabSearch Extension'}. All rights reserved.`;
  }
}