-- =============================================================
-- RaithuFresh — Farmer reservation access patch
-- Gives farmers read + limited update access to reservations
-- that belong to their own produce listings only.
-- =============================================================

-- ── Step 1: Grants ────────────────────────────────────────────────────────

-- Allow authenticated to read reservations (controlled by RLS below)
GRANT SELECT ON reservations TO authenticated;

-- Allow authenticated to update ONLY the status column.
-- Column-level GRANT means any attempt to UPDATE other columns is blocked
-- at the privilege layer, before RLS even runs.
GRANT UPDATE(status) ON reservations TO authenticated;

-- ── Step 2: Drop the broad read-all policy from patch-auth.sql ────────────

-- This policy allowed any authenticated user to read ALL reservations —
-- which is too permissive. We replace it with a farmer-scoped one.
DROP POLICY IF EXISTS "auth_read_reservations" ON reservations;

-- ── Step 3: Farmer-scoped SELECT ──────────────────────────────────────────

-- A farmer can only SELECT reservations where:
--   reservation.listing_id → produce_listings.farmer_id → farmers.user_id = auth.uid()
DROP POLICY IF EXISTS "farmer_read_own_reservations" ON reservations;
CREATE POLICY "farmer_read_own_reservations" ON reservations
  FOR SELECT TO authenticated
  USING (
    listing_id IN (
      SELECT pl.id
      FROM   produce_listings pl
      JOIN   farmers f ON f.id = pl.farmer_id
      WHERE  f.user_id = auth.uid()
    )
  );

-- ── Step 4: Farmer-scoped UPDATE (status only) ────────────────────────────

-- A farmer can only UPDATE a reservation that belongs to their own listing.
-- Column-level GRANT (step 1) ensures only the status column can be changed.
-- The CHECK validates that the new status is one of the allowed values;
-- the DB CHECK constraint on the table also enforces this.
DROP POLICY IF EXISTS "farmer_update_own_reservation_status" ON reservations;
CREATE POLICY "farmer_update_own_reservation_status" ON reservations
  FOR UPDATE TO authenticated
  USING (
    listing_id IN (
      SELECT pl.id
      FROM   produce_listings pl
      JOIN   farmers f ON f.id = pl.farmer_id
      WHERE  f.user_id = auth.uid()
    )
  )
  WITH CHECK (
    status IN ('pending', 'confirmed', 'cancelled', 'completed')
    AND listing_id IN (
      SELECT pl.id
      FROM   produce_listings pl
      JOIN   farmers f ON f.id = pl.farmer_id
      WHERE  f.user_id = auth.uid()
    )
  );

-- ── Notes ──────────────────────────────────────────────────────────────────
-- Public INSERT on reservations (buyers) is unchanged:
--   "public_insert_reservations" — FOR INSERT TO anon WITH CHECK (true)
-- Auth INSERT on reservations is unchanged:
--   "auth_insert_reservation" — FOR INSERT TO authenticated WITH CHECK (true)
--
-- Admin read of all reservations:
--   For MVP, admin counting may return only admin's own farmer's reservations
--   (or 0 if admin has no farmer row). AdminDashboard falls back to mock counts.
--   Production fix: add policy using auth.jwt() -> 'app_metadata' -> 'role' = 'admin'.
--
-- Buyer phone security:
--   buyer_phone is visible only to the farmer who owns the listing.
--   Public (anon) users cannot SELECT from reservations — no anon SELECT policy exists.
