// i18n.js - Custom internationalization manager

class I18nManager {
  constructor() {
    this.language = 'en'; // Default language
    this.messages = {};
    this.loadedLanguages = new Set();
    this.listeners = [];
  }

  // Initialize the i18n manager
  async initialize() {
    try {
      // Load saved language preference
      const result = await chrome.storage.sync.get('language');
      if (result.language) {
        this.language = result.language;
      } else {
        // Use browser language as fallback
        const browserLang = chrome.i18n.getUILanguage();
        this.language = browserLang.startsWith('zh') ? 'zh_CN' : 'en';
      }

      // Load messages for the current language
      await this.loadMessages(this.language);
    } catch (error) {
      console.error('Failed to initialize i18n:', error);
    }
  }

  // Load messages for a specific language
  async loadMessages(lang) {
    try {
      if (this.loadedLanguages.has(lang)) {
        return;
      }

      const response = await fetch(`/_locales/${lang}/messages.json`);
      if (!response.ok) {
        throw new Error(`Failed to load messages for ${lang}`);
      }

      const messages = await response.json();
      this.messages[lang] = messages;
      this.loadedLanguages.add(lang);
    } catch (error) {
      console.error(`Failed to load messages for ${lang}:`, error);
      // Fallback to English if loading fails
      if (lang !== 'en') {
        await this.loadMessages('en');
      }
    }
  }

  // Get message for a key
  getMessage(key, replacements = null) {
    // Try current language first
    let message = this._getMessageFromLang(key, this.language);
    
    // Fallback to English if not found
    if (!message) {
      message = this._getMessageFromLang(key, 'en');
    }

    // Fallback to key itself if still not found
    if (!message) {
      return key;
    }

    // Apply replacements if provided
    if (replacements) {
      if (Array.isArray(replacements)) {
        replacements.forEach((replacement, index) => {
          message = message.replace(`$${index + 1}`, replacement);
        });
      } else if (typeof replacements === 'string') {
        // 替换 $count$ 格式的占位符
        message = message.replace(/\$\w+\$/g, replacements);
      }
    }

    return message;
  }

  // Get message from specific language
  _getMessageFromLang(key, lang) {
    if (this.messages[lang] && this.messages[lang][key]) {
      return this.messages[lang][key].message;
    }
    return null;
  }

  // Set language
  async setLanguage(lang) {
    if (this.language === lang) {
      return;
    }

    this.language = lang;
    await this.loadMessages(lang);
    
    // Always notify listeners regardless of whether the language was just loaded
    this.notifyLanguageChanged(lang);
  }

  // Add language change listener
  addListener(listener) {
    this.listeners.push(listener);
  }

  // Remove language change listener
  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  // Notify all listeners of language change
  notifyLanguageChanged(lang) {
    this.listeners.forEach(listener => {
      try {
        listener(lang);
      } catch (error) {
        console.error('Error in language change listener:', error);
      }
    });
  }

  // Update all elements with data-i18n attribute
  updatePageI18n() {
    // Update text content
    const textElements = document.querySelectorAll('[data-i18n]');
    textElements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      const message = this.getMessage(key);
      if (message && message !== key) {
        el.textContent = message;
      }
    });

    // Update placeholders
    const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
    placeholderElements.forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const message = this.getMessage(key);
      if (message && message !== key) {
        el.placeholder = message;
      }
    });

    // Update titles
    const titleElements = document.querySelectorAll('[data-i18n-title]');
    titleElements.forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const message = this.getMessage(key);
      if (message && message !== key) {
        el.title = message;
      }
    });

    // Update document title
    const titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) {
      const key = titleEl.getAttribute('data-i18n');
      const message = this.getMessage(key);
      if (message && message !== key) {
        document.title = message;
      }
    }
  }
}

// Export singleton instance
const i18n = new I18nManager();
export default i18n;