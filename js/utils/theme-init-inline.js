// 在页面渲染前立即应用主题，防止闪烁
// 这个脚本必须在</head>之前加载，所以放在 HTML 的 head 中作为外部脚本
(function() {
  const theme = localStorage.getItem('theme');
  // 如果用户设置了主题，使用用户设置的主题
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    // 立即设置背景色，防止白屏闪烁
    document.documentElement.style.backgroundColor = '#0f0f1a';
    document.body && (document.body.style.backgroundColor = '#0f0f1a');
    // 更新内联样式
    const style = document.getElementById('initial-bg-style');
    if (style) {
      style.textContent = 'html, body { background-color: #0f0f1a; margin: 0; padding: 0; }';
    }
  } else if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.backgroundColor = '#f8fafc';
    document.body && (document.body.style.backgroundColor = '#f8fafc');
    const style = document.getElementById('initial-bg-style');
    if (style) {
      style.textContent = 'html, body { background-color: #f8fafc; margin: 0; padding: 0; }';
    }
  } else {
    // 没有设置主题时，根据系统偏好设置背景色
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const bgColor = prefersDark ? '#0f0f1a' : '#f8fafc';
    document.documentElement.style.backgroundColor = bgColor;
    document.body && (document.body.style.backgroundColor = bgColor);
    const style = document.getElementById('initial-bg-style');
    if (style) {
      style.textContent = `html, body { background-color: ${bgColor}; margin: 0; padding: 0; }`;
    }
  }
})();
