(function () {
  const capacitor = window.Capacitor;
  const plugins = capacitor?.Plugins || {};
  const isNative = Boolean(capacitor?.isNativePlatform?.());

  function applyShellClass() {
    document.documentElement.classList.toggle('is-capacitor', isNative);
  }

  function syncStatusBar() {
    if (!isNative || !plugins.StatusBar) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    plugins.StatusBar.setBackgroundColor?.({ color: dark ? '#07100f' : '#f7fbf8' }).catch(() => {});
    plugins.StatusBar.setStyle?.({ style: dark ? 'DARK' : 'LIGHT' }).catch(() => {});
  }

  function bindNativeBackButton() {
    if (!isNative || !plugins.App) return;
    plugins.App.addListener?.('backButton', ({ canGoBack }) => {
      const authModal = document.getElementById('authModal');
      if (authModal?.classList.contains('open')) {
        window.DealNestAuth?.closeAuth?.();
        return;
      }
      if (canGoBack) window.history.back();
      else plugins.App.exitApp?.();
    });
  }

  function bindOAuthReturn() {
    if (!isNative || !plugins.App) return;
    plugins.App.addListener?.('appUrlOpen', (event) => {
      if (!event?.url) return;
      window.DealNestAuth?.handleOAuthUrl?.(event.url);
    });
  }

  function bindMicroFeedback() {
    if (!isNative || !plugins.Haptics) return;
    document.body.addEventListener('click', (event) => {
      if (!event.target.closest('button, .post-button, .deal-action, .copy-btn')) return;
      plugins.Haptics.impact?.({ style: 'LIGHT' }).catch(() => {});
    }, { passive: true });
  }

  window.addEventListener('dealnest:theme-applied', syncStatusBar);
  function initMobileShell() {
    applyShellClass();
    syncStatusBar();
    bindNativeBackButton();
    bindOAuthReturn();
    bindMicroFeedback();
    plugins.SplashScreen?.hide?.().catch(() => {});
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initMobileShell, { once: true });
  } else {
    initMobileShell();
  }

  window.DealNestMobile = {
    isNative,
    nativeRedirectUrl() {
      return 'com.razzrohith.dealnest://auth/callback';
    },
    async openExternal(url) {
      if (isNative && plugins.Browser) return plugins.Browser.open({ url });
      window.location.assign(url);
      return null;
    }
  };
}());
