(async function () {
  await Promise.all([window.DealNestDataReady, window.DealNestAuthReady].filter(Boolean));
  const data = window.DealScoutData;
  const Auth = window.DealNestAuth;
  const Discovery = window.DealNestDiscovery;
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get('id');
  function findDealFromRequest(id) {
    const direct = data.deals.find((item) => item.id === id || item.slug === id || item.uuid === id);
    if (direct || !id) return direct;
    const terms = String(id)
      .toLowerCase()
      .replace(/^deal-/, '')
      .replace(/-\d+$/, '')
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 2);
    if (!terms.length) return null;
    return data.deals.find((item) => {
      const text = [item.title, item.store, item.category, ...(Array.isArray(item.tags) ? item.tags : [])].join(' ').toLowerCase();
      return terms.every((term) => text.includes(term));
    }) || data.deals.find((item) => {
      const text = [item.title, ...(Array.isArray(item.tags) ? item.tags : [])].join(' ').toLowerCase();
      return terms.some((term) => text.includes(term));
    });
  }
  const deal = findDealFromRequest(requestedId) || data.deals[0];
  const saved = new Set(JSON.parse(localStorage.getItem('dealnest:saved') || '[]'));
  const voted = new Set(Auth?.user ? JSON.parse(localStorage.getItem('dealnest:voted') || '[]') : []);

  const detail = document.getElementById('dealDetail');
  const crumbTitle = document.getElementById('crumbTitle');
  const relatedDeals = document.getElementById('relatedDeals');
  const commentsList = document.getElementById('commentsList');
  const commentForm = document.getElementById('commentForm');
  const commentOutput = document.getElementById('commentOutput');
  const instructionList = document.getElementById('instructionList');
  const menuToggle = document.getElementById('menuToggle');
  const primaryNav = document.getElementById('primaryNav');

  function absoluteAssetUrl(value) {
    try {
      return new URL(value || './assets/img/dealnest-share.svg', window.DealNestSEO?.siteUrl || window.location.origin).href;
    } catch (error) {
      return `${window.location.origin}/assets/img/dealnest-share.svg`;
    }
  }

  function cleanDealUrl() {
    const canonical = window.DealNestSEO?.absoluteUrl(`deal.html?id=${encodeURIComponent(deal.id)}`)
      || `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(deal.id)}`;
    return canonical;
  }

  function outboundLink(item, source) {
    return window.DealNestOutbound?.linkFor(item, source) || item.dealUrl;
  }

  function money(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: value % 1 === 0 ? 0 : 2
    }).format(value);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function persist(key, set) {
    localStorage.setItem(`dealnest:${key}`, JSON.stringify([...set]));
  }

  function toast(message) {
    if (Auth?.toast) {
      Auth.toast(message);
      return;
    }
    let node = document.querySelector('.toast');
    if (!node) {
      node = document.createElement('div');
      node.className = 'toast';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('show'), 1800);
  }

  function remoteEnabled() {
    return Boolean(Auth?.isConfigured && Auth?.user);
  }

  async function syncMemberState() {
    if (!remoteEnabled()) return;
    const userId = Auth.currentUserId();
    const [savedRows, voteRows] = await Promise.all([
      Auth.rest(`saved_deals?select=deal_id&deal_id=eq.${encodeURIComponent(deal.uuid || deal.id)}&user_id=eq.${encodeURIComponent(userId)}`).catch(() => []),
      Auth.rest(`deal_votes?select=deal_id&deal_id=eq.${encodeURIComponent(deal.uuid || deal.id)}&user_id=eq.${encodeURIComponent(userId)}`).catch(() => [])
    ]);
    if (savedRows.length) saved.add(deal.id);
    if (voteRows.length) voted.add(deal.id);
    persist('saved', saved);
    persist('voted', voted);
  }

  async function toggleSaved() {
    if (!remoteEnabled()) {
      if (saved.has(deal.id)) {
        saved.delete(deal.id);
        toast('Removed from saved deals on this device');
      } else {
        saved.add(deal.id);
        toast('Saved here. Create an account to sync saved deals across devices.');
      }
      persist('saved', saved);
      renderDetail();
      return;
    }

    const userId = Auth.currentUserId();
    const remoteId = deal.uuid || deal.id;
    try {
      if (saved.has(deal.id)) {
        await Auth.rest(`saved_deals?deal_id=eq.${encodeURIComponent(remoteId)}&user_id=eq.${encodeURIComponent(userId)}`, {
          method: 'DELETE',
          prefer: 'return=minimal'
        });
        saved.delete(deal.id);
        toast('Removed from your account saves');
      } else {
        await Auth.rest('saved_deals?on_conflict=deal_id,user_id', {
          method: 'POST',
          prefer: 'resolution=ignore-duplicates,return=representation',
          body: { deal_id: remoteId, user_id: userId }
        });
        saved.add(deal.id);
        toast('Saved to your account');
      }
      persist('saved', saved);
      renderDetail();
    } catch (error) {
      toast(error.message);
    }
  }

  async function addHeat() {
    if (!Auth?.requireAuth({
      type: 'vote',
      message: 'Sign in to add heat. One vote per member keeps deal scoring fair.',
      action: { type: 'vote-detail', dealId: deal.id, page: location.href }
    })) return;
    if (voted.has(deal.id)) {
      toast('You already added heat');
      return;
    }
    try {
      await Auth.rest('deal_votes?on_conflict=deal_id,user_id', {
        method: 'POST',
        prefer: 'resolution=ignore-duplicates,return=representation',
        body: { deal_id: deal.uuid || deal.id, user_id: Auth.currentUserId(), value: 1 }
      });
      voted.add(deal.id);
      persist('voted', voted);
      toast('Heat added');
      renderDetail();
    } catch (error) {
      toast(/duplicate|conflict/i.test(error.message) ? 'You already added heat' : error.message);
    }
  }

  async function reportDeal() {
    if (!Auth?.requireAuth({
      type: 'report',
      message: 'Sign in to report expired or incorrect deals.',
      action: { type: 'report', dealId: deal.id, page: location.href }
    })) return;
    const reason = window.prompt('What should moderators review?', 'expired');
    if (!reason) return;
    try {
      await Auth.rest('deal_reports', {
        method: 'POST',
        body: {
          deal_id: deal.uuid || deal.id,
          user_id: Auth.currentUserId(),
          reason: reason.slice(0, 120),
          details: `Reported from ${location.href}`
        }
      });
      toast('Report sent to moderation');
    } catch (error) {
      toast(error.message);
    }
  }

  function relatedCard(item) {
    const tone = (data.categories.find((category) => category.name === item.category)?.tone || 'mint').toLowerCase();
    const storeUrl = `./store.html?name=${encodeURIComponent(item.store)}`;
    const categoryUrl = `./category.html?name=${encodeURIComponent(item.category)}`;
    const itemTitle = escapeHtml(item.title);
    const itemStore = escapeHtml(item.store);
    const itemCategory = escapeHtml(item.category);
    const itemStatus = escapeHtml(item.status);
    return `
      <article class="deal-card tone-${tone}">
        <a class="deal-image" href="./deal.html?id=${encodeURIComponent(item.id)}" aria-label="Open ${itemTitle}">
          <img src="${escapeHtml(item.image)}" alt="${itemTitle}">
          <span class="discount-badge">${item.discount}% off</span>
          <span class="status-badge">${itemStatus}</span>
        </a>
        <div class="deal-body">
          <div class="deal-meta">
            <span><a href="${storeUrl}">${itemStore}</a></span>
            <span class="category-badge"><a href="${categoryUrl}">${itemCategory}</a></span>
          </div>
          <h3 class="deal-title"><a href="./deal.html?id=${encodeURIComponent(item.id)}">${itemTitle}</a></h3>
          <div class="price-row">
            <span class="price">${money(item.currentPrice)}</span>
            <span class="was-price">${money(item.originalPrice)}</span>
          </div>
          <div class="deal-actions single-action">
            <a class="deal-action" href="${item.dealUrl}">View deal</a>
            <a class="deal-action outbound-action" href="${outboundLink(item, 'related-deal')}" data-outbound-link>Get deal -></a>
          </div>
        </div>
      </article>
    `;
  }

  function renderDetail() {
    const isSaved = saved.has(deal.id);
    const hasVoted = voted.has(deal.id);
    const heat = deal.heat + (hasVoted ? 1 : 0);
    const storeUrl = `./store.html?name=${encodeURIComponent(deal.store)}`;
    const categoryUrl = `./category.html?name=${encodeURIComponent(deal.category)}`;
    const merchantUrl = deal.merchantUrl && deal.merchantUrl !== '#' ? deal.merchantUrl : storeUrl;
    const outboundUrl = outboundLink(deal, 'deal-detail');
    const statusNote = /expired|hidden|rejected|pending/i.test(deal.status)
      ? `<div class="detail-state-note"><strong>${escapeHtml(deal.status)}</strong><span>This deal may be limited, under review, or unavailable from the main public feed.</span></div>`
      : '';
    const safeTitle = escapeHtml(deal.title);
    const safeStore = escapeHtml(deal.store);
    const safeCategory = escapeHtml(deal.category);
    const safeDescription = escapeHtml(deal.description);
    const safeImage = escapeHtml(deal.image);
    const safeStatus = escapeHtml(deal.status);
    const safeShipping = escapeHtml(deal.shipping);
    const safePostedTime = escapeHtml(deal.postedTime);
    const safePostedBy = escapeHtml(deal.postedBy);
    const safeExpires = escapeHtml(deal.expires || 'No deadline listed');
    const safeCoupon = escapeHtml(deal.couponCode || 'No code needed');
    document.title = `${deal.title} | DealNest`;
    crumbTitle.textContent = deal.title;
    const canonicalUrl = cleanDealUrl();
    const metaDescription = `${deal.title} at ${deal.store}: ${money(deal.currentPrice)}${deal.originalPrice ? ` from ${money(deal.originalPrice)}` : ''}. ${deal.description}`.slice(0, 250);
    window.DealNestSEO?.update({
      title: `${deal.title} | ${money(deal.currentPrice)} at ${deal.store} | DealNest`,
      description: metaDescription,
      canonical: canonicalUrl,
      image: absoluteAssetUrl(deal.image),
      type: 'product'
    });
    window.DealNestSEO?.jsonLd('dealnest-breadcrumb-jsonld', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'DealNest', item: window.DealNestSEO.absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: 'Hot deals', item: window.DealNestSEO.absoluteUrl('/#hot-deals') },
        { '@type': 'ListItem', position: 3, name: deal.title, item: canonicalUrl }
      ]
    });
    window.DealNestSEO?.jsonLd('dealnest-product-jsonld', {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: deal.title,
      description: deal.description,
      image: absoluteAssetUrl(deal.image),
      brand: { '@type': 'Brand', name: deal.store },
      offers: {
        '@type': 'Offer',
        url: canonicalUrl,
        priceCurrency: 'USD',
        price: Number(deal.currentPrice || 0).toFixed(2),
        availability: /expired|hidden|rejected|pending/i.test(deal.status) ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
        seller: { '@type': 'Organization', name: deal.store }
      }
    });

    detail.innerHTML = `
      <section class="product-gallery motion-item">
        <div class="gallery-main">
          <img src="${safeImage}" alt="${safeTitle}">
          <span class="discount-badge">${deal.discount}% off</span>
          <span class="status-badge">${safeStatus}</span>
        </div>
        <div class="gallery-thumbs" aria-label="Product gallery thumbnails">
          <button type="button" class="active" data-action="thumb" data-view="Hero angle" aria-label="Show hero product view"><img src="${safeImage}" alt=""></button>
          <button type="button" data-action="thumb" data-view="Package view" aria-label="Show package product view"><img src="${safeImage}" alt=""></button>
          <button type="button" data-action="thumb" data-view="Detail view" aria-label="Show detail product view"><img src="${safeImage}" alt=""></button>
        </div>
      </section>

      <section class="deal-summary motion-item">
        <div class="deal-meta">
          <span><a href="${storeUrl}">${safeStore}</a></span>
          <span class="category-badge"><a href="${categoryUrl}">${safeCategory}</a></span>
          <span>${safeStatus}</span>
        </div>
        <h1>${safeTitle}</h1>
        <p class="deal-description">${safeDescription}</p>
        ${statusNote}
        <div class="summary-price">
          <span>${money(deal.currentPrice)}</span>
          <del>${money(deal.originalPrice)}</del>
          <strong>${deal.discount}% off</strong>
        </div>
        <div class="detail-facts">
          <div><span>Shipping</span><strong>${safeShipping}</strong></div>
          <div><span>Posted</span><strong>${safePostedTime}</strong></div>
          <div><span>Member</span><strong>${safePostedBy}</strong></div>
          <div><span>Expires</span><strong>${safeExpires}</strong></div>
          <div><span>Comments</span><strong>${deal.comments} replies</strong></div>
        </div>

        <div class="coupon-detail ${deal.couponCode ? '' : 'muted-coupon'}">
          <div>
            <span>Coupon code</span>
            <strong>${safeCoupon}</strong>
          </div>
          <button type="button" data-action="copy" data-code="${safeCoupon}">${deal.couponCode ? 'Copy code' : 'View terms'}</button>
        </div>

        <div class="detail-actions">
          <button type="button" class="heat-button ${hasVoted ? 'voted' : ''}" data-action="vote">Add heat (${heat})</button>
          <button type="button" class="save-btn ${isSaved ? 'saved' : ''}" data-action="save">${isSaved ? 'Saved' : 'Save deal'}</button>
          <button type="button" class="ghost-button" data-action="share">Share</button>
          <button type="button" class="ghost-button" data-action="expired">Report expired</button>
        </div>

        <a class="deal-merchant-button outbound-action" href="${outboundUrl}" data-outbound-link rel="noopener noreferrer">Get deal at ${safeStore} -></a>
      </section>
    `;
    requestAnimationFrame(() => window.DealNestMotion?.refresh());
  }

  function renderInstructions() {
    const customSteps = String(deal.instructions || '')
      .split(/\n+/)
      .map((step) => step.trim())
      .filter(Boolean);
    const steps = customSteps.length ? customSteps : [
      `Open the ${deal.store} offer page from the store button.`,
      deal.couponCode ? `Apply coupon code ${deal.couponCode} before checkout.` : 'Confirm the discount appears automatically in cart.',
      `Verify the final price is ${money(deal.currentPrice)} before tax and any optional services.`,
      `Check shipping details: ${deal.shipping}.`,
      'If the price changes, use Report expired so moderators can review it.'
    ];
    instructionList.innerHTML = steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('');
  }

  async function loadComments() {
    if (!Auth?.isConfigured || !deal.uuid) return data.comments;
    try {
      const rows = await Auth.publicRest(`deal_comments?select=id,body,created_at,profiles(display_name,username)&deal_id=eq.${encodeURIComponent(deal.uuid)}&status=eq.approved&order=created_at.desc`);
      if (!rows.length) return data.comments;
      return rows.map((row) => ({
        user: row.profiles?.display_name || row.profiles?.username || 'DealNest member',
        badge: 'Member',
        time: new Date(row.created_at).toLocaleDateString(),
        text: row.body
      }));
    } catch (error) {
      return data.comments;
    }
  }

  async function renderComments() {
    const comments = await loadComments();
    commentsList.innerHTML = comments.map((comment) => `
      <article class="comment-card">
        <div>
          <strong>${escapeHtml(comment.user)}</strong>
          <span>${escapeHtml(comment.badge)} / ${escapeHtml(comment.time)}</span>
        </div>
        <p>${escapeHtml(comment.text)}</p>
      </article>
    `).join('');
  }

  function renderRelated() {
    const related = Discovery.relatedDeals(deal, data.deals, 4);
    relatedDeals.innerHTML = (related.length ? related : Discovery.sortDeals(data.deals.filter((item) => item.id !== deal.id), 'trending').slice(0, 4))
      .map(relatedCard)
      .join('');
  }

  async function handleAction(event) {
    const target = event.target.closest('[data-action], [data-placeholder]');
    if (!target) return;
    const { action, code, placeholder } = target.dataset;
    if (placeholder) {
      toast(placeholder);
      return;
    }
    if (action === 'thumb') {
      document.querySelectorAll('.gallery-thumbs button').forEach((button) => button.classList.remove('active'));
      target.classList.add('active');
      toast(`${target.dataset.view} selected`);
    }
    if (action === 'copy') {
      navigator.clipboard?.writeText(code).then(() => toast(`Copied ${code}`)).catch(() => toast(`Coupon: ${code}`));
    }
    if (action === 'vote') {
      await addHeat();
    }
    if (action === 'save') {
      await toggleSaved();
    }
    if (action === 'share') {
      const url = cleanDealUrl();
      const title = `${deal.title} | DealNest`;
      const text = `${money(deal.currentPrice)} at ${deal.store}. ${deal.description}`;
      if (navigator.share) {
        navigator.share({ title, text, url })
          .then(() => toast('Share sheet opened'))
          .catch(() => navigator.clipboard?.writeText(url).then(() => toast('Deal link copied')).catch(() => toast('Share link ready in the address bar')));
      } else {
        navigator.clipboard?.writeText(url).then(() => toast('Deal link copied')).catch(() => toast('Share link ready in the address bar'));
      }
    }
    if (action === 'expired') {
      await reportDeal();
    }
  }

  async function submitComment(event) {
    event.preventDefault();
    if (!Auth?.requireAuth({
      type: 'comment',
      message: 'Sign in to join the deal discussion.',
      action: { type: 'comment', dealId: deal.id, page: location.href }
    })) return;
    const values = Object.fromEntries(new FormData(event.target).entries());
    const body = (values.body || '').trim();
    if (body.length < 4) {
      commentOutput.textContent = 'Add a little more detail before posting.';
      return;
    }
    commentOutput.textContent = 'Posting...';
    try {
      await Auth.rest('deal_comments', {
        method: 'POST',
        body: { deal_id: deal.uuid || deal.id, user_id: Auth.currentUserId(), body }
      });
      event.target.reset();
      commentOutput.textContent = 'Comment posted.';
      toast('Comment posted');
      await renderComments();
    } catch (error) {
      commentOutput.textContent = error.message;
    }
  }

  function bindMenu() {
    menuToggle.addEventListener('click', () => {
      const header = document.querySelector('.market-header');
      const isOpen = header.classList.toggle('menu-open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
    });
    primaryNav.addEventListener('click', () => {
      document.querySelector('.market-header').classList.remove('menu-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  }

  await syncMemberState();
  renderDetail();
  renderInstructions();
  await renderComments();
  renderRelated();
  bindMenu();
  document.body.addEventListener('click', handleAction);
  commentForm?.addEventListener('submit', submitComment);
  window.addEventListener('dealnest:auth-changed', async () => {
    await syncMemberState();
    renderDetail();
  });
  window.addEventListener('dealnest:resume-action', (event) => {
    if (event.detail?.type === 'vote-detail') addHeat();
    if (event.detail?.type === 'report') reportDeal();
  });
  window.DealNestMotion?.refresh();
}());
