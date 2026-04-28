(function () {
  const siteUrl = 'https://razzrohith.com';
  const shareImage = `${siteUrl}/assets/img/dealnest-share.svg`;

  function setMeta(selector, attr, value) {
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement('meta');
      const nameMatch = selector.match(/name="([^"]+)"/);
      const propertyMatch = selector.match(/property="([^"]+)"/);
      if (nameMatch) node.setAttribute('name', nameMatch[1]);
      if (propertyMatch) node.setAttribute('property', propertyMatch[1]);
      document.head.appendChild(node);
    }
    node.setAttribute(attr, value);
  }

  function setLink(rel, href) {
    let node = document.head.querySelector(`link[rel="${rel}"]`);
    if (!node) {
      node = document.createElement('link');
      node.setAttribute('rel', rel);
      document.head.appendChild(node);
    }
    node.setAttribute('href', href);
  }

  function absoluteUrl(path = '/') {
    const url = new URL(path, siteUrl);
    return url.href;
  }

  function update(meta) {
    const title = meta.title || document.title;
    const description = meta.description || document.querySelector('meta[name="description"]')?.content || '';
    const canonical = meta.canonical || absoluteUrl(location.pathname);
    const image = meta.image || shareImage;
    document.title = title;
    setMeta('meta[name="description"]', 'content', description);
    setLink('canonical', canonical);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:url"]', 'content', canonical);
    setMeta('meta[property="og:image"]', 'content', image);
    setMeta('meta[property="og:type"]', 'content', meta.type || 'website');
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', description);
    setMeta('meta[name="twitter:image"]', 'content', image);
    setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
  }

  function jsonLd(id, data) {
    let node = document.getElementById(id);
    if (!node) {
      node = document.createElement('script');
      node.type = 'application/ld+json';
      node.id = id;
      document.head.appendChild(node);
    }
    node.textContent = JSON.stringify(data);
  }

  window.DealNestSEO = {
    absoluteUrl,
    jsonLd,
    shareImage,
    siteUrl,
    update
  };
}());
