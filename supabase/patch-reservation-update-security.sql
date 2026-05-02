-- =============================================================
-- RaithuFresh — Reservation Update Security + Produce Listing Cleanup
-- Restricts reservation UPDATE to status column only.
-- Removes leftover authenticated DELETE on produce_listings.
-- =============================================================
-- Changes:
--   A. reservations  — revoke broad UPDATE from anon + authenticated
--                      grant UPDATE(status) to authenticated only
--                      revoke DELETE from anon (leftover)
--   B. produce_listings — revoke DELETE from authenticated (leftover)
--
-- RLS policies are kept or recreated idempotently.
-- No INSERT/SELECT paths are changed.
-- =============================================================

-- ── A. reservations ────────────────────────────────────────────────────────

-- Remove all anon write access
REVOKE UPDATE ON reservations FROM anon;
REVOKE DELETE ON reservations FROM anon;

-- Remove broad authenticated UPDATE (covers all columns)
REVOKE UPDATE ON reservations FROM authenticated;

-- Grant UPDATE on status column only
-- Protected columns (no UPDATE grant): id, listing_id, buyer_name,
--   buyer_phone, quantity_kg, payment_method, created_at
GRANT UPDATE(status) ON reservations TO authenticated;

-- Recreate RLS UPDATE policies idempotently to ensure WITH CHECK is present
-- and status domain is enforced.

-- Farmer: update status on reservations linked to own listings only
DROP POLICY IF EXISTS "farmer_update_own_reservation_status" ON reservations;
CREATE POLICY "farmer_update_own_reservation_status" ON reservations
  FOR UPDATE TO authenticated
  USING (
    listing_id IN (
      SELECT pl.id
      FROM produce_listings pl
      JOIN farmers f ON f.id = pl.farmer_id
      WHERE f.user_id = auth.uid()
    )
  )
  WITH CHECK (
    status IN ('pending', 'confirmed', 'cancelled', 'completed')
    AND listing_id IN (
      SELECT pl.id
      FROM produce_listings pl
      JOIN farmers f ON f.id = pl.farmer_id
      WHERE f.user_id = auth.uid()
    )
  );

-- Admin: update any reservation status
DROP POLICY IF EXISTS "admin_update_reservation_status" ON reservations;
CREATE POLICY "admin_update_reservation_status" ON reservations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  )
  WITH CHECK (
    status IN ('pending', 'confirmed', 'cancelled', 'completed')
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- ── B. produce_listings — remove leftover authenticated DELETE ──────────────

REVOKE DELETE ON produce_listings FROM authenticated;

-- No DELETE RLS policy is added. Farmers do not need to delete listings
-- (they mark status as sold/out_of_stock instead).

-- ── Verification summary ───────────────────────────────────────────────────
-- After applying this patch:
--
-- reservations:
--   anon        : INSERT allowed (public_insert_reservations)
--   anon        : SELECT blocked (no anon SELECT policy)
--   anon        : UPDATE BLOCKED (revoked)
--   anon        : DELETE BLOCKED (revoked)
--   authenticated : INSERT allowed (auth_insert_reservation)
--   authenticated : SELECT — farmer sees own (farmer_read_own_reservations)
--                           admin sees all (admin_read_all_reservations)
--   authenticated : UPDATE id           BLOCKED (no column grant)
--   authenticated : UPDATE listing_id   BLOCKED (no column grant)
--   authenticated : UPDATE buyer_name   BLOCKED (no column grant)
--   authenticated : UPDATE buyer_phone  BLOCKED (no column grant)
--   authenticated : UPDATE quantity_kg  BLOCKED (no column grant)
--   authenticated : UPDATE payment_method BLOCKED (no column grant)
--   authenticated : UPDATE created_at   BLOCKED (no column grant)
--   authenticated : UPDATE status       — allowed only when RLS passes:
--                     farmer: own listing ownership check + domain check
--                     admin: role='admin' check + domain check
--
-- produce_listings:
--   authenticated : DELETE BLOCKED (revoked)
--   All other produce_listings grants/policies are unchanged.
