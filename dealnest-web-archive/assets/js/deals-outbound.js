(function () {
  const sessionKeyName = 'dealnest:clickSession';

  function getSessionKey() {
    let value = localStorage.getItem(sessionKeyName);
    if (!value) {
      value = crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(sessionKeyName, value);
    }
    return value;
  }

  function dealId(deal) {
    return deal?.uuid || deal?.id || deal?.slug || '';
  }

  function linkFor(deal, source = 'site') {
    return `./redirect.html?deal=${encodeURIComponent(dealId(deal))}&source=${encodeURIComponent(source)}`;
  }

  function safeUrl(value) {
    if (!value) return null;
    try {
      const url = new URL(value, window.location.origin);
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      if (url.origin === window.location.origin) return null;
      return url;
    } catch (error) {
      return null;
    }
  }

  function destinationFor(deal) {
    return safeUrl(deal?.affiliateUrl)
      || safeUrl(deal?.outboundUrl)
      || safeUrl(deal?.merchantUrl);
  }

  function sourcePage(value) {
    return String(value || location.pathname || 'site').replace(/[^a-z0-9/_#?.=-]+/gi, '-').slice(0, 150);
  }

  async function trackClick({ deal, source, destination }) {
    const Auth = window.DealNestAuth;
    const remoteDealId = deal?.uuid || deal?.id;
    if (!Auth?.isConfigured || !remoteDealId) return { tracked: false, reason: 'missing-config-or-deal' };
    const body = {
      deal_id: remoteDealId,
      store_id: deal?.storeId || null,
      user_id: Auth.currentUserId?.() || null,
      source_page: sourcePage(source),
      destination_host: destination?.hostname || null,
      outbound_url: destination?.href || null,
      session_key: getSessionKey(),
      metadata: {
        source: sourcePage(source),
        deal_slug: deal?.slug || deal?.id || null,
        store: deal?.store || null
      }
    };
    try {
      if (Auth.user) {
        await Auth.rest('click_events', {
          method: 'POST',
          prefer: 'return=minimal',
          body
        });
      } else {
        body.user_id = null;
        await Auth.publicRest('click_events', {
          method: 'POST',
          prefer: 'return=minimal',
          body
        });
      }
      return { tracked: true };
    } catch (error) {
      return { tracked: false, reason: error.message };
    }
  }

  function bindOutboundFeedback() {
    document.body.addEventListener('click', (event) => {
      const link = event.target.closest('[data-outbound-link]');
      if (!link) return;
      link.classList.add('is-loading');
      link.setAttribute('aria-busy', 'true');
      if (!link.dataset.originalText) link.dataset.originalText = link.textContent.trim();
      link.textContent = 'Opening...';
    });
  }

  window.DealNestOutbound = {
    bindOutboundFeedback,
    destinationFor,
    getSessionKey,
    linkFor,
    safeUrl,
    sourcePage,
    trackClick
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindOutboundFeedback);
  else bindOutboundFeedback();
}());
