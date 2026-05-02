-- =============================================================
-- RaithuFresh — Produce Listing Update Security Patch
-- Removes anon write grants and restricts authenticated UPDATE
-- to safe farmer-editable columns only.
-- =============================================================
-- Changes:
--   A. Revoke anon UPDATE and DELETE (table-level + column-level)
--   B. Revoke broad authenticated UPDATE (covers all columns)
--   C. Grant column-level UPDATE to authenticated for safe fields only
--      Protected: id, farmer_id, created_at
--   D. Keep all existing RLS policies unchanged
-- =============================================================

-- ── A. Remove anon write access ────────────────────────────────────────────

-- Revoke table-level anon write grants
REVOKE UPDATE ON produce_listings FROM anon;
REVOKE DELETE ON produce_listings FROM anon;

-- anon SELECT is retained (needed for public Browse Produce)
-- public_read_active_listings RLS policy is NOT touched

-- ── B. Remove broad authenticated UPDATE (covers all columns) ──────────────

REVOKE UPDATE ON produce_listings FROM authenticated;

-- ── C. Grant column-level UPDATE for safe farmer-editable fields ───────────

GRANT UPDATE (
  produce_name,
  category,
  quantity_kg,
  price_per_kg,
  harvest_datetime,
  pickup_location,
  district,
  distance_km,
  quality_notes,
  status,
  updated_at
) ON produce_listings TO authenticated;

-- Protected columns (no UPDATE grant):
--   id         — primary key, must never change
--   farmer_id  — ownership anchor, farmer cannot re-assign listing to another farmer
--   created_at — immutable audit timestamp

-- ── D. RLS policy — kept as-is ────────────────────────────────────────────

-- farmer_update_own_listing was created in patch-farmer-auth-link.sql.
-- It enforces row-level ownership via farmer_id → farmers.user_id = auth.uid().
-- Column-level grants now add a second, independent enforcement layer:
-- even if the RLS USING/CHECK somehow matched, the column grant blocks
-- any attempt to UPDATE farmer_id, id, or created_at at the privilege layer.
--
-- Recreate idempotently to ensure WITH CHECK is present:
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

-- farmer_insert_own_listing is not touched (INSERT is unchanged)

-- ── Verification summary ───────────────────────────────────────────────────
-- After applying this patch:
--
-- anon on produce_listings:
--   SELECT  — allowed (public_read_active_listings, status='active' only)
--   INSERT  — BLOCKED (revoked in patch-post-qa-security-hardening.sql)
--   UPDATE  — BLOCKED (revoked here, both table and column level)
--   DELETE  — BLOCKED (revoked here)
--
-- authenticated on produce_listings:
--   SELECT         — allowed (auth_read_listings, all statuses)
--   INSERT         — allowed via farmer_insert_own_listing (farmer_id ownership required)
--   UPDATE id      — BLOCKED (no column grant)
--   UPDATE farmer_id — BLOCKED (no column grant)
--   UPDATE created_at — BLOCKED (no column grant)
--   UPDATE produce_name, category, quantity_kg, price_per_kg,
--          harvest_datetime, pickup_location, district, distance_km,
--          quality_notes, status, updated_at
--                 — allowed (column-level grant + RLS row ownership check)
--   UPDATE other farmer's listing — BLOCKED (RLS farmer_update_own_listing)
