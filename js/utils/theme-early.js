(function() {
  try {
    var theme = localStorage.getItem('theme') || 'light';
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } catch(e) {}
})();
