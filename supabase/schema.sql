-- =============================================================
-- RaithuFresh — Supabase Schema
-- MVP-level security. Tighten RLS policies when real auth is added.
-- =============================================================

-- ─── 1. waitlist_leads ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS waitlist_leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  role        TEXT CHECK (role IN ('buyer', 'farmer', 'agent')),
  town        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE waitlist_leads ENABLE ROW LEVEL SECURITY;

-- MVP: anyone can join the waitlist (no auth required)
CREATE POLICY "public_insert_waitlist" ON waitlist_leads
  FOR INSERT TO anon WITH CHECK (true);

-- ─── 2. farmers ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS farmers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  phone          TEXT,
  village        TEXT,
  district       TEXT,
  rating         NUMERIC DEFAULT 0,
  verified       BOOLEAN DEFAULT false,
  assisted_mode  BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE farmers ENABLE ROW LEVEL SECURITY;

-- MVP: verified farmer profiles are public
CREATE POLICY "public_read_verified_farmers" ON farmers
  FOR SELECT TO anon USING (verified = true);

-- ─── 3. produce_listings ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS produce_listings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id        UUID REFERENCES farmers(id),
  produce_name     TEXT NOT NULL,
  category         TEXT CHECK (category IN ('Fruit', 'Vegetable')),
  quantity_kg      NUMERIC NOT NULL,
  price_per_kg     NUMERIC NOT NULL,
  harvest_datetime TIMESTAMPTZ,
  pickup_location  TEXT,
  district         TEXT,
  distance_km      NUMERIC,
  quality_notes    TEXT,
  status           TEXT DEFAULT 'active' CHECK (status IN ('active', 'reserved', 'sold', 'out_of_stock')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE produce_listings ENABLE ROW LEVEL SECURITY;

-- MVP: anyone can view active listings
CREATE POLICY "public_read_active_listings" ON produce_listings
  FOR SELECT TO anon USING (status = 'active');

-- MVP: any authenticated session can insert (farmer creates listing)
-- Tighten to farmer's own rows when auth is added
CREATE POLICY "public_insert_listings" ON produce_listings
  FOR INSERT TO anon WITH CHECK (true);

-- ─── 4. reservations ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID REFERENCES produce_listings(id),
  buyer_name      TEXT NOT NULL,
  buyer_phone     TEXT NOT NULL,
  quantity_kg     NUMERIC NOT NULL,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  payment_method  TEXT DEFAULT 'Cash or UPI directly to farmer',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- MVP: anyone can make a reservation
CREATE POLICY "public_insert_reservations" ON reservations
  FOR INSERT TO anon WITH CHECK (true);

-- ─── 5. agent_call_requests ──────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_call_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_name   TEXT NOT NULL,
  farmer_phone  TEXT NOT NULL,
  village       TEXT,
  request_note  TEXT,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'called', 'resolved')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE agent_call_requests ENABLE ROW LEVEL SECURITY;

-- MVP: anyone can submit a call request
CREATE POLICY "public_insert_call_requests" ON agent_call_requests
  FOR INSERT TO anon WITH CHECK (true);
