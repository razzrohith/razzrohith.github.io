-- ============================================================
-- RaithuFresh — Pilot Data Reset Plan
-- ============================================================
-- STATUS: SAFE TO REVIEW. Destructive statements commented out.
-- DO NOT run DELETE blocks without explicit admin approval.
-- DO NOT apply this file automatically from the app.
--
-- PURPOSE:
--   Prepare the database for a controlled pilot launch with
--   real farmers and buyers, after removing test/QA data.
--
-- CURRENT STATE (as of Phase 15 QA, 2026-05-03):
--   farmers:           8 rows — all verified demo/seed data
--   produce_listings:  15 rows — all active, all demo/seed data
--   reservations:      0 rows — clean
--   waitlist_leads:    0 rows — clean
--   agent_call_requests: (cannot SELECT as anon — table secured)
--   user_profiles:     (cannot SELECT as anon — RLS secured)
--
-- WHAT IS SAFE TO KEEP:
--   - Verified demo farmers + their active listings
--     (used for public Browse and Produce Detail demos)
--   - The schema, RLS policies, and grants
--
-- WHAT SHOULD BE REMOVED BEFORE REAL PILOT:
--   - Any fake/QA test reservations
--   - Any fake/QA waitlist leads (inserted during testing)
--   - Any fake/QA agent call requests
--   - Any fake/QA user_profiles (test buyer/farmer/agent accounts)
--   - Optionally: demo farmer rows + listings if replacing with real farmers
--
-- WHAT REQUIRES MANUAL REVIEW (do not delete blindly):
--   - user_profiles: check for real pilot users before deleting test accounts
--   - agent_call_requests: check if any are from real agents
--   - farmers + produce_listings: keep if being used for demo; replace if
--     onboarding real farmers
--
-- HOW TO USE THIS FILE:
--   1. Run the INSPECTION queries (Section 1) first.
--   2. Review output. Identify test vs real data.
--   3. Uncomment and run only the specific DELETE blocks you intend.
--   4. Verify counts after each DELETE.
-- ============================================================

-- ============================================================
-- SECTION 1 — INSPECTION (safe to run, read-only)
-- ============================================================

-- 1a. Counts of all relevant tables
SELECT 'farmers'            AS table_name, COUNT(*) AS total FROM public.farmers
UNION ALL
SELECT 'produce_listings',                  COUNT(*) FROM public.produce_listings
UNION ALL
SELECT 'reservations',                      COUNT(*) FROM public.reservations
UNION ALL
SELECT 'waitlist_leads',                    COUNT(*) FROM public.waitlist_leads
UNION ALL
SELECT 'agent_call_requests',               COUNT(*) FROM public.agent_call_requests
UNION ALL
SELECT 'user_profiles',                     COUNT(*) FROM public.user_profiles
ORDER BY table_name;

-- 1b. Breakdown of reservation statuses
SELECT status, COUNT(*) AS count
FROM public.reservations
GROUP BY status
ORDER BY status;

-- 1c. Breakdown of listing statuses
SELECT status, COUNT(*) AS count
FROM public.produce_listings
GROUP BY status
ORDER BY status;

-- 1d. Waitlist leads count by role
SELECT role, COUNT(*) AS count
FROM public.waitlist_leads
GROUP BY role
ORDER BY role;

-- 1e. User profiles by role (no names/emails printed in report)
SELECT role, COUNT(*) AS count
FROM public.user_profiles
GROUP BY role
ORDER BY role;

-- 1f. Farmer verification status
SELECT verified, COUNT(*) AS count
FROM public.farmers
GROUP BY verified;

-- 1g. Recent waitlist leads (for QA cleanup identification — time only, no personal data)
SELECT created_at, role
FROM public.waitlist_leads
ORDER BY created_at DESC
LIMIT 20;

-- 1h. Recent reservations (statuses and times — no buyer phone printed)
SELECT created_at, status, payment_method
FROM public.reservations
ORDER BY created_at DESC
LIMIT 20;

-- 1i. Recent agent call requests (statuses and times)
SELECT created_at, status
FROM public.agent_call_requests
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================
-- SECTION 2 — SAFE CLEANUP: QA/Test Waitlist Leads
-- ============================================================
-- Fake leads inserted during QA testing can be identified by:
--   - name containing 'QA', 'Test', 'test', 'rls', 'verify', 'cleanup'
--   - phone numbers like 9000000099, 9000000088, 0000000001
-- These are safe to delete.
-- ============================================================

-- Preview before deleting:
SELECT id, role, created_at
FROM public.waitlist_leads
WHERE
  name ILIKE '%QA%'
  OR name ILIKE '%Test%'
  OR name ILIKE '%rls%'
  OR name ILIKE '%verify%'
  OR name ILIKE '%cleanup%'
  OR phone IN ('9000000099', '9000000088', '0000000001', '9000000001')
ORDER BY created_at DESC;

-- UNCOMMENT TO DELETE (only after reviewing preview above):
-- DELETE FROM public.waitlist_leads
-- WHERE
--   name ILIKE '%QA%'
--   OR name ILIKE '%Test%'
--   OR name ILIKE '%rls%'
--   OR name ILIKE '%verify%'
--   OR name ILIKE '%cleanup%'
--   OR phone IN ('9000000099', '9000000088', '0000000001', '9000000001');

-- ============================================================
-- SECTION 3 — SAFE CLEANUP: Fake/Test Reservations
-- ============================================================
-- QA reservations can be identified by:
--   - buyer_name containing 'QA', 'Test', 'test'
--   - buyer_phone like 9000000099
--   - status = 'cancelled' older than 30 days (safe to archive)
-- ============================================================

-- Preview:
SELECT id, status, buyer_name, buyer_phone, created_at
FROM public.reservations
WHERE
  buyer_name ILIKE '%QA%'
  OR buyer_name ILIKE '%Test%'
  OR buyer_phone IN ('9000000099', '9000000088', '0000000001')
ORDER BY created_at DESC;

-- UNCOMMENT TO DELETE:
-- DELETE FROM public.reservations
-- WHERE
--   buyer_name ILIKE '%QA%'
--   OR buyer_name ILIKE '%Test%'
--   OR buyer_phone IN ('9000000099', '9000000088', '0000000001');

-- OPTIONAL: Delete old cancelled reservations (>30 days):
-- DELETE FROM public.reservations
-- WHERE status = 'cancelled'
--   AND created_at < NOW() - INTERVAL '30 days';

-- ============================================================
-- SECTION 4 — SAFE CLEANUP: Fake Agent Call Requests
-- ============================================================

-- Preview:
SELECT id, status, created_at
FROM public.agent_call_requests
WHERE created_at < NOW() - INTERVAL '7 days'
  AND status IN ('completed', 'cancelled')
ORDER BY created_at DESC;

-- UNCOMMENT TO DELETE old completed/cancelled requests:
-- DELETE FROM public.agent_call_requests
-- WHERE created_at < NOW() - INTERVAL '7 days'
--   AND status IN ('completed', 'cancelled');

-- ============================================================
-- SECTION 5 — OPTIONAL: Remove Test User Profiles
-- ============================================================
-- WARNING: This will permanently delete accounts.
-- Only delete accounts you are sure are test/QA accounts.
-- Cross-reference with auth.users if needed.
-- ============================================================

-- Preview test profiles by email pattern:
SELECT up.id, up.role, up.created_at, au.email
FROM public.user_profiles up
JOIN auth.users au ON au.id = up.id
WHERE
  au.email ILIKE '%test%'
  OR au.email ILIKE '%qa%'
  OR au.email ILIKE '%example.com%'
  OR au.email ILIKE '%fake%'
ORDER BY up.created_at DESC;

-- UNCOMMENT TO DELETE (cascades to reservations/listings via FK if set):
-- DELETE FROM public.user_profiles
-- WHERE id IN (
--   SELECT up.id FROM public.user_profiles up
--   JOIN auth.users au ON au.id = up.id
--   WHERE au.email ILIKE '%test%'
--      OR au.email ILIKE '%qa%'
--      OR au.email ILIKE '%example.com%'
--      OR au.email ILIKE '%fake%'
-- );
-- Note: Also delete from auth.users via Supabase Dashboard > Authentication > Users

-- ============================================================
-- SECTION 6 — OPTIONAL: Full Demo Reset
-- ============================================================
-- Use only when starting a fresh pilot with real farmer data.
-- Keeps the schema and RLS intact; removes all data rows.
-- ============================================================

-- UNCOMMENT IN ORDER (respect FK constraints):
-- DELETE FROM public.agent_call_requests;
-- DELETE FROM public.reservations;
-- DELETE FROM public.produce_listings;
-- DELETE FROM public.farmers;
-- DELETE FROM public.waitlist_leads;
-- DELETE FROM public.user_profiles;
-- Note: auth.users must be cleared separately via Supabase Dashboard.

-- ============================================================
-- SECTION 7 — PILOT READINESS VERIFICATION
-- Run after any cleanup to confirm state.
-- ============================================================

SELECT 'farmers'            AS table_name, COUNT(*) AS total FROM public.farmers
UNION ALL
SELECT 'produce_listings',                  COUNT(*) FROM public.produce_listings
UNION ALL
SELECT 'reservations',                      COUNT(*) FROM public.reservations
UNION ALL
SELECT 'waitlist_leads',                    COUNT(*) FROM public.waitlist_leads
UNION ALL
SELECT 'agent_call_requests',               COUNT(*) FROM public.agent_call_requests
UNION ALL
SELECT 'user_profiles',                     COUNT(*) FROM public.user_profiles
ORDER BY table_name;

-- Expected for a fresh pilot start:
--   reservations:          0
--   waitlist_leads:        0 (or only real pre-registrations)
--   agent_call_requests:   0
--   user_profiles:         only real pilot accounts
--   farmers:               real onboarded farmers (or keep demo if needed)
--   produce_listings:      real active listings from real farmers
