-- ============================================================
-- RaithuFresh — Phase 11 RLS Patch Candidates
-- STATUS: FOR REVIEW ONLY. Do NOT apply without explicit approval.
-- ============================================================
--
-- Two tables returned HTTP 204 (not 401/403) for anon UPDATE:
--   • farmers
--   • waitlist_leads
--
-- HTTP 204 means: the UPDATE policy allowed the operation,
-- but no rows matched the WHERE clause in our test.
-- If a real row existed, an anon user may be able to update it.
--
-- RECOMMENDED FIX: Add an explicit DENY policy for anon UPDATE
-- on both tables. These are safe additive policies (do not
-- weaken any existing policy; only block what currently falls through).
--
-- Review before applying. Run psql "$SUPABASE_DB_URL" -f this-file
-- AFTER confirming no existing UPDATE policy conflicts below.
-- ============================================================

-- ── Inspect current UPDATE policies on affected tables ───────

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

-- ── Expected: no anon UPDATE policy should exist ─────────────
-- If the above query returns rows with roles = '{anon}' or '{public}',
-- those policies should be narrowed to authenticated users only.

-- ============================================================
-- PATCH 1 — Block anon UPDATE on farmers
-- ============================================================
-- Risk: Without this, anon users could potentially update any
--   farmer row if no other USING clause blocks them.
-- Safe to add: additive deny policy, does not affect
--   authenticated farmer UPDATE (covered by separate policy).
-- ============================================================
-- UNCOMMENT TO APPLY (after review and approval):
--
-- CREATE POLICY "deny_anon_update_farmers"
--   ON public.farmers
--   FOR UPDATE
--   TO anon
--   USING (false)
--   WITH CHECK (false);

-- ============================================================
-- PATCH 2 — Block anon UPDATE on waitlist_leads
-- ============================================================
-- Risk: Without this, anon users could potentially update
--   existing waitlist_leads rows.
-- Safe to add: additive deny policy. Anon INSERT is still
--   allowed by the existing INSERT policy (public waitlist form).
-- ============================================================
-- UNCOMMENT TO APPLY (after review and approval):
--
-- CREATE POLICY "deny_anon_update_waitlist_leads"
--   ON public.waitlist_leads
--   FOR UPDATE
--   TO anon
--   USING (false)
--   WITH CHECK (false);

-- ── Verify after applying ────────────────────────────────────
-- Re-run: PATCH /farmers?id=eq.<any-real-id>  (anon key)
-- Expected: HTTP 403 (not 204 or 200)
-- Re-run: PATCH /waitlist_leads?id=eq.<any-real-id>  (anon key)
-- Expected: HTTP 403 (not 204)
