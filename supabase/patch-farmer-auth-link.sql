-- =============================================================
-- RaithuFresh — Farmer auth link patch
-- Adds user_id to farmers table and tightens produce_listings RLS
-- =============================================================

-- ── Step 1: Add user_id column to farmers (safe, idempotent) ─────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'farmers' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE farmers
      ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── Step 2: Unique constraint (safe) ──────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'farmers_user_id_unique'
  ) THEN
    ALTER TABLE farmers
      ADD CONSTRAINT farmers_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- ── Step 3: Index ─────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_farmers_user_id ON farmers (user_id);

-- ── Step 4: Grants ────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON farmers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON produce_listings TO authenticated;

-- ── Step 5: farmers RLS ───────────────────────────────────────────────────

-- Remove the old broad auth read policy added in patch-auth.sql
DROP POLICY IF EXISTS "auth_read_farmers" ON farmers;

-- Authenticated users can read all farmers (needed for joined browse queries)
DROP POLICY IF EXISTS "auth_read_all_farmers" ON farmers;
CREATE POLICY "auth_read_all_farmers" ON farmers
  FOR SELECT TO authenticated USING (true);

-- Farmers can insert their own row (user_id must equal auth user)
DROP POLICY IF EXISTS "farmer_insert_own_row" ON farmers;
CREATE POLICY "farmer_insert_own_row" ON farmers
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Farmers can update their own row only
DROP POLICY IF EXISTS "farmer_update_own_row" ON farmers;
CREATE POLICY "farmer_update_own_row" ON farmers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Step 6: produce_listings RLS — farmer-scoped ──────────────────────────

-- Drop the broad auth insert policy added in patch-auth.sql
DROP POLICY IF EXISTS "auth_insert_listing" ON produce_listings;

-- Farmer can only insert listings where farmer_id belongs to their own farmers row
DROP POLICY IF EXISTS "farmer_insert_own_listing" ON produce_listings;
CREATE POLICY "farmer_insert_own_listing" ON produce_listings
  FOR INSERT TO authenticated
  WITH CHECK (
    farmer_id IN (
      SELECT id FROM farmers WHERE user_id = auth.uid()
    )
  );

-- Farmer can update only their own listings (status changes, edits)
DROP POLICY IF EXISTS "farmer_update_own_listing" ON produce_listings;
CREATE POLICY "farmer_update_own_listing" ON produce_listings
  FOR UPDATE TO authenticated
  USING (
    farmer_id IN (
      SELECT id FROM farmers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    farmer_id IN (
      SELECT id FROM farmers WHERE user_id = auth.uid()
    )
  );

-- Farmer can read all their own listings regardless of status
-- Note: auth_read_listings (SELECT all for authenticated, added in patch-auth.sql)
-- already covers this. No change needed for SELECT — authenticated users can read all
-- listings, which allows both browse and farmer-own-listing views.

-- ── Notes ──────────────────────────────────────────────────────────────────
-- Seed farmers (from seed.sql) have user_id = NULL. This is intentional.
-- They remain visible on Browse Produce because public_read_active_listings
-- (status = 'active') is unaffected and the farmers join works for both
-- verified=true (anon) and all (authenticated).
--
-- Admin access to produce_listings UPDATE is not scoped here.
-- For production, add a separate admin bypass policy using
-- auth.jwt() -> 'app_metadata' -> 'role' = 'admin'.
