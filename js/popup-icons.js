// Handle About and Settings button clicks
document.addEventListener('DOMContentLoaded', () => {
  const aboutBtn = document.getElementById('about-btn');
  const settingsBtn = document.getElementById('settings-btn');

  if (aboutBtn) {
    aboutBtn.addEventListener('click', () => {
      // Open about page in a new tab
      chrome.tabs.create({ url: chrome.runtime.getURL('html/about.html') });
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      // Open settings page in a new tab
      chrome.tabs.create({ url: chrome.runtime.getURL('html/settings.html') });
    });
  }
});