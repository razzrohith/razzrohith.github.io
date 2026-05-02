-- =============================================================
-- RaithuFresh — Post-QA Security Hardening Patch
-- Applied after full role-based QA and RLS verification pass.
-- =============================================================
-- Changes:
--   A. produce_listings  — remove anon INSERT
--   B. agent_call_requests — remove anon SELECT/INSERT/UPDATE,
--      restrict authenticated access to agent/admin role only
-- =============================================================

-- ── A. produce_listings ────────────────────────────────────────────────────

-- Drop the schema.sql-era anon insert policy (no farmer ownership check)
DROP POLICY IF EXISTS "public_insert_listings" ON produce_listings;

-- Revoke INSERT from anon at grant level
-- (SELECT is retained so Browse Produce still works publicly)
REVOKE INSERT ON produce_listings FROM anon;

-- Verify the farmer-scoped INSERT policy still exists (created in patch-farmer-auth-link.sql).
-- No new policy needed: farmer_insert_own_listing already enforces:
--   farmer_id IN (SELECT id FROM farmers WHERE user_id = auth.uid())

-- ── B. agent_call_requests ─────────────────────────────────────────────────

-- 1. Remove all anon policies
DROP POLICY IF EXISTS "public_insert_call_requests"        ON agent_call_requests;
DROP POLICY IF EXISTS "public_read_call_requests"          ON agent_call_requests;
DROP POLICY IF EXISTS "public_update_call_request_status"  ON agent_call_requests;

-- 2. Remove broad authenticated policies that allow ALL roles to read/update/insert
DROP POLICY IF EXISTS "auth_insert_call_requests"          ON agent_call_requests;
DROP POLICY IF EXISTS "auth_read_call_requests"            ON agent_call_requests;
DROP POLICY IF EXISTS "auth_update_call_request_status"    ON agent_call_requests;

-- 3. Revoke all grants from anon on agent_call_requests
REVOKE SELECT, INSERT, UPDATE, DELETE ON agent_call_requests FROM anon;

-- 4. Add role-scoped SELECT: agent and admin only
CREATE POLICY "agent_admin_read_call_requests" ON agent_call_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('agent', 'admin')
    )
  );

-- 5. Add role-scoped INSERT: agent and admin only
--    (No public farmer callback form exists — only AgentDashboard creates requests)
CREATE POLICY "agent_admin_insert_call_requests" ON agent_call_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('agent', 'admin')
    )
  );

-- 6. Add role-scoped UPDATE: agent and admin only, status domain enforced
CREATE POLICY "agent_admin_update_call_request_status" ON agent_call_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('agent', 'admin')
    )
  )
  WITH CHECK (
    status IN ('pending', 'called', 'resolved')
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('agent', 'admin')
    )
  );

-- ── Verification notes ─────────────────────────────────────────────────────
-- After applying this patch:
--
-- produce_listings:
--   anon  : SELECT active listings only (public_read_active_listings retained)
--   anon  : INSERT BLOCKED (policy dropped + REVOKE)
--   auth  : SELECT all listings (auth_read_listings retained)
--   auth  : INSERT only for own farmer_id (farmer_insert_own_listing retained)
--   auth  : UPDATE only for own farmer_id (farmer_update_own_listing retained)
--
-- agent_call_requests:
--   anon        : ALL access BLOCKED (policies dropped + REVOKE)
--   buyer/farmer: SELECT, INSERT, UPDATE BLOCKED (role check in policies)
--   agent/admin : SELECT all requests (agent_admin_read_call_requests)
--   agent/admin : INSERT new requests (agent_admin_insert_call_requests)
--   agent/admin : UPDATE status in ('pending','called','resolved') only
