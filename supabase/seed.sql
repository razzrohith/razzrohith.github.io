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
    ('glowlab-sunrise-sleep-lamp', 'GlowLab sunrise sleep lamp with wind-down sound modes', 'Bedside lamp with sunrise simulation, soft soundscapes, and app-free controls.', './deal.html?id=deal-sleep-25', './assets/img/deals/lamp.svg', 46.00, 99.00, 54, 'GlowLab', 'Wellness', 'Free shipping', 'REST20', 'live', false, true, 331, 101, 17, array['Wellness','Free Shipping','Home']),
    ('aeroquiet-wireless-headphones', 'AeroQuiet wireless headphones with travel case and 40-hour battery', 'Noise-softening headphones with quick charge and a hard travel shell.', './deal.html?id=deal-headphones-02', './assets/img/deals/headphones.svg', 89.00, 179.00, 50, 'SoundNest', 'Audio', 'Free shipping', 'QUIET20', 'live', false, true, 641, 227, 58, array['Trending','Free Shipping','Audio']),
    ('contour-mesh-ergonomic-chair', 'Contour mesh ergonomic chair with adjustable lumbar support', 'Workday chair with breathable mesh, tilt tension, and height-adjustable arm pads.', './deal.html?id=deal-chair-03', './assets/img/deals/chair.svg', 164.00, 299.00, 45, 'Haven Home', 'Home', '$9 oversize delivery', '', 'live', true, false, 511, 194, 41, array['Popular','Home','Office']),
    ('skyway-hardside-luggage-set', 'Skyway three-piece hardside luggage set with spinner wheels', 'Nested travel set with scratch-resistant shells and smooth spinner wheels.', './deal.html?id=deal-luggage-05', './assets/img/deals/luggage.svg', 139.00, 260.00, 47, 'Skyway Travel', 'Travel', 'Free shipping', '', 'expiring_soon', false, false, 436, 146, 29, array['Expiring Soon','Travel','Free Shipping']),
    ('stormline-packable-rain-jacket', 'Stormline packable rain jacket with sealed pockets', 'Lightweight jacket that folds into its own pocket for commuter bags and trail kits.', './deal.html?id=deal-jacket-06', './assets/img/deals/jacket.svg', 58.00, 128.00, 55, 'UrbanTrail', 'Fashion', 'Free shipping over $50', 'RAINREADY', 'live', false, false, 389, 119, 17, array['Fashion','Free Shipping','Outdoors']),
    ('reserve-coffee-sampler', 'Reserve whole bean coffee sampler, four 12oz bags', 'Rotating roast bundle for pour-over, espresso, and cold brew testing.', './deal.html?id=deal-coffee-07', './assets/img/deals/coffee.svg', 32.00, 56.00, 43, 'Roast & Co.', 'Kitchen', 'Free shipping', 'FRESHBEANS', 'live', false, false, 274, 82, 13, array['New','Free Shipping','Kitchen']),
    ('novamix-compact-stand-mixer', 'NovaMix compact stand mixer with stainless bowl', 'Counter-friendly mixer with whisk, paddle, dough hook, and splash guard.', './deal.html?id=deal-kitchen-08', './assets/img/deals/kitchen.svg', 99.00, 189.00, 48, 'CookHaus', 'Kitchen', '$5 shipping', '', 'live', false, true, 322, 101, 22, array['New','Home','Kitchen']),
    ('low-profile-mechanical-keyboard-kit', 'Low-profile mechanical keyboard and silent switch kit', 'Slim hot-swap board with compact layout, dampened case, and matching keycaps.', './deal.html?id=deal-keyboard-10', './assets/img/deals/keyboard.svg', 72.00, 139.00, 48, 'PixelForge', 'Gaming', 'Free shipping', 'TYPEFAST', 'live', false, true, 553, 177, 39, array['Gaming','Free Shipping','Desk setup']),
    ('liftmate-standing-desk-frame', 'LiftMate electric standing desk frame with memory presets', 'Dual-motor frame with quiet lift, cable tray, and four height presets.', './deal.html?id=deal-desk-12', './assets/img/deals/chair.svg', 188.00, 349.00, 46, 'Haven Home', 'Home', '$12 delivery', 'STANDUP', 'live', false, false, 474, 162, 33, array['Home','Desk setup','Popular']),
    ('aerostep-knit-walking-shoes', 'AeroStep knit walking shoes in seasonal colors', 'Light everyday sneakers with breathable upper and cushioned sole.', './deal.html?id=deal-sneaker-13', './assets/img/deals/jacket.svg', 44.00, 95.00, 54, 'UrbanTrail', 'Fashion', 'Free shipping over $50', 'STEP12', 'live', false, false, 251, 72, 11, array['Fashion','New']),
    ('trailmodo-weatherproof-backpack', 'TrailModo weatherproof commuter backpack with laptop sleeve', 'Structured daily bag with sealed pocketing, bottle storage, and trolley strap.', './deal.html?id=deal-backpack-14', './assets/img/deals/backpack.svg', 67.00, 129.00, 48, 'TrailModo', 'Outdoors', 'Free shipping', 'PACKLIGHT', 'live', false, false, 377, 106, 18, array['Outdoors','Travel','Free Shipping']),
    ('northline-mesh-wifi-router-pack', 'Northline mesh Wi-Fi 6 router two-pack for apartments', 'Simple whole-home coverage with app setup, guest network, and device priority.', './deal.html?id=deal-router-16', './assets/img/deals/laptop.svg', 129.00, 249.00, 48, 'Northline Tech', 'Electronics', 'Free shipping', '', 'live', false, false, 488, 153, 31, array['Electronics','Free Shipping','Home']),
    ('studiodock-4k-webcam-light', 'StudioDock 4K webcam with key light and privacy shutter', 'Creator-friendly webcam bundle with adjustable light and compact mount.', './deal.html?id=deal-camera-17', './assets/img/deals/monitor.svg', 79.00, 149.00, 47, 'StudioDock', 'Electronics', 'Free shipping', 'LOOKCLEAR', 'live', false, false, 365, 111, 20, array['Electronics','Desk setup','Free Shipping']),
    ('skyway-weekend-stay-credit', 'Skyway boutique weekend stay credit for select cities', 'Flexible hotel credit package for off-peak weekend stays and late checkout.', './deal.html?id=deal-hotel-18', './assets/img/deals/luggage.svg', 189.00, 310.00, 39, 'Skyway Travel', 'Travel', 'Digital booking credit', 'WEEKEND30', 'live', false, false, 296, 88, 34, array['Travel','Digital']),
    ('haven-task-lamp-wireless-charging', 'Haven dimmable task lamp with wireless charging base', 'Desk lamp with touch controls, warm and cool modes, and a weighted base.', './deal.html?id=deal-lamp-19', './assets/img/deals/lamp.svg', 38.00, 84.00, 55, 'Haven Home', 'Home', '$5 shipping', 'LAMP10', 'live', false, false, 236, 69, 16, array['Home','Desk setup']),
    ('roast-co-burr-grinder', 'Roast & Co. burr grinder with dose timer', 'Compact grinder for drip, press, and espresso-style recipes.', './deal.html?id=deal-grinder-20', './assets/img/deals/coffee.svg', 74.00, 139.00, 47, 'Roast & Co.', 'Kitchen', 'Free shipping', 'GRIND15', 'live', false, false, 318, 94, 19, array['Kitchen','Coffee','Free Shipping']),
    ('pixelforge-pro-controller-dock', 'PixelForge pro controller dock bundle with hall sticks', 'Low-latency controller with charging dock, remappable buttons, and textured grips.', './deal.html?id=deal-controller-21', './assets/img/deals/console.svg', 59.00, 109.00, 46, 'PixelForge', 'Gaming', 'Free shipping', 'DOCKPLAY', 'live', false, false, 449, 140, 28, array['Gaming','Free Shipping']),
    ('vistasupply-patio-lounge-pair', 'VistaSupply fold-flat patio lounge chair pair', 'Outdoor chair pair with breathable sling fabric and compact winter storage.', './deal.html?id=deal-patio-22', './assets/img/deals/chair.svg', 96.00, 180.00, 47, 'VistaSupply', 'Outdoors', '$8 delivery', '', 'live', false, false, 284, 79, 14, array['Outdoors','Home']),
    ('brightcart-fitness-watch-gps', 'BrightCart fitness watch with GPS and sleep tracking', 'Slim wellness watch with always-on stats and a seven-day battery estimate.', './deal.html?id=deal-watch-23', './assets/img/deals/watch.svg', 118.00, 229.00, 48, 'BrightCart', 'Electronics', 'Free shipping', 'MOVE30', 'live', true, true, 536, 188, 44, array['Electronics','Free Shipping','Popular']),
    ('urbantrail-convertible-weekender-duffel', 'UrbanTrail convertible weekender duffel with shoe garage', 'Carry-on friendly duffel with padded strap, shoe storage, and wipe-clean lining.', './deal.html?id=deal-duffel-24', './assets/img/deals/luggage.svg', 54.00, 110.00, 51, 'UrbanTrail', 'Travel', 'Free shipping over $50', 'GOFAST', 'expiring_soon', false, false, 308, 90, 21, array['Travel','Fashion','Expiring Soon']),
    ('glowlab-compact-grooming-kit', 'GlowLab compact grooming kit with travel charging case', 'Quiet grooming set with five attachments, washable heads, and a pocket case.', './deal.html?id=deal-groom-26', './assets/img/deals/skincare.svg', 39.00, 86.00, 55, 'GlowLab', 'Wellness', '$4 shipping', 'GLOW15', 'live', false, false, 224, 68, 12, array['Wellness','Travel']),
    ('pawly-washable-bolster-pet-bed', 'Pawly washable bolster pet bed with cooling liner', 'Supportive bed with removable cover, low entry edge, and summer cooling insert.', './deal.html?id=deal-petbed-28', './assets/img/deals/pet.svg', 48.00, 94.00, 49, 'Pawly', 'Pets', 'Free shipping over $40', '', 'live', false, false, 287, 83, 15, array['Pets','Home'])
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
    ('GlowLab', 'REST20', 'Sleep and recovery essentials', 'Wellness', true),
    ('UrbanTrail', 'RAINREADY', 'Outdoor layers markdown event', 'Fashion', true),
    ('TrailModo', 'PACKLIGHT', 'Weatherproof travel bags', 'Outdoors', true),
    ('BrightCart', 'MOVE30', 'Wearable tech event code', 'Electronics', true),
    ('Roast & Co.', 'FRESHBEANS', 'Coffee sampler launch pricing', 'Kitchen', true),
    ('Haven Home', 'STANDUP', 'Desk frame and office comfort savings', 'Home', false)
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
