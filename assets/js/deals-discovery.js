(function () {
  function text(value) {
    return String(value || '').toLowerCase().trim();
  }

  function words(value) {
    return text(value)
      .split(/[^a-z0-9%]+/i)
      .map((word) => word.trim())
      .filter(Boolean);
  }

  function includesField(value, query) {
    return text(value).includes(text(query));
  }

  function dealFields(deal) {
    const tags = Array.isArray(deal.tags) ? deal.tags : [];
    return {
      title: deal.title || '',
      store: deal.store || '',
      category: deal.category || '',
      coupon: deal.couponCode || '',
      description: deal.description || '',
      shipping: deal.shipping || '',
      keywords: tags.join(' '),
      status: deal.status || ''
    };
  }

  function searchableText(deal) {
    const fields = dealFields(deal);
    return Object.values(fields).join(' ');
  }

  function searchScore(deal, query) {
    const cleanQuery = text(query);
    if (!cleanQuery) return 0;

    const terms = words(cleanQuery);
    const fields = dealFields(deal);
    const haystack = text(searchableText(deal));
    if (!terms.every((term) => haystack.includes(term))) return -1;

    let score = 0;
    if (text(fields.title) === cleanQuery) score += 220;
    if (includesField(fields.title, cleanQuery)) score += 120;
    if (includesField(fields.store, cleanQuery)) score += 85;
    if (includesField(fields.category, cleanQuery)) score += 75;
    if (includesField(fields.coupon, cleanQuery)) score += 65;
    if (includesField(fields.keywords, cleanQuery)) score += 45;
    if (includesField(fields.description, cleanQuery)) score += 28;
    if (includesField(fields.shipping, cleanQuery)) score += 18;

    terms.forEach((term) => {
      if (includesField(fields.title, term)) score += 28;
      if (includesField(fields.store, term)) score += 18;
      if (includesField(fields.category, term)) score += 18;
      if (includesField(fields.coupon, term)) score += 14;
      if (includesField(fields.keywords, term)) score += 10;
      if (includesField(fields.description, term)) score += 5;
      if (includesField(fields.shipping, term)) score += 4;
    });

    return score;
  }

  function dealAgeHours(deal) {
    const raw = text(deal.postedTime);
    if (!raw || raw === 'recently' || raw === 'today') return 8;
    if (raw.includes('min')) return 0.5;
    const hourMatch = raw.match(/(\d+)\s*hr/);
    if (hourMatch) return Number(hourMatch[1]);
    const dayMatch = raw.match(/(\d+)\s*day/);
    if (dayMatch) return Number(dayMatch[1]) * 24;
    if (raw.includes('yesterday')) return 30;
    return 72;
  }

  function recencyBoost(deal) {
    const hours = dealAgeHours(deal);
    if (hours <= 1) return 80;
    if (hours <= 6) return 58;
    if (hours <= 24) return 34;
    if (hours <= 72) return 16;
    return 4;
  }

  function isExpiring(deal) {
    const value = `${deal.status || ''} ${deal.expires || ''} ${Array.isArray(deal.tags) ? deal.tags.join(' ') : ''}`;
    return /expiring|ends tonight|ends today|48 hours/i.test(value);
  }

  function hasFreeShipping(deal) {
    return /free/i.test(deal.shipping || '');
  }

  function hasCoupon(deal) {
    return Boolean(String(deal.couponCode || '').trim());
  }

  function dealScore(deal, options = {}) {
    const heat = Number(deal.heat || 0);
    const votes = Number(deal.votes || 0);
    const comments = Number(deal.comments || 0);
    const discount = Number(deal.discount || 0);
    const savedBoost = options.savedSet?.has?.(deal.id) ? 30 : 0;

    /*
      Discovery ranking formula:
      heat is the primary community signal, votes/comments add confidence,
      discount adds shopping value, recency keeps the feed fresh, and
      expiring-soon deals get a small urgency boost without overwhelming quality.
    */
    return (heat * 1)
      + (votes * 0.28)
      + (comments * 1.8)
      + (discount * 2.2)
      + recencyBoost(deal)
      + (isExpiring(deal) ? 70 : 0)
      + savedBoost;
  }

  function matchesFilter(deal, filter) {
    const value = text(filter);
    if (!value) return true;
    if (value === 'free shipping') return hasFreeShipping(deal);
    if (value === 'coupon available' || value === 'coupon') return hasCoupon(deal);
    if (value === 'expiring soon') return isExpiring(deal);
    if (value === '30%+ off' || value === 'high discount') return Number(deal.discount || 0) >= 30;
    if (value === '50%+ off') return Number(deal.discount || 0) >= 50;
    return [
      deal.category,
      deal.store,
      deal.status,
      deal.shipping,
      ...(Array.isArray(deal.tags) ? deal.tags : [])
    ].some((item) => text(item) === value || text(item).includes(value));
  }

  function matchesDeal(deal, options = {}) {
    if (searchScore(deal, options.query || '') < 0) return false;
    if (options.store && deal.store !== options.store) return false;
    if (Number.isFinite(options.maxPrice) && Number(deal.currentPrice || 0) > options.maxPrice) return false;
    if (Number.isFinite(options.minDiscount) && Number(deal.discount || 0) < options.minDiscount) return false;
    if (options.freeShipping && !hasFreeShipping(deal)) return false;
    if (options.couponOnly && !hasCoupon(deal)) return false;
    if (options.expiringOnly && !isExpiring(deal)) return false;
    return [...(options.filters || [])].every((filter) => matchesFilter(deal, filter));
  }

  function sortDeals(deals, sort = 'trending', options = {}) {
    const normalized = sort === 'new' ? 'newest' : sort === 'popular' ? 'hottest' : sort;
    const query = options.query || '';
    const sorted = [...deals].sort((a, b) => {
      if (query) {
        const scoreDiff = searchScore(b, query) - searchScore(a, query);
        if (scoreDiff) return scoreDiff;
      }
      if (normalized === 'newest') return dealAgeHours(a) - dealAgeHours(b);
      if (normalized === 'discount') return Number(b.discount || 0) - Number(a.discount || 0) || dealScore(b, options) - dealScore(a, options);
      if (normalized === 'price-low') return Number(a.currentPrice || 0) - Number(b.currentPrice || 0);
      if (normalized === 'expiring') return Number(isExpiring(b)) - Number(isExpiring(a)) || dealAgeHours(a) - dealAgeHours(b);
      if (normalized === 'comments') return Number(b.comments || 0) - Number(a.comments || 0) || dealScore(b, options) - dealScore(a, options);
      if (normalized === 'saved') {
        const savedDiff = Number(options.savedSet?.has?.(b.id)) - Number(options.savedSet?.has?.(a.id));
        if (savedDiff) return savedDiff;
      }
      return dealScore(b, options) - dealScore(a, options);
    });
    return sorted;
  }

  function filterAndSort(deals, options = {}) {
    return sortDeals(deals.filter((deal) => matchesDeal(deal, options)), options.sort || 'trending', options);
  }

  function activeFilterLabels(options = {}) {
    const labels = [];
    if (options.query) labels.push(`Search: "${options.query}"`);
    if (options.store) labels.push(`Store: ${options.store}`);
    if (Number.isFinite(options.maxPrice)) labels.push(`Under $${options.maxPrice}`);
    if (Number.isFinite(options.minDiscount) && options.minDiscount > 0) labels.push(`${options.minDiscount}%+ off`);
    if (options.freeShipping) labels.push('Free shipping');
    if (options.couponOnly) labels.push('Coupon available');
    if (options.expiringOnly) labels.push('Expiring soon');
    [...(options.filters || [])].forEach((filter) => labels.push(filter));
    return [...new Set(labels)];
  }

  function emptyStateHtml(options = {}, data = {}) {
    const labels = activeFilterLabels(options);
    const suggestions = (data.trendingSearches || []).slice(0, 5);
    const categories = (data.categories || []).slice(0, 4);
    return `
      <strong>No matching deals</strong>
      <p>${labels.length ? `Active filters: ${labels.join(', ')}.` : 'Try a broader search or fewer filters.'}</p>
      <div class="empty-actions">
        <button type="button" class="deal-action" data-action="clear-filters">Clear filters</button>
        ${suggestions.map((term) => `<button type="button" data-filter-shortcut="${term}">${term}</button>`).join('')}
        ${categories.map((category) => `<button type="button" data-filter-shortcut="${category.name}">${category.name}</button>`).join('')}
      </div>
    `;
  }

  function keywordOverlap(a, b) {
    const aWords = new Set(words(searchableText(a)));
    return words(searchableText(b)).filter((word) => word.length > 3 && aWords.has(word)).length;
  }

  function relatedDeals(current, deals, limit = 4) {
    return deals
      .filter((deal) => deal.id !== current.id)
      .map((deal) => {
        const priceGap = Math.abs(Number(deal.currentPrice || 0) - Number(current.currentPrice || 0));
        const priceScore = Math.max(0, 40 - Math.min(40, priceGap / 10));
        const score = (deal.category === current.category ? 140 : 0)
          + (deal.store === current.store ? 90 : 0)
          + (keywordOverlap(current, deal) * 16)
          + priceScore
          + (dealScore(deal) * 0.05);
        return { deal, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.deal);
  }

  window.DealNestDiscovery = {
    activeFilterLabels,
    dealScore,
    emptyStateHtml,
    filterAndSort,
    hasCoupon,
    hasFreeShipping,
    isExpiring,
    matchesDeal,
    relatedDeals,
    searchScore,
    sortDeals
  };
}());
