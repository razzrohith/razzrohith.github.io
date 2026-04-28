(function () {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let revealObserver;
  let counterObserver;
  let ticking = false;
  let magneticBound = false;
  let progressBound = false;

  function reveal() {
    const items = document.querySelectorAll('.motion-item:not(.in-view)');
    if (prefersReduced || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('in-view'));
      return;
    }
    revealObserver ||= new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    items.forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index % 8, 6) * 45}ms`;
      revealObserver.observe(item);
    });
  }

  function counters() {
    const nodes = document.querySelectorAll('[data-count]');
    if (prefersReduced) {
      nodes.forEach((node) => {
        node.textContent = Number(node.dataset.count).toLocaleString('en-US');
      });
      return;
    }
    const animate = (node) => {
      const target = Number(node.dataset.count);
      const start = performance.now();
      const duration = 1200;
      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        node.textContent = Math.round(target * eased).toLocaleString('en-US');
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    counterObserver ||= new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.target.dataset.counted) return;
        entry.target.dataset.counted = 'true';
        animate(entry.target);
      });
    }, { threshold: 0.7 });
    nodes.forEach((node) => {
      if (!node.dataset.counted) counterObserver.observe(node);
    });
  }

  function parallax() {
    if (prefersReduced) return;
    const hero = document.querySelector('.hero-stage');
    if (!hero) return;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const offset = Math.min(window.scrollY * 0.08, 54);
        hero.querySelectorAll('.floating-deal-card').forEach((card, index) => {
          card.style.translate = `0 ${offset * (index + 1) * -0.18}px`;
        });
        ticking = false;
      });
    }, { passive: true });
  }

  function scrollProgress() {
    if (progressBound) return;
    progressBound = true;
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    const update = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      bar.style.transform = `scaleX(${Math.min(window.scrollY / max, 1)})`;
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
  }

  function magneticButtons() {
    if (prefersReduced || magneticBound) return;
    magneticBound = true;
    const selector = '.post-button, .deal-action, .save-btn, .copy-btn, .heat-button, .ghost-button';
    document.body.addEventListener('pointermove', (event) => {
      const button = event.target.closest?.(selector);
      if (!button || window.innerWidth < 760) return;
      const rect = button.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) / rect.width;
      const y = (event.clientY - rect.top - rect.height / 2) / rect.height;
      button.style.setProperty('--magnet-x', `${x * 8}px`);
      button.style.setProperty('--magnet-y', `${y * 6}px`);
    });
    document.body.addEventListener('pointerout', (event) => {
      const button = event.target.closest?.(selector);
      if (!button) return;
      button.style.removeProperty('--magnet-x');
      button.style.removeProperty('--magnet-y');
    });
  }

  function markEnhanced() {
    document.documentElement.classList.add('motion-enhanced');
    document.querySelectorAll('.deal-card, .category-card, .store-card, .coupon-card, .topic-card, .dashboard-card, .admin-row')
      .forEach((node) => node.classList.add('depth-card'));
  }

  function refresh() {
    markEnhanced();
    reveal();
    counters();
    magneticButtons();
  }

  window.DealNestMotion = { refresh };
  document.addEventListener('DOMContentLoaded', () => {
    refresh();
    scrollProgress();
    parallax();
  });
}());
