(function () {
  const storageKey = 'dealnest:theme';
  const choices = ['light', 'dark', 'system'];
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  let preference = readPreference();

  function readPreference() {
    try {
      const saved = localStorage.getItem(storageKey);
      return choices.includes(saved) ? saved : 'system';
    } catch (error) {
      return 'system';
    }
  }

  function systemTheme() {
    return media?.matches ? 'dark' : 'light';
  }

  function resolvedTheme(choice = preference) {
    return choice === 'system' ? systemTheme() : choice;
  }

  function updateMeta(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#07100f' : '#f7fbf8');
  }

  function updateToggle() {
    document.querySelectorAll('[data-theme-choice]').forEach((button) => {
      const active = button.dataset.themeChoice === preference;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function applyTheme(choice = preference, persist = false) {
    preference = choices.includes(choice) ? choice : 'system';
    const theme = resolvedTheme(preference);
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.style.colorScheme = theme;
    updateMeta(theme);
    updateToggle();
    window.dispatchEvent(new CustomEvent('dealnest:theme-applied', { detail: { preference, theme } }));
    if (persist) {
      try {
        localStorage.setItem(storageKey, preference);
      } catch (error) {
        // Theme still applies for this page even when storage is unavailable.
      }
    }
  }

  function makeSwitcher() {
    const switcher = document.createElement('div');
    switcher.className = 'theme-switcher';
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', 'Color theme');
    switcher.innerHTML = `
      <button type="button" data-theme-choice="light" onclick="window.DealNestTheme?.apply('light')">Light</button>
      <button type="button" data-theme-choice="dark" onclick="window.DealNestTheme?.apply('dark')">Dark</button>
      <button type="button" data-theme-choice="system" onclick="window.DealNestTheme?.apply('system')">System</button>
    `;
    return switcher;
  }

  function handleThemeClick(event) {
    const target = event.target;
    const button = target?.closest
      ? target.closest('[data-theme-choice]')
      : target?.parentElement?.closest?.('[data-theme-choice]');
    if (!button) return;
    event.preventDefault();
    applyTheme(button.dataset.themeChoice, true);
    window.dispatchEvent(new CustomEvent('dealnest:theme-changed', {
      detail: { preference, theme: resolvedTheme(preference) }
    }));
  }

  function mountToggle() {
    document.querySelectorAll('.market-header').forEach((header) => {
      if (header.querySelector('.theme-switcher')) return;
      const actions = header.querySelector('.header-actions');
      const switcher = makeSwitcher();
      switcher.querySelectorAll('[data-theme-choice]').forEach((button) => {
        button.addEventListener('click', handleThemeClick);
      });
      if (actions) header.insertBefore(switcher, actions);
      else header.appendChild(switcher);
    });
    updateToggle();
  }

  applyTheme(preference, false);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountToggle, { once: true });
  } else {
    mountToggle();
  }

  media?.addEventListener?.('change', () => {
    if (preference === 'system') applyTheme('system', false);
  });

  document.addEventListener('click', handleThemeClick, true);

  window.DealNestTheme = {
    apply: (choice) => applyTheme(choice, true),
    preference: () => preference,
    current: () => resolvedTheme(preference)
  };
})();
