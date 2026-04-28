(async function () {
  await Promise.all([window.DealNestDataReady, window.DealNestAuthReady].filter(Boolean));
  const data = window.DealScoutData;
  const Auth = window.DealNestAuth;
  const Discovery = window.DealNestDiscovery;
  const page = document.body.dataset.page;
  const params = new URLSearchParams(window.location.search);
  const saved = new Set(JSON.parse(localStorage.getItem('dealnest:saved') || '[]'));
  const followedStores = new Set(JSON.parse(localStorage.getItem('dealnest:followedStores') || '[]'));

  function money(value) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value % 1 === 0 ? 0 : 2 }).format(value);
  }

  function compact(value) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
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

  function toneFor(category) {
    return (data.categories.find((item) => item.name === category)?.tone || 'mint').toLowerCase();
  }

  function storeByName(name) {
    return data.stores.find((store) => store.name === name) || { name, initials: name.slice(0, 2).toUpperCase(), followers: 0, rating: 0 };
  }

  function dealById(id) {
    return data.deals.find((deal) => deal.id === id || deal.slug === id || deal.uuid === id);
  }

  function outboundLink(deal, source) {
    return window.DealNestOutbound?.linkFor(deal, source) || deal.dealUrl;
  }

  function remoteEnabled() {
    return Boolean(Auth?.isConfigured && Auth?.user);
  }

  function requireMember(type, message) {
    return Auth?.requireAuth({ type, message, action: { type, page, url: location.href } });
  }

  function accessPanel(title, message, button = 'Sign in') {
    return `<section class="section-block"><div class="access-panel"><p class="eyebrow">Member access</p><h2>${title}</h2><p>${message}</p><button class="post-button" type="button" data-auth-action="login">${button}</button><output></output></div></section>`;
  }

  async function fetchRows(path, fallback = []) {
    if (!remoteEnabled()) return fallback;
    return Auth.rest(path).catch(() => fallback);
  }

  function categoryNameById(id) {
    return data.categories.find((category) => category.id === id)?.name || '';
  }

  function storeNameById(id) {
    return data.stores.find((store) => store.id === id)?.name || '';
  }

  function alertCategoryName(alert) {
    return alert.category || categoryNameById(alert.category_id) || 'Any category';
  }

  function alertStoreName(alert) {
    return alert.store || storeNameById(alert.store_id) || 'Any store';
  }

  async function fetchAlertRows(userId) {
    const base = `user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`;
    const extended = `deal_alerts?select=id,keyword,category_id,store_id,max_price,min_discount_percent,notify_email,notify_browser,notify_dashboard,is_active,created_at,updated_at,require_free_shipping,require_coupon,require_expiring_soon&${base}`;
    const fallback = `deal_alerts?select=id,keyword,category_id,store_id,max_price,min_discount_percent,notify_email,notify_browser,notify_dashboard,is_active,created_at,updated_at&${base}`;
    const rows = await fetchRows(extended, null);
    return rows || fetchRows(fallback);
  }

  function alertCriteriaFromForm(form) {
    const values = Object.fromEntries(new FormData(form).entries());
    return {
      id: values.alertId || '',
      keyword: String(values.keyword || '').trim(),
      category: String(values.category || 'Any category'),
      store: String(values.store || 'Any store'),
      max_price: values.price ? Number(values.price) : null,
      min_discount_percent: values.discount ? Number(values.discount) : null,
      require_free_shipping: Boolean(values.freeShipping),
      require_coupon: Boolean(values.couponAvailable),
      require_expiring_soon: Boolean(values.expiringSoon),
      notify_email: Boolean(form.querySelector('[data-channel="Email"]')?.classList.contains('active')),
      notify_browser: Boolean(form.querySelector('[data-channel="Browser"]')?.classList.contains('active')),
      notify_dashboard: true,
      is_active: true
    };
  }

  function alertValidation(criteria) {
    const errors = [];
    if (!criteria.keyword && criteria.category === 'Any category' && criteria.store === 'Any store') {
      errors.push('Add a keyword, category, or store so the alert has a clear signal.');
    }
    if (criteria.max_price !== null && (!Number.isFinite(criteria.max_price) || criteria.max_price < 0)) errors.push('Max price must be a valid positive number.');
    if (criteria.min_discount_percent !== null && (!Number.isFinite(criteria.min_discount_percent) || criteria.min_discount_percent < 0 || criteria.min_discount_percent > 100)) errors.push('Minimum discount must be between 0 and 100.');
    return errors;
  }

  function freeShippingDeal(deal) {
    return /free/i.test(deal.shipping || '') || (deal.tags || []).some((tag) => /free shipping/i.test(tag));
  }

  function expiringDeal(deal) {
    return /expiring/i.test(deal.status || '') || (deal.tags || []).some((tag) => /expiring/i.test(tag));
  }

  function alertMatchReasons(alert, deal) {
    const reasons = [];
    const keyword = String(alert.keyword || '').trim().toLowerCase();
    const haystack = [deal.title, deal.description, deal.store, deal.category, deal.couponCode, deal.shipping, ...(deal.tags || [])].join(' ').toLowerCase();
    if (keyword && keyword.split(/\s+/).filter(Boolean).some((term) => haystack.includes(term))) reasons.push(`keyword "${alert.keyword}"`);
    const category = alertCategoryName(alert);
    if (category !== 'Any category' && deal.category === category) reasons.push(category);
    const store = alertStoreName(alert);
    if (store !== 'Any store' && deal.store === store) reasons.push(store);
    if (alert.max_price !== null && Number(deal.currentPrice) <= Number(alert.max_price)) reasons.push(`under ${money(Number(alert.max_price))}`);
    if (alert.min_discount_percent !== null && Number(deal.discount) >= Number(alert.min_discount_percent)) reasons.push(`${alert.min_discount_percent}%+ off`);
    if (alert.require_free_shipping && freeShippingDeal(deal)) reasons.push('free shipping');
    if (alert.require_coupon && deal.couponCode) reasons.push('coupon available');
    if (alert.require_expiring_soon && expiringDeal(deal)) reasons.push('expiring soon');
    return reasons;
  }

  function matchesAlert(alert, deal) {
    const keyword = String(alert.keyword || '').trim().toLowerCase();
    if (keyword) {
      const haystack = [deal.title, deal.description, deal.store, deal.category, deal.couponCode, deal.shipping, ...(deal.tags || [])].join(' ').toLowerCase();
      if (!keyword.split(/\s+/).filter(Boolean).some((term) => haystack.includes(term))) return false;
    }
    const category = alertCategoryName(alert);
    if (category !== 'Any category' && deal.category !== category) return false;
    const store = alertStoreName(alert);
    if (store !== 'Any store' && deal.store !== store) return false;
    if (alert.max_price !== null && alert.max_price !== undefined && Number(deal.currentPrice) > Number(alert.max_price)) return false;
    if (alert.min_discount_percent !== null && alert.min_discount_percent !== undefined && Number(deal.discount) < Number(alert.min_discount_percent)) return false;
    if (alert.require_free_shipping && !freeShippingDeal(deal)) return false;
    if (alert.require_coupon && !deal.couponCode) return false;
    if (alert.require_expiring_soon && !expiringDeal(deal)) return false;
    return true;
  }

  function matchingDealsForAlert(alert) {
    return data.deals
      .filter((deal) => matchesAlert(alert, deal))
      .map((deal) => ({ deal, reasons: alertMatchReasons(alert, deal) }))
      .sort((a, b) => b.deal.heat - a.deal.heat || b.deal.discount - a.deal.discount);
  }

  async function toggleAccountSave(id, target) {
    const deal = dealById(id);
    if (!deal) return;
    if (!remoteEnabled()) {
      if (saved.has(id)) {
        saved.delete(id);
        toast('Removed from saved deals on this device');
      } else {
        saved.add(id);
        toast('Saved here. Create an account to sync saved deals across devices.');
      }
      persist('saved', saved);
      target?.classList.toggle('saved', saved.has(id));
      if (target) target.textContent = saved.has(id) ? 'Saved' : 'Save';
      return;
    }
    const remoteId = deal.uuid || deal.id;
    const userId = Auth.currentUserId();
    try {
      if (saved.has(id)) {
        await Auth.rest(`saved_deals?deal_id=eq.${encodeURIComponent(remoteId)}&user_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE', prefer: 'return=minimal' });
        saved.delete(id);
        toast('Removed from your account saves');
      } else {
        await Auth.rest('saved_deals?on_conflict=deal_id,user_id', {
          method: 'POST',
          prefer: 'resolution=ignore-duplicates,return=representation',
          body: { deal_id: remoteId, user_id: userId }
        });
        saved.add(id);
        toast('Saved to your account');
      }
      persist('saved', saved);
      target?.classList.toggle('saved', saved.has(id));
      if (target) target.textContent = saved.has(id) ? 'Saved' : 'Save';
    } catch (error) {
      toast(error.message);
    }
  }

  function couponsForStore(name) {
    return data.coupons.filter((coupon) => coupon.store === name);
  }

  function categoryDeals(name) {
    return data.deals.filter((deal) => deal.category === name);
  }

  function slugify(value) {
    return String(value || 'deal')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 54) || 'deal';
  }

  function categoryId(name) {
    return data.categories.find((category) => category.name === name)?.id || null;
  }

  function storeId(name) {
    return data.stores.find((store) => store.name === name)?.id || null;
  }

  function calculateDiscount(price, original) {
    if (!Number.isFinite(price) || !Number.isFinite(original) || price <= 0 || original <= 0 || price >= original) return 0;
    return Math.max(0, Math.min(100, Math.round((1 - price / original) * 100)));
  }

  function normalizeImagePath(value) {
    const trimmed = String(value || '').trim();
    return trimmed || './assets/img/deals/monitor.svg';
  }

  function safeFileName(name) {
    const cleaned = String(name || 'deal-image')
      .toLowerCase()
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 44) || 'deal-image';
    return cleaned;
  }

  function validateDealImage(file) {
    if (!file || !file.name) return '';
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) return 'Upload a JPG, PNG, or WebP image.';
    if (file.size > 5 * 1024 * 1024) return 'Deal images must be 5 MB or smaller.';
    return '';
  }

  function dealCard(deal, compactCard = false) {
    const isSaved = saved.has(deal.id);
    return `
      <article class="deal-card tone-${toneFor(deal.category)} motion-item" data-deal-id="${deal.id}">
        <a class="deal-image" href="${deal.dealUrl}" aria-label="Open ${deal.title}">
          <img src="${deal.image}" alt="${deal.title}" loading="lazy">
          <span class="discount-badge">${deal.discount}% off</span>
          <span class="status-badge">${deal.status}</span>
        </a>
        <div class="deal-body">
          <div class="deal-meta"><span><a href="./store.html?name=${encodeURIComponent(deal.store)}">${deal.store}</a></span><span class="category-badge"><a href="./category.html?name=${encodeURIComponent(deal.category)}">${deal.category}</a></span></div>
          <h3 class="deal-title"><a href="${deal.dealUrl}">${deal.title}</a></h3>
          ${compactCard ? '' : `<p class="deal-description">${deal.description}</p>`}
          <div class="price-row"><span class="price">${money(deal.currentPrice)}</span><span class="was-price">${money(deal.originalPrice)}</span></div>
          <div class="deal-signals"><span>${deal.heat} heat</span><span>${deal.comments} comments</span><span>${deal.postedTime}</span></div>
          ${deal.couponCode && !compactCard ? `<div class="coupon-row"><code>${deal.couponCode}</code><button class="copy-btn" type="button" data-action="copy" data-code="${deal.couponCode}">Copy</button></div>` : ''}
          <div class="deal-actions">
            <button class="save-btn ${isSaved ? 'saved' : ''}" type="button" data-action="save" data-id="${deal.id}">${isSaved ? 'Saved' : 'Save'}</button>
            <a class="deal-action" href="${deal.dealUrl}">View deal</a>
            <a class="deal-action outbound-action" href="${outboundLink(deal, compactCard ? `${page || 'page'}-compact` : page || 'page')}" data-outbound-link>Get deal -></a>
          </div>
        </div>
      </article>
    `;
  }

  function stat(label, value, detail) {
    return `<article><span>${value}</span><strong>${label}</strong><p>${detail}</p></article>`;
  }

  function pageShell(title, eyebrow, intro, body) {
    const root = document.getElementById('pageContent');
    root.innerHTML = `
      <section class="page-hero section-block motion-item">
        <p class="eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
        <p>${intro}</p>
      </section>
      ${body}
    `;
    requestAnimationFrame(() => window.DealNestMotion?.refresh());
  }

  function categories() {
    const totalDeals = data.deals.length;
    pageShell('Shop by category', 'Discovery map', 'Browse rich category rooms with active deals, store signals, and the hottest current offer in each lane.',
      `<section class="section-block"><div class="trust-strip">${stat('categories', data.categories.length, 'Balanced shopping lanes with real mock inventory.')}${stat('active deals', totalDeals, 'Every card links into a filtered category route.')}${stat('top heat', Math.max(...data.deals.map((deal) => deal.heat)), 'Community momentum helps prioritize the feed.')}</div></section>
      <section class="section-block"><div class="category-card-grid">${data.categories.map((category) => {
        const deals = categoryDeals(category.name);
        const top = Discovery.sortDeals(deals, 'trending')[0];
        const stores = [...new Set(deals.map((deal) => deal.store))].slice(0, 3).join(', ') || 'Stores coming soon';
        return `<a class="category-card tone-${category.tone} motion-item rich-category-card" href="./category.html?name=${encodeURIComponent(category.name)}"><span>${category.icon}</span><strong>${category.name}</strong><p>${category.description}</p><small>${deals.length} active deals / ${stores}</small>${top ? `<em>Top: ${top.title}</em>` : '<em>New deals arriving soon</em>'}</a>`;
      }).join('')}</div></section>`);
  }

  function stores() {
    pageShell('Store directory', 'Store watch', 'Follow stores, scan trust signals, compare coupon depth, and jump into dedicated store profiles.',
      `<section class="section-block"><div class="store-grid">${data.stores.map((store) => {
        const deals = data.deals.filter((deal) => deal.store === store.name);
        const coupons = couponsForStore(store.name);
        const heat = deals.reduce((sum, deal) => sum + deal.heat, 0);
        const followed = followedStores.has(store.name);
        return `<article class="store-card motion-item rich-store-card"><span>${store.initials}</span><h3><a href="./store.html?name=${encodeURIComponent(store.name)}">${store.name}</a></h3><p>${deals.length} active deals / ${coupons.length} coupons / ${compact(store.followers)} followers</p><div class="store-badges"><b>${store.rating} trust</b><b>${heat} heat</b></div><button type="button" class="${followed ? 'saved' : ''}" data-action="follow-store" data-store="${store.name}">${followed ? 'Following' : 'Follow store'}</button></article>`;
      }).join('')}</div></section>`);
  }

  function coupons() {
    const stores = [...new Set(data.coupons.map((coupon) => coupon.store))];
    pageShell('Coupon desk', 'Verified savings', 'Copy codes, filter by store, and scan expiration pressure without leaving the coupon workspace.',
      `<section class="section-block coupon-workspace">
        <div class="feed-toolbar"><div><p class="eyebrow">Coupon filters</p><h2>Find usable codes fast</h2></div><select id="couponStoreFilter" aria-label="Filter coupons by store"><option value="">All stores</option>${stores.map((store) => `<option value="${store}">${store}</option>`).join('')}</select></div>
        <div class="chip-list coupon-tabs"><button type="button" class="active" data-coupon-filter="all">All</button><button type="button" data-coupon-filter="verified">Verified</button><button type="button" data-coupon-filter="expiring">Expiring soon</button></div>
        <div class="coupon-list coupon-page-grid" id="couponResults"></div>
      </section>`);
    renderCouponResults();
  }

  function renderCouponResults() {
    const root = document.getElementById('couponResults');
    if (!root) return;
    const active = document.querySelector('[data-coupon-filter].active')?.dataset.couponFilter || 'all';
    const store = document.getElementById('couponStoreFilter')?.value || '';
    const filtered = data.coupons.filter((coupon) => {
      if (store && coupon.store !== store) return false;
      if (active === 'verified' && !coupon.verified) return false;
      if (active === 'expiring' && !/tonight|48|tuesday|sunday|saturday/i.test(coupon.expires)) return false;
      return true;
    });
    root.innerHTML = filtered.map((coupon) => `<article class="coupon-card motion-item"><div><strong>${coupon.store}</strong><code>${coupon.code}</code></div><p>${coupon.description}</p><footer><small>${coupon.verified ? 'Verified code' : 'Community tested'} / ${coupon.expires}</small><button class="copy-btn" type="button" data-action="copy" data-code="${coupon.code}">Copy code</button></footer></article>`).join('') || '<div class="empty-state"><strong>No coupons match</strong><p>Clear the store or status filter to see more codes.</p></div>';
    window.DealNestMotion?.refresh();
  }

  function community() {
    const topTags = [...new Set(data.communityTopics.map((topic) => topic.tag))].slice(0, 6);
    pageShell('Community hub', 'Discussion layer', 'A populated forum preview for deal safety, coupon reports, buying advice, and category-specific conversation.',
      `<section class="community-section community-page"><div><h2>Members make the signal stronger.</h2><p>Use discussion previews to validate deal quality before clicking through. Reputation, moderation, and thread detail pages can plug into this structure later.</p><div class="hero-pills">${topTags.map((tag) => `<button type="button" data-placeholder="${tag} threads will open when forum routing is added.">${tag}</button>`).join('')}</div></div><div class="topic-list">${data.communityTopics.map((topic) => `<article class="topic-card motion-item"><div><strong>${topic.title}</strong><span>${topic.tag} / ${topic.user}</span><p>${data.users.find((user) => user.username === topic.user)?.badge || 'Community member'}</p></div><b>${topic.replies} replies</b></article>`).join('')}</div></section>
      <section class="section-block"><div class="section-heading"><div><p class="eyebrow">Community standards</p><h2>Guidelines that keep deals useful</h2></div></div><div class="trust-strip">${stat('Verify price', '01', 'Post final cart price, shipping, coupon terms, and expiration context.')}${stat('Compare stores', '02', 'Mention warranty, return windows, and marketplace risk where relevant.')}${stat('Respect signal', '03', 'Vote on deal quality and report expired or misleading offers.')}</div></section>`);
    window.DealNestSEO?.jsonLd('dealnest-community-jsonld', {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'DealNest community discussions',
      itemListElement: data.communityTopics.slice(0, 8).map((topic, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'DiscussionForumPosting',
          headline: topic.title,
          author: { '@type': 'Person', name: topic.user },
          about: topic.tag,
          commentCount: topic.replies
        }
      }))
    });
  }

  function search() {
    const query = params.get('q') || params.get('filter') || '';
    const sort = params.get('sort') || 'trending';
    const results = Discovery.filterAndSort(data.deals, { query, sort, filters: new Set(), savedSet: saved });
    pageShell('Search results', 'Find faster', query ? `Ranked matches for "${query}" across title, store, category, coupon, shipping, description, and keywords.` : 'Showing all deals sorted by community heat, value, recency, and urgency.',
      `<section class="section-block"><div class="feed-toolbar"><div><p class="eyebrow">${results.length} matches</p><h2>Deals matching your intent</h2></div><div class="community-actions"><a class="text-link" href="./">Refine on homepage</a><a class="text-link" href="./search.html?sort=discount">Highest discount</a><a class="text-link" href="./search.html?sort=comments">Most discussed</a></div></div><div class="deal-grid">${results.map((deal) => dealCard(deal)).join('') || `<div class="empty-state">${Discovery.emptyStateHtml({ query }, data)}</div>`}</div></section>`);
  }

  async function savedPage() {
    if (remoteEnabled()) {
      const rows = await fetchRows(`saved_deals?select=deal_id,created_at&user_id=eq.${encodeURIComponent(Auth.currentUserId())}&order=created_at.desc`);
      rows.forEach((row) => {
        const deal = dealById(row.deal_id);
        if (deal) saved.add(deal.id);
      });
      persist('saved', saved);
    }
    const results = data.deals.filter((deal) => saved.has(deal.id));
    pageShell('Saved deals', 'Your watchlist', remoteEnabled() ? 'These saves are synced to your DealNest account.' : 'Guest saves stay on this device. Create an account to sync saved deals across devices.',
      `<section class="section-block"><div class="feed-toolbar"><div><p class="eyebrow">${results.length} saved</p><h2>Deals you are watching</h2></div><div class="community-actions"><a class="text-link" href="./#hot-deals">Find more</a>${remoteEnabled() ? '' : '<button class="ghost-button" type="button" data-auth-action="signup">Sync saves</button>'}</div></div><div class="deal-grid">${results.map((deal) => dealCard(deal)).join('') || '<div class="empty-state"><strong>No saved deals yet</strong><p>Save deals from the homepage or detail pages to fill this view.</p></div>'}</div></section>`);
  }

  async function alerts() {
    const alertRows = remoteEnabled() ? await fetchAlertRows(Auth.currentUserId()) : [];
    const totalMatches = alertRows.reduce((sum, alert) => sum + (alert.is_active === false ? 0 : matchingDealsForAlert(alert).length), 0);
    const locked = !remoteEnabled() ? accessPanel('Sign in to create alerts', 'Guests can browse deals freely, but alert rules belong to your account so they can sync across devices.') : '';
    pageShell('Deal alerts', 'Watchlist builder', 'Build account-backed alert rules with keyword, category, store, max price, discount target, and notification options.',
      `${locked}<section class="alert-section section-block"><div class="alert-copy"><h2>Your next price drop radar.</h2><p>Build precise alert rules, preview matching public deals instantly, and keep delivery preferences ready for future notifications.</p><div class="trust-strip mini-stats">${stat('alerts', alertRows.length, 'Account-backed rules saved for this member.')}${stat('matches', totalMatches, 'Current public deals matching active alerts.')}</div></div><form class="alert-builder motion-item" id="alertForm" novalidate><input type="hidden" name="alertId"><label>Keyword<input name="keyword" value="gaming monitor" placeholder="monitor, coffee, backpack"></label><label>Category<select name="category"><option>Any category</option>${data.categories.map((category) => `<option>${category.name}</option>`).join('')}</select></label><label>Store<select name="store"><option>Any store</option>${data.stores.map((store) => `<option>${store.name}</option>`).join('')}</select></label><label>Max price<input name="price" inputmode="decimal" value="250"></label><label>Minimum discount %<input name="discount" inputmode="numeric" value="35"></label><div class="alert-checks"><label><input name="freeShipping" type="checkbox"> Free shipping</label><label><input name="couponAvailable" type="checkbox"> Coupon available</label><label><input name="expiringSoon" type="checkbox"> Expiring soon</label></div><div class="alert-channels"><button type="button" class="active" data-channel="Dashboard">Dashboard</button><button type="button" data-channel="Email">Email placeholder</button><button type="button" data-channel="Browser">Browser placeholder</button></div><div class="alert-form-actions"><button class="post-button" type="submit">${remoteEnabled() ? 'Save alert' : 'Sign in to save'}</button><button class="ghost-button" type="button" data-action="reset-alert-form">Reset</button></div><output id="alertOutput">Alert preview will appear here.</output></form></section><section class="section-block alert-preview-panel"><div class="section-heading"><div><p class="eyebrow">Live preview</p><h2>Matches before you save</h2></div></div><div id="alertPreviewResults"></div></section><section class="section-block alert-saved-panel"><div class="section-heading"><div><p class="eyebrow">Saved alerts</p><h2>Your active radar</h2></div></div><div id="savedAlertList"></div></section>`);
    renderAlertPreview();
    renderSavedAlerts(alertRows);
  }

  function renderAlertPreview(criteria = null) {
    const root = document.getElementById('alertPreviewResults');
    const form = document.getElementById('alertForm');
    if (!root || !form) return;
    const alert = criteria || alertCriteriaFromForm(form);
    const errors = alertValidation(alert);
    if (errors.length) {
      root.innerHTML = `<div class="empty-state"><strong>Alert needs a signal</strong><p>${errors.join(' ')}</p></div>`;
      return;
    }
    const matches = matchingDealsForAlert(alert).slice(0, 6);
    root.innerHTML = matches.length
      ? `<div class="alert-match-grid">${matches.map(({ deal, reasons }) => `<article class="alert-match-card"><img src="${deal.image}" alt=""><div><strong><a href="${deal.dealUrl}">${deal.title}</a></strong><span>${deal.store} / ${money(deal.currentPrice)} / ${deal.discount}% off</span><small>Matched by ${reasons.join(', ') || 'current alert rule'}</small></div><a class="deal-action outbound-action" href="${outboundLink(deal, 'alert-preview')}" data-outbound-link>Get deal -></a></article>`).join('')}</div>`
      : '<div class="empty-state"><strong>No current matches</strong><p>Try widening the price, discount, store, or keyword fields.</p></div>';
    window.DealNestMotion?.refresh();
  }

  function renderSavedAlerts(alertRows = []) {
    const root = document.getElementById('savedAlertList');
    if (!root) return;
    window.DealNestAlerts = alertRows;
    if (!remoteEnabled()) {
      root.innerHTML = '<div class="empty-state"><strong>Login required</strong><p>Alert rules are private account data. Sign in to create and manage them.</p></div>';
      return;
    }
    root.innerHTML = alertRows.length
      ? `<div class="saved-alert-list">${alertRows.map((alert) => {
        const matches = alert.is_active === false ? [] : matchingDealsForAlert(alert);
        const criteria = [
          alert.keyword ? `"${alert.keyword}"` : '',
          alertCategoryName(alert) !== 'Any category' ? alertCategoryName(alert) : '',
          alertStoreName(alert) !== 'Any store' ? alertStoreName(alert) : '',
          alert.max_price ? `under ${money(Number(alert.max_price))}` : '',
          alert.min_discount_percent ? `${alert.min_discount_percent}%+ off` : '',
          alert.require_free_shipping ? 'free shipping' : '',
          alert.require_coupon ? 'coupon' : '',
          alert.require_expiring_soon ? 'expiring soon' : ''
        ].filter(Boolean).join(' / ') || 'Any public deal';
        return `<article class="saved-alert-card" data-alert-id="${alert.id}"><div><span class="status-pill">${alert.is_active === false ? 'inactive' : 'active'}</span><strong>${criteria}</strong><p>${matches.length} matching public deal${matches.length === 1 ? '' : 's'} now.</p>${matches[0] ? `<small>Top match: ${matches[0].deal.title} / ${matches[0].reasons.join(', ')}</small>` : '<small>No current matches. We will keep watching.</small>'}</div><div class="alert-card-actions"><button type="button" data-action="edit-alert" data-id="${alert.id}">Edit</button><button type="button" data-action="toggle-alert" data-id="${alert.id}" data-active="${alert.is_active === false ? 'false' : 'true'}">${alert.is_active === false ? 'Activate' : 'Pause'}</button><button type="button" data-action="delete-alert" data-id="${alert.id}">Delete</button></div></article>`;
      }).join('')}</div>`
      : '<div class="empty-state"><strong>No saved alerts yet</strong><p>Create your first alert above to start watching current public deals.</p></div>';
  }

  function fillAlertForm(alert) {
    const form = document.getElementById('alertForm');
    if (!form || !alert) return;
    form.elements.alertId.value = alert.id || '';
    form.elements.keyword.value = alert.keyword || '';
    form.elements.category.value = alertCategoryName(alert);
    form.elements.store.value = alertStoreName(alert);
    form.elements.price.value = alert.max_price || '';
    form.elements.discount.value = alert.min_discount_percent || '';
    form.elements.freeShipping.checked = Boolean(alert.require_free_shipping);
    form.elements.couponAvailable.checked = Boolean(alert.require_coupon);
    form.elements.expiringSoon.checked = Boolean(alert.require_expiring_soon);
    form.querySelectorAll('[data-channel]').forEach((button) => {
      const name = button.dataset.channel;
      const active = name === 'Email' ? alert.notify_email : name === 'Browser' ? alert.notify_browser : alert.notify_dashboard !== false;
      button.classList.toggle('active', Boolean(active));
    });
    document.getElementById('alertOutput').textContent = 'Editing alert. Save to update this rule.';
    renderAlertPreview();
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function refreshAlerts() {
    if (!remoteEnabled() || page !== 'alerts') return;
    const rows = await fetchAlertRows(Auth.currentUserId());
    renderSavedAlerts(rows);
  }

  async function saveAlert(criteria) {
    const body = {
      user_id: Auth.currentUserId(),
      keyword: criteria.keyword || null,
      category_id: criteria.category === 'Any category' ? null : categoryId(criteria.category),
      store_id: criteria.store === 'Any store' ? null : storeId(criteria.store),
      max_price: criteria.max_price,
      min_discount_percent: criteria.min_discount_percent,
      notify_email: criteria.notify_email,
      notify_browser: criteria.notify_browser,
      notify_dashboard: criteria.notify_dashboard,
      is_active: criteria.is_active,
      require_free_shipping: criteria.require_free_shipping,
      require_coupon: criteria.require_coupon,
      require_expiring_soon: criteria.require_expiring_soon
    };
    const fallbackBody = { ...body };
    delete fallbackBody.require_free_shipping;
    delete fallbackBody.require_coupon;
    delete fallbackBody.require_expiring_soon;
    const method = criteria.id ? 'PATCH' : 'POST';
    const path = criteria.id ? `deal_alerts?id=eq.${encodeURIComponent(criteria.id)}&user_id=eq.${encodeURIComponent(Auth.currentUserId())}` : 'deal_alerts';
    try {
      return await Auth.rest(path, { method, body });
    } catch (error) {
      if (!/column|schema|require_/i.test(error.message)) throw error;
      return Auth.rest(path, { method, body: fallbackBody });
    }
  }

  function postDeal() {
    const locked = !remoteEnabled() ? accessPanel('Sign in to post a deal', 'Browsing stays open to everyone, but submissions require an account and go to moderation before they appear publicly.') : '';
    pageShell('Post a deal', 'Submission studio', 'Submit a clear, verifiable deal. New submissions are saved as pending and must be approved before public display.',
      `${locked}<section class="split-section post-workspace"><form class="section-block deal-form" id="postDealForm" novalidate><div class="section-heading"><div><p class="eyebrow">Submission details</p><h2>Build a moderator-ready deal</h2><p>Give reviewers the final price, source URL, product context, and image proof in one pass.</p></div></div><div class="form-grid"><label class="wide-field">Deal title<input name="title" placeholder="Example: 27-inch creator monitor with USB-C dock" required></label><label>Deal URL<input name="url" type="url" placeholder="https://example.com/deal" required></label><label>Store<select name="store" required><option value="">Choose store</option>${data.stores.map((store) => `<option value="${store.name}">${store.name}</option>`).join('')}</select></label><label>Category<select name="category" required><option value="">Choose category</option>${data.categories.map((category) => `<option value="${category.name}">${category.name}</option>`).join('')}</select></label><label>Current price<input name="price" inputmode="decimal" placeholder="229.00" required></label><label>Original price<input name="original" inputmode="decimal" placeholder="389.00" required></label><label>Discount %<input name="discount" inputmode="numeric" placeholder="Auto" readonly></label><label>Coupon code<input name="coupon" placeholder="Optional"></label><label>Shipping info<input name="shipping" placeholder="Free shipping, store pickup, or delivery terms"></label><label>Expiration date<input name="expires" type="date"></label><label class="wide-field">Short description<textarea name="description" rows="4" placeholder="What is the product, who is it for, and what makes this a strong deal?" required></textarea></label><label class="wide-field">Detailed instructions<textarea name="instructions" rows="4" placeholder="Add coupon steps, cart notes, membership requirements, rebate details, or checkout warnings."></textarea></label><div class="wide-field image-input-panel"><label>Upload product image<input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp"></label><span>JPG, PNG, or WebP up to 5 MB. Images are reviewed with the deal.</span></div><label class="wide-field">Or use image URL<input name="image" placeholder="./assets/img/deals/monitor.svg"></label></div><button class="post-button" type="submit">${remoteEnabled() ? 'Submit for review' : 'Sign in to submit'}</button><div class="form-errors" id="postErrors" aria-live="polite">Submissions are private until a moderator approves them.</div></form><aside class="section-block post-preview-panel"><div class="section-heading"><div><p class="eyebrow">Live preview</p><h2>Moderator preview</h2></div></div><div id="postPreview"></div><div class="review-note"><strong>Moderation promise</strong><p>Your submission stays pending until reviewed. You cannot self-publish it.</p></div></aside></section>`);
    renderPostPreview();
  }

  function renderPostPreview() {
    const form = document.getElementById('postDealForm');
    const preview = document.getElementById('postPreview');
    if (!form || !preview) return;
    const values = Object.fromEntries(new FormData(form).entries());
    const price = Number(values.price) || 0;
    const original = Number(values.original) || price;
    const discount = calculateDiscount(price, original);
    const discountInput = form.elements.discount;
    if (discountInput) discountInput.value = discount ? String(discount) : '';
    const file = form.elements.imageFile?.files?.[0];
    const image = file ? URL.createObjectURL(file) : normalizeImagePath(values.image);
    const store = values.store || data.stores[0]?.name || 'DealNest Store';
    const category = values.category || data.categories[0]?.name || 'Deals';
    preview.innerHTML = dealCard({
      id: 'preview-deal',
      title: values.title || 'Untitled deal',
      description: values.description || 'Add a helpful description.',
      image,
      currentPrice: price,
      originalPrice: original,
      discount,
      store,
      category,
      shipping: values.shipping || 'Shipping details required',
      postedTime: 'Preview',
      postedBy: 'you',
      heat: 0,
      votes: 0,
      comments: 0,
      couponCode: values.coupon,
      status: 'Draft',
      dealUrl: '#',
      tags: [category]
    });
  }

  function login() {
    const member = Auth?.user;
    pageShell('Member access', 'Account center', member ? `You are signed in as ${member.email}.` : 'Sign in or create an account for saved deals, alerts, voting, comments, and moderation roles.',
      `<section class="split-section"><article class="section-block access-panel"><div class="section-heading"><div><p class="eyebrow">${member ? 'Signed in' : 'Secure access'}</p><h2>${member ? 'Your account is active' : 'Open the member panel'}</h2></div></div><p>${member ? 'Use your dashboard for saved deals, submissions, comments, and alerts.' : 'Guest browsing remains open. Login is only required when you interact with member features.'}</p><div class="community-actions">${member ? '<a class="post-button link-button" href="./dashboard.html">Open dashboard</a><button class="ghost-button" type="button" data-auth-action="logout">Logout</button>' : '<button class="post-button" type="button" data-auth-action="login">Login</button><button class="ghost-button" type="button" data-auth-action="signup">Sign up</button>'}</div></article><aside class="section-block"><div class="trust-strip">${stat('saved deals', saved.size, 'Current browser watchlist.')}${stat('followed stores', followedStores.size, 'Local store follows today.')}${stat('protected actions', 6, 'Vote, comment, report, post, save, alert.')}</div></aside></section>`);
  }

  function games() {
    pageShell('Games archive', 'Maintenance classics', 'The previous games remain available as a secondary archive while DealNest becomes the main product.',
      `<section class="games-archive"><div><h2>Playable archive</h2><p>These pages are preserved and separated from the shopping flow.</p></div><div class="archive-links"><a href="./snake/">Snake</a><a href="./ludo/">Ludo Royale</a><a href="./sequence-play.html">Sequence</a></div></section>`);
  }

  function categoryDetail() {
    const name = params.get('name') || '';
    const category = data.categories.find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (!category) {
      pageShell('Category not found', 'Category page', 'The requested category does not exist in this dataset.', `<section class="section-block"><div class="empty-state"><strong>Unknown category</strong><p>Return to categories and choose another lane.</p></div></section>`);
      return;
    }
    const deals = Discovery.sortDeals(categoryDeals(category.name), 'trending');
    const top = deals[0];
    const stores = [...new Set(deals.map((deal) => deal.store))];
    pageShell(`${category.name} deals`, 'Category detail', `${category.description} Compare the best current offers, active stores, and community heat in this lane.`,
      `<section class="section-block"><div class="trust-strip">${stat('active deals', deals.length, 'Current offers in this category.')}${stat('top stores', stores.length, stores.slice(0, 4).join(', ') || 'New stores soon.')}${stat('best heat', top ? top.heat : 0, top ? top.title : 'No top deal yet.')}</div></section><section class="section-block"><div class="deal-grid">${deals.map((deal) => dealCard(deal)).join('') || '<div class="empty-state"><strong>No active deals</strong><p>Check back as the feed grows.</p></div>'}</div></section>`);
  }

  function storeDetail() {
    const name = params.get('name') || '';
    const store = data.stores.find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (!store) {
      pageShell('Store not found', 'Store profile', 'The requested store does not exist in this dataset.', `<section class="section-block"><div class="empty-state"><strong>Unknown store</strong><p>Return to stores and choose another listing.</p></div></section>`);
      return;
    }
    const deals = Discovery.sortDeals(data.deals.filter((deal) => deal.store === store.name), 'trending');
    const coupons = couponsForStore(store.name);
    pageShell(store.name, 'Store profile', `Track active deals, coupons, trust rating, followers, and category footprint for ${store.name}.`,
      `<section class="section-block"><div class="trust-strip">${stat('followers', compact(store.followers), 'Mock social proof for future follow flows.')}${stat('trust rating', store.rating, 'Community sentiment and moderation signal.')}${stat('coupons', coupons.length, coupons.map((coupon) => coupon.code).join(', ') || 'No codes today.')}</div></section><section class="split-section"><div class="section-block"><div class="section-heading"><div><p class="eyebrow">Active deals</p><h2>${deals.length} current offers</h2></div></div><div class="deal-grid">${deals.map((deal) => dealCard(deal)).join('') || '<div class="empty-state"><strong>No active deals</strong><p>This store will populate when new listings are added.</p></div>'}</div></div><aside class="section-block"><div class="section-heading"><div><p class="eyebrow">Store coupons</p><h2>Codes and terms</h2></div></div><div class="coupon-list">${coupons.map((coupon) => `<article class="coupon-card"><div><strong>${coupon.store}</strong><code>${coupon.code}</code></div><p>${coupon.description}</p><footer><small>${coupon.expires}</small><button class="copy-btn" type="button" data-action="copy" data-code="${coupon.code}">Copy</button></footer></article>`).join('') || '<div class="empty-state"><strong>No current coupons</strong><p>Follow this store for future codes.</p></div>'}</div></aside></section>`);
  }

  function adminDealStore(deal) {
    return deal.stores?.name || 'Unknown store';
  }

  function adminDealCategory(deal) {
    return deal.categories?.name || 'Uncategorized';
  }

  function adminReporter(report) {
    return report.profiles?.display_name || report.profiles?.username || 'Member';
  }

  function adminDate(value) {
    return value ? new Date(value).toLocaleString() : 'No timestamp';
  }

  function adminStatus(value) {
    return String(value || 'unknown').replace(/_/g, ' ');
  }

  async function fetchAdminData() {
    const [deals, reports, queue, clicks] = await Promise.all([
      Auth.rest('deals?select=id,slug,title,description,instructions,deal_url,image_url,status,moderation_status,current_price,original_price,discount_percent,shipping_info,coupon_code,posted_by,created_at,updated_at,stores(name),categories(name)&order=created_at.desc&limit=200'),
      Auth.rest('deal_reports?select=id,reason,details,status,created_at,deal_id,deals(title,slug,status,moderation_status)&order=created_at.desc&limit=100').catch(() => []),
      Auth.rest('moderation_queue?select=id,entity_type,entity_id,title,reason,priority,status,created_at,updated_at&order=created_at.desc&limit=100').catch(() => []),
      Auth.rest('click_events?select=id,deal_id,store_id,user_id,clicked_at,source_page,destination_host,deals(title,slug),stores(name)&order=clicked_at.desc&limit=100').catch(() => [])
    ]);
    return { deals, reports, queue, clicks };
  }

  function renderAdminStats(deals, reports, clicks = []) {
    const countDeals = (predicate) => deals.filter(predicate).length;
    return `
      <section class="section-block">
        <div class="trust-strip admin-stat-grid">
          ${stat('pending deals', countDeals((deal) => deal.status === 'pending' || deal.moderation_status === 'pending'), 'Waiting for moderator review.')}
          ${stat('open reports', reports.filter((report) => report.status === 'open' || report.status === 'reviewing').length, 'Community flags needing attention.')}
          ${stat('approved deals', countDeals((deal) => deal.moderation_status === 'approved' && ['live', 'expiring_soon'].includes(deal.status)), 'Visible in the public feed.')}
          ${stat('rejected deals', countDeals((deal) => deal.moderation_status === 'rejected'), 'Not visible publicly.')}
          ${stat('hidden deals', countDeals((deal) => deal.status === 'hidden'), 'Removed from public surfaces.')}
          ${stat('tracked clicks', clicks.length, 'Recent outbound click events visible to moderators.')}
        </div>
      </section>
    `;
  }

  function renderAdminAnalytics(clicks = []) {
    const root = document.getElementById('adminAnalytics');
    if (!root) return;
    const countBy = (keyFn) => clicks.reduce((map, click) => {
      const key = keyFn(click) || 'Unknown';
      map.set(key, (map.get(key) || 0) + 1);
      return map;
    }, new Map());
    const topDeals = [...countBy((click) => click.deals?.title || click.deal_id).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topStores = [...countBy((click) => click.stores?.name || click.destination_host).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    root.innerHTML = `
      <div class="admin-toolbar">
        <div>
          <p class="eyebrow">Outbound analytics</p>
          <h2>Affiliate-ready click signal</h2>
          <p class="admin-subcopy">Privacy-safe click events only. Raw analytics are readable by admin and moderator roles through RLS.</p>
        </div>
      </div>
      ${clicks.length ? `
        <div class="analytics-grid">
          <article class="analytics-card"><h3>Top clicked deals</h3>${topDeals.map(([name, count]) => `<p><span>${name}</span><strong>${count}</strong></p>`).join('')}</article>
          <article class="analytics-card"><h3>Top stores</h3>${topStores.map(([name, count]) => `<p><span>${name}</span><strong>${count}</strong></p>`).join('')}</article>
          <article class="analytics-card wide-analytics-card"><h3>Recent events</h3>${clicks.slice(0, 8).map((click) => `<p><span>${click.deals?.title || click.deal_id} / ${click.source_page || 'site'} / ${click.destination_host || 'unknown host'}</span><strong>${adminDate(click.clicked_at)}</strong></p>`).join('')}</article>
        </div>
      ` : '<div class="empty-state"><strong>No click analytics yet</strong><p>Run the click tracking migration, then click a Get Deal button to populate this admin-only preview.</p></div>'}
    `;
  }

  function renderAdminDealRow(deal) {
    const needsReview = deal.status === 'pending' || deal.moderation_status === 'pending';
    const submitter = deal.posted_by ? `${deal.posted_by.slice(0, 8)}...` : 'Seed or system';
    return `
      <article class="admin-row admin-review-row motion-item" data-admin-status="${deal.status}" data-admin-moderation="${deal.moderation_status}">
        <a class="admin-thumb" href="${deal.image_url || './assets/img/deals/monitor.svg'}" target="_blank" rel="noopener" aria-label="Open submitted image">
          <img src="${deal.image_url || './assets/img/deals/monitor.svg'}" alt="">
        </a>
        <div>
          <strong>${deal.title}</strong>
          <span>${adminDealStore(deal)} / ${adminDealCategory(deal)} / ${money(Number(deal.current_price || 0))} <del>${deal.original_price ? money(Number(deal.original_price)) : ''}</del> / ${deal.discount_percent || 0}% off</span>
          <small>Submitter ${submitter} / ${deal.shipping_info || 'No shipping note'} / ${deal.coupon_code || 'No coupon'}</small>
          <small>${deal.description || 'No description'} ${deal.instructions ? `/ ${deal.instructions}` : ''}</small>
          ${deal.deal_url ? `<a class="text-link" href="${deal.deal_url}" target="_blank" rel="noopener">Open submitted URL</a>` : ''}
        </div>
        <div class="admin-badges">
          <b>${adminStatus(deal.status)}</b>
          <b>${adminStatus(deal.moderation_status)}</b>
        </div>
        <div class="admin-actions">
          <button type="button" data-admin-action="approve-deal" data-id="${deal.id}" ${needsReview ? '' : 'disabled'}>Approve</button>
          <button type="button" data-admin-action="reject-deal" data-id="${deal.id}">Reject</button>
          <button type="button" data-admin-action="expire-deal" data-id="${deal.id}">Expire</button>
          <button type="button" data-admin-action="hide-deal" data-id="${deal.id}">Hide</button>
        </div>
      </article>
    `;
  }

  function renderAdminReportRow(report) {
    return `
      <article class="admin-row motion-item" data-admin-status="${report.status}">
        <div>
          <strong>${report.deals?.title || 'Reported deal'}</strong>
          <span>${report.reason} / reported by ${adminReporter(report)}</span>
          <small>${report.details || 'No extra details'} / ${adminDate(report.created_at)}</small>
        </div>
        <div class="admin-badges">
          <b>${adminStatus(report.status)}</b>
          <b>report</b>
        </div>
        <div class="admin-actions">
          <button type="button" data-admin-action="review-report" data-id="${report.id}">Reviewing</button>
          <button type="button" data-admin-action="resolve-report" data-id="${report.id}">Resolve</button>
          <button type="button" data-admin-action="dismiss-report" data-id="${report.id}">Dismiss</button>
        </div>
      </article>
    `;
  }

  function renderAdminQueueRow(item) {
    return `
      <article class="admin-row motion-item" data-admin-status="${item.status}" data-admin-priority="${item.priority}">
        <div>
          <strong>${item.title}</strong>
          <span>${item.entity_type} / ${item.priority} priority / ${adminStatus(item.status)}</span>
          <small>${item.reason || 'No note'} / ${adminDate(item.created_at)}</small>
        </div>
        <div class="admin-badges">
          <b>${item.priority}</b>
          <b>${adminStatus(item.status)}</b>
        </div>
        <div class="admin-actions">
          <button type="button" data-admin-action="queue-reviewing" data-id="${item.id}">Reviewing</button>
          <button type="button" data-admin-action="queue-resolved" data-id="${item.id}">Resolve</button>
          <button type="button" data-admin-action="queue-dismissed" data-id="${item.id}">Dismiss</button>
        </div>
      </article>
    `;
  }

  function renderAdminWorkspace(deals, reports, queue, activeFilter = 'pending') {
    const pendingDeals = deals.filter((deal) => deal.status === 'pending' || deal.moderation_status === 'pending');
    const rejectedDeals = deals.filter((deal) => deal.moderation_status === 'rejected');
    const hiddenDeals = deals.filter((deal) => deal.status === 'hidden');
    const expiredDeals = deals.filter((deal) => deal.status === 'expired');
    const reported = reports.filter((report) => report.status !== 'resolved' && report.status !== 'dismissed');
    const groups = {
      pending: pendingDeals,
      reported,
      rejected: rejectedDeals,
      hidden: hiddenDeals,
      expired: expiredDeals,
      queue
    };
    const activeItems = groups[activeFilter] || pendingDeals;
    const renderMap = {
      reported: renderAdminReportRow,
      queue: renderAdminQueueRow
    };
    const rowRenderer = renderMap[activeFilter] || renderAdminDealRow;
    document.getElementById('adminWorkspace').innerHTML = `
      <div class="admin-toolbar">
        <div>
          <p class="eyebrow">Moderation queue</p>
          <h2>${activeFilter.replace(/\b\w/g, (letter) => letter.toUpperCase())}</h2>
        </div>
        <div class="chip-list admin-filters">
          ${Object.keys(groups).map((key) => `<button type="button" class="${key === activeFilter ? 'active' : ''}" data-admin-filter="${key}">${key} <span>${groups[key].length}</span></button>`).join('')}
        </div>
      </div>
      <div class="admin-list">
        ${activeItems.map(rowRenderer).join('') || '<div class="empty-state"><strong>No moderation items here</strong><p>Switch filters or wait for new submissions and reports.</p></div>'}
      </div>
    `;
    window.DealNestMotion?.refresh();
  }

  async function writeModerationAction(action, entityType, entityId, note) {
    await Auth.rest('moderation_actions', {
      method: 'POST',
      body: {
        moderator_id: Auth.currentUserId(),
        action,
        notes: `${entityType}:${entityId}${note ? ` / ${note}` : ''}`
      }
    }).catch(() => {});
  }

  async function dashboard() {
    if (!remoteEnabled()) {
      pageShell('Dashboard', 'Member workspace', 'Dashboard data belongs to signed-in members.', accessPanel('Sign in to open your dashboard', 'Guests can browse the full public site, but saved account data and submissions need login.'));
      return;
    }
    const userId = Auth.currentUserId();
    const [savedRows, postedRows, commentRows, alertRows] = await Promise.all([
      fetchRows(`saved_deals?select=deal_id,created_at&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`),
      fetchRows(`deals?select=id,slug,title,status,moderation_status,image_url,current_price,original_price,discount_percent,created_at,updated_at&posted_by=eq.${encodeURIComponent(userId)}&order=created_at.desc`),
      fetchRows(`deal_comments?select=id,body,created_at,deal_id&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`),
      fetchAlertRows(userId)
    ]);
    const savedDeals = savedRows.map((row) => dealById(row.deal_id)).filter(Boolean);
    const memberName = Auth.user?.user_metadata?.display_name || Auth.user?.email?.split('@')[0] || 'DealNest member';
    const postedCount = (status, moderation) => postedRows.filter((deal) => (!status || deal.status === status) && (!moderation || deal.moderation_status === moderation)).length;
    const activeAlertRows = alertRows.filter((alert) => alert.is_active !== false);
    const alertMatches = activeAlertRows.flatMap((alert) => matchingDealsForAlert(alert).slice(0, 3).map((match) => ({ alert, ...match })));
    pageShell('Your dashboard', 'Member workspace', 'A private hub for your saved deals, posted deals, comments, alerts, and account profile.',
      `<section class="section-block"><div class="trust-strip">${stat('saved', savedDeals.length, 'Deals synced to your account.')}${stat('pending', postedCount('pending', 'pending'), 'Waiting for moderator review.')}${stat('approved', postedRows.filter((deal) => deal.moderation_status === 'approved').length, 'Approved or previously approved submissions.')}${stat('alerts', activeAlertRows.length, 'Active account alert rules.')}${stat('matches', alertMatches.length, 'Recent in-app alert matches.')}</div></section><section class="dashboard-grid"><article class="dashboard-card"><h3>Profile</h3><div class="profile-line"><strong>${memberName}</strong><span>${Auth.user?.email || ''}</span></div><a class="deal-action" href="./post-deal.html">Post a deal</a><a class="ghost-button link-button" href="./alerts.html">Manage alerts</a></article><article class="dashboard-card"><h3>Saved deals</h3><div class="dashboard-list">${savedDeals.map((deal) => `<article><strong><a href="${deal.dealUrl}">${deal.title}</a></strong><span>${deal.store} / ${money(deal.currentPrice)}</span></article>`).join('') || '<p>No account saves yet.</p>'}</div></article><article class="dashboard-card wide-dashboard-card"><h3>Recent alert matches</h3><div class="dashboard-list alert-dashboard-list">${alertMatches.slice(0, 8).map(({ alert, deal, reasons }) => `<article><img src="${deal.image}" alt=""><div><strong><a href="${deal.dealUrl}">${deal.title}</a></strong><span>${deal.store} / ${money(deal.currentPrice)} / ${deal.discount}% off</span><small>${alert.keyword || alertCategoryName(alert) || 'Alert'} matched by ${reasons.join(', ') || 'current rule'}</small></div><a class="deal-action outbound-action" href="${outboundLink(deal, 'dashboard-alert')}" data-outbound-link>Get deal -></a></article>`).join('') || '<p>No alert matches yet. Create or broaden an alert to see matches here.</p>'}</div></article><article class="dashboard-card wide-dashboard-card"><h3>Submitted deals</h3><div class="dashboard-list submitted-list">${postedRows.map((deal) => `<article><img src="${deal.image_url || './assets/img/deals/monitor.svg'}" alt=""><div><strong>${deal.title}</strong><span class="status-pill">${deal.status} / ${deal.moderation_status}</span><span>${money(Number(deal.current_price || 0))}${deal.original_price ? ` from ${money(Number(deal.original_price))}` : ''} / ${deal.discount_percent || 0}% off</span><small>Submitted ${adminDate(deal.created_at)} / updated ${adminDate(deal.updated_at)}</small></div></article>`).join('') || '<p>No submissions yet.</p>'}</div></article><article class="dashboard-card"><h3>Comments</h3><div class="dashboard-list">${commentRows.slice(0, 6).map((comment) => `<article><strong>${new Date(comment.created_at).toLocaleDateString()}</strong><p>${comment.body}</p></article>`).join('') || '<p>No comments yet.</p>'}</div></article><article class="dashboard-card"><h3>Deal alerts</h3><div class="dashboard-list">${alertRows.map((alert) => `<article><strong>${alert.keyword || alertCategoryName(alert)}</strong><span>${alertStoreName(alert)} / ${alert.max_price ? `under ${money(Number(alert.max_price))}` : 'any price'} / ${alert.min_discount_percent || 0}%+ off</span><small>${matchingDealsForAlert(alert).length} current matches / ${alert.is_active === false ? 'paused' : 'active'}</small></article>`).join('') || '<p>No alerts yet.</p>'}</div></article></section>`);
  }

  async function admin() {
    if (!Auth?.user) {
      pageShell('Moderation console', 'Admin structure', 'Admin and moderator tools require member authentication.', accessPanel('Sign in for moderation access', 'Normal browsing remains public. Admin pages are protected.'));
      return;
    }
    const roles = await Auth.getRoles().catch(() => []);
    if (!roles.includes('admin') && !roles.includes('moderator')) {
      pageShell('Access denied', 'Admin structure', 'Your account is signed in, but it does not have moderator or admin permissions.',
        `<section class="section-block"><div class="access-panel"><p class="eyebrow">Protected area</p><h2>Moderator role required</h2><p>Only admin and moderator accounts can access the moderation queue.</p><a class="deal-action" href="./">Return home</a></div></section>`);
      return;
    }
    pageShell('Moderation console', 'Admin structure', 'Review pending deals, reported content, and queue items with role-gated Supabase actions protected by RLS.',
      `<section class="section-block"><div class="admin-loading" id="adminLoading"><strong>Loading moderation workspace...</strong><p>Only admin and moderator roles can read this data.</p></div></section>`);
    try {
      const adminData = await fetchAdminData();
      document.getElementById('pageContent').innerHTML = `
        <section class="page-hero section-block motion-item">
          <p class="eyebrow">Role verified</p>
          <h1>Moderation console</h1>
          <p>Approve pending submissions, triage reports, hide unsafe deals, expire stale offers, and leave moderation notes.</p>
        </section>
        ${renderAdminStats(adminData.deals, adminData.reports, adminData.clicks)}
        <section class="section-block admin-panel" id="adminWorkspace"></section>
        <section class="section-block admin-panel" id="adminAnalytics"></section>
        <section class="section-block admin-note">
          <p><strong>Security model:</strong> this page uses the browser anon key plus the signed-in moderator/admin session. RLS decides what can be read or changed.</p>
        </section>
      `;
      window.DealNestAdmin = { ...adminData, filter: 'pending' };
      renderAdminWorkspace(adminData.deals, adminData.reports, adminData.queue, 'pending');
      renderAdminAnalytics(adminData.clicks);
    } catch (error) {
      document.getElementById('pageContent').innerHTML = `
        <section class="page-hero section-block motion-item">
          <p class="eyebrow">Moderation console</p>
          <h1>Unable to load admin data</h1>
          <p>${error.message}</p>
        </section>
        <section class="section-block"><div class="access-panel"><h2>Check role and RLS policies</h2><p>Your account must have a row in <code>user_roles</code> with role <code>admin</code> or <code>moderator</code>.</p></div></section>
      `;
    }
  }

  const renderers = { categories, stores, coupons, community, search, saved: savedPage, alerts, post: postDeal, login, games, category: categoryDetail, store: storeDetail, dashboard, admin };
  await renderers[page]?.();

  document.body.addEventListener('input', (event) => {
    if (event.target.closest('#postDealForm')) renderPostPreview();
    if (event.target.closest('#alertForm')) renderAlertPreview();
  });

  document.body.addEventListener('submit', async (event) => {
    if (event.target.id === 'postDealForm') {
      event.preventDefault();
      if (!requireMember('post-deal', 'Sign in to submit deals for moderation.')) return;
      const form = event.target;
      const submitButton = form.querySelector('button[type="submit"]');
      const values = Object.fromEntries(new FormData(form).entries());
      const file = form.elements.imageFile?.files?.[0];
      const price = Number(values.price);
      const original = Number(values.original);
      const discount = calculateDiscount(price, original);
      const errors = [];
      const title = String(values.title || '').trim();
      const description = String(values.description || '').trim();
      const instructions = String(values.instructions || '').trim();
      const shipping = String(values.shipping || '').trim();
      let parsedUrl = null;
      try {
        parsedUrl = new URL(values.url);
      } catch (error) {
        parsedUrl = null;
      }
      if (!title || title.length < 12) errors.push('Use a clearer title with at least 12 characters.');
      if (!parsedUrl || !/^https?:$/i.test(parsedUrl.protocol)) errors.push('Add a valid deal URL beginning with http or https.');
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(original) || original <= 0) errors.push('Add valid current and original prices.');
      if (Number.isFinite(price) && Number.isFinite(original) && price >= original) errors.push('Current price should be lower than original price.');
      if (!categoryId(values.category) || !storeId(values.store)) errors.push('Choose a valid store and category from the list.');
      if (description.length < 20) errors.push('Add a short description with at least 20 characters.');
      if (!shipping) errors.push('Add shipping or pickup information.');
      const fileError = validateDealImage(file);
      if (fileError) errors.push(fileError);
      const output = document.getElementById('postErrors');
      if (errors.length) {
        output.textContent = errors.join(' ');
        toast('Fix highlighted deal details');
        return;
      }
      output.textContent = 'Submitting for review...';
      submitButton.disabled = true;
      submitButton.textContent = 'Submitting...';
      try {
        const createdRows = await Auth.rest('deals?select=id,slug,status,moderation_status', {
          method: 'POST',
          body: {
            slug: `${slugify(title)}-${Date.now().toString(36)}`,
            title,
            description,
            instructions,
            deal_url: parsedUrl.href,
            image_url: normalizeImagePath(values.image),
            current_price: price,
            original_price: original,
            discount_percent: discount,
            store_id: storeId(values.store),
            category_id: categoryId(values.category),
            posted_by: Auth.currentUserId(),
            shipping_info: shipping,
            coupon_code: values.coupon || null,
            expires_at: values.expires ? new Date(values.expires).toISOString() : null,
            status: 'pending',
            moderation_status: 'pending',
            tags: [values.category, values.store].filter(Boolean)
          }
        });
        const created = createdRows?.[0];
        let uploadedUrl = '';
        if (file && created?.id && Auth.uploadFile) {
          output.textContent = 'Uploading image...';
          const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
          const path = `${Auth.currentUserId()}/${created.id}/${Date.now()}-${safeFileName(file.name)}.${extension}`;
          const upload = await Auth.uploadFile('deal-images', path, file, { upsert: false });
          uploadedUrl = upload.publicUrl;
          await Auth.rest(`deals?id=eq.${encodeURIComponent(created.id)}`, {
            method: 'PATCH',
            body: {
              image_url: uploadedUrl,
              status: 'pending',
              moderation_status: 'pending'
            }
          });
          await Auth.rest('deal_images', {
            method: 'POST',
            body: {
              deal_id: created.id,
              image_url: uploadedUrl,
              alt_text: title,
              sort_order: 0
            }
          }).catch(() => {});
        }
        output.textContent = 'Your deal was submitted for review.';
        toast('Deal submitted for review');
        form.reset();
        renderPostPreview();
        if (uploadedUrl) output.textContent = 'Your deal and image were submitted for review.';
      } catch (error) {
        output.textContent = error.message;
        toast('Submission could not be saved');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit for review';
      }
    }
    if (event.target.id === 'alertForm') {
      event.preventDefault();
      if (!requireMember('deal-alert', 'Sign in to create account-backed deal alerts.')) return;
      const form = event.target;
      const criteria = alertCriteriaFromForm(form);
      const output = document.getElementById('alertOutput');
      const submitButton = form.querySelector('button[type="submit"]');
      const errors = alertValidation(criteria);
      if (errors.length) {
        output.textContent = errors.join(' ');
        toast('Alert needs a clearer rule');
        renderAlertPreview(criteria);
        return;
      }
      output.textContent = criteria.id ? 'Updating alert...' : 'Saving alert...';
      submitButton.disabled = true;
      submitButton.textContent = criteria.id ? 'Updating...' : 'Saving...';
      try {
        await saveAlert(criteria);
        const count = matchingDealsForAlert(criteria).length;
        output.textContent = `${criteria.keyword || 'Alert'} saved. ${count} current public deal${count === 1 ? '' : 's'} match.`;
        toast(criteria.id ? 'Alert updated' : 'Alert saved');
        form.reset();
        form.elements.alertId.value = '';
        form.querySelector('[data-channel="Dashboard"]')?.classList.add('active');
        renderAlertPreview();
        await refreshAlerts();
      } catch (error) {
        output.textContent = error.message;
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Save alert';
      }
    }
  });

  document.body.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action], [data-placeholder], [data-coupon-filter], [data-channel]');
    if (!target) return;
    const { action, code, placeholder, couponFilter, store, channel } = target.dataset;
    if (placeholder) toast(placeholder);
    if (channel) {
      target.classList.toggle('active');
      toast(`${channel} notification ${target.classList.contains('active') ? 'enabled' : 'disabled'} in preview`);
    }
    if (couponFilter) {
      document.querySelectorAll('[data-coupon-filter]').forEach((button) => button.classList.toggle('active', button === target));
      renderCouponResults();
    }
    if (action === 'copy') navigator.clipboard?.writeText(code).then(() => toast(`Copied ${code}`)).catch(() => toast(`Coupon: ${code}`));
    if (action === 'save') toggleAccountSave(target.dataset.id, target);
    if (action === 'reset-alert-form') {
      const form = document.getElementById('alertForm');
      form?.reset();
      if (form?.elements.alertId) form.elements.alertId.value = '';
      form?.querySelector('[data-channel="Dashboard"]')?.classList.add('active');
      document.getElementById('alertOutput').textContent = 'Alert preview will appear here.';
      renderAlertPreview();
    }
    if (action === 'edit-alert') {
      const alert = (window.DealNestAlerts || []).find((item) => item.id === target.dataset.id);
      fillAlertForm(alert);
    }
    if (action === 'toggle-alert') {
      if (!requireMember('deal-alert', 'Sign in to manage account-backed deal alerts.')) return;
      target.disabled = true;
      Auth.rest(`deal_alerts?id=eq.${encodeURIComponent(target.dataset.id)}&user_id=eq.${encodeURIComponent(Auth.currentUserId())}`, {
        method: 'PATCH',
        body: { is_active: target.dataset.active !== 'true' }
      }).then(() => {
        toast(target.dataset.active === 'true' ? 'Alert paused' : 'Alert activated');
        refreshAlerts();
      }).catch((error) => toast(error.message)).finally(() => { target.disabled = false; });
    }
    if (action === 'delete-alert') {
      if (!requireMember('deal-alert', 'Sign in to manage account-backed deal alerts.')) return;
      if (!window.confirm('Delete this deal alert?')) return;
      target.disabled = true;
      Auth.rest(`deal_alerts?id=eq.${encodeURIComponent(target.dataset.id)}&user_id=eq.${encodeURIComponent(Auth.currentUserId())}`, {
        method: 'DELETE',
        prefer: 'return=minimal'
      }).then(() => {
        toast('Alert deleted');
        refreshAlerts();
      }).catch((error) => toast(error.message)).finally(() => { target.disabled = false; });
    }
    if (action === 'follow-store') {
      if (followedStores.has(store)) {
        followedStores.delete(store);
        toast(`Unfollowed ${store}`);
      } else {
        followedStores.add(store);
        toast(`Following ${store}`);
      }
      persist('followedStores', followedStores);
      target.classList.toggle('saved', followedStores.has(store));
      target.textContent = followedStores.has(store) ? 'Following' : 'Follow store';
    }
  });

  document.body.addEventListener('click', async (event) => {
    const filterButton = event.target.closest('[data-admin-filter]');
    if (filterButton && window.DealNestAdmin) {
      window.DealNestAdmin.filter = filterButton.dataset.adminFilter;
      renderAdminWorkspace(window.DealNestAdmin.deals, window.DealNestAdmin.reports, window.DealNestAdmin.queue, window.DealNestAdmin.filter);
      return;
    }

    const button = event.target.closest('[data-admin-action]');
    if (!button || !window.DealNestAdmin) return;
    if (!Auth?.user) {
      Auth?.openAuth({ mode: 'login', message: 'Sign in with an admin or moderator account to use moderation actions.' });
      return;
    }
    const roles = await Auth.getRoles().catch(() => []);
    if (!roles.includes('admin') && !roles.includes('moderator')) {
      toast('Moderator role required');
      return;
    }

    const action = button.dataset.adminAction;
    const id = button.dataset.id;
    const risky = ['reject-deal', 'hide-deal', 'expire-deal'].includes(action);
    const note = window.prompt('Add a moderation note or reason:', action.replace(/-/g, ' '));
    if (note === null) return;
    if (risky && !window.confirm(`Confirm ${action.replace(/-/g, ' ')}? This item will not appear in the public feed.`)) return;

    button.disabled = true;
    button.textContent = 'Saving...';
    try {
      if (action === 'approve-deal') {
        await Auth.rest(`deals?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: { status: 'live', moderation_status: 'approved' }
        });
        await writeModerationAction('approve_deal', 'deal', id, note);
        toast('Deal approved');
      }
      if (action === 'reject-deal') {
        await Auth.rest(`deals?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: { moderation_status: 'rejected', status: 'rejected' }
        });
        await writeModerationAction('reject_deal', 'deal', id, note);
        toast('Deal rejected');
      }
      if (action === 'hide-deal') {
        await Auth.rest(`deals?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: { status: 'hidden' }
        });
        await writeModerationAction('hide_deal', 'deal', id, note);
        toast('Deal hidden');
      }
      if (action === 'expire-deal') {
        await Auth.rest(`deals?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: { status: 'expired' }
        });
        await writeModerationAction('expire_deal', 'deal', id, note);
        toast('Deal marked expired');
      }
      if (action === 'review-report' || action === 'resolve-report' || action === 'dismiss-report') {
        const nextStatus = action === 'review-report' ? 'reviewing' : action === 'resolve-report' ? 'resolved' : 'dismissed';
        await Auth.rest(`deal_reports?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: { status: nextStatus }
        });
        await writeModerationAction(action.replace(/-/g, '_'), 'report', id, note);
        toast(`Report ${nextStatus}`);
      }
      if (action.startsWith('queue-')) {
        const nextStatus = action.replace('queue-', '');
        await Auth.rest(`moderation_queue?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: { status: nextStatus }
        });
        await writeModerationAction(action.replace(/-/g, '_'), 'queue', id, note);
        toast(`Queue item ${nextStatus}`);
      }
      const refreshed = await fetchAdminData();
      window.DealNestAdmin = { ...refreshed, filter: window.DealNestAdmin.filter };
      document.querySelector('.admin-stat-grid')?.closest('.section-block')?.remove();
      document.querySelector('.page-hero')?.insertAdjacentHTML('afterend', renderAdminStats(refreshed.deals, refreshed.reports, refreshed.clicks));
      renderAdminWorkspace(refreshed.deals, refreshed.reports, refreshed.queue, window.DealNestAdmin.filter);
      renderAdminAnalytics(refreshed.clicks);
    } catch (error) {
      toast(error.message);
      button.disabled = false;
      button.textContent = action.replace(/-/g, ' ');
    }
  });

  document.body.addEventListener('change', (event) => {
    if (event.target.id === 'couponStoreFilter') renderCouponResults();
    if (event.target.closest('#alertForm')) renderAlertPreview();
  });

  const menuToggle = document.getElementById('menuToggle');
  const primaryNav = document.getElementById('primaryNav');
  menuToggle?.addEventListener('click', () => {
    const header = document.querySelector('.market-header');
    const open = header.classList.toggle('menu-open');
    document.body.classList.toggle('menu-active', open);
    menuToggle.setAttribute('aria-expanded', String(open));
  });
  primaryNav?.addEventListener('click', () => {
    document.querySelector('.market-header').classList.remove('menu-open');
    document.body.classList.remove('menu-active');
    menuToggle.setAttribute('aria-expanded', 'false');
  });
}());
