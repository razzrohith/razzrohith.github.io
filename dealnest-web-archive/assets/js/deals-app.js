(async function () {
  await Promise.all([window.DealNestDataReady, window.DealNestAuthReady].filter(Boolean));
  const data = window.DealScoutData;
  const Auth = window.DealNestAuth;
  const Discovery = window.DealNestDiscovery;
  const storeNames = data.stores.map((store) => store.name);
  const initialMaxPrice = Math.max(100, Math.ceil(Math.max(...data.deals.map((deal) => Number(deal.currentPrice) || 0), 900) / 25) * 25);
  const state = {
    query: new URLSearchParams(window.location.search).get('q') || '',
    sort: 'trending',
    filters: new Set(),
    store: '',
    maxPrice: initialMaxPrice,
    minDiscount: 0,
    hasInteracted: Boolean(new URLSearchParams(window.location.search).get('q')),
    saved: new Set(JSON.parse(localStorage.getItem('dealnest:saved') || '[]')),
    voted: new Set(Auth?.user ? JSON.parse(localStorage.getItem('dealnest:voted') || '[]') : []),
    followedStores: new Set(JSON.parse(localStorage.getItem('dealnest:followedStores') || '[]'))
  };

  const els = {
    searchForm: document.getElementById('searchForm'),
    search: document.getElementById('dealSearch'),
    dealFeed: document.getElementById('dealFeed'),
    trendingDeals: document.getElementById('trendingDeals'),
    newDeals: document.getElementById('newDeals'),
    editorsPicks: document.getElementById('editorsPicks'),
    couponList: document.getElementById('couponList'),
    storeGrid: document.getElementById('storeGrid'),
    topicList: document.getElementById('topicList'),
    categoryGrid: document.getElementById('categoryGrid'),
    spotlight: document.getElementById('dealSpotlight'),
    pulseRail: document.getElementById('pulseRail'),
    trendList: document.getElementById('trendList'),
    alertPreview: document.getElementById('alertPreview'),
    resultCount: document.getElementById('resultCount'),
    emptyState: document.getElementById('emptyState'),
    storeFilter: document.getElementById('storeFilter'),
    priceFilter: document.getElementById('priceFilter'),
    priceValue: document.getElementById('priceValue'),
    discountFilter: document.getElementById('discountFilter'),
    discountValue: document.getElementById('discountValue'),
    clearFilters: document.getElementById('clearFilters'),
    filterDrawerToggle: document.getElementById('filterDrawerToggle'),
    closeFilters: document.getElementById('closeFilters'),
    sortControls: document.getElementById('sortControls'),
    quickFilters: document.getElementById('quickFilters'),
    menuToggle: document.getElementById('menuToggle'),
    primaryNav: document.getElementById('primaryNav')
  };

  const actionableSelectors = '[data-action], [data-placeholder]';

  function money(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: value % 1 === 0 ? 0 : 2
    }).format(value);
  }

  function compactNumber(value) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
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

  function dealById(id) {
    return data.deals.find((deal) => deal.id === id || deal.slug === id || deal.uuid === id);
  }

  function remoteEnabled() {
    return Boolean(Auth?.isConfigured && Auth?.user);
  }

  async function syncMemberState() {
    if (!remoteEnabled()) return;
    const userId = Auth.currentUserId();
    const [savedRows, voteRows] = await Promise.all([
      Auth.rest(`saved_deals?select=deal_id&user_id=eq.${encodeURIComponent(userId)}`).catch(() => []),
      Auth.rest(`deal_votes?select=deal_id&user_id=eq.${encodeURIComponent(userId)}`).catch(() => [])
    ]);
    savedRows.forEach((row) => {
      const deal = dealById(row.deal_id);
      if (deal) state.saved.add(deal.id);
    });
    voteRows.forEach((row) => {
      const deal = dealById(row.deal_id);
      if (deal) state.voted.add(deal.id);
    });
    persist('saved', state.saved);
    persist('voted', state.voted);
  }

  async function toggleSaved(id) {
    const deal = dealById(id);
    if (!deal) return;
    if (!remoteEnabled()) {
      if (state.saved.has(id)) {
        state.saved.delete(id);
        toast('Removed from saved deals on this device');
      } else {
        state.saved.add(id);
        toast('Saved here. Create an account to sync saved deals across devices.');
      }
      persist('saved', state.saved);
      renderStaticSections();
      renderFeed();
      return;
    }

    const userId = Auth.currentUserId();
    const remoteId = deal.uuid || deal.id;
    try {
      if (state.saved.has(id)) {
        await Auth.rest(`saved_deals?deal_id=eq.${encodeURIComponent(remoteId)}&user_id=eq.${encodeURIComponent(userId)}`, {
          method: 'DELETE',
          prefer: 'return=minimal'
        });
        state.saved.delete(id);
        toast('Removed from your account saves');
      } else {
        await Auth.rest('saved_deals?on_conflict=deal_id,user_id', {
          method: 'POST',
          prefer: 'resolution=ignore-duplicates,return=representation',
          body: { deal_id: remoteId, user_id: userId }
        });
        state.saved.add(id);
        toast('Saved to your account');
      }
      persist('saved', state.saved);
      renderStaticSections();
      renderFeed();
    } catch (error) {
      toast(error.message);
    }
  }

  async function addHeat(id) {
    const deal = dealById(id);
    if (!deal) return;
    if (!Auth?.requireAuth({
      type: 'vote',
      message: 'Sign in to add heat. One vote per member keeps the signal honest.',
      action: { type: 'vote', dealId: id, page: location.href }
    })) return;
    if (state.voted.has(id)) {
      toast('You already added heat');
      return;
    }
    try {
      await Auth.rest('deal_votes?on_conflict=deal_id,user_id', {
        method: 'POST',
        prefer: 'resolution=ignore-duplicates,return=representation',
        body: { deal_id: deal.uuid || deal.id, user_id: Auth.currentUserId(), value: 1 }
      });
      state.voted.add(id);
      persist('voted', state.voted);
      toast('Heat added');
      renderStaticSections();
      renderFeed();
    } catch (error) {
      toast(/duplicate|conflict/i.test(error.message) ? 'You already added heat' : error.message);
    }
  }

  function discoveryOptions() {
    return {
      query: state.query,
      sort: state.sort,
      filters: state.filters,
      store: state.store,
      maxPrice: state.maxPrice,
      minDiscount: state.minDiscount,
      savedSet: state.saved
    };
  }

  function findStore(name) {
    return data.stores.find((store) => store.name === name) || { initials: name.slice(0, 2), followers: 0, rating: 0 };
  }

  function toneFor(category) {
    return (data.categories.find((item) => item.name === category)?.tone || 'mint').toLowerCase();
  }

  function outboundLink(deal, source) {
    return window.DealNestOutbound?.linkFor(deal, source) || deal.dealUrl;
  }

  function cardTemplate(deal, compact = false) {
    const saved = state.saved.has(deal.id);
    const voted = state.voted.has(deal.id);
    const heat = deal.heat + (voted ? 1 : 0);
    const title = escapeHtml(deal.title);
    const store = escapeHtml(deal.store);
    const category = escapeHtml(deal.category);
    const status = escapeHtml(deal.status);
    const description = escapeHtml(deal.description);
    const shipping = escapeHtml(deal.shipping);
    const postedBy = escapeHtml(deal.postedBy);
    const couponCode = escapeHtml(deal.couponCode);
    return `
      <article class="deal-card tone-${toneFor(deal.category)} motion-item" data-deal-id="${deal.id}">
        <a class="deal-image" href="${deal.dealUrl}" aria-label="View ${title}">
          <img src="${escapeHtml(deal.image)}" alt="${title}" loading="lazy">
          <span class="discount-badge">${deal.discount}% off</span>
          <span class="status-badge">${status}</span>
        </a>
        <div class="deal-body">
          <div class="deal-meta">
            <span><a href="./store.html?name=${encodeURIComponent(deal.store)}">${store}</a></span>
            <span class="category-badge"><a href="./category.html?name=${encodeURIComponent(deal.category)}">${category}</a></span>
          </div>
          <h3 class="deal-title"><a href="${deal.dealUrl}">${title}</a></h3>
          ${compact ? '' : `<p class="deal-description">${description}</p>`}
          <div class="price-row">
            <span class="price">${money(deal.currentPrice)}</span>
            <span class="was-price">${money(deal.originalPrice)}</span>
          </div>
          <div class="deal-signals">
            <button class="heat-button ${voted ? 'voted' : ''}" type="button" data-action="vote" data-id="${deal.id}">Heat ${heat}</button>
            <span>${deal.comments} comments</span>
            <span>${escapeHtml(deal.postedTime)}</span>
          </div>
          <p class="posted-by">Posted by ${postedBy} / ${shipping}</p>
          ${compact || !deal.couponCode ? '' : `
            <div class="coupon-row">
              <code>${couponCode}</code>
              <button class="copy-btn" type="button" data-action="copy" data-code="${couponCode}">Copy</button>
            </div>
          `}
          <div class="deal-actions">
            <button class="save-btn ${saved ? 'saved' : ''}" type="button" data-action="save" data-id="${deal.id}" aria-label="${saved ? 'Unsave' : 'Save'} ${title}">${saved ? 'Saved' : 'Save'}</button>
            <a class="deal-action" href="${deal.dealUrl}">View deal</a>
            <a class="deal-action outbound-action" href="${outboundLink(deal, compact ? 'compact-card' : 'hot-feed')}" data-outbound-link>Get deal -></a>
          </div>
        </div>
      </article>
    `;
  }

  function renderCards(container, deals, compact = false) {
    if (!container) return;
    container.innerHTML = deals.map((deal) => cardTemplate(deal, compact)).join('');
  }

  function renderFeed() {
    const options = discoveryOptions();
    const filtered = Discovery.filterAndSort(data.deals, options);
    els.dealFeed.classList.remove('feed-skeleton');
    els.dealFeed.removeAttribute('aria-busy');
    renderCards(els.dealFeed, filtered, false);
    const activeLabels = Discovery.activeFilterLabels(options)
      .filter((label) => !label.startsWith('Under $') || state.maxPrice !== initialMaxPrice);
    els.resultCount.textContent = `${filtered.length} deal${filtered.length === 1 ? '' : 's'}${activeLabels.length ? ` / ${activeLabels.length} active filter${activeLabels.length === 1 ? '' : 's'}` : ''}`;
    const showEmpty = filtered.length === 0 && state.hasInteracted;
    els.emptyState.innerHTML = showEmpty
      ? Discovery.emptyStateHtml(options, data)
      : '';
    els.emptyState.classList.toggle('hidden', !showEmpty);
    window.DealNestMotion?.refresh();
  }

  function renderSpotlight() {
    const deal = data.deals.find((item) => item.featured && item.trending) || data.deals[0];
    const store = findStore(deal.store);
    els.spotlight.innerHTML = `
      <article class="spotlight-card motion-item">
        <div class="spotlight-art">
          <img src="${escapeHtml(deal.image)}" alt="${escapeHtml(deal.title)}" loading="lazy">
          <span>${deal.discount}% off</span>
        </div>
        <div class="spotlight-copy">
          <p class="eyebrow">Featured deal spotlight</p>
          <h2>${escapeHtml(deal.title)}</h2>
          <p>${escapeHtml(deal.description)}</p>
          <div class="summary-price">
            <span>${money(deal.currentPrice)}</span>
            <del>${money(deal.originalPrice)}</del>
            <strong>${deal.heat} heat</strong>
          </div>
          <div class="spotlight-store">
            <b>${escapeHtml(store.initials)}</b>
            <span>${escapeHtml(deal.store)} / ${escapeHtml(deal.shipping)} / ${escapeHtml(deal.expires)}</span>
          </div>
          <div class="spotlight-actions">
            <a class="deal-merchant-button" href="${deal.dealUrl}">Inspect deal</a>
            <a class="deal-action outbound-action" href="${outboundLink(deal, 'spotlight')}" data-outbound-link>Get deal -></a>
            <button class="ghost-button" type="button" data-action="save" data-id="${deal.id}">Save deal</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderPulse() {
    const totalHeat = data.deals.reduce((sum, deal) => sum + deal.heat, 0);
    const totalComments = data.deals.reduce((sum, deal) => sum + deal.comments, 0);
    const expiring = data.deals.filter((deal) => deal.status === 'Expiring Soon').length;
    const topStores = [...data.stores].sort((a, b) => b.followers - a.followers).slice(0, 4);
    els.pulseRail.innerHTML = `
      <article><span data-count="${data.deals.length}">0</span><strong>live public deals</strong><p>Fresh deal density for useful filtering and discovery.</p></article>
      <article><span data-count="${totalHeat}">0</span><strong>total heat</strong><p>Community energy drives the layout and sorting model.</p></article>
      <article><span data-count="${totalComments}">0</span><strong>comments tracked</strong><p>Discussion signals make each listing feel alive.</p></article>
      <article><span data-count="${expiring}">0</span><strong>ending soon</strong><p>Urgency appears only when public deal timing supports it.</p></article>
    `;
    els.trendList.innerHTML = topStores.map((store) => `
      <li><b>${escapeHtml(store.initials)}</b><span>${escapeHtml(store.name)}</span><strong>${compactNumber(store.followers)} followers</strong></li>
    `).join('');
  }

  function renderCategories() {
    els.categoryGrid.innerHTML = data.categories.map((category) => {
      const deals = data.deals.filter((deal) => deal.category === category.name);
      const best = Discovery.sortDeals(deals, 'trending')[0];
      return `
        <button class="category-card tone-${category.tone} motion-item" type="button" data-filter-shortcut="${category.name}">
          <span>${escapeHtml(category.icon)}</span>
          <strong>${escapeHtml(category.name)}</strong>
          <p>${escapeHtml(category.description)}</p>
          <small>${deals.length} deals${best ? ` / top ${best.discount}% off` : ''}</small>
        </button>
      `;
    }).join('');
  }

  function renderCoupons() {
    els.couponList.innerHTML = data.coupons.slice(0, 6).map((coupon) => `
      <article class="coupon-card motion-item">
        <div>
          <strong>${escapeHtml(coupon.store)}</strong>
          <code>${escapeHtml(coupon.code)}</code>
        </div>
        <p>${escapeHtml(coupon.description)}</p>
        <footer>
          <small>${coupon.verified ? 'Verified' : 'Community tested'} / ${escapeHtml(coupon.expires)}</small>
          <button class="copy-btn" type="button" data-action="copy" data-code="${escapeHtml(coupon.code)}">Copy code</button>
        </footer>
      </article>
    `).join('');
  }

  function renderStores() {
    els.storeGrid.innerHTML = data.stores.slice(0, 8).map((store) => {
      const storeDeals = data.deals.filter((deal) => deal.store === store.name);
      const heat = storeDeals.reduce((sum, deal) => sum + deal.heat, 0);
      const followed = state.followedStores.has(store.name);
      return `
        <article class="store-card motion-item">
          <span>${escapeHtml(store.initials)}</span>
          <h3><a href="./store.html?name=${encodeURIComponent(store.name)}">${escapeHtml(store.name)}</a></h3>
          <p>${storeDeals.length} active deals / ${compactNumber(store.followers)} followers / ${store.rating} rating</p>
          <button type="button" class="${followed ? 'saved' : ''}" data-action="follow-store" data-store="${escapeHtml(store.name)}">${followed ? 'Following' : 'Follow store'}</button>
          <small>${heat} store heat</small>
        </article>
      `;
    }).join('');
  }

  function renderStaticSections() {
    renderCards(els.trendingDeals, Discovery.sortDeals(data.deals.filter((deal) => deal.trending), 'trending', { savedSet: state.saved }).slice(0, 6), true);
    renderCards(els.newDeals, Discovery.sortDeals(data.deals, 'newest').slice(0, 6), true);
    renderSpotlight();
    renderPulse();
    renderCategories();
    renderCoupons();
    renderStores();

    els.editorsPicks.innerHTML = data.deals.filter((deal) => deal.featured).slice(0, 5).map((deal) => `
      <a class="editor-item motion-item" href="${deal.dealUrl}">
        <img src="${escapeHtml(deal.image)}" alt="${escapeHtml(deal.title)}" loading="lazy">
        <div>
          <h3>${escapeHtml(deal.title)}</h3>
          <p>${escapeHtml(deal.store)} / ${escapeHtml(deal.shipping)}</p>
        </div>
        <strong>${money(deal.currentPrice)}</strong>
      </a>
    `).join('');

    els.topicList.innerHTML = data.communityTopics.slice(0, 5).map((topic) => `
      <article class="topic-card motion-item">
        <div>
          <strong>${escapeHtml(topic.title)}</strong>
          <span>${escapeHtml(topic.tag)} / ${escapeHtml(topic.user)}</span>
        </div>
        <b>${topic.replies} replies</b>
      </article>
    `).join('');

    els.alertPreview.innerHTML = data.trendingSearches.slice(0, 5).map((term) => `<button type="button" data-filter-shortcut="${escapeHtml(term)}">${escapeHtml(term)}</button>`).join('');
  }

  function populateStores() {
    storeNames.forEach((store) => {
      const option = document.createElement('option');
      option.value = store;
      option.textContent = store;
      els.storeFilter.appendChild(option);
    });
  }

  function updateFilterButtons() {
    document.querySelectorAll('[data-filter]').forEach((button) => {
      button.classList.toggle('active', state.filters.has(button.dataset.filter));
    });
    document.querySelectorAll('[data-sort]').forEach((button) => {
      button.classList.toggle('active', button.dataset.sort === state.sort);
    });
    els.priceValue.textContent = `$${state.maxPrice} and under`;
    els.discountValue.textContent = state.minDiscount > 0 ? `${state.minDiscount}% off and up` : 'Any discount';
  }

  function updateShortcutButtons() {
    document.querySelectorAll('[data-filter-shortcut]').forEach((button) => {
      button.classList.toggle('active', state.filters.has(button.dataset.filterShortcut) || state.query.toLowerCase() === button.dataset.filterShortcut.toLowerCase());
    });
  }

  function applyShortcut(value) {
    const category = data.categories.some((item) => item.name === value);
    state.hasInteracted = true;
    state.filters.clear();
    state.query = '';
    if (category || ['Free Shipping', 'Coupon Available', 'Expiring Soon', '30%+ Off', '50%+ Off', 'Popular', 'Gaming', 'Travel', 'Home', 'Fashion', 'Electronics', 'Kitchen', 'Audio', 'Outdoors', 'Wellness', 'Pets'].includes(value)) {
      state.filters.add(value);
    } else {
      state.query = value;
    }
    els.search.value = state.query;
    updateFilterButtons();
    updateShortcutButtons();
    renderFeed();
    document.getElementById('hot-deals').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleDealAction(event) {
    const target = event.target.closest(actionableSelectors);
    if (!target) return;
    const { action, id, code, placeholder } = target.dataset;
    if (placeholder) {
      toast(placeholder);
      return;
    }
    if (action === 'save') {
      await toggleSaved(id);
    }
    if (action === 'vote') {
      await addHeat(id);
    }
    if (action === 'copy') {
      navigator.clipboard?.writeText(code).then(() => toast(`Copied ${code}`)).catch(() => toast(`Coupon: ${code}`));
    }
    if (action === 'follow-store') {
      const store = target.dataset.store;
      if (state.followedStores.has(store)) {
        state.followedStores.delete(store);
        toast(`Unfollowed ${store}`);
      } else {
        state.followedStores.add(store);
        toast(`Following ${store}`);
      }
      persist('followedStores', state.followedStores);
      renderStores();
    }
    if (action === 'clear-filters') {
      resetFilters();
    }
  }

  function closeFilterDrawer() {
    document.body.classList.remove('filters-open');
    els.filterDrawerToggle?.setAttribute('aria-expanded', 'false');
    els.dealFeed?.removeAttribute('aria-hidden');
    document.querySelector('.feed-panel')?.removeAttribute('aria-hidden');
  }

  function openFilterDrawer() {
    document.body.classList.add('filters-open');
    els.filterDrawerToggle?.setAttribute('aria-expanded', 'true');
  }

  function resetFilters() {
    state.query = '';
    state.sort = 'trending';
    state.filters.clear();
    state.store = '';
    state.maxPrice = initialMaxPrice;
    state.minDiscount = 0;
    state.hasInteracted = false;
    els.search.value = '';
    els.storeFilter.value = '';
    els.priceFilter.value = String(initialMaxPrice);
    els.discountFilter.value = '0';
    closeFilterDrawer();
    updateFilterButtons();
    updateShortcutButtons();
    renderFeed();
  }

  function bindEvents() {
    els.search.value = state.query;
    els.searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      state.hasInteracted = true;
      state.query = els.search.value;
      renderFeed();
      updateShortcutButtons();
      document.getElementById('hot-deals').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    els.search.addEventListener('input', () => {
      state.hasInteracted = true;
      state.query = els.search.value;
      renderFeed();
      updateShortcutButtons();
    });
    els.sortControls.addEventListener('click', (event) => {
      const button = event.target.closest('[data-sort]');
      if (!button) return;
      state.hasInteracted = true;
      state.sort = button.dataset.sort;
      updateFilterButtons();
      renderFeed();
    });
    els.quickFilters.addEventListener('click', (event) => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      const filter = button.dataset.filter;
      state.hasInteracted = true;
      state.query = '';
      els.search.value = '';
      if (state.filters.has(filter)) state.filters.delete(filter);
      else state.filters.add(filter);
      updateFilterButtons();
      updateShortcutButtons();
      renderFeed();
    });
    document.body.addEventListener('click', (event) => {
      const shortcut = event.target.closest('[data-filter-shortcut]');
      if (shortcut) applyShortcut(shortcut.dataset.filterShortcut);
      if (event.target.closest(actionableSelectors)) handleDealAction(event);
    });
    els.storeFilter.addEventListener('change', () => {
      state.hasInteracted = true;
      state.store = els.storeFilter.value;
      renderFeed();
    });
    els.priceFilter.addEventListener('input', () => {
      state.hasInteracted = true;
      state.maxPrice = Number(els.priceFilter.value);
      updateFilterButtons();
      renderFeed();
    });
    els.discountFilter.addEventListener('input', () => {
      state.hasInteracted = true;
      state.minDiscount = Number(els.discountFilter.value);
      updateFilterButtons();
      renderFeed();
    });
    els.clearFilters.addEventListener('click', resetFilters);
    els.filterDrawerToggle?.addEventListener('click', () => {
      if (document.body.classList.contains('filters-open')) closeFilterDrawer();
      else openFilterDrawer();
    });
    els.closeFilters?.addEventListener('click', closeFilterDrawer);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeFilterDrawer();
    });
    els.menuToggle.addEventListener('click', () => {
      closeFilterDrawer();
      const header = document.querySelector('.market-header');
      const isOpen = header.classList.toggle('menu-open');
      document.body.classList.toggle('menu-active', isOpen);
      els.menuToggle.setAttribute('aria-expanded', String(isOpen));
    });
    els.primaryNav.addEventListener('click', () => {
      const header = document.querySelector('.market-header');
      header.classList.remove('menu-open');
      document.body.classList.remove('menu-active');
      els.menuToggle.setAttribute('aria-expanded', 'false');
    });
  }

  window.addEventListener('dealnest:auth-changed', async () => {
    await syncMemberState();
    renderStaticSections();
    renderFeed();
  });
  window.addEventListener('dealnest:resume-action', (event) => {
    if (event.detail?.type === 'vote') addHeat(event.detail.dealId);
  });

  els.priceFilter.max = String(initialMaxPrice);
  els.priceFilter.value = String(initialMaxPrice);
  els.discountFilter.value = String(state.minDiscount);
  await syncMemberState();
  populateStores();
  renderStaticSections();
  updateFilterButtons();
  updateShortcutButtons();
  renderFeed();
  bindEvents();
  document.documentElement.classList.add('dealnest-ready');
}());
