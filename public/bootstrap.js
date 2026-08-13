(function () {
  var theme = 'dark';
  try {
    var storedTheme = window.localStorage.getItem('centralgo:color-theme');
    if (storedTheme === 'light' || storedTheme === 'dark') theme = storedTheme;
    else if (window.matchMedia('(prefers-color-scheme: light)').matches) theme = 'light';
  } catch (_) {
    // Local storage may be blocked; dark remains the safe operational default.
  }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  var driverRoute = window.location.pathname === '/driver' || window.location.pathname.indexOf('/driver/') === 0;
  var manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = driverRoute ? '/driver-manifest.json' : '/manifest.json';
  document.head.appendChild(manifest);

  if (driverRoute) {
    document.title = 'Central GO Conductor';
    var appTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    var themeColor = document.querySelector('meta[name="theme-color"]');
    if (appTitle) appTitle.setAttribute('content', 'GO Conductor');
    if (themeColor) themeColor.setAttribute('content', '#07111f');
  }
})();
