(function () {
  const data = window.DealScoutData;
  const storeNames = data.stores.map((store) => store.name);
  const state = {
    query: new URLSearchParams(window.location.search).get('q') || '',
    sort: 'trending',
    filters: new Set(),
    store: '',
    maxPrice: 900,
    saved: new Set(JSON.parse(localStorage.getItem('dealnest:saved') || '[]')),
    voted: new Set(JSON.parse(localStorage.getItem('dealnest:voted') || '[]')),
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
    clearFilters: document.getElementById('clearFilters'),
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

  function persist(key, set) {
    localStorage.setItem(`dealnest:${key}`, JSON.stringify([...set]));
  }

  function toast(message) {
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

  function dealTokens(deal) {
    const values = [deal.category, deal.status, deal.store, deal.shipping, ...deal.tags];
    return values.flatMap((value) => [value, value.toLowerCase()]);
  }

  function matchesDeal(deal) {
    const query = state.query.trim().toLowerCase();
    const haystack = [deal.title, deal.description, deal.store, deal.category, deal.shipping, deal.couponCode, ...deal.tags]
      .join(' ')
      .toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (state.store && deal.store !== state.store) return false;
    if (deal.currentPrice > state.maxPrice) return false;
    if (state.filters.size > 0) {
      const tokens = new Set(dealTokens(deal));
      const hasEveryFilter = [...state.filters].every((filter) => tokens.has(filter) || tokens.has(filter.toLowerCase()));
      if (!hasEveryFilter) return false;
    }
    return true;
  }

  function sortDeals(deals) {
    const sorted = [...deals];
    if (state.sort === 'new') return sorted.reverse();
    if (state.sort === 'popular') return sorted.sort((a, b) => b.comments + b.votes - (a.comments + a.votes));
    if (state.sort === 'expiring') return sorted.sort((a, b) => Number(b.status === 'Expiring Soon') - Number(a.status === 'Expiring Soon') || b.heat - a.heat);
    return sorted.sort((a, b) => b.heat - a.heat);
  }

  function findStore(name) {
    return data.stores.find((store) => store.name === name) || { initials: name.slice(0, 2), followers: 0, rating: 0 };
  }

  function toneFor(category) {
    return (data.categories.find((item) => item.name === category)?.tone || 'mint').toLowerCase();
  }

  function cardTemplate(deal, compact = false) {
    const saved = state.saved.has(deal.id);
    const voted = state.voted.has(deal.id);
    const heat = deal.heat + (voted ? 1 : 0);
    return `
      <article class="deal-card tone-${toneFor(deal.category)} motion-item" data-deal-id="${deal.id}">
        <a class="deal-image" href="${deal.dealUrl}" aria-label="View ${deal.title}">
          <img src="${deal.image}" alt="${deal.title}" loading="lazy">
          <span class="discount-badge">${deal.discount}% off</span>
          <span class="status-badge">${deal.status}</span>
        </a>
        <div class="deal-body">
          <div class="deal-meta">
            <span><a href="./store.html?name=${encodeURIComponent(deal.store)}">${deal.store}</a></span>
            <span class="category-badge"><a href="./category.html?name=${encodeURIComponent(deal.category)}">${deal.category}</a></span>
          </div>
          <h3 class="deal-title"><a href="${deal.dealUrl}">${deal.title}</a></h3>
          ${compact ? '' : `<p class="deal-description">${deal.description}</p>`}
          <div class="price-row">
            <span class="price">${money(deal.currentPrice)}</span>
            <span class="was-price">${money(deal.originalPrice)}</span>
          </div>
          <div class="deal-signals">
            <button class="heat-button ${voted ? 'voted' : ''}" type="button" data-action="vote" data-id="${deal.id}">Heat ${heat}</button>
            <span>${deal.comments} comments</span>
            <span>${deal.postedTime}</span>
          </div>
          <p class="posted-by">Posted by ${deal.postedBy} / ${deal.shipping}</p>
          ${compact || !deal.couponCode ? '' : `
            <div class="coupon-row">
              <code>${deal.couponCode}</code>
              <button class="copy-btn" type="button" data-action="copy" data-code="${deal.couponCode}">Copy</button>
            </div>
          `}
          <div class="deal-actions">
            <button class="save-btn ${saved ? 'saved' : ''}" type="button" data-action="save" data-id="${deal.id}" aria-label="${saved ? 'Unsave' : 'Save'} ${deal.title}">${saved ? 'Saved' : 'Save'}</button>
            <a class="deal-action" href="${deal.dealUrl}">View deal</a>
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
    const filtered = sortDeals(data.deals.filter(matchesDeal));
    renderCards(els.dealFeed, filtered, false);
    els.resultCount.textContent = `${filtered.length} deal${filtered.length === 1 ? '' : 's'}`;
    els.emptyState.classList.toggle('hidden', filtered.length > 0);
    window.DealNestMotion?.refresh();
  }

  function renderSpotlight() {
    const deal = data.deals.find((item) => item.featured && item.trending) || data.deals[0];
    const store = findStore(deal.store);
    els.spotlight.innerHTML = `
      <article class="spotlight-card motion-item">
        <div class="spotlight-art">
          <img src="${deal.image}" alt="${deal.title}" loading="lazy">
          <span>${deal.discount}% off</span>
        </div>
        <div class="spotlight-copy">
          <p class="eyebrow">Featured deal spotlight</p>
          <h2>${deal.title}</h2>
          <p>${deal.description}</p>
          <div class="summary-price">
            <span>${money(deal.currentPrice)}</span>
            <del>${money(deal.originalPrice)}</del>
            <strong>${deal.heat} heat</strong>
          </div>
          <div class="spotlight-store">
            <b>${store.initials}</b>
            <span>${deal.store} / ${deal.shipping} / ${deal.expires}</span>
          </div>
          <div class="spotlight-actions">
            <a class="deal-merchant-button" href="${deal.dealUrl}">Inspect deal</a>
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
      <article><span data-count="${data.deals.length}">0</span><strong>live mock deals</strong><p>Expanded feed with enough density for real filtering.</p></article>
      <article><span data-count="${totalHeat}">0</span><strong>total heat</strong><p>Community energy drives the layout and sorting model.</p></article>
      <article><span data-count="${totalComments}">0</span><strong>comments tracked</strong><p>Discussion signals make each listing feel alive.</p></article>
      <article><span data-count="${expiring}">0</span><strong>ending soon</strong><p>Urgency appears only where the mock data supports it.</p></article>
    `;
    els.trendList.innerHTML = topStores.map((store) => `
      <li><b>${store.initials}</b><span>${store.name}</span><strong>${compactNumber(store.followers)} followers</strong></li>
    `).join('');
  }

  function renderCategories() {
    els.categoryGrid.innerHTML = data.categories.map((category) => {
      const deals = data.deals.filter((deal) => deal.category === category.name);
      const best = deals.reduce((top, deal) => deal.heat > (top?.heat || 0) ? deal : top, null);
      return `
        <button class="category-card tone-${category.tone} motion-item" type="button" data-filter-shortcut="${category.name}">
          <span>${category.icon}</span>
          <strong>${category.name}</strong>
          <p>${category.description}</p>
          <small>${deals.length} deals${best ? ` / top ${best.discount}% off` : ''}</small>
        </button>
      `;
    }).join('');
  }

  function renderCoupons() {
    els.couponList.innerHTML = data.coupons.slice(0, 6).map((coupon) => `
      <article class="coupon-card motion-item">
        <div>
          <strong>${coupon.store}</strong>
          <code>${coupon.code}</code>
        </div>
        <p>${coupon.description}</p>
        <footer>
          <small>${coupon.verified ? 'Verified' : 'Community tested'} / ${coupon.expires}</small>
          <button class="copy-btn" type="button" data-action="copy" data-code="${coupon.code}">Copy code</button>
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
          <span>${store.initials}</span>
          <h3><a href="./store.html?name=${encodeURIComponent(store.name)}">${store.name}</a></h3>
          <p>${storeDeals.length} active deals / ${compactNumber(store.followers)} followers / ${store.rating} rating</p>
          <button type="button" class="${followed ? 'saved' : ''}" data-action="follow-store" data-store="${store.name}">${followed ? 'Following' : 'Follow store'}</button>
          <small>${heat} store heat</small>
        </article>
      `;
    }).join('');
  }

  function renderStaticSections() {
    renderCards(els.trendingDeals, data.deals.filter((deal) => deal.trending).sort((a, b) => b.heat - a.heat).slice(0, 6), true);
    renderCards(els.newDeals, [...data.deals].reverse().slice(0, 6), true);
    renderSpotlight();
    renderPulse();
    renderCategories();
    renderCoupons();
    renderStores();

    els.editorsPicks.innerHTML = data.deals.filter((deal) => deal.featured).slice(0, 5).map((deal) => `
      <a class="editor-item motion-item" href="${deal.dealUrl}">
        <img src="${deal.image}" alt="${deal.title}" loading="lazy">
        <div>
          <h3>${deal.title}</h3>
          <p>${deal.store} / ${deal.shipping}</p>
        </div>
        <strong>${money(deal.currentPrice)}</strong>
      </a>
    `).join('');

    els.topicList.innerHTML = data.communityTopics.slice(0, 5).map((topic) => `
      <article class="topic-card motion-item">
        <div>
          <strong>${topic.title}</strong>
          <span>${topic.tag} / ${topic.user}</span>
        </div>
        <b>${topic.replies} replies</b>
      </article>
    `).join('');

    els.alertPreview.innerHTML = data.trendingSearches.slice(0, 5).map((term) => `<button type="button" data-filter-shortcut="${term}">${term}</button>`).join('');
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
  }

  function updateShortcutButtons() {
    document.querySelectorAll('[data-filter-shortcut]').forEach((button) => {
      button.classList.toggle('active', state.filters.has(button.dataset.filterShortcut) || state.query.toLowerCase() === button.dataset.filterShortcut.toLowerCase());
    });
  }

  function applyShortcut(value) {
    const category = data.categories.some((item) => item.name === value);
    state.filters.clear();
    state.query = '';
    if (category || ['Free Shipping', 'Expiring Soon', 'Popular', 'Gaming', 'Travel', 'Home', 'Fashion', 'Electronics', 'Kitchen', 'Audio', 'Outdoors', 'Wellness', 'Pets'].includes(value)) {
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

  function handleDealAction(event) {
    const target = event.target.closest(actionableSelectors);
    if (!target) return;
    const { action, id, code, placeholder } = target.dataset;
    if (placeholder) {
      toast(placeholder);
      return;
    }
    if (action === 'save') {
      if (state.saved.has(id)) {
        state.saved.delete(id);
        toast('Removed from saved deals');
      } else {
        state.saved.add(id);
        toast('Saved for later');
      }
      persist('saved', state.saved);
      renderStaticSections();
      renderFeed();
    }
    if (action === 'vote') {
      if (state.voted.has(id)) {
        toast('You already added heat');
        return;
      }
      state.voted.add(id);
      persist('voted', state.voted);
      toast('Heat added');
      renderStaticSections();
      renderFeed();
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
  }

  function bindEvents() {
    els.search.value = state.query;
    els.searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      state.query = els.search.value;
      renderFeed();
      updateShortcutButtons();
      document.getElementById('hot-deals').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    els.search.addEventListener('input', () => {
      state.query = els.search.value;
      renderFeed();
      updateShortcutButtons();
    });
    els.sortControls.addEventListener('click', (event) => {
      const button = event.target.closest('[data-sort]');
      if (!button) return;
      state.sort = button.dataset.sort;
      updateFilterButtons();
      renderFeed();
    });
    els.quickFilters.addEventListener('click', (event) => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      const filter = button.dataset.filter;
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
      state.store = els.storeFilter.value;
      renderFeed();
    });
    els.priceFilter.addEventListener('input', () => {
      state.maxPrice = Number(els.priceFilter.value);
      updateFilterButtons();
      renderFeed();
    });
    els.clearFilters.addEventListener('click', () => {
      state.query = '';
      state.sort = 'trending';
      state.filters.clear();
      state.store = '';
      state.maxPrice = 900;
      els.search.value = '';
      els.storeFilter.value = '';
      els.priceFilter.value = '900';
      updateFilterButtons();
      updateShortcutButtons();
      renderFeed();
    });
    els.menuToggle.addEventListener('click', () => {
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

  populateStores();
  renderStaticSections();
  updateFilterButtons();
  updateShortcutButtons();
  renderFeed();
  bindEvents();
}());
