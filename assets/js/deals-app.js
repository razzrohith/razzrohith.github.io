(function () {
  const data = window.DealScoutData;
  const state = {
    query: '',
    sort: 'trending',
    filters: new Set(),
    store: '',
    maxPrice: 800,
    saved: new Set(JSON.parse(localStorage.getItem('dealnest:saved') || '[]')),
    voted: new Set(JSON.parse(localStorage.getItem('dealnest:voted') || '[]'))
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

  function matchesDeal(deal) {
    const query = state.query.trim().toLowerCase();
    const haystack = [deal.title, deal.store, deal.category, deal.shipping, deal.couponCode, ...deal.tags]
      .join(' ')
      .toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (state.store && deal.store !== state.store) return false;
    if (deal.currentPrice > state.maxPrice) return false;
    if (state.filters.size > 0) {
      const tokens = new Set([deal.category, deal.status, ...deal.tags]);
      const hasEveryFilter = [...state.filters].every((filter) => tokens.has(filter));
      if (!hasEveryFilter) return false;
    }
    return true;
  }

  function sortDeals(deals) {
    const sorted = [...deals];
    if (state.sort === 'new') {
      return sorted.sort((a, b) => data.deals.indexOf(b) - data.deals.indexOf(a));
    }
    if (state.sort === 'popular') {
      return sorted.sort((a, b) => b.comments - a.comments);
    }
    if (state.sort === 'expiring') {
      return sorted.sort((a, b) => Number(b.status === 'Expiring Soon') - Number(a.status === 'Expiring Soon') || b.heat - a.heat);
    }
    return sorted.sort((a, b) => b.heat - a.heat);
  }

  function cardTemplate(deal, compact = false) {
    const saved = state.saved.has(deal.id);
    const voted = state.voted.has(deal.id);
    const heat = deal.heat + (voted ? 1 : 0);
    return `
      <article class="deal-card is-updated" data-deal-id="${deal.id}">
        <div class="deal-image">
          <img src="${deal.image}" alt="${deal.title}">
          <span class="discount-badge">${deal.discount}% off</span>
          <span class="status-badge">${deal.status}</span>
        </div>
        <div class="deal-body">
          <div class="deal-meta">
            <span>${deal.store}</span>
            <span class="category-badge">${deal.category}</span>
          </div>
          <h3 class="deal-title">${deal.title}</h3>
          <div class="price-row">
            <span class="price">${money(deal.currentPrice)}</span>
            <span class="was-price">${money(deal.originalPrice)}</span>
          </div>
          <div class="deal-signals">
            <button class="heat-button ${voted ? 'voted' : ''}" type="button" data-action="vote" data-id="${deal.id}">Heat ${heat}</button>
            <span>${deal.comments} comments</span>
            <span>${deal.postedTime}</span>
          </div>
          <p class="posted-by">Posted by ${deal.postedBy} · ${deal.shipping}</p>
          ${compact || !deal.couponCode ? '' : `
            <div class="coupon-row">
              <code>${deal.couponCode}</code>
              <button class="copy-btn" type="button" data-action="copy" data-code="${deal.couponCode}">Copy</button>
            </div>
          `}
          <div class="deal-actions">
            <button class="save-btn ${saved ? 'saved' : ''}" type="button" data-action="save" data-id="${deal.id}" aria-label="${saved ? 'Unsave' : 'Save'} ${deal.title}">${saved ? 'Saved' : 'Save'}</button>
            <a class="deal-action" href="${deal.dealUrl}" data-action="deal" data-id="${deal.id}">Get deal</a>
          </div>
        </div>
      </article>
    `;
  }

  function renderCards(container, deals, compact = false) {
    container.innerHTML = deals.map((deal) => cardTemplate(deal, compact)).join('');
  }

  function renderFeed() {
    const filtered = sortDeals(data.deals.filter(matchesDeal));
    renderCards(els.dealFeed, filtered, false);
    els.resultCount.textContent = `${filtered.length} deal${filtered.length === 1 ? '' : 's'}`;
    els.emptyState.classList.toggle('hidden', filtered.length > 0);
  }

  function renderStaticSections() {
    renderCards(els.trendingDeals, sortDeals(data.deals).slice(0, 4), true);
    renderCards(els.newDeals, [...data.deals].reverse().slice(0, 4), true);

    els.editorsPicks.innerHTML = sortDeals(data.deals).slice(0, 4).map((deal) => `
      <article class="editor-item">
        <img src="${deal.image}" alt="${deal.title}">
        <div>
          <h3>${deal.title}</h3>
          <p>${deal.store} / ${deal.shipping}</p>
        </div>
        <strong>${money(deal.currentPrice)}</strong>
      </article>
    `).join('');

    els.couponList.innerHTML = data.coupons.map((coupon) => `
      <article class="coupon-card">
        <div>
          <strong>${coupon.store}</strong>
          <code>${coupon.code}</code>
        </div>
        <p>${coupon.description}</p>
        <footer>
          <small>${coupon.expires}</small>
          <button class="copy-btn" type="button" data-action="copy" data-code="${coupon.code}">Copy code</button>
        </footer>
      </article>
    `).join('');

    const storeStats = data.stores.map((store) => {
      const storeDeals = data.deals.filter((deal) => deal.store === store);
      const heat = storeDeals.reduce((sum, deal) => sum + deal.heat, 0);
      return { store, count: storeDeals.length, heat };
    }).filter((store) => store.count > 0);

    els.storeGrid.innerHTML = storeStats.map((item) => `
      <article class="store-card">
        <span>${item.store.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
        <h3>${item.store}</h3>
        <p>${item.count} active deal${item.count === 1 ? '' : 's'} / ${item.heat} heat</p>
        <button type="button" data-placeholder="Store following will connect to alerts in a later phase.">Follow store</button>
      </article>
    `).join('');

    els.topicList.innerHTML = data.communityTopics.map((topic) => `
      <article class="topic-card">
        <div>
          <strong>${topic.title}</strong>
          <span>${topic.tag}</span>
        </div>
        <b>${topic.replies} replies</b>
      </article>
    `).join('');
  }

  function populateStores() {
    data.stores.forEach((store) => {
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

  function applyShortcut(value) {
    state.filters.clear();
    state.filters.add(value);
    state.query = '';
    els.search.value = '';
    updateFilterButtons();
    renderFeed();
    document.getElementById('hot-deals').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function updateShortcutButtons() {
    document.querySelectorAll('[data-filter-shortcut]').forEach((button) => {
      button.classList.toggle('active', state.filters.has(button.dataset.filterShortcut));
    });
  }

  function handleDealAction(event) {
    const target = event.target.closest('[data-action]');
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
      navigator.clipboard?.writeText(code).then(() => {
        toast(`Copied ${code}`);
      }).catch(() => {
        toast(`Coupon: ${code}`);
      });
    }
    if (action === 'deal') {
      event.preventDefault();
      const deal = data.deals.find((item) => item.id === id);
      toast(`${deal ? deal.store : 'Deal'} detail pages arrive in Phase 2`);
    }
  }

  function bindEvents() {
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
      updateShortcutButtons();
      renderFeed();
    });

    els.quickFilters.addEventListener('click', (event) => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      const filter = button.dataset.filter;
      if (state.filters.has(filter)) state.filters.delete(filter);
      else state.filters.add(filter);
      updateFilterButtons();
      updateShortcutButtons();
      renderFeed();
    });

    document.querySelectorAll('[data-filter-shortcut]').forEach((button) => {
      button.addEventListener('click', () => applyShortcut(button.dataset.filterShortcut));
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
      state.maxPrice = 800;
      els.search.value = '';
      els.storeFilter.value = '';
      els.priceFilter.value = '800';
      updateFilterButtons();
      updateShortcutButtons();
      renderFeed();
    });

    document.body.addEventListener('click', (event) => {
      if (event.target.closest(actionableSelectors)) handleDealAction(event);
    });

    els.menuToggle.addEventListener('click', () => {
      const header = document.querySelector('.market-header');
      const isOpen = header.classList.toggle('menu-open');
      els.menuToggle.setAttribute('aria-expanded', String(isOpen));
    });

    els.primaryNav.addEventListener('click', () => {
      const header = document.querySelector('.market-header');
      header.classList.remove('menu-open');
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
