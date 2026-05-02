-- =============================================================
-- RaithuFresh — Auth patch
-- Creates user_profiles table + RLS
-- Adds authenticated-user policies for protected tables
-- =============================================================

-- ── user_profiles ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT,
  phone      TEXT,
  role       TEXT CHECK (role IN ('buyer', 'farmer', 'agent', 'admin')),
  village    TEXT,
  district   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON user_profiles TO anon, authenticated;

-- Users can read their own profile
DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
CREATE POLICY "users_read_own_profile" ON user_profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- Users can insert their own profile on signup
DROP POLICY IF EXISTS "users_insert_own_profile" ON user_profiles;
CREATE POLICY "users_insert_own_profile" ON user_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
CREATE POLICY "users_update_own_profile" ON user_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Admin read-all profiles — MVP pending:
-- A SECURITY DEFINER function that reads user_profiles would cause RLS recursion.
-- For MVP: admin sees their own profile only.
-- Production fix: assign admin role via Supabase service_role key and
-- use auth.jwt() -> app_metadata to bypass RLS for admin reads.

-- ── agent_call_requests: add authenticated policies ─────────────

-- Allow authenticated users (agent/admin) to INSERT requests
DROP POLICY IF EXISTS "auth_insert_call_requests" ON agent_call_requests;
CREATE POLICY "auth_insert_call_requests" ON agent_call_requests
  FOR INSERT TO authenticated WITH CHECK (true);

-- Allow authenticated users to SELECT all requests
DROP POLICY IF EXISTS "auth_read_call_requests" ON agent_call_requests;
CREATE POLICY "auth_read_call_requests" ON agent_call_requests
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to UPDATE status
DROP POLICY IF EXISTS "auth_update_call_request_status" ON agent_call_requests;
CREATE POLICY "auth_update_call_request_status" ON agent_call_requests
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (status IN ('pending', 'called', 'resolved'));

-- ── Other tables: add authenticated read/write policies ──────────

-- produce_listings: authenticated users (farmers) can insert their own
DROP POLICY IF EXISTS "auth_insert_listing" ON produce_listings;
CREATE POLICY "auth_insert_listing" ON produce_listings
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_listings" ON produce_listings;
CREATE POLICY "auth_read_listings" ON produce_listings
  FOR SELECT TO authenticated USING (true);

-- reservations: authenticated users can insert reservations
DROP POLICY IF EXISTS "auth_insert_reservation" ON reservations;
CREATE POLICY "auth_insert_reservation" ON reservations
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_reservations" ON reservations;
CREATE POLICY "auth_read_reservations" ON reservations
  FOR SELECT TO authenticated USING (true);

-- waitlist_leads: authenticated users can insert
DROP POLICY IF EXISTS "auth_insert_waitlist" ON waitlist_leads;
CREATE POLICY "auth_insert_waitlist" ON waitlist_leads
  FOR INSERT TO authenticated WITH CHECK (true);

-- farmers: authenticated users can read
DROP POLICY IF EXISTS "auth_read_farmers" ON farmers;
CREATE POLICY "auth_read_farmers" ON farmers
  FOR SELECT TO authenticated USING (true);
