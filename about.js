// Apply internationalization and dynamically load the extension version
document.addEventListener('DOMContentLoaded', () => {
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
});

function applyI18n() {
  // Update main title
  const titleElement = document.getElementById('about-title');
  if (titleElement) {
    titleElement.textContent = chrome.i18n.getMessage('extName') || 'My Tab Search';
  }
  
  // Update version label
  const versionLabel = document.getElementById('version-label');
  if (versionLabel) {
    versionLabel.textContent = chrome.i18n.getMessage('versionLabel') || 'Version:';
  }
  
  // Update description
  const descElement = document.getElementById('about-description');
  if (descElement) {
    descElement.textContent = chrome.i18n.getMessage('aboutDescription') || 
      'My Tab Search is a Chrome extension that helps you quickly search and switch between your open tabs. With a simple keyboard shortcut, you can access all your open tabs and find the one you need in seconds.';
  }
  
  // Update features section
  const featuresHeading = document.getElementById('features-heading');
  if (featuresHeading) {
    featuresHeading.textContent = chrome.i18n.getMessage('featuresHeading') || 'Features:';
  }
  
  // Update features list items
  const featureItems = document.querySelectorAll('.feature-item');
  const featureMessages = [
    'featureSearchTabs',
    'featureKeyboardNav',
    'featureFuzzySearch',
    'featureOneClickSwitch',
    'featureCloseFromResults',
    'featureSwitchPrevious',
    'featureRememberState'
  ];
  
  featureItems.forEach((item, index) => {
    if (featureMessages[index]) {
      const message = chrome.i18n.getMessage(featureMessages[index]);
      if (message) {
        item.textContent = message;
      }
    }
  });
  
  // Update shortcuts section
  const shortcutsHeading = document.getElementById('shortcuts-heading');
  if (shortcutsHeading) {
    shortcutsHeading.textContent = chrome.i18n.getMessage('shortcutsHeading') || 'Shortcuts:';
  }
  
  // Update shortcut descriptions
  const openPopupText = document.getElementById('open-popup-text');
  if (openPopupText) {
    openPopupText.textContent = chrome.i18n.getMessage('openPopupText') || 'Open the tab search popup';
  }
  
  const switchPrevText = document.getElementById('switch-prev-text');
  if (switchPrevText) {
    switchPrevText.textContent = chrome.i18n.getMessage('switchPrevText') || 'Switch to the previous tab';
  }
  
  const navResultsText = document.getElementById('nav-results-text');
  if (navResultsText) {
    navResultsText.textContent = chrome.i18n.getMessage('navResultsText') || 'Navigate through search results';
  }
  
  const switchSelectedText = document.getElementById('switch-selected-text');
  if (switchSelectedText) {
    switchSelectedText.textContent = chrome.i18n.getMessage('switchSelectedText') || 'Switch to the selected tab';
  }
  
  const closeTabText = document.getElementById('close-tab-text');
  if (closeTabText) {
    closeTabText.textContent = chrome.i18n.getMessage('closeTabText') || 'Close the selected tab';
  }
  
  // Update footer
  const madeWithLove = document.getElementById('made-with-love');
  if (madeWithLove) {
    madeWithLove.textContent = chrome.i18n.getMessage('madeWithLove') || 'Made with ❤️ for better browsing experience';
  }
  
  const copyrightText = document.getElementById('copyright-text');
  if (copyrightText) {
    copyrightText.textContent = chrome.i18n.getMessage('copyrightText') || `© 2025 ${chrome.i18n.getMessage('extName') || 'My Tab Search Extension'}. All rights reserved.`;
  }
}