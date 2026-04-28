(function () {
  const fallbackData = window.DealScoutData;
  let supabaseUrl = '';
  let anonKey = '';

  function endpoint(path, query) {
    return `${supabaseUrl}/rest/v1/${path}${query ? `?${query}` : ''}`;
  }

  function parseEnv(text) {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .reduce((env, line) => {
        const index = line.indexOf('=');
        env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
        return env;
      }, {});
  }

  async function resolveConfig() {
    const direct = window.DealNestConfig || {};
    if (direct.SUPABASE_URL && direct.SUPABASE_ANON_KEY) {
      supabaseUrl = direct.SUPABASE_URL.replace(/\/$/, '');
      anonKey = direct.SUPABASE_ANON_KEY;
      return;
    }

    const isLocal = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
    if (!isLocal) return;

    try {
      const response = await fetch('./.env', { cache: 'no-store' });
      if (!response.ok) return;
      const env = parseEnv(await response.text());
      supabaseUrl = (env.SUPABASE_URL || '').replace(/\/$/, '');
      anonKey = env.SUPABASE_ANON_KEY || '';
    } catch (error) {
      supabaseUrl = '';
      anonKey = '';
    }
  }

  async function request(path, query) {
    const response = await fetch(endpoint(path, query), {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase ${path} request failed with ${response.status}`);
    }

    return response.json();
  }

  function mergeByName(remoteItems, fallbackItems) {
    const seen = new Set(remoteItems.map((item) => item.name.toLowerCase()));
    return [
      ...remoteItems,
      ...fallbackItems.filter((item) => !seen.has(item.name.toLowerCase()))
    ];
  }

  function mergeDeals(remoteDeals, fallbackDeals) {
    const seen = new Set();
    remoteDeals.forEach((deal) => {
      seen.add(deal.id);
      seen.add(deal.title.toLowerCase());
    });

    return [
      ...remoteDeals,
      ...fallbackDeals.filter((deal) => !seen.has(deal.id) && !seen.has(deal.title.toLowerCase()))
    ];
  }

  function mergeCoupons(remoteCoupons, fallbackCoupons) {
    const seen = new Set(remoteCoupons.map((coupon) => `${coupon.store}:${coupon.code}`.toLowerCase()));
    return [
      ...remoteCoupons,
      ...fallbackCoupons.filter((coupon) => !seen.has(`${coupon.store}:${coupon.code}`.toLowerCase()))
    ];
  }

  function moneyStatus(value) {
    if (!value) return 'Live';
    return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function relativePostedTime(value) {
    if (!value) return 'Recently';
    const created = new Date(value);
    const diffMs = Date.now() - created.getTime();
    if (Number.isNaN(diffMs)) return 'Recently';
    const minutes = Math.max(1, Math.round(diffMs / 60000));
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  function mapCategory(row) {
    return {
      id: row.id,
      name: row.name,
      icon: row.icon || row.name.slice(0, 2).toUpperCase(),
      tone: row.tone || 'mint',
      description: row.description || 'Curated deals and community picks.'
    };
  }

  function mapStore(row) {
    return {
      id: row.id,
      name: row.name,
      initials: row.initials || row.name.slice(0, 2).toUpperCase(),
      description: row.description || 'Community-watched store.',
      followers: row.followers_count || 0,
      rating: row.rating || 0,
      trustLabel: row.trust_label || 'Community watched'
    };
  }

  function mapDeal(row) {
    const store = row.stores || {};
    const category = row.categories || {};
    const id = row.slug || row.id;
    const status = moneyStatus(row.status);
    return {
      uuid: row.id,
      slug: row.slug,
      id,
      title: row.title,
      description: row.description || 'Community-submitted deal.',
      instructions: row.instructions || '',
      merchantUrl: row.deal_url || '#',
      image: row.image_url || './assets/img/deals/monitor.svg',
      currentPrice: Number(row.current_price || 0),
      originalPrice: Number(row.original_price || row.current_price || 0),
      discount: Number(row.discount_percent || 0),
      store: store.name || 'DealNest Store',
      category: category.name || 'Deals',
      shipping: row.shipping_info || 'See store for shipping',
      postedTime: relativePostedTime(row.created_at),
      postedBy: 'DealNest member',
      heat: Number(row.heat_score || 0),
      votes: Number(row.vote_count || 0),
      comments: Number(row.comment_count || 0),
      couponCode: row.coupon_code || '',
      status,
      featured: Boolean(row.featured),
      trending: Boolean(row.trending),
      expires: row.expires_at ? new Date(row.expires_at).toLocaleDateString() : (status === 'Expiring Soon' ? 'Expiring soon' : 'No deadline listed'),
      dealUrl: `./deal.html?id=${encodeURIComponent(id)}`,
      tags: Array.isArray(row.tags) ? row.tags : [status, category.name, store.name].filter(Boolean),
      source: 'supabase'
    };
  }

  function mapCoupon(row) {
    const store = row.stores || {};
    return {
      id: row.id,
      code: row.code,
      store: store.name || 'DealNest Store',
      description: row.description || 'Community coupon',
      category: row.category || 'General',
      expires: row.expires_at ? new Date(row.expires_at).toLocaleDateString() : 'No deadline listed',
      verified: Boolean(row.verified),
      source: 'supabase'
    };
  }

  async function loadSupabaseData() {
    await resolveConfig();

    if (!supabaseUrl || !anonKey || !fallbackData) {
      window.DealNestDataSource = 'mock';
      document.documentElement.dataset.source = 'mock';
      return fallbackData;
    }

    const [categoriesRows, storesRows, dealsRows, couponsRows] = await Promise.all([
      request('categories', 'select=id,name,slug,icon,tone,description,is_active&is_active=eq.true&order=sort_order.asc'),
      request('stores', 'select=id,name,slug,initials,description,followers_count,rating,trust_label,is_active&is_active=eq.true&order=name.asc'),
      request('deals', 'select=id,slug,title,description,instructions,deal_url,image_url,current_price,original_price,discount_percent,shipping_info,coupon_code,status,moderation_status,featured,trending,heat_score,vote_count,comment_count,tags,expires_at,created_at,stores(name,initials),categories(name,icon,tone)&moderation_status=eq.approved&status=in.(live,expiring_soon)&order=heat_score.desc'),
      request('coupons', 'select=id,code,description,category,verified,status,expires_at,stores(name,initials)&status=eq.active&order=created_at.desc')
    ]);

    const remoteData = {
      ...fallbackData,
      categories: mergeByName(categoriesRows.map(mapCategory), fallbackData.categories || []),
      stores: mergeByName(storesRows.map(mapStore), fallbackData.stores || []),
      deals: mergeDeals(dealsRows.map(mapDeal), fallbackData.deals || []),
      coupons: mergeCoupons(couponsRows.map(mapCoupon), fallbackData.coupons || [])
    };

    window.DealScoutData = remoteData;
    window.DealNestDataSource = 'supabase';
    document.documentElement.dataset.source = 'supabase';
    window.dispatchEvent(new CustomEvent('dealnest:data-ready', { detail: { source: 'supabase' } }));
    return remoteData;
  }

  window.DealNestDataReady = loadSupabaseData().catch((error) => {
    console.warn('DealNest is using local mock data because Supabase public data could not be loaded.', error);
    window.DealNestDataSource = 'mock';
    document.documentElement.dataset.source = 'mock';
    window.DealScoutData = fallbackData;
    return fallbackData;
  });
}());
