document.addEventListener('DOMContentLoaded', () => {
  if (window.ThemeManager) {
    // 确保默认主题已设置
    if (!localStorage.getItem('theme')) {
      window.ThemeManager.setTheme('light');
    }
    window.ThemeManager.init();
  }
});
