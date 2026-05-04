-- ============================================================
-- RaithuFresh — Pilot Readiness Cleanup
-- ============================================================
-- STATUS: Review required before execution.
--
-- PURPOSE:
--   Identify and optionally clean up test data before 
--   onboarding real pilot users.
-- ============================================================

-- 1. INSPECT CURRENT DATA
SELECT 'user_profiles' AS table_name, COUNT(*) AS count FROM public.user_profiles
UNION ALL SELECT 'farmers', COUNT(*) FROM public.farmers
UNION ALL SELECT 'produce_listings', COUNT(*) FROM public.produce_listings
UNION ALL SELECT 'reservations', COUNT(*) FROM public.reservations
UNION ALL SELECT 'agent_call_requests', COUNT(*) FROM public.agent_call_requests
UNION ALL SELECT 'waitlist_leads', COUNT(*) FROM public.waitlist_leads;

-- 2. DETECT FAKE/QA DATA
-- Check for test names or numbers in profiles
SELECT id, full_name, role, phone, created_at 
FROM public.user_profiles 
WHERE full_name ILIKE '%test%' 
   OR full_name ILIKE '%qa%' 
   OR phone LIKE '90000000%';

-- Check for test listings
SELECT id, produce_name, status, created_at 
FROM public.produce_listings 
WHERE produce_name ILIKE '%test%' 
   OR produce_name ILIKE '%dummy%';

-- 3. CLEANUP (COMMENTED OUT - UNCOMMENT ONLY IF CERTAIN)
-- Delete test reservations first (FK dependency)
-- DELETE FROM public.reservations 
-- WHERE buyer_name ILIKE '%test%' OR buyer_phone LIKE '90000000%';

-- Delete test listings
-- DELETE FROM public.produce_listings 
-- WHERE produce_name ILIKE '%test%';

-- Delete test farmer profiles
-- DELETE FROM public.farmers 
-- WHERE name ILIKE '%test%' OR phone LIKE '90000000%';

-- 4. NORMALIZATION
-- Ensure all active listings have a category
UPDATE public.produce_listings SET category = 'Vegetable' WHERE category IS NULL;

-- 5. PILOT TARGET CHECK
-- Confirm how many verified farmers we have for the pilot
SELECT verified, COUNT(*) 
FROM public.farmers 
GROUP BY verified;
