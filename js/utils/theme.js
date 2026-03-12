const THEME_KEY = 'theme';

const ThemeManager = {
  init() {
    this.applyTheme();
    window.addEventListener('storage', (e) => {
      if (e.key === THEME_KEY) {
        this.applyTheme();
      }
    });
  },

  applyTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
    const html = document.documentElement;
    
    if (savedTheme === 'light') {
      html.setAttribute('data-theme', 'light');
    } else {
      html.removeAttribute('data-theme');
    }
  },

  toggle() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    
    if (currentTheme === 'light') {
      html.removeAttribute('data-theme');
      localStorage.setItem(THEME_KEY, 'dark');
      return 'dark';
    } else {
      html.setAttribute('data-theme', 'light');
      localStorage.setItem(THEME_KEY, 'light');
      return 'light';
    }
  },

  getCurrentTheme() {
    return localStorage.getItem(THEME_KEY) || 'light';
  },

  setTheme(theme) {
    const html = document.documentElement;
    if (theme === 'light') {
      html.setAttribute('data-theme', 'light');
    } else {
      html.removeAttribute('data-theme');
    }
    localStorage.setItem(THEME_KEY, theme);
  }
};

// 同时支持模块导出和普通脚本
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ThemeManager };
} else {
  window.ThemeManager = ThemeManager;
}
