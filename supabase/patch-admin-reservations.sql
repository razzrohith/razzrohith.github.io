-- =============================================================
-- RaithuFresh — Admin reservation access patch
-- Allows admin users (user_profiles.role = 'admin') to read
-- all reservations and update only the status column.
-- Does NOT weaken the existing farmer policies from
-- patch-farmer-reservations.sql.
-- =============================================================

-- ── Step 1: Grants (idempotent) ───────────────────────────────────────────
-- GRANT SELECT is already done in patch-farmer-reservations.sql.
-- GRANT UPDATE(status) is already done in patch-farmer-reservations.sql.
-- Re-stating them here is harmless (idempotent) and makes this patch
-- self-contained in case it is applied in isolation.

GRANT SELECT        ON reservations TO authenticated;
GRANT UPDATE(status) ON reservations TO authenticated;

-- ── Step 2: Admin SELECT all reservations ────────────────────────────────
-- Allows admin users to read every reservation row.
-- Gated entirely on user_profiles.role = 'admin'.

DROP POLICY IF EXISTS "admin_read_all_reservations" ON reservations;
CREATE POLICY "admin_read_all_reservations" ON reservations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   user_profiles up
      WHERE  up.id   = auth.uid()
      AND    up.role = 'admin'
    )
  );

-- ── Step 3: Admin UPDATE status only ─────────────────────────────────────
-- Column-level GRANT (step 1) already restricts what columns can change.
-- This RLS policy additionally restricts which rows an admin can touch.
-- The WITH CHECK also re-validates the status domain for belt-and-suspenders.

DROP POLICY IF EXISTS "admin_update_reservation_status" ON reservations;
CREATE POLICY "admin_update_reservation_status" ON reservations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   user_profiles up
      WHERE  up.id   = auth.uid()
      AND    up.role = 'admin'
    )
  )
  WITH CHECK (
    status IN ('pending', 'confirmed', 'cancelled', 'completed')
    AND EXISTS (
      SELECT 1
      FROM   user_profiles up
      WHERE  up.id   = auth.uid()
      AND    up.role = 'admin'
    )
  );

-- ── Notes ──────────────────────────────────────────────────────────────────
-- Existing farmer policies remain intact:
--   farmer_read_own_reservations    — farmer sees only their own
--   farmer_update_own_reservation_status — farmer updates only their own status
--
-- Buyer INSERT is unchanged (public + auth INSERT policies from schema.sql).
--
-- Buyer phone security:
--   buyer_phone is visible to:
--     - the owning farmer (via farmer_read_own_reservations)
--     - admin users (via admin_read_all_reservations)
--   It is NOT accessible by anon, other buyers, or other farmers.
--
-- MVP limitation:
--   Admin access is gated on user_profiles.role = 'admin'.
--   In production, harden with JWT claims (app_metadata.role = 'admin')
--   or a server-side Postgres function so clients cannot tamper with
--   their own user_profiles row to escalate privileges.
