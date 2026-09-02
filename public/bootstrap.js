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

  // Disconnected mobiles are intentionally locked against drag/reorder, but the
  // same React lock also marks the green power button as disabled. Browsers do
  // not deliver React's onClick for a button whose component prop is disabled,
  // even if the DOM attribute is later removed. Keep the button tappable and,
  // for disconnected rows only, route the tap through the already-supported
  // "Incorporar móvil" form so the real Supabase RPC is executed.
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

  var setReactInputValue = function (input, value) {
    try {
      var descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      if (descriptor && descriptor.set) descriptor.set.call(input, value);
      else input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {
      input.value = value;
      try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    }
  };

  var submitDisconnectedMobileByUnit = function (unitNumber, attempt) {
    var input = document.querySelector('input[aria-label="Número de móvil a incorporar"]');
    if (!input) {
      var manage = document.querySelector('button[aria-label="Gestionar móviles por radio"]');
      if (manage && attempt === 0) {
        try { manage.click(); } catch (_) {}
      }
      if (attempt < 5) window.setTimeout(function () { submitDisconnectedMobileByUnit(unitNumber, attempt + 1); }, 40);
      return;
    }

    setReactInputValue(input, unitNumber);
    window.setTimeout(function () {
      var form = input.closest('form');
      if (!form) return;
      try {
        if (typeof form.requestSubmit === 'function') form.requestSubmit();
        else {
          var submit = form.querySelector('button[type="submit"]');
          if (submit) submit.click();
        }
      } catch (_) {}
    }, 60);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installOperatorPowerGuard, { once: true });
  else installOperatorPowerGuard();

  document.addEventListener('click', function (event) {
    if (driverRoute) return;
    var target = event.target;
    var button = target && typeof target.closest === 'function' ? target.closest('button[aria-label^="Incorporar o retirar el móvil"]') : null;
    if (!button) return;
    var row = button.closest('[title*="DESCONECTADO"]');
    if (!row) return;

    var label = String(button.getAttribute('aria-label') || '');
    var match = label.match(/móvil\s+(.+?)\s+de la fila manual/i);
    if (!match || !match[1]) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    submitDisconnectedMobileByUnit(match[1].trim(), 0);
  }, true);

  // Permission recovery for the driver GPS card. Android can reject a permission
  // dialog while another app (for example an Uber floating bubble) is drawing
  // over the screen. The warning card itself now acts as a retry affordance: a
  // real user tap is forwarded immediately to the existing React GPS control so
  // Chrome/Android can request the permission again once the overlay is closed.
  document.addEventListener('click', function (event) {
    if (!driverRoute) return;
    var target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    var section = target.closest('section');
    if (!section) return;
    var text = String(section.textContent || '');
    if (text.indexOf('REVISAR GPS') === -1 && text.indexOf('Ubicación bloqueada') === -1) return;
    var gpsButton = document.querySelector('button[aria-label="Activar GPS"]');
    if (!gpsButton || gpsButton.contains(target)) return;
    try { gpsButton.click(); } catch (_) {}
  }, true);

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
