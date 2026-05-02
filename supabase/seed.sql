-- =============================================================
-- RaithuFresh — Seed Data (Telangana farmers and produce)
-- Run AFTER schema.sql
-- =============================================================

-- ─── Farmers ─────────────────────────────────────────────────
INSERT INTO farmers (id, name, phone, village, district, rating, verified) VALUES
  ('11111111-0001-0001-0001-000000000001', 'Ramaiah',       '9876543210', 'Shadnagar',   'Rangareddy',  4.8, true),
  ('11111111-0001-0001-0001-000000000002', 'Lakshmi Devi',  '9876543211', 'Vikarabad',   'Vikarabad',   4.9, true),
  ('11111111-0001-0001-0001-000000000003', 'Venkat Rao',    '9876543212', 'Narayanpet',  'Narayanpet',  4.5, true),
  ('11111111-0001-0001-0001-000000000004', 'Srinivas',      '9876543213', 'Siddipet',    'Siddipet',    4.2, true),
  ('11111111-0001-0001-0001-000000000005', 'Yellamma',      '9876543214', 'Nizamabad',   'Nizamabad',   4.7, true),
  ('11111111-0001-0001-0001-000000000006', 'Narayana',      '9876543215', 'Khammam',     'Khammam',     4.6, true),
  ('11111111-0001-0001-0001-000000000007', 'Padma Bai',     '9876543216', 'Warangal',    'Warangal',    4.9, true),
  ('11111111-0001-0001-0001-000000000008', 'Suresh Kumar',  '9876543217', 'Karimnagar',  'Karimnagar',  4.4, true)
ON CONFLICT (id) DO NOTHING;

-- ─── Produce Listings ─────────────────────────────────────────
INSERT INTO produce_listings
  (farmer_id, produce_name, category, quantity_kg, price_per_kg, harvest_datetime, pickup_location, district, distance_km, quality_notes, status)
VALUES
  ('11111111-0001-0001-0001-000000000001', 'Mango (Banaganapalli)', 'Fruit',     500, 80,  now() + interval '2 days', 'Shadnagar Main Market',  'Rangareddy', 12, 'Organic, naturally ripened', 'active'),
  ('11111111-0001-0001-0001-000000000002', 'Tomato',                'Vegetable', 200, 25,  now(),                     'Vikarabad Farm Gate',    'Vikarabad',  5,  'Freshly plucked today morning', 'active'),
  ('11111111-0001-0001-0001-000000000003', 'Banana',                'Fruit',     300, 40,  now() - interval '1 day', 'Narayanpet Center',       'Narayanpet', 22, NULL, 'active'),
  ('11111111-0001-0001-0001-000000000004', 'Onion',                 'Vegetable', 400, 30,  now() - interval '1 day', 'Siddipet Storage',        'Siddipet',   18, NULL, 'active'),
  ('11111111-0001-0001-0001-000000000005', 'Guava',                 'Fruit',     100, 50,  now() + interval '1 day', 'Nizamabad Orchard',       'Nizamabad',  30, 'Sweet and firm', 'active'),
  ('11111111-0001-0001-0001-000000000006', 'Brinjal (Baingan)',     'Vegetable', 80,  35,  now(),                     'Khammam Market',          'Khammam',    8,  NULL, 'active'),
  ('11111111-0001-0001-0001-000000000007', 'Papaya',                'Fruit',     150, 45,  now() - interval '1 day', 'Warangal Farm',           'Warangal',   15, NULL, 'active'),
  ('11111111-0001-0001-0001-000000000008', 'Green Chilli',          'Vegetable', 50,  60,  now(),                     'Karimnagar Gate',         'Karimnagar', 10, 'Very spicy', 'active'),
  ('11111111-0001-0001-0001-000000000001', 'Watermelon',            'Fruit',     600, 20,  now() + interval '1 day', 'Shadnagar Farm',          'Rangareddy', 12, NULL, 'active'),
  ('11111111-0001-0001-0001-000000000002', 'Okra (Bhindi)',         'Vegetable', 60,  40,  now(),                     'Vikarabad Farm Gate',     'Vikarabad',  5,  'Tender', 'active'),
  ('11111111-0001-0001-0001-000000000003', 'Cucumber',              'Vegetable', 120, 25,  now() - interval '1 day', 'Narayanpet Center',       'Narayanpet', 22, NULL, 'active'),
  ('11111111-0001-0001-0001-000000000004', 'Tomato',                'Vegetable', 250, 22,  now(),                     'Siddipet Storage',        'Siddipet',   18, NULL, 'active'),
  ('11111111-0001-0001-0001-000000000005', 'Mango (Dasheri)',       'Fruit',     400, 90,  now() + interval '2 days', 'Nizamabad Orchard',      'Nizamabad',  30, NULL, 'active'),
  ('11111111-0001-0001-0001-000000000006', 'Banana',                'Fruit',     200, 38,  now() - interval '1 day', 'Khammam Market',          'Khammam',    8,  NULL, 'active'),
  ('11111111-0001-0001-0001-000000000007', 'Onion',                 'Vegetable', 500, 28,  now() + interval '2 days', 'Warangal Farm',          'Warangal',   15, NULL, 'active');
