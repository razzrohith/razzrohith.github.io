-- DealNest safe mock seed data.
-- Run after 20260427000000_initial_dealnest_schema.sql.
-- This seed does not create auth users or store secrets.

insert into public.categories (name, slug, icon, tone, description, sort_order) values
  ('Electronics', 'electronics', 'EL', 'mint', 'Laptops, tablets, monitors, and connected gear.', 10),
  ('Gaming', 'gaming', 'GM', 'blue', 'Console bundles, accessories, controllers, and desk upgrades.', 20),
  ('Home', 'home', 'HM', 'gold', 'Furniture, decor, smart home, and comfort picks.', 30),
  ('Travel', 'travel', 'TR', 'sky', 'Luggage, bags, travel tech, and booking-friendly finds.', 40),
  ('Fashion', 'fashion', 'FA', 'rose', 'Outerwear, essentials, footwear, and seasonal drops.', 50),
  ('Kitchen', 'kitchen', 'KT', 'green', 'Appliances, coffee gear, cookware, and prep tools.', 60),
  ('Audio', 'audio', 'AU', 'violet', 'Headphones, speakers, microphones, and creator gear.', 70),
  ('Outdoors', 'outdoors', 'OD', 'leaf', 'Camping, trail, patio, and weather-ready gear.', 80),
  ('Wellness', 'wellness', 'WL', 'mint', 'Recovery, sleep, grooming, and everyday health gear.', 90),
  ('Pets', 'pets', 'PT', 'gold', 'Smart feeders, beds, travel kits, and pet-home essentials.', 100)
on conflict (slug) do update set
  name = excluded.name,
  icon = excluded.icon,
  tone = excluded.tone,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.stores (name, slug, initials, description, followers_count, rating, trust_label) values
  ('Northline Tech', 'northline-tech', 'NT', 'Performance laptops, routers, and creator electronics.', 18400, 4.8, 'Verified store'),
  ('Haven Home', 'haven-home', 'HH', 'Home office, lighting, decor, and comfort finds.', 12850, 4.7, 'Community watched'),
  ('PixelForge', 'pixelforge', 'PF', 'Gaming accessories, controllers, keyboards, and console gear.', 21120, 4.9, 'Top rated'),
  ('UrbanTrail', 'urbantrail', 'UT', 'Commuter apparel, weekend bags, and weather-ready basics.', 9360, 4.6, 'Community watched'),
  ('Roast & Co.', 'roast-co', 'RC', 'Coffee gear, beans, and compact brewing tools.', 7420, 4.7, 'Verified store'),
  ('Skyway Travel', 'skyway-travel', 'ST', 'Travel credit, luggage, and city-ready trip gear.', 10390, 4.5, 'Travel scout'),
  ('SoundNest', 'soundnest', 'SN', 'Audio gear, smart speakers, headphones, and creator microphones.', 16930, 4.8, 'Verified store'),
  ('CookHaus', 'cookhaus', 'CH', 'Cookware, prep tools, and compact kitchen appliances.', 11920, 4.7, 'Kitchen favorite'),
  ('BrightCart', 'brightcart', 'BC', 'Everyday tech, wearables, and household essentials.', 14210, 4.6, 'Community watched'),
  ('TrailModo', 'trailmodo', 'TM', 'Outdoor packs, commuter bags, and weatherproof carry gear.', 8810, 4.5, 'Outdoor scout'),
  ('StudioDock', 'studiodock', 'SD', 'Desk setups, webcams, displays, and creator docking gear.', 13740, 4.8, 'Creator pick'),
  ('VistaSupply', 'vistasupply', 'VS', 'Patio, outdoor seating, and seasonal home goods.', 15280, 4.6, 'Seasonal pick'),
  ('GlowLab', 'glowlab', 'GL', 'Sleep, recovery, grooming, and wellness accessories.', 8120, 4.6, 'Wellness pick'),
  ('Pawly', 'pawly', 'PW', 'Pet tech, washable beds, feeders, and home pet essentials.', 10540, 4.7, 'Pet favorite')
on conflict (slug) do update set
  name = excluded.name,
  initials = excluded.initials,
  description = excluded.description,
  followers_count = excluded.followers_count,
  rating = excluded.rating,
  trust_label = excluded.trust_label;

insert into public.deals (
  slug, title, description, instructions, deal_url, image_url, current_price, original_price,
  discount_percent, store_id, category_id, shipping_info, coupon_code, status, moderation_status,
  featured, trending, heat_score, vote_count, comment_count, tags
)
select
  seed.slug,
  seed.title,
  seed.description,
  'Verify final price, coupon terms, shipping cost, return window, and expiration before purchase.',
  seed.deal_url,
  seed.image_url,
  seed.current_price,
  seed.original_price,
  seed.discount_percent,
  stores.id,
  categories.id,
  seed.shipping_info,
  seed.coupon_code,
  seed.status,
  'approved',
  seed.featured,
  seed.trending,
  seed.heat_score,
  seed.vote_count,
  seed.comment_count,
  seed.tags
from (
  values
    ('nimbus-14-ultralight-laptop', 'Nimbus 14 ultralight laptop with 16GB memory and 1TB SSD', 'Portable productivity notebook with a bright display, compact charger, and premium storage tier.', './deal.html?id=deal-laptop-01', './assets/img/deals/laptop.svg', 749.00, 1199.00, 38, 'Northline Tech', 'Electronics', 'Free 2-day shipping', 'NIMBUS150', 'live', true, true, 782, 318, 94, array['Trending','Free Shipping','Popular','Laptop']),
    ('arcpad-mini-console-bundle', 'ArcPad mini game console bundle with two controllers', 'Compact living-room console bundle with multiplayer controllers and dock.', './deal.html?id=deal-console-04', './assets/img/deals/console.svg', 219.00, 329.00, 33, 'PixelForge', 'Gaming', 'Free shipping', 'PLAYMORE', 'live', true, true, 868, 355, 122, array['Trending','Gaming','Free Shipping','Popular']),
    ('vista-qhd-creator-monitor', 'Vista 27-inch QHD creator monitor with USB-C docking', 'Color-tuned display with single-cable laptop charging and a compact stand.', './deal.html?id=deal-monitor-09', './assets/img/deals/monitor.svg', 229.00, 389.00, 41, 'StudioDock', 'Electronics', 'Free shipping', 'DOCK40', 'live', true, true, 602, 214, 47, array['Electronics','Free Shipping','Desk setup']),
    ('roomfill-smart-speaker-pair', 'RoomFill compact smart speaker pair with stereo sync', 'Small-room audio pair with app controls and multi-room grouping.', './deal.html?id=deal-speaker-11', './assets/img/deals/speaker.svg', 64.00, 140.00, 54, 'SoundNest', 'Audio', 'Free shipping', 'PAIRUP', 'live', false, false, 421, 131, 25, array['Audio','Free Shipping','Home']),
    ('cookhaus-ceramic-cookware-set', 'CookHaus ceramic nonstick cookware starter set', 'Space-saving pans with removable handles and induction-ready bases.', './deal.html?id=deal-cookware-15', './assets/img/deals/kitchen.svg', 119.00, 220.00, 46, 'CookHaus', 'Kitchen', 'Free shipping', 'PANTRY25', 'expiring_soon', true, false, 342, 98, 26, array['Kitchen','Expiring Soon','Free Shipping']),
    ('pawly-smart-pet-feeder-camera', 'Pawly smart pet feeder with portion schedule and camera', 'Connected feeder with timed meals, voice notes, and a wide-angle check-in camera.', './deal.html?id=deal-feeder-27', './assets/img/deals/pet.svg', 82.00, 159.00, 48, 'Pawly', 'Pets', 'Free shipping', 'PAWMEAL', 'live', true, false, 402, 126, 23, array['Pets','Free Shipping','Home']),
    ('glowlab-sunrise-sleep-lamp', 'GlowLab sunrise sleep lamp with wind-down sound modes', 'Bedside lamp with sunrise simulation, soft soundscapes, and app-free controls.', './deal.html?id=deal-sleep-25', './assets/img/deals/lamp.svg', 46.00, 99.00, 54, 'GlowLab', 'Wellness', 'Free shipping', 'REST20', 'live', false, true, 331, 101, 17, array['Wellness','Free Shipping','Home'])
) as seed(slug, title, description, deal_url, image_url, current_price, original_price, discount_percent, store_name, category_name, shipping_info, coupon_code, status, featured, trending, heat_score, vote_count, comment_count, tags)
join public.stores on stores.name = seed.store_name
join public.categories on categories.name = seed.category_name
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  current_price = excluded.current_price,
  original_price = excluded.original_price,
  discount_percent = excluded.discount_percent,
  heat_score = excluded.heat_score,
  vote_count = excluded.vote_count,
  comment_count = excluded.comment_count,
  updated_at = now();

insert into public.coupons (store_id, code, description, category, verified, status)
select stores.id, seed.code, seed.description, seed.category, seed.verified, 'active'
from (
  values
    ('Northline Tech', 'NIMBUS150', '$150 off select performance laptops', 'Electronics', true),
    ('SoundNest', 'QUIET20', 'Extra 20% off featured audio', 'Audio', true),
    ('PixelForge', 'PLAYMORE', 'Console bundle accessory credit', 'Gaming', true),
    ('StudioDock', 'DOCK40', 'Creator desk gear coupon stack', 'Electronics', true),
    ('CookHaus', 'PANTRY25', 'Kitchen starter set discount', 'Kitchen', true),
    ('Pawly', 'PAWMEAL', 'Smart pet care discount', 'Pets', true),
    ('GlowLab', 'REST20', 'Sleep and recovery essentials', 'Wellness', true)
) as seed(store_name, code, description, category, verified)
join public.stores on stores.name = seed.store_name
on conflict (store_id, code) do update set
  description = excluded.description,
  category = excluded.category,
  verified = excluded.verified,
  status = excluded.status,
  updated_at = now();

insert into public.community_threads (slug, title, tag, reply_count, status) values
  ('best-time-to-buy-travel-gear', 'Best time to buy travel gear before summer?', 'Buying advice', 28, 'approved'),
  ('under-100-desk-upgrades', 'Share your under-$100 desk upgrade finds', 'Community picks', 64, 'approved'),
  ('verify-marketplace-refurb-deals', 'How do you verify marketplace refurb deals?', 'Deal safety', 19, 'approved'),
  ('coupon-stacking-wins', 'Coupon stacking wins from this week', 'Coupons', 36, 'approved'),
  ('pet-feeder-reliability', 'Pet tech owners: which smart feeders are actually reliable?', 'Pets', 26, 'approved')
on conflict (slug) do update set
  title = excluded.title,
  tag = excluded.tag,
  reply_count = excluded.reply_count,
  updated_at = now();

insert into public.moderation_queue (entity_type, title, reason, priority, status) values
  ('report', 'Price mismatch on travel luggage bundle', 'Community report says final cart price changed.', 'high', 'open'),
  ('deal', 'Member-submitted tablet dock package', 'Pending deal needs image and store verification.', 'medium', 'open'),
  ('coupon', 'PAIRUP works only on speaker pair colors', 'Coupon terms need clarification.', 'low', 'reviewing'),
  ('thread', 'Refurb warranty claim needs source check', 'Community safety discussion flagged for moderator review.', 'medium', 'open'),
  ('deal', 'UrbanTrail duffel promotion ending tonight', 'Time-sensitive expiration check.', 'high', 'open');
