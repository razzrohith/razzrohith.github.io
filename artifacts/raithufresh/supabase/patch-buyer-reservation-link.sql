-- patch-buyer-reservation-link.sql
-- Links reservations to Supabase auth users for buyer dashboard access.
-- Safe to run multiple times (all statements are idempotent).
-- Does NOT drop or alter any existing farmer/admin RLS policies.

-- ── Step 1: Add buyer_user_id column if not already present ─────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'buyer_user_id'
  ) THEN
    ALTER TABLE reservations
      ADD COLUMN buyer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Step 2: Index for fast buyer dashboard queries ──────────────────────────

CREATE INDEX IF NOT EXISTS idx_reservations_buyer_user_id
  ON reservations(buyer_user_id)
  WHERE buyer_user_id IS NOT NULL;

-- ── Step 3: RLS must be enabled (safe no-op if already on) ─────────────────

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- ── Step 4: Buyer SELECT — logged-in buyer sees only their own reservations ──

DROP POLICY IF EXISTS buyers_select_own_reservations ON reservations;
CREATE POLICY buyers_select_own_reservations ON reservations
  FOR SELECT
  TO authenticated
  USING (buyer_user_id = auth.uid());

-- ── Step 5: Authenticated INSERT — logged-in buyer inserts with their uid ───
-- Allows buyer_user_id = auth.uid() (logged-in) OR NULL (backward compat for
-- authenticated users who submitted before this patch was applied).

DROP POLICY IF EXISTS buyers_insert_own_reservations ON reservations;
CREATE POLICY buyers_insert_own_reservations ON reservations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    buyer_user_id = auth.uid()
    OR buyer_user_id IS NULL
  );

-- ── Notes ───────────────────────────────────────────────────────────────────
-- 1. Existing anon INSERT policy (for guest buyers) is NOT touched.
-- 2. Existing farmer SELECT/UPDATE policies are NOT touched.
-- 3. Existing admin SELECT/UPDATE policies are NOT touched.
-- 4. Old guest reservations with buyer_user_id = NULL remain intact and
--    continue to be visible to farmers and admins as before.
-- 5. Buyer phone (buyer_phone column) is NOT selected in getReservationsForCurrentBuyer —
--    only the farmer phone is included for pickup coordination.
