-- =============================================================
-- RaithuFresh — Unique Phone Patch
-- Enforces phone uniqueness on user_profiles
-- =============================================================

-- 1. Identify duplicates (manual check recommended before applying)
-- SELECT phone, COUNT(*) 
-- FROM public.user_profiles 
-- WHERE phone IS NOT NULL AND phone <> ''
-- GROUP BY phone 
-- HAVING COUNT(*) > 1;

-- 2. Add unique partial index
-- We use a partial index to allow multiple null/empty values but enforce uniqueness for real numbers.
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_phone_unique_idx 
ON public.user_profiles (phone) 
WHERE phone IS NOT NULL AND phone <> '';

-- 3. Add availability check RPC
-- This allows the frontend to check if a phone is taken without exposing profiles.
CREATE OR REPLACE FUNCTION public.is_phone_available(phone_input text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE phone = phone_input
  );
END;
$$;

-- Grant access to anyone (anon and authenticated)
GRANT EXECUTE ON FUNCTION public.is_phone_available(text) TO anon, authenticated;
