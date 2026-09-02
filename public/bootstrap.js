(function () {
  var theme = 'dark';
  var pendingInstallPrompt = null;

  // Capture the Chromium install event as early as possible. The React bundle is
  // intentionally large and some mobile browsers can make the install event
  // available before the driver screen has mounted its own listener.
  window.addEventListener('beforeinstallprompt', function (event) {
    try { event.preventDefault(); } catch (_) {}
    // On the driver route this bootstrap owns the prompt lifecycle. Keeping the
    // same event out of the later React listener prevents a dismissed prompt from
    // becoming a stale, second-click failure.
    if (window.location.pathname === '/driver' || window.location.pathname.indexOf('/driver/') === 0) {
      try { event.stopImmediatePropagation(); } catch (_) {}
    }
    pendingInstallPrompt = event;
    window.__centralGoInstallPrompt = event;
    try { window.dispatchEvent(new CustomEvent('pwa-installable')); } catch (_) {}
  });

  window.addEventListener('appinstalled', function () {
    pendingInstallPrompt = null;
    window.__centralGoInstallPrompt = null;
    try { window.dispatchEvent(new CustomEvent('pwa-installed')); } catch (_) {}
  });

  try {
    var storedTheme = window.localStorage.getItem('centralgo:color-theme');
    if (storedTheme === 'light' || storedTheme === 'dark') theme = storedTheme;
    else if (window.matchMedia('(prefers-color-scheme: light)').matches) theme = 'light';
  } catch (_) {
    // Local storage may be blocked; dark remains the safe operational default.
  }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  var themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute('content', theme === 'light' ? '#e7f0f9' : '#0b2340');

  var driverRoute = window.location.pathname === '/driver' || window.location.pathname.indexOf('/driver/') === 0;
  var manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = driverRoute ? '/driver-manifest.json' : '/manifest.json';
  document.head.appendChild(manifest);

  if (driverRoute) {
    document.title = 'Central GO Conductor';
    var appTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appTitle) appTitle.setAttribute('content', 'GO Conductor');
    if (themeColor) themeColor.setAttribute('content', theme === 'light' ? '#e7f0f9' : '#061120');
  }

  // Operator manual-control safety patch: disconnected mobiles must remain
  // manually incorporable. React intentionally locks drag/reorder controls for
  // disconnected rows, but the same lock was also disabling the green power
  // button. Re-enable only that control on rows explicitly marked DESCONECTADO;
  // paused and in-trip mobiles remain protected.
  var enableDisconnectedPowerButtons = function () {
    var buttons = document.querySelectorAll('button[aria-label^="Incorporar o retirar el móvil"]');
    buttons.forEach(function (button) {
      var row = button.closest('[title*="DESCONECTADO"]');
      if (row && button.disabled) button.disabled = false;
    });
  };

  var installOperatorPowerGuard = function () {
    enableDisconnectedPowerButtons();
    if (!document.body || typeof MutationObserver === 'undefined') return;
    var observer = new MutationObserver(function () { enableDisconnectedPowerButtons(); });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'title'] });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installOperatorPowerGuard, { once: true });
  else installOperatorPowerGuard();

  // Driver install hot path: use the early captured native prompt directly from
  // the existing button. If no native prompt exists, React keeps handling the
  // click and shows the platform-specific manual installation instructions.
  document.addEventListener('click', function (event) {
    if (!driverRoute || !pendingInstallPrompt) return;
    var target = event.target;
    var button = target && typeof target.closest === 'function' ? target.closest('button') : null;
    if (!button || String(button.textContent || '').indexOf('Instalar app del conductor') === -1) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    var promptEvent = pendingInstallPrompt;
    Promise.resolve()
      .then(function () { return promptEvent.prompt(); })
      .then(function () { return promptEvent.userChoice; })
      .then(function () {
        if (pendingInstallPrompt === promptEvent) pendingInstallPrompt = null;
        if (window.__centralGoInstallPrompt === promptEvent) window.__centralGoInstallPrompt = null;
      })
      .catch(function (error) {
        console.warn('Central GO driver install prompt failed:', error);
        if (pendingInstallPrompt === promptEvent) pendingInstallPrompt = null;
        if (window.__centralGoInstallPrompt === promptEvent) window.__centralGoInstallPrompt = null;
        // Let the existing React fallback explain the manual installation path.
        window.setTimeout(function () { try { button.click(); } catch (_) {} }, 0);
      });
  }, true);
})();
