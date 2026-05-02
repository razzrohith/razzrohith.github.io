-- patch-buyer-cancel-reservation.sql
-- Allows logged-in buyers to cancel ONLY their own PENDING reservations.
-- Safe to run multiple times (idempotent).
-- Does NOT weaken farmer/admin policies.
-- Does NOT allow buyers to update any other fields.

-- RLS must already be enabled (from previous patch). Safe no-op if re-run.
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Buyer UPDATE policy — strictly scoped:
--   USING:      buyer_user_id = auth.uid() AND status = 'pending'
--               (buyer must own it; it must currently be pending)
--   WITH CHECK: buyer_user_id = auth.uid() AND status = 'cancelled'
--               (the only new status allowed is 'cancelled')
--
-- This means:
--   - Buyer can only touch their own reservations.
--   - Buyer can only act on pending reservations.
--   - Buyer can only set the status to 'cancelled'.
--   - Buyer cannot set status to 'confirmed' or 'completed'.
--   - Buyer cannot update buyer_name, buyer_phone, listing_id, quantity_kg, etc.
--   - Farmer/admin UPDATE policies are separate and untouched.

DROP POLICY IF EXISTS buyers_cancel_own_pending_reservations ON reservations;
CREATE POLICY buyers_cancel_own_pending_reservations ON reservations
  FOR UPDATE
  TO authenticated
  USING (buyer_user_id = auth.uid() AND status = 'pending')
  WITH CHECK (buyer_user_id = auth.uid() AND status = 'cancelled');

-- ── Notes ───────────────────────────────────────────────────────────────────
-- 1. No DELETE policy is added. Buyers cannot delete reservations.
-- 2. Farmer UPDATE policy (updateReservationStatus) is untouched.
-- 3. Admin UPDATE policy (updateAdminReservationStatus) is untouched.
-- 4. The client helper cancelBuyerReservation() calls .update({ status: 'cancelled' })
--    and the RLS USING+WITH CHECK blocks everything else server-side.
