(async function () {
  await Promise.all([window.DealNestDataReady, window.DealNestAuthReady].filter(Boolean));
  const data = window.DealScoutData;
  const Outbound = window.DealNestOutbound;
  const params = new URLSearchParams(location.search);
  const requestedDeal = params.get('deal') || '';
  const source = params.get('source') || 'redirect';
  const shell = document.getElementById('redirectShell');

  function findDeal(id) {
    return data.deals.find((deal) => deal.uuid === id || deal.id === id || deal.slug === id);
  }

  function renderBlocked(title, message) {
    shell.innerHTML = `
      <section class="access-panel">
        <p class="eyebrow">Outbound blocked</p>
        <h1>${title}</h1>
        <p>${message}</p>
        <div class="redirect-actions">
          <a class="deal-action" href="./deal.html?id=${encodeURIComponent(requestedDeal)}">Back to deal</a>
          <a class="ghost-button link-button" href="./">Return home</a>
        </div>
      </section>
    `;
  }

  function renderOpening(deal, destination, tracked) {
    shell.innerHTML = `
      <section class="access-panel">
        <p class="eyebrow">${tracked ? 'Click tracked' : 'Tracking skipped'}</p>
        <h1>Opening ${deal.store}</h1>
        <p>${tracked ? 'Thanks. Your click was recorded with privacy-safe metadata only.' : 'Tracking was unavailable, but safe merchant links can still open.'}</p>
        <div class="redirect-actions">
          <a class="deal-merchant-button" id="openMerchantLink" href="${destination.href}" target="_self" rel="noopener noreferrer">Open deal now</a>
          <a class="ghost-button link-button" href="./deal.html?id=${encodeURIComponent(deal.id)}">Back to detail</a>
        </div>
      </section>
    `;
  }

  const deal = findDeal(requestedDeal);
  if (!deal) {
    renderBlocked('Deal not found', 'This deal link does not match a public DealNest deal.');
    return;
  }

  const destination = Outbound.destinationFor(deal);
  if (!destination) {
    renderBlocked('Merchant URL is not configured yet', 'This prototype does not have a safe external merchant or affiliate URL for this deal. Internal URLs and unsafe schemes are intentionally blocked.');
    return;
  }

  const result = await Outbound.trackClick({ deal, source, destination });
  renderOpening(deal, destination, result.tracked);
  setTimeout(() => {
    window.location.assign(destination.href);
  }, 900);
}());
