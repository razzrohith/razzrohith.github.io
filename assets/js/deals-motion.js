(function () {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function reveal() {
    const items = document.querySelectorAll('.motion-item:not(.in-view)');
    if (prefersReduced || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('in-view'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    items.forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index % 8, 6) * 45}ms`;
      observer.observe(item);
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
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.target.dataset.counted) return;
        entry.target.dataset.counted = 'true';
        animate(entry.target);
      });
    }, { threshold: 0.7 });
    nodes.forEach((node) => observer.observe(node));
  }

  function parallax() {
    if (prefersReduced) return;
    const hero = document.querySelector('.hero-stage');
    if (!hero) return;
    window.addEventListener('scroll', () => {
      const offset = Math.min(window.scrollY * 0.08, 54);
      hero.style.setProperty('--hero-drift', `${offset}px`);
      hero.querySelectorAll('.floating-deal-card').forEach((card, index) => {
        card.style.translate = `0 ${offset * (index + 1) * -0.18}px`;
      });
    }, { passive: true });
  }

  function refresh() {
    reveal();
    counters();
  }

  window.DealNestMotion = { refresh };
  document.addEventListener('DOMContentLoaded', () => {
    refresh();
    parallax();
  });
}());
