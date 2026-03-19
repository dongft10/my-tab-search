document.addEventListener('DOMContentLoaded', () => {
  if (window.ThemeManager) {
    // 主题已经在 HTML 的内联脚本中初始化了
    // 这里只需要初始化事件监听器
    window.ThemeManager.init();
  }
});
