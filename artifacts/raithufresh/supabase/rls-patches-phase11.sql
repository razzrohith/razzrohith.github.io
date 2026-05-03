-- ============================================================
-- RaithuFresh — Phase 11 RLS Patches (APPLY-READY)
-- ============================================================
-- Two tables returned HTTP 204 (not 403) for anon UPDATE.
-- HTTP 204 = the RLS UPDATE policy did not deny the operation;
-- no rows matched our test UUID, but a real row could be updated.
--
-- These are additive DENY policies. They do not weaken any
-- existing policy and do not affect:
--   - authenticated farmer UPDATE (their own row)
--   - anon INSERT on waitlist_leads (public waitlist form)
--   - any SELECT policy on either table
--
-- HOW TO APPLY:
--   Open Supabase Dashboard → SQL Editor → New Query
--   Paste and run the two CREATE POLICY statements below.
--   Then re-run the verification queries at the bottom.
--
-- DO NOT apply via anon key (DDL requires elevated privilege).
-- DO NOT use service_role key from frontend code.
-- ============================================================

-- ── Inspect current UPDATE policies before applying ──────────

SELECT
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('farmers', 'waitlist_leads')
  AND cmd = 'UPDATE'
ORDER BY tablename, policyname;

-- ── Expected: zero rows or no row with roles = '{anon}' ──────
-- If the query above returns an open UPDATE policy covering anon
-- or public, narrow that policy before running the patches below.

-- ============================================================
-- PATCH 1 — Block anon UPDATE on farmers
-- ============================================================
CREATE POLICY "deny_anon_update_farmers"
  ON public.farmers
  FOR UPDATE
  TO anon
  USING (false)
  WITH CHECK (false);

-- ============================================================
-- PATCH 2 — Block anon UPDATE on waitlist_leads
-- ============================================================
CREATE POLICY "deny_anon_update_waitlist_leads"
  ON public.waitlist_leads
  FOR UPDATE
  TO anon
  USING (false)
  WITH CHECK (false);

-- ============================================================
-- VERIFICATION — run after applying
-- ============================================================

-- 1. Confirm the new policies appear:
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('farmers', 'waitlist_leads')
  AND policyname IN ('deny_anon_update_farmers', 'deny_anon_update_waitlist_leads');

-- 2. Functional check (run via REST API with anon key):
--    PATCH /farmers?id=eq.<any-real-farmer-uuid>  body: {"name":"test"}
--    Expected: HTTP 403 (was HTTP 204 before patch)
--
--    PATCH /waitlist_leads?id=eq.<any-real-id>   body: {"phone":"0000000000"}
--    Expected: HTTP 403 (was HTTP 204 before patch)
--
--    GET /produce_listings?select=id,status&limit=3
--    Expected: HTTP 200, rows still visible (SELECT unaffected)
--
--    POST /waitlist_leads  body: {"name":"QA Test","phone":"9000000001","village":"TestVillage"}
--    Expected: HTTP 201 (INSERT still allowed for anon)
