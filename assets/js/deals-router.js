(function () {
  const publicRoutes = new Map([
    ['categories.html', 'categories'],
    ['stores.html', 'stores'],
    ['coupons.html', 'coupons'],
    ['community.html', 'community'],
    ['alerts.html', 'alerts'],
    ['saved.html', 'saved'],
    ['games.html', 'games']
  ]);
  const pendingKey = 'dealnest:publicSection';

  function pageName(pathname = window.location.pathname) {
    const clean = pathname.split('/').pop() || 'index.html';
    return clean === '' ? 'index.html' : clean;
  }

  function rootUrl() {
    const path = window.location.pathname;
    const rootPath = path.endsWith('/')
      ? path
      : path.replace(/[^/]*$/, '');
    return `${window.location.origin}${rootPath || '/'}`;
  }

  function isHome() {
    const current = pageName();
    return current === 'index.html' || current === '';
  }

  function cleanRootUrl() {
    const root = rootUrl();
    if (window.location.href !== root) {
      window.history.replaceState({ dealnestSection: null }, document.title, root);
    }
  }

  function closeMobileMenu() {
    const header = document.querySelector('.market-header');
    const menuToggle = document.getElementById('menuToggle');
    header?.classList.remove('menu-open');
    document.body.classList.remove('menu-active');
    menuToggle?.setAttribute('aria-expanded', 'false');
  }

  function setActive(sectionId) {
    document.querySelectorAll('.primary-nav a, .site-footer a, [data-public-route]').forEach((link) => {
      let active = false;
      try {
        const url = new URL(link.getAttribute('href'), window.location.href);
        active = publicRoutes.get(pageName(url.pathname)) === sectionId;
      } catch (error) {
        active = false;
      }
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function flashSection(section) {
    section.classList.remove('section-arrived');
    window.requestAnimationFrame(() => {
      section.classList.add('section-arrived');
      window.setTimeout(() => section.classList.remove('section-arrived'), 1300);
    });
  }

  function showSection(sectionId, options = {}) {
    const target = document.getElementById(sectionId);
    if (!target) return false;
    closeMobileMenu();
    cleanRootUrl();
    setActive(sectionId);
    target.scrollIntoView({ behavior: options.instant ? 'auto' : 'smooth', block: 'start' });
    flashSection(target);
    return true;
  }

  function routeForAnchor(anchor) {
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#')) return null;
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    const route = publicRoutes.get(pageName(url.pathname));
    return route ? { url, sectionId: route } : null;
  }

  function shouldIgnoreClick(event, anchor) {
    return event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || anchor.target === '_blank'
      || anchor.hasAttribute('data-route-direct')
      || anchor.hasAttribute('download');
  }

  function interceptPublicNavigation(event) {
    const anchor = event.target.closest('a[href]');
    if (!anchor || shouldIgnoreClick(event, anchor)) return;
    const route = routeForAnchor(anchor);
    if (!route) return;

    event.preventDefault();
    if (isHome() && showSection(route.sectionId)) return;

    try {
      sessionStorage.setItem(pendingKey, route.sectionId);
    } catch (error) {
      // Navigation still falls back to the clean homepage.
    }
    window.location.assign(rootUrl());
  }

  function hydratePendingRoute() {
    if (!isHome()) return;
    cleanRootUrl();
    let pending = '';
    try {
      pending = sessionStorage.getItem(pendingKey) || '';
      sessionStorage.removeItem(pendingKey);
    } catch (error) {
      pending = '';
    }
    if (pending) {
      window.requestAnimationFrame(() => showSection(pending, { instant: true }));
    }
  }

  function init() {
    document.addEventListener('click', interceptPublicNavigation);
    hydratePendingRoute();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.DealNestRouter = { showSection };
})();
