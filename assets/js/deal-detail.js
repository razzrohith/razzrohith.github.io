(async function () {
  await Promise.all([window.DealNestDataReady, window.DealNestAuthReady].filter(Boolean));
  const data = window.DealScoutData;
  const Auth = window.DealNestAuth;
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get('id');
  const deal = data.deals.find((item) => item.id === requestedId || item.slug === requestedId || item.uuid === requestedId) || data.deals[0];
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

  function money(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: value % 1 === 0 ? 0 : 2
    }).format(value);
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
    return `
      <article class="deal-card tone-${tone}">
        <a class="deal-image" href="./deal.html?id=${encodeURIComponent(item.id)}" aria-label="Open ${item.title}">
          <img src="${item.image}" alt="${item.title}">
          <span class="discount-badge">${item.discount}% off</span>
          <span class="status-badge">${item.status}</span>
        </a>
        <div class="deal-body">
          <div class="deal-meta">
            <span><a href="${storeUrl}">${item.store}</a></span>
            <span class="category-badge"><a href="${categoryUrl}">${item.category}</a></span>
          </div>
          <h3 class="deal-title"><a href="./deal.html?id=${encodeURIComponent(item.id)}">${item.title}</a></h3>
          <div class="price-row">
            <span class="price">${money(item.currentPrice)}</span>
            <span class="was-price">${money(item.originalPrice)}</span>
          </div>
          <div class="deal-actions single-action">
            <a class="deal-action" href="${item.dealUrl}">View deal</a>
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
    const statusNote = /expired|hidden|rejected|pending/i.test(deal.status)
      ? `<div class="detail-state-note"><strong>${deal.status}</strong><span>This deal may be limited, under review, or unavailable from the main public feed.</span></div>`
      : '';
    document.title = `${deal.title} | DealNest`;
    crumbTitle.textContent = deal.title;

    detail.innerHTML = `
      <section class="product-gallery motion-item">
        <div class="gallery-main">
          <img src="${deal.image}" alt="${deal.title}">
          <span class="discount-badge">${deal.discount}% off</span>
          <span class="status-badge">${deal.status}</span>
        </div>
        <div class="gallery-thumbs" aria-label="Product gallery thumbnails">
          <button type="button" class="active" data-action="thumb" data-view="Hero angle" aria-label="Show hero product view"><img src="${deal.image}" alt=""></button>
          <button type="button" data-action="thumb" data-view="Package view" aria-label="Show package product view"><img src="${deal.image}" alt=""></button>
          <button type="button" data-action="thumb" data-view="Detail view" aria-label="Show detail product view"><img src="${deal.image}" alt=""></button>
        </div>
      </section>

      <section class="deal-summary motion-item">
        <div class="deal-meta">
          <span><a href="${storeUrl}">${deal.store}</a></span>
          <span class="category-badge"><a href="${categoryUrl}">${deal.category}</a></span>
          <span>${deal.status}</span>
        </div>
        <h1>${deal.title}</h1>
        <p class="deal-description">${deal.description}</p>
        ${statusNote}
        <div class="summary-price">
          <span>${money(deal.currentPrice)}</span>
          <del>${money(deal.originalPrice)}</del>
          <strong>${deal.discount}% off</strong>
        </div>
        <div class="detail-facts">
          <div><span>Shipping</span><strong>${deal.shipping}</strong></div>
          <div><span>Posted</span><strong>${deal.postedTime}</strong></div>
          <div><span>Member</span><strong>${deal.postedBy}</strong></div>
          <div><span>Expires</span><strong>${deal.expires || 'No deadline listed'}</strong></div>
          <div><span>Comments</span><strong>${deal.comments} replies</strong></div>
        </div>

        <div class="coupon-detail ${deal.couponCode ? '' : 'muted-coupon'}">
          <div>
            <span>Coupon code</span>
            <strong>${deal.couponCode || 'No code needed'}</strong>
          </div>
          <button type="button" data-action="copy" data-code="${deal.couponCode || 'No code needed'}">${deal.couponCode ? 'Copy code' : 'View terms'}</button>
        </div>

        <div class="detail-actions">
          <button type="button" class="heat-button ${hasVoted ? 'voted' : ''}" data-action="vote">Add heat (${heat})</button>
          <button type="button" class="save-btn ${isSaved ? 'saved' : ''}" data-action="save">${isSaved ? 'Saved' : 'Save deal'}</button>
          <button type="button" class="ghost-button" data-action="share">Share</button>
          <button type="button" class="ghost-button" data-action="expired">Report expired</button>
        </div>

        <a class="deal-merchant-button" href="${merchantUrl}" target="_blank" rel="noopener">Get deal at ${deal.store}</a>
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
    instructionList.innerHTML = steps.map((step) => `<li>${step}</li>`).join('');
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
          <strong>${comment.user}</strong>
          <span>${comment.badge} / ${comment.time}</span>
        </div>
        <p>${comment.text}</p>
      </article>
    `).join('');
  }

  function renderRelated() {
    const related = data.deals
      .filter((item) => item.id !== deal.id && (item.category === deal.category || item.tags.some((tag) => deal.tags.includes(tag))))
      .slice(0, 4);
    relatedDeals.innerHTML = (related.length ? related : data.deals.filter((item) => item.id !== deal.id).slice(0, 4))
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
      const url = window.location.href;
      navigator.clipboard?.writeText(url).then(() => toast('Deal link copied')).catch(() => toast('Share link ready in the address bar'));
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
