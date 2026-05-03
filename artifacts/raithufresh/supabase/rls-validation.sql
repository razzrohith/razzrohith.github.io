-- ============================================================
-- RaithuFresh — RLS Validation Script
-- READ-ONLY. Does not modify any policy, grant, or data.
-- Run against SUPABASE_DB_URL (postgres pooler) using:
--   psql "$SUPABASE_DB_URL" -f supabase/rls-validation.sql
-- ============================================================

-- ── 0. Overview: Which tables have RLS enabled? ──────────────

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  forcerowsecurity AS rls_forced
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'user_profiles', 'farmers', 'produce_listings',
    'reservations', 'agent_call_requests', 'waitlist_leads'
  )
ORDER BY tablename;

-- ── 1. All RLS policies on the core tables ───────────────────

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd          AS "command",
  qual         AS "using_expression",
  with_check   AS "with_check_expression"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'user_profiles', 'farmers', 'produce_listings',
    'reservations', 'agent_call_requests', 'waitlist_leads'
  )
ORDER BY tablename, cmd, policyname;

-- ── 2. Table-level privileges (column grants not shown here) ─

SELECT
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'user_profiles', 'farmers', 'produce_listings',
    'reservations', 'agent_call_requests', 'waitlist_leads'
  )
ORDER BY table_name, grantee, privilege_type;

-- ── 3. Column-level grants on sensitive tables ───────────────
-- Checks whether column-level UPDATE grants exist on protected columns.
-- Expected: no column-level grants override table-level RLS.

SELECT
  table_schema,
  table_name,
  column_name,
  grantee,
  privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name IN (
    'user_profiles', 'farmers', 'produce_listings',
    'reservations', 'agent_call_requests', 'waitlist_leads'
  )
ORDER BY table_name, column_name, grantee;

-- ── 4. user_profiles — expected policy checks ────────────────
-- Expected:
--   anon: SELECT own? No (no auth.uid match). INSERT not allowed.
--   authenticated: SELECT own (auth.uid = id). UPDATE own safe cols only.
--   Role column must never be updatable via RLS — verify WITH CHECK clause.

SELECT
  policyname,
  cmd,
  roles,
  qual         AS "using",
  with_check   AS "with_check"
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY cmd, policyname;

-- ── 5. farmers — expected policy checks ──────────────────────
-- Expected:
--   anon:  SELECT verified farmers (public read). No INSERT/UPDATE/DELETE.
--   authenticated farmer: INSERT/UPDATE own row (user_id = auth.uid()).
--   user cannot update another farmer's row.

SELECT
  policyname,
  cmd,
  roles,
  qual         AS "using",
  with_check   AS "with_check"
FROM pg_policies
WHERE tablename = 'farmers'
ORDER BY cmd, policyname;

-- ── 6. produce_listings — expected policy checks ─────────────
-- Expected:
--   anon:  SELECT active listings only (status = 'active'). No INSERT/UPDATE/DELETE.
--   authenticated farmer: INSERT only for own farmer_id. UPDATE own listing only.
--   Protected columns: id, farmer_id, created_at — must not be in WITH CHECK.

SELECT
  policyname,
  cmd,
  roles,
  qual         AS "using",
  with_check   AS "with_check"
FROM pg_policies
WHERE tablename = 'produce_listings'
ORDER BY cmd, policyname;

-- ── 7. reservations — expected policy checks ─────────────────
-- Expected:
--   anon:  INSERT (guest reservation). SELECT = none. UPDATE = none. DELETE = none.
--   buyer (authenticated): SELECT own (buyer_user_id = auth.uid()).
--                          UPDATE status = 'cancelled' on own pending reservation only.
--   farmer (authenticated): SELECT reservations on own listings. UPDATE status only.
--   admin:  SELECT all. UPDATE status only.
--   No DELETE for any role.

SELECT
  policyname,
  cmd,
  roles,
  qual         AS "using",
  with_check   AS "with_check"
FROM pg_policies
WHERE tablename = 'reservations'
ORDER BY cmd, policyname;

-- ── 8. agent_call_requests — expected policy checks ──────────
-- Expected:
--   anon:  No access at all.
--   agent role: SELECT, INSERT, UPDATE (status only).
--   admin role: SELECT all, UPDATE status.
--   status constraint: pending | called | resolved.

SELECT
  policyname,
  cmd,
  roles,
  qual         AS "using",
  with_check   AS "with_check"
FROM pg_policies
WHERE tablename = 'agent_call_requests'
ORDER BY cmd, policyname;

-- ── 9. waitlist_leads — expected policy checks ───────────────
-- Expected:
--   anon:  INSERT only (public waitlist form).
--   anon:  No SELECT (private list).
--   No public UPDATE/DELETE.

SELECT
  policyname,
  cmd,
  roles,
  qual         AS "using",
  with_check   AS "with_check"
FROM pg_policies
WHERE tablename = 'waitlist_leads'
ORDER BY cmd, policyname;

-- ── 10. Check for any unsafe anon SELECT on sensitive tables ─
-- Expected result: anon SELECT on reservations, user_profiles (all rows),
-- agent_call_requests — should NOT appear.

SELECT
  tablename,
  policyname,
  cmd,
  roles,
  qual
FROM pg_policies
WHERE tablename IN ('reservations', 'user_profiles', 'agent_call_requests', 'waitlist_leads')
  AND cmd = 'SELECT'
  AND (
    'anon' = ANY(roles) OR 'public' = ANY(roles) OR roles = '{}'
  )
ORDER BY tablename;

-- ── 11. Check: can anon UPDATE/DELETE reservations? ──────────
-- Expected: zero rows returned.

SELECT
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'reservations'
  AND cmd IN ('UPDATE', 'DELETE')
  AND (
    'anon' = ANY(roles) OR 'public' = ANY(roles) OR roles = '{}'
  );

-- ── 12. Check: can anon INSERT agent_call_requests? ──────────
-- Expected: zero rows.

SELECT
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'agent_call_requests'
  AND cmd = 'INSERT'
  AND (
    'anon' = ANY(roles) OR 'public' = ANY(roles) OR roles = '{}'
  );

-- ── 13. Check signup cannot set role = admin ─────────────────
-- Expected: user_profiles INSERT WITH CHECK should restrict role != 'admin'
-- OR no INSERT policy exists (handled at signup function level only).

SELECT
  policyname,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'user_profiles'
  AND cmd IN ('INSERT', 'UPDATE')
ORDER BY cmd;

-- ── 14. Summary guide ────────────────────────────────────────
-- After running this script, verify each table against the expected matrix below.
-- If any row is unexpected, do NOT apply fixes in the same session.
-- Report the issue and the smallest safe fix for a future prompt.
--
-- Table             | anon SELECT | anon INSERT | anon UPDATE | auth SELECT own | auth UPDATE own
-- user_profiles     | no          | yes (signup)| no          | yes (id=uid)    | yes (safe cols)
-- farmers           | yes (verif) | no          | no          | yes (user_id)   | yes (own row)
-- produce_listings  | yes (active)| no          | no          | yes (own)       | yes (own)
-- reservations      | no          | yes (guest) | no          | yes (buyer_uid) | cancel own pending
-- agent_call_requests| no         | no          | no          | no              | no (agent role only)
-- waitlist_leads    | no          | yes         | no          | no              | no
--
-- ── End of RLS Validation Script ─────────────────────────────
