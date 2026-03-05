document.addEventListener('DOMContentLoaded', () => {
  if (window.ThemeManager) {
    window.ThemeManager.init();
    
    // 确保默认主题已设置
    if (!localStorage.getItem('theme')) {
      window.ThemeManager.setTheme('light');
    }
    
    const savedTheme = localStorage.getItem('theme') || 'light';
    const themeRadio = document.querySelector(`input[name="theme"][value="${savedTheme}"]`);
    if (themeRadio) {
      themeRadio.checked = true;
    }
    
    document.querySelectorAll('input[name="theme"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        window.ThemeManager.setTheme(e.target.value);
      });
    });
  }
});
