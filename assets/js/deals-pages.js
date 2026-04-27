(async function () {
  await Promise.all([window.DealNestDataReady, window.DealNestAuthReady].filter(Boolean));
  const data = window.DealScoutData;
  const Auth = window.DealNestAuth;
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
        const top = [...deals].sort((a, b) => b.heat - a.heat)[0];
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
  }

  function search() {
    const query = (params.get('q') || params.get('filter') || '').toLowerCase();
    const sort = params.get('sort') || 'trending';
    const results = data.deals.filter((deal) => !query || [deal.title, deal.description, deal.store, deal.category, deal.shipping, deal.couponCode, ...deal.tags].join(' ').toLowerCase().includes(query));
    if (sort === 'new') results.reverse();
    if (sort === 'popular') results.sort((a, b) => b.comments + b.votes - (a.comments + a.votes));
    if (sort === 'expiring') results.sort((a, b) => Number(b.status === 'Expiring Soon') - Number(a.status === 'Expiring Soon') || b.heat - a.heat);
    if (sort === 'trending') results.sort((a, b) => b.heat - a.heat);
    pageShell('Search results', 'Find faster', query ? `Showing static MVP results for "${query}".` : 'Showing all deals sorted by community heat.',
      `<section class="section-block"><div class="feed-toolbar"><div><p class="eyebrow">${results.length} matches</p><h2>Deals matching your intent</h2></div><a class="text-link" href="./">Refine on homepage</a></div><div class="deal-grid">${results.map((deal) => dealCard(deal)).join('') || '<div class="empty-state"><strong>No matching deals yet</strong><p>Try another keyword from the homepage.</p></div>'}</div></section>`);
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

  function alerts() {
    const locked = !remoteEnabled() ? accessPanel('Sign in to create alerts', 'Guests can browse deals freely, but alert rules belong to your account so they can sync across devices.') : '';
    pageShell('Deal alerts', 'Watchlist builder', 'Build account-backed alert rules with keyword, category, store, max price, discount target, and notification options.',
      `<section class="alert-section section-block"><div class="alert-copy"><h2>Your next price drop radar.</h2><p>This static MVP validates alert UX before accounts and delivery channels are wired up.</p><div class="trust-strip mini-stats">${stat('keywords', data.trendingSearches.length, 'Popular searches can seed alerts.')}${stat('stores', data.stores.length, 'Store follows can become triggers.')}</div></div><form class="alert-builder motion-item" id="alertForm"><label>Keyword<input name="keyword" value="gaming monitor"></label><label>Category<select name="category">${data.categories.map((category) => `<option>${category.name}</option>`).join('')}</select></label><label>Store<select name="store"><option>Any store</option>${data.stores.map((store) => `<option>${store.name}</option>`).join('')}</select></label><label>Max price<input name="price" value="250"></label><label>Minimum discount %<input name="discount" value="35"></label><div><button type="button" data-channel="Email">Email</button><button type="button" data-channel="Browser">Browser</button><button type="button" data-channel="Dashboard">Dashboard</button></div><button class="post-button" type="submit">Preview alert</button><output id="alertOutput">Alert preview will appear here.</output></form></section>`);
    document.getElementById('pageContent').insertAdjacentHTML('beforeend', locked);
  }

  function postDeal() {
    const locked = !remoteEnabled() ? accessPanel('Sign in to post a deal', 'Browsing stays open to everyone, but submissions require an account and go to moderation before they appear publicly.') : '';
    pageShell('Post a deal', 'Submission studio', 'Submit a clear, verifiable deal. New submissions are saved as pending and must be approved before public display.',
      `${locked}<section class="split-section post-workspace"><form class="section-block deal-form" id="postDealForm" novalidate><div class="section-heading"><div><p class="eyebrow">Required details</p><h2>Submit a clear, verifiable deal</h2></div></div><div class="form-grid"><label>Deal title<input name="title" value="Example: Premium monitor bundle" required></label><label>Deal URL<input name="url" value="https://example.com/deal" required></label><label>Current price<input name="price" value="229" required></label><label>Original price<input name="original" value="389" required></label><label>Store<select name="store">${data.stores.map((store) => `<option value="${store.name}">${store.name}</option>`).join('')}</select></label><label>Category<select name="category">${data.categories.map((category) => `<option value="${category.name}">${category.name}</option>`).join('')}</select></label><label>Coupon code<input name="coupon" value="SAVE40"></label><label>Expiration date<input name="expires" type="date"></label><label class="wide-field">Image URL or upload placeholder<input name="image" value="./assets/img/deals/monitor.svg"></label><label class="wide-field">Description<textarea name="description" rows="5">Include final price, shipping notes, coupon terms, and why the deal is useful.</textarea></label></div><button class="post-button" type="submit">${remoteEnabled() ? 'Submit for review' : 'Sign in to submit'}</button><div class="form-errors" id="postErrors" aria-live="polite"></div></form><aside class="section-block"><div class="section-heading"><div><p class="eyebrow">Live preview</p><h2>Deal card preview</h2></div></div><div id="postPreview"></div></aside></section>`);
    renderPostPreview();
  }

  function renderPostPreview() {
    const form = document.getElementById('postDealForm');
    const preview = document.getElementById('postPreview');
    if (!form || !preview) return;
    const values = Object.fromEntries(new FormData(form).entries());
    const price = Number(values.price) || 0;
    const original = Number(values.original) || price;
    const discount = original > price ? Math.round((1 - price / original) * 100) : 0;
    preview.innerHTML = dealCard({
      id: 'preview-deal',
      title: values.title || 'Untitled deal',
      description: values.description || 'Add a helpful description.',
      image: values.image || './assets/img/deals/monitor.svg',
      currentPrice: price,
      originalPrice: original,
      discount,
      store: values.store,
      category: values.category,
      shipping: 'Shipping details required',
      postedTime: 'Preview',
      postedBy: 'you',
      heat: 0,
      votes: 0,
      comments: 0,
      couponCode: values.coupon,
      status: 'Draft',
      dealUrl: '#',
      tags: [values.category]
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
    const deals = categoryDeals(category.name);
    const top = [...deals].sort((a, b) => b.heat - a.heat)[0];
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
    const deals = data.deals.filter((deal) => deal.store === store.name);
    const coupons = couponsForStore(store.name);
    pageShell(store.name, 'Store profile', `Track active deals, coupons, trust rating, followers, and category footprint for ${store.name}.`,
      `<section class="section-block"><div class="trust-strip">${stat('followers', compact(store.followers), 'Mock social proof for future follow flows.')}${stat('trust rating', store.rating, 'Community sentiment and moderation signal.')}${stat('coupons', coupons.length, coupons.map((coupon) => coupon.code).join(', ') || 'No codes today.')}</div></section><section class="split-section"><div class="section-block"><div class="section-heading"><div><p class="eyebrow">Active deals</p><h2>${deals.length} current offers</h2></div></div><div class="deal-grid">${deals.map((deal) => dealCard(deal)).join('') || '<div class="empty-state"><strong>No active deals</strong><p>This store will populate when new listings are added.</p></div>'}</div></div><aside class="section-block"><div class="section-heading"><div><p class="eyebrow">Store coupons</p><h2>Codes and terms</h2></div></div><div class="coupon-list">${coupons.map((coupon) => `<article class="coupon-card"><div><strong>${coupon.store}</strong><code>${coupon.code}</code></div><p>${coupon.description}</p><footer><small>${coupon.expires}</small><button class="copy-btn" type="button" data-action="copy" data-code="${coupon.code}">Copy</button></footer></article>`).join('') || '<div class="empty-state"><strong>No current coupons</strong><p>Follow this store for future codes.</p></div>'}</div></aside></section>`);
  }

  async function dashboard() {
    if (!remoteEnabled()) {
      pageShell('Dashboard', 'Member workspace', 'Dashboard data belongs to signed-in members.', accessPanel('Sign in to open your dashboard', 'Guests can browse the full public site, but saved account data and submissions need login.'));
      return;
    }
    const userId = Auth.currentUserId();
    const [savedRows, postedRows, commentRows, alertRows] = await Promise.all([
      fetchRows(`saved_deals?select=deal_id,created_at&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`),
      fetchRows(`deals?select=id,slug,title,status,moderation_status,created_at&posted_by=eq.${encodeURIComponent(userId)}&order=created_at.desc`),
      fetchRows(`deal_comments?select=id,body,created_at,deal_id&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`),
      fetchRows(`deal_alerts?select=id,keyword,max_price,min_discount_percent,is_active,created_at&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`)
    ]);
    const savedDeals = savedRows.map((row) => dealById(row.deal_id)).filter(Boolean);
    const memberName = Auth.user?.user_metadata?.display_name || Auth.user?.email?.split('@')[0] || 'DealNest member';
    pageShell('Your dashboard', 'Member workspace', 'A private hub for your saved deals, posted deals, comments, alerts, and account profile.',
      `<section class="section-block"><div class="trust-strip">${stat('saved', savedDeals.length, 'Deals synced to your account.')}${stat('submitted', postedRows.length, 'Pending and reviewed submissions.')}${stat('alerts', alertRows.length, 'Account alert rules.')}</div></section><section class="dashboard-grid"><article class="dashboard-card"><h3>Profile</h3><div class="profile-line"><strong>${memberName}</strong><span>${Auth.user?.email || ''}</span></div><a class="deal-action" href="./post-deal.html">Post a deal</a></article><article class="dashboard-card"><h3>Saved deals</h3><div class="dashboard-list">${savedDeals.map((deal) => `<article><strong><a href="${deal.dealUrl}">${deal.title}</a></strong><span>${deal.store} / ${money(deal.currentPrice)}</span></article>`).join('') || '<p>No account saves yet.</p>'}</div></article><article class="dashboard-card"><h3>Posted deals</h3><div class="dashboard-list">${postedRows.map((deal) => `<article><strong>${deal.title}</strong><span class="status-pill">${deal.status} / ${deal.moderation_status}</span></article>`).join('') || '<p>No submissions yet.</p>'}</div></article><article class="dashboard-card"><h3>Comments</h3><div class="dashboard-list">${commentRows.slice(0, 6).map((comment) => `<article><strong>${new Date(comment.created_at).toLocaleDateString()}</strong><p>${comment.body}</p></article>`).join('') || '<p>No comments yet.</p>'}</div></article><article class="dashboard-card"><h3>Deal alerts</h3><div class="dashboard-list">${alertRows.map((alert) => `<article><strong>${alert.keyword || 'Any keyword'}</strong><span>Under ${alert.max_price ? money(Number(alert.max_price)) : 'any price'} / ${alert.min_discount_percent || 0}%+ off</span></article>`).join('') || '<p>No alerts yet.</p>'}</div></article></section>`);
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
    const pending = data.moderation || [];
    const reported = pending.filter((item) => /Reported|Expired|Community/.test(item.type));
    pageShell('Moderation console', 'Admin structure', 'A populated static console for reported deals, pending submissions, coupon checks, and community triage.',
      `<section class="section-block"><div class="trust-strip">${stat('queue items', pending.length, 'Mock work items ready for review.')}${stat('high priority', pending.filter((item) => item.severity === 'High').length, 'Needs attention first.')}${stat('reported', reported.length, 'Reports and flags from the community.')}</div></section><section class="split-section"><article class="section-block"><div class="section-heading"><div><p class="eyebrow">Moderation queue</p><h2>Review workload</h2></div></div><div class="editor-list">${pending.map((item) => `<article class="editor-item motion-item"><div class="queue-icon">${item.severity.slice(0, 1)}</div><div><h3>${item.title}</h3><p>${item.type} / ${item.owner} / ${item.status}</p></div><strong>${item.severity}</strong></article>`).join('')}</div></article><article class="section-block"><div class="section-heading"><div><p class="eyebrow">Reported deals</p><h2>Time-sensitive checks</h2></div></div><div class="editor-list">${data.deals.filter((deal) => deal.status === 'Expiring Soon').map((deal) => `<article class="editor-item motion-item"><img src="${deal.image}" alt="${deal.title}"><div><h3>${deal.title}</h3><p>${deal.store} / ${deal.expires} / ${deal.comments} comments</p></div><strong>${deal.heat} heat</strong></article>`).join('')}</div><div class="community-actions"><button type="button" data-placeholder="Approve workflow will connect to role auth later.">Approve selected</button><button type="button" data-placeholder="Escalation workflow will connect to backend later.">Escalate</button></div></article></section>`);
  }

  const renderers = { categories, stores, coupons, community, search, saved: savedPage, alerts, post: postDeal, login, games, category: categoryDetail, store: storeDetail, dashboard, admin };
  await renderers[page]?.();

  document.body.addEventListener('input', (event) => {
    if (event.target.closest('#postDealForm')) renderPostPreview();
  });

  document.body.addEventListener('submit', async (event) => {
    if (event.target.id === 'postDealForm') {
      event.preventDefault();
      if (!requireMember('post-deal', 'Sign in to submit deals for moderation.')) return;
      const values = Object.fromEntries(new FormData(event.target).entries());
      const errors = [];
      if (!values.title || values.title.length < 12) errors.push('Use a clearer title with at least 12 characters.');
      if (!/^https?:\/\//i.test(values.url || '')) errors.push('Add a valid deal URL beginning with http or https.');
      if (Number(values.price) <= 0 || Number(values.original) <= 0) errors.push('Add valid current and original prices.');
      if (Number(values.price) >= Number(values.original)) errors.push('Current price should be lower than original price.');
      if (!categoryId(values.category) || !storeId(values.store)) errors.push('Choose a valid store and category from the list.');
      const output = document.getElementById('postErrors');
      if (errors.length) {
        output.textContent = errors.join(' ');
        toast('Fix highlighted deal details');
        return;
      }
      output.textContent = 'Submitting for review...';
      const price = Number(values.price);
      const original = Number(values.original);
      const discount = Math.round((1 - price / original) * 100);
      try {
        await Auth.rest('deals', {
          method: 'POST',
          body: {
            slug: `${slugify(values.title)}-${Date.now().toString(36)}`,
            title: values.title,
            description: values.description,
            deal_url: values.url,
            image_url: values.image || './assets/img/deals/monitor.svg',
            current_price: price,
            original_price: original,
            discount_percent: discount,
            store_id: storeId(values.store),
            category_id: categoryId(values.category),
            posted_by: Auth.currentUserId(),
            shipping_info: 'Submitted by member',
            coupon_code: values.coupon || null,
            expires_at: values.expires ? new Date(values.expires).toISOString() : null,
            status: 'pending',
            moderation_status: 'pending',
            tags: [values.category, values.store].filter(Boolean)
          }
        });
        output.textContent = 'Your deal was submitted for review.';
        toast('Deal submitted for review');
      } catch (error) {
        output.textContent = error.message;
        toast('Submission could not be saved');
      }
    }
    if (event.target.id === 'alertForm') {
      event.preventDefault();
      if (!requireMember('deal-alert', 'Sign in to create account-backed deal alerts.')) return;
      const values = Object.fromEntries(new FormData(event.target).entries());
      const output = document.getElementById('alertOutput');
      output.textContent = 'Saving alert...';
      try {
        await Auth.rest('deal_alerts', {
          method: 'POST',
          body: {
            user_id: Auth.currentUserId(),
            keyword: values.keyword || null,
            category_id: categoryId(values.category),
            store_id: values.store === 'Any store' ? null : storeId(values.store),
            max_price: Number(values.price) || null,
            min_discount_percent: Number(values.discount) || null,
            notify_email: Boolean(document.querySelector('[data-channel="Email"]')?.classList.contains('active')),
            notify_browser: Boolean(document.querySelector('[data-channel="Browser"]')?.classList.contains('active')),
            notify_dashboard: true
          }
        });
        output.textContent = `${values.keyword} in ${values.category}, ${values.store}, under $${values.price}, ${values.discount}%+ off. Saved to your account.`;
        toast('Alert saved');
      } catch (error) {
        output.textContent = error.message;
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

  document.body.addEventListener('change', (event) => {
    if (event.target.id === 'couponStoreFilter') renderCouponResults();
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
