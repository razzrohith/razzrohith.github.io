# DealNest SEO and Sharing Notes

DealNest is deployed as a static GitHub Pages site. Static pages now include canonical URLs, Open Graph metadata, Twitter card metadata, robots directives, and a shared preview image.

## Static Sitemap

`sitemap.xml` lists stable public routes such as the homepage, category/store directories, coupons, community, search, deal shell, and games archive.

Dynamic Supabase deal URLs are not generated into the sitemap at build time yet. The current static deal shell can update metadata in the browser after Supabase/mock data loads, but crawlers that do not execute JavaScript may only see the generic deal page metadata.

## Future Dynamic Sitemap Plan

When backend automation is added, generate `sitemap.xml` from Supabase approved public deals only:

- `moderation_status = 'approved'`
- `status in ('live', 'expiring_soon')`

The generated sitemap should include canonical `deal.html?id=<slug>` URLs and exclude pending, rejected, hidden, expired, and non-approved deals.

## Structured Data

The homepage includes safe `Organization` and `WebSite` JSON-LD. Deal detail pages add client-side `BreadcrumbList` and `Product`/`Offer` JSON-LD from the currently loaded public deal data. No fake reviews, aggregate ratings, or seller claims are emitted.
