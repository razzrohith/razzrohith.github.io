-- ============================================================
-- RaithuFresh — Phase 14 RLS Patch (CORRECTED — APPLY-READY)
-- ============================================================
--
-- PROBLEM FOUND:
--   The previous patch used CREATE POLICY ... USING (false).
--   That is WRONG for this situation.
--
--   PostgreSQL combines permissive policies with OR logic.
--   A permissive USING(false) policy is simply OR'd with any
--   existing permissive ALLOW policy — and true OR false = true.
--   A permissive deny policy has no blocking effect whatsoever.
--
-- ROOT CAUSE CONFIRMED BY PROBING:
--   farmers      anon PATCH → HTTP 204  (UPDATE grant exists at privilege level)
--   waitlist_leads anon PATCH → HTTP 204  (UPDATE grant exists at privilege level)
--   user_profiles  anon PATCH → HTTP 401  (NO UPDATE grant — correct, this is the target state)
--
--   The user_profiles 401 error body confirms:
--   "Grant the required privileges with: GRANT UPDATE ON public.user_profiles TO anon"
--   This means user_profiles has NO UPDATE grant for anon, which is why it returns 401.
--   farmers and waitlist_leads DO have the UPDATE grant → they return 204.
--
-- BONUS FINDING:
--   farmers      anon DELETE → HTTP 204  (DELETE grant also present)
--   waitlist_leads anon DELETE → HTTP 204  (DELETE grant also present)
--   These are patched here too.
--
-- CORRECT FIX: REVOKE at the privilege level.
--   REVOKE cuts access before PostgreSQL even evaluates RLS policies.
--   This is unconditional — regardless of any existing permissive policies.
--   This is exactly what secures user_profiles today.
--
-- HOW TO APPLY:
--   Open Supabase Dashboard → SQL Editor → New Query
--   Run the INSPECTION section first, then the PATCH section.
--
-- WHAT IS NOT AFFECTED:
--   - anon SELECT on farmers (READ privilege — not touched)
--   - anon INSERT on waitlist_leads (INSERT privilege — not touched)
--   - authenticated farmer UPDATE on own rows (separate role — not touched)
--   - authenticated buyer/farmer/agent flows (separate role — not touched)
--   - RLS policies for SELECT/INSERT (not touched)
-- ============================================================

-- ============================================================
-- SECTION 1 — INSPECTION (run first, review before patching)
-- ============================================================

-- 1a. Check column-level grants for anon and PUBLIC on both tables
SELECT
  grantee,
  table_name,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('farmers', 'waitlist_leads')
  AND grantee IN ('anon', 'PUBLIC', 'public')
ORDER BY table_name, grantee, privilege_type;

-- 1b. Check ALL existing RLS policies on both tables
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('farmers', 'waitlist_leads')
ORDER BY tablename, cmd, policyname;

-- 1c. Confirm RLS is enabled
SELECT
  tablename,
  rowsecurity AS rls_enabled,
  forcerowsecurity AS rls_forced
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('farmers', 'waitlist_leads');

-- ============================================================
-- SECTION 2 — PATCH (run after reviewing Section 1 output)
-- ============================================================
--
-- IMPORTANT: If Section 1 shows a GRANT to PUBLIC (not just anon),
-- replace "FROM anon" with "FROM PUBLIC" below, then re-grant
-- the specific operations you still want anon to have:
--   GRANT SELECT ON public.farmers TO anon;
--   GRANT SELECT, INSERT ON public.waitlist_leads TO anon;
--
-- If the grant is directly to the 'anon' role (most common in
-- Supabase projects), the statements below are correct as-is.
-- ============================================================

-- PATCH 1: Revoke UPDATE and DELETE from anon on farmers
-- Effect: anon PATCH → HTTP 401 "permission denied" (was 204)
-- Effect: anon DELETE → HTTP 401 "permission denied" (was 204)
-- No effect on: anon SELECT, authenticated farmer UPDATE/DELETE
REVOKE UPDATE ON public.farmers FROM anon;
REVOKE DELETE ON public.farmers FROM anon;

-- PATCH 2: Revoke UPDATE and DELETE from anon on waitlist_leads
-- Effect: anon PATCH → HTTP 401 "permission denied" (was 204)
-- Effect: anon DELETE → HTTP 401 "permission denied" (was 204)
-- No effect on: anon INSERT (INSERT privilege is separate and kept)
REVOKE UPDATE ON public.waitlist_leads FROM anon;
REVOKE DELETE ON public.waitlist_leads FROM anon;

-- PATCH 3: Drop any existing UPDATE or DELETE policies for anon
-- on these tables (belt-and-suspenders — prevent future confusion)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('farmers', 'waitlist_leads')
      AND cmd IN ('UPDATE', 'DELETE')
      AND (
        roles @> ARRAY['anon']::name[]
        OR roles @> ARRAY['PUBLIC']::name[]
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      pol.policyname, pol.tablename
    );
    RAISE NOTICE 'Dropped policy % on %', pol.policyname, pol.tablename;
  END LOOP;
END $$;

-- ============================================================
-- SECTION 3 — VERIFICATION (run after patch, use anon REST key)
-- ============================================================

-- 3a. Confirm grants were revoked
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('farmers', 'waitlist_leads')
  AND grantee IN ('anon', 'PUBLIC', 'public')
  AND privilege_type IN ('UPDATE', 'DELETE')
ORDER BY table_name, grantee, privilege_type;
-- Expected: zero rows (or only authenticated/service_role rows, not anon)

-- 3b. Functional REST API checks (run with anon key via curl or fetch):
--
--   PATCH /farmers?id=eq.<any-uuid>  body: {"name":"test"}
--   Expected: HTTP 401, body contains "permission denied"  (was 204)
--
--   PATCH /waitlist_leads?id=eq.<any-uuid>  body: {"phone":"0000000000"}
--   Expected: HTTP 401, body contains "permission denied"  (was 204)
--
--   DELETE /farmers?id=eq.<any-uuid>
--   Expected: HTTP 401, body contains "permission denied"  (was 204)
--
--   DELETE /waitlist_leads?id=eq.<any-uuid>
--   Expected: HTTP 401, body contains "permission denied"  (was 204)
--
--   GET /farmers?select=id,name,verified&verified=eq.true&limit=3
--   Expected: HTTP 200, rows returned  (SELECT unaffected)
--
--   GET /produce_listings?select=id,status&limit=3
--   Expected: HTTP 200, rows returned  (unrelated table, unaffected)
--
--   POST /waitlist_leads  body: {"name":"QA Test","phone":"9000000099","role":"buyer","town":"TestVillage"}
--   Expected: HTTP 201  (INSERT still allowed for anon)
--
-- ============================================================
-- WHY THE PREVIOUS PATCH WAS WRONG
-- ============================================================
--
-- The previous patch used:
--   CREATE POLICY "deny_anon_update_farmers"
--     ON public.farmers FOR UPDATE TO anon
--     USING (false) WITH CHECK (false);
--
-- This is a PERMISSIVE policy (the default). PostgreSQL evaluates
-- all PERMISSIVE policies for a role using OR:
--   result = policy_1 OR policy_2 OR policy_3 ...
--
-- If any existing permissive UPDATE policy evaluates to TRUE,
-- the false policy is irrelevant:
--   true OR false = true  →  access still granted
--
-- A RESTRICTIVE policy (FOR UPDATE ... AS RESTRICTIVE) IS combined
-- with AND, so it CAN override permissive policies. However, the
-- safest and most fundamental fix is REVOKE, which operates at
-- the PostgreSQL privilege layer — before RLS is evaluated at all.
-- If the role has no UPDATE privilege, RLS policies are never
-- consulted for UPDATE operations.
-- ============================================================
