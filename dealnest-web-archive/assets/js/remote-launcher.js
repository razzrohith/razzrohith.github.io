(function () {
  const frame = document.getElementById('gameFrame');
  const loading = document.getElementById('loadingPanel');

  function hideLoader() {
    if (!loading) return;
    loading.classList.add('hidden');
    setTimeout(() => loading.remove(), 260);
  }

  if (frame) {
    frame.addEventListener('load', hideLoader, { once: true });
    try {
      if (frame.contentDocument && frame.contentDocument.readyState === 'complete') {
        requestAnimationFrame(hideLoader);
      }
    } catch (_) {
      // Cross-origin hosted games are expected to block direct readiness checks.
    }
  }

  setTimeout(hideLoader, frame && frame.dataset.local === 'true' ? 900 : 30000);
}());
