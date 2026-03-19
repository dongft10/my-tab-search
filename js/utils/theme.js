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
    const savedTheme = localStorage.getItem(THEME_KEY);
    const html = document.documentElement;
    
    // 如果用户设置了主题，使用用户设置的主题
    if (savedTheme === 'dark') {
      html.setAttribute('data-theme', 'dark');
    } else if (savedTheme === 'light') {
      html.setAttribute('data-theme', 'light');
    }
    // 如果用户没有设置主题，则使用系统偏好（通过 CSS 媒体查询自动处理）
  },

  toggle() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    
    if (currentTheme === 'light' || (!currentTheme && this.getSystemPrefersDark() === false)) {
      // 当前是亮色主题，切换到暗色
      html.setAttribute('data-theme', 'dark');
      localStorage.setItem(THEME_KEY, 'dark');
      return 'dark';
    } else {
      // 当前是暗色主题，切换到亮色
      html.setAttribute('data-theme', 'light');
      localStorage.setItem(THEME_KEY, 'light');
      return 'light';
    }
  },

  getSystemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  },

  getCurrentTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) {
      return savedTheme;
    }
    // 如果没有设置，返回系统偏好
    return this.getSystemPrefersDark() ? 'dark' : 'light';
  },

  setTheme(theme) {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      html.setAttribute('data-theme', 'light');
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
