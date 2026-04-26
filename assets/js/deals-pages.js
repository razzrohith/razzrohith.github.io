(function () {
  const data = window.DealScoutData;
  const page = document.body.dataset.page;
  const params = new URLSearchParams(window.location.search);
  const saved = new Set(JSON.parse(localStorage.getItem('dealnest:saved') || '[]'));

  function money(value) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value % 1 === 0 ? 0 : 2 }).format(value);
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

  function dealCard(deal) {
    const tone = (data.categories.find((item) => item.name === deal.category)?.tone || 'mint').toLowerCase();
    return `
      <article class="deal-card tone-${tone} motion-item">
        <a class="deal-image" href="${deal.dealUrl}">
          <img src="${deal.image}" alt="${deal.title}" loading="lazy">
          <span class="discount-badge">${deal.discount}% off</span>
          <span class="status-badge">${deal.status}</span>
        </a>
        <div class="deal-body">
          <div class="deal-meta"><span><a href="./store.html?name=${encodeURIComponent(deal.store)}">${deal.store}</a></span><span class="category-badge"><a href="./category.html?name=${encodeURIComponent(deal.category)}">${deal.category}</a></span></div>
          <h3 class="deal-title"><a href="${deal.dealUrl}">${deal.title}</a></h3>
          <p class="deal-description">${deal.description}</p>
          <div class="price-row"><span class="price">${money(deal.currentPrice)}</span><span class="was-price">${money(deal.originalPrice)}</span></div>
          <div class="deal-actions single-action"><a class="deal-action" href="${deal.dealUrl}">View deal</a></div>
        </div>
      </article>
    `;
  }

  function shell(title, eyebrow, intro, body) {
    const root = document.getElementById('pageContent');
    root.innerHTML = `
      <section class="page-hero section-block motion-item">
        <p class="eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
        <p>${intro}</p>
      </section>
      ${body}
    `;
    window.DealNestMotion?.refresh();
  }

  function categories() {
    shell('Shop by category', 'Discovery map', 'Original category rooms with enough context to support future category landing pages.',
      `<section class="section-block"><div class="category-card-grid">${data.categories.map((category) => {
        const deals = data.deals.filter((deal) => deal.category === category.name);
        return `<a class="category-card tone-${category.tone} motion-item" href="./category.html?name=${encodeURIComponent(category.name)}"><span>${category.icon}</span><strong>${category.name}</strong><p>${category.description}</p><small>${deals.length} active deals</small></a>`;
      }).join('')}</div></section>`);
  }

  function stores() {
    shell('Store directory', 'Store watch', 'Follow-worthy mock stores with ratings, followers, active deal counts, and heat.',
      `<section class="store-section"><div class="store-grid">${data.stores.map((store) => {
        const deals = data.deals.filter((deal) => deal.store === store.name);
        return `<article class="store-card motion-item"><span>${store.initials}</span><h3><a href="./store.html?name=${encodeURIComponent(store.name)}">${store.name}</a></h3><p>${deals.length} active deals / ${store.followers.toLocaleString('en-US')} followers / ${store.rating} rating</p><button type="button" data-placeholder="Store follow rules will connect to accounts later.">Follow store</button><small>${deals.reduce((sum, deal) => sum + deal.heat, 0)} heat</small></article>`;
      }).join('')}</div></section>`);
  }

  function coupons() {
    shell('Coupon desk', 'Verified savings', 'A richer coupon surface with store labels, code copy, verification state, and expiration cues.',
      `<section class="section-block"><div class="coupon-list coupon-page-grid">${data.coupons.map((coupon) => `<article class="coupon-card motion-item"><div><strong>${coupon.store}</strong><code>${coupon.code}</code></div><p>${coupon.description}</p><footer><small>${coupon.verified ? 'Verified' : 'Community tested'} / ${coupon.expires}</small><button class="copy-btn" type="button" data-action="copy" data-code="${coupon.code}">Copy code</button></footer></article>`).join('')}</div></section>`);
  }

  function community() {
    shell('Community hub', 'Discussion layer', 'Forum-style previews for deal safety, buying advice, coupon reports, and category-specific threads.',
      `<section class="community-section"><div><h2>Members make the signal stronger.</h2><p>Future phases can add authentication, reputation, moderation queues, markdown comments, and thread detail pages.</p></div><div class="topic-list">${data.communityTopics.map((topic) => `<article class="topic-card motion-item"><div><strong>${topic.title}</strong><span>${topic.tag} / ${topic.user}</span></div><b>${topic.replies} replies</b></article>`).join('')}</div></section>`);
  }

  function search() {
    const query = (params.get('q') || params.get('filter') || '').toLowerCase();
    const sort = params.get('sort') || 'trending';
    const results = data.deals.filter((deal) => !query || [deal.title, deal.description, deal.store, deal.category, deal.shipping, ...deal.tags].join(' ').toLowerCase().includes(query));
    if (sort === 'new') results.reverse();
    if (sort === 'popular') results.sort((a, b) => b.comments + b.votes - (a.comments + a.votes));
    if (sort === 'expiring') results.sort((a, b) => Number(b.status === 'Expiring Soon') - Number(a.status === 'Expiring Soon') || b.heat - a.heat);
    shell('Search results', 'Find faster', query ? `Showing mock results for "${query}".` : 'Showing all mock deals. Use the homepage search for interactive filtering.',
      `<section class="section-block"><div class="deal-grid">${results.map(dealCard).join('') || '<div class="empty-state"><strong>No matching deals yet</strong><p>Try another keyword from the homepage.</p></div>'}</div></section>`);
  }

  function savedPage() {
    const results = data.deals.filter((deal) => saved.has(deal.id));
    shell('Saved deals', 'Your watchlist', 'Saved deals persist locally in this browser until account storage is added.',
      `<section class="section-block"><div class="deal-grid">${results.map(dealCard).join('') || '<div class="empty-state"><strong>No saved deals yet</strong><p>Save deals from the homepage or detail pages to fill this view.</p></div>'}</div></section>`);
  }

  function alerts() {
    shell('Deal alerts', 'Watchlist builder', 'A premium placeholder for keyword alerts, store follows, price ceilings, and category notifications.',
      `<section class="alert-section section-block"><div class="alert-copy"><h2>Alert rules will make DealNest personal.</h2><p>Preview how keyword watches, category triggers, and account-backed notifications will feel.</p></div><div class="alert-builder motion-item"><label>Keyword<input value="laptop under 800"></label><label>Category<input value="Electronics"></label><label>Max price<input value="$800"></label><button class="post-button" type="button" data-placeholder="Alert saving will be enabled when accounts are implemented.">Save alert</button></div></section>`);
  }

  function postDeal() {
    shell('Post a deal', 'Submission preview', 'A production flow can validate price, store, coupon, expiration, image, and community rules before publishing.',
      `<section class="alert-section section-block"><div class="alert-copy"><h2>Structured posting keeps deals trustworthy.</h2><p>This placeholder keeps the UX alive without pretending submissions are live yet.</p></div><form class="alert-builder motion-item"><label>Deal title<input value="Example: Premium monitor bundle"></label><label>Store<input value="Northline Tech"></label><label>Price<input value="$229"></label><button class="post-button" type="button" data-placeholder="Deal submission opens in the backend phase.">Preview deal</button></form></section>`);
  }

  function login() {
    shell('Member access', 'Account placeholder', 'Login and signup screens will later support saved deals, alerts, comments, voting history, and moderation roles.',
      `<section class="alert-section section-block"><div class="alert-copy"><h2>Your deal memory will live here.</h2><p>For now, saves and votes use local browser storage only.</p></div><form class="alert-builder motion-item"><label>Email<input value="member@example.com"></label><label>Password<input type="password" value="previewonly"></label><button class="post-button" type="button" data-placeholder="Authentication is a later phase.">Continue</button></form></section>`);
  }

  function games() {
    shell('Games archive', 'Maintenance classics', 'The previous games remain available as a secondary archive while the main experience becomes DealNest.',
      `<section class="games-archive"><div><h2>Playable archive</h2><p>These pages were preserved and kept out of the main shopping flow.</p></div><div class="archive-links"><a href="./snake/">Snake</a><a href="./ludo/">Ludo Royale</a><a href="./sequence-play.html">Sequence</a></div></section>`);
  }

  function categoryDetail() {
    const name = params.get('name') || '';
    const category = data.categories.find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (!category) {
      shell('Category not found', 'Category page', 'The requested category does not exist in this mock dataset.',
        `<section class="section-block"><div class="empty-state"><strong>Unknown category</strong><p>Return to categories and choose another lane.</p></div></section>`);
      return;
    }
    const deals = data.deals.filter((deal) => deal.category === category.name);
    const top = [...deals].sort((a, b) => b.heat - a.heat).slice(0, 1);
    shell(`${category.name} deals`, 'Category detail', `${category.description} This page previews how dedicated category routes can feel.`,
      `<section class="section-block"><div class="trust-strip"><article><span>${deals.length}</span><strong>active deals</strong><p>Matching offers in this category.</p></article><article><span>${deals.reduce((sum, deal) => sum + deal.heat, 0)}</span><strong>combined heat</strong><p>Community momentum in this lane.</p></article><article><span>${top[0] ? `${top[0].discount}%` : '0%'}</span><strong>best discount</strong><p>Top markdown currently in the category.</p></article></div></section><section class="section-block"><div class="deal-grid">${deals.map(dealCard).join('')}</div></section>`);
  }

  function storeDetail() {
    const name = params.get('name') || '';
    const store = data.stores.find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (!store) {
      shell('Store not found', 'Store profile', 'The requested store does not exist in this mock dataset.',
        `<section class="section-block"><div class="empty-state"><strong>Unknown store</strong><p>Return to stores and choose another listing.</p></div></section>`);
      return;
    }
    const deals = data.deals.filter((deal) => deal.store === store.name);
    const categories = [...new Set(deals.map((deal) => deal.category))].join(', ');
    shell(store.name, 'Store profile', `Original store profile with deal activity, follower signal, and category footprint for ${store.name}.`,
      `<section class="section-block"><div class="trust-strip"><article><span>${store.followers.toLocaleString('en-US')}</span><strong>followers</strong><p>Mock social proof for follow flow planning.</p></article><article><span>${store.rating}</span><strong>store rating</strong><p>Community trust and verification sentiment.</p></article><article><span>${deals.length}</span><strong>active deals</strong><p>${categories || 'No categories yet'}</p></article></div></section><section class="section-block"><div class="deal-grid">${deals.map(dealCard).join('') || '<div class="empty-state"><strong>No active deals</strong><p>This store will populate when new listings are added.</p></div>'}</div></section>`);
  }

  function admin() {
    const expiring = data.deals.filter((deal) => deal.status === 'Expiring Soon').slice(0, 8);
    const queue = data.communityTopics.slice(0, 6);
    shell('Moderation console', 'Admin structure', 'Placeholder moderation workspace for deal reports, quality checks, and community triage.',
      `<section class="split-section"><article class="section-block"><div class="section-heading"><div><p class="eyebrow">Report queue</p><h2>Expiring and review-needed deals</h2></div></div><div class="editor-list">${expiring.map((deal) => `<article class="editor-item motion-item"><img src="${deal.image}" alt="${deal.title}"><div><h3>${deal.title}</h3><p>${deal.store} / ${deal.status} / ${deal.expires}</p></div><strong>${deal.heat} heat</strong></article>`).join('')}</div></article><article class="section-block"><div class="section-heading"><div><p class="eyebrow">Community triage</p><h2>Forum moderation preview</h2></div></div><div class="topic-list">${queue.map((topic) => `<article class="topic-card motion-item"><div><strong>${topic.title}</strong><span>${topic.tag} / ${topic.user}</span></div><b>${topic.replies} replies</b></article>`).join('')}</div><div class="community-actions"><button type="button" data-placeholder="Moderation actions activate once role auth is implemented.">Approve queue</button><button type="button" data-placeholder="Escalation workflow is a later backend phase.">Escalate</button></div></article></section>`);
  }

  const renderers = { categories, stores, coupons, community, search, saved: savedPage, alerts, post: postDeal, login, games, category: categoryDetail, store: storeDetail, admin };
  renderers[page]?.();

  document.body.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action], [data-placeholder]');
    if (!target) return;
    const { action, code, placeholder } = target.dataset;
    if (placeholder) toast(placeholder);
    if (action === 'copy') navigator.clipboard?.writeText(code).then(() => toast(`Copied ${code}`)).catch(() => toast(`Coupon: ${code}`));
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
