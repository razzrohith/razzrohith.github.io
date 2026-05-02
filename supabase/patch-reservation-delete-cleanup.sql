-- =============================================================
-- RaithuFresh — Reservation DELETE Grant Cleanup
-- Removes leftover DELETE grants on reservations from anon
-- and authenticated. No DELETE policy is added.
-- Reservation lifecycle is managed through status changes only.
-- =============================================================

REVOKE DELETE ON reservations FROM authenticated;
REVOKE DELETE ON reservations FROM anon;

-- No DELETE RLS policy is added.
-- Reservation records are never deleted in MVP.
-- Status changes (pending → confirmed → completed / cancelled)
-- replace deletion as the reservation lifecycle mechanism.
