-- =============================================================
-- RaithuFresh — User role self-escalation security patch
--
-- Problem:
--   patch-auth.sql issued a broad table-level grant:
--     GRANT SELECT, INSERT, UPDATE ON user_profiles TO anon, authenticated;
--   This lets any authenticated user UPDATE any column on their own row,
--   including the `role` column. A buyer could therefore self-promote to
--   admin by sending: UPDATE user_profiles SET role = 'admin' WHERE id = auth.uid()
--
-- Fix:
--   1. Revoke the broad table-level UPDATE from anon and authenticated.
--   2. Grant UPDATE only on the safe non-sensitive columns.
--   3. The RLS policy (auth.uid() = id) still restricts updates to the
--      user's own row. Column-level GRANT is the real fence.
--
-- What is preserved:
--   - SELECT own profile (users_read_own_profile RLS policy)
--   - INSERT own profile on signup (users_insert_own_profile RLS policy)
--   - UPDATE own full_name, phone, village, district
--
-- What is now blocked:
--   - UPDATE role (any role, including buyer → admin)
--   - UPDATE id
--   - UPDATE created_at
--   - anon UPDATE on any column
-- =============================================================

-- ── Step 1: Revoke the broad UPDATE privilege ──────────────────────────────

-- anon should never be able to UPDATE profiles.
-- (RLS had no anon UPDATE policy so anon was already blocked by RLS, but
-- revoking the GRANT adds a second line of defence at the privilege layer.)
REVOKE UPDATE ON user_profiles FROM anon;

-- Remove the broad authenticated UPDATE so no column-free escalation is possible.
REVOKE UPDATE ON user_profiles FROM authenticated;

-- ── Step 2: Grant UPDATE only on safe columns ─────────────────────────────

-- Only non-sensitive, non-role columns may be updated by authenticated users.
-- PostgreSQL column-level GRANTs cannot be used to GRANT a subset of a
-- table-level REVOKE implicitly — we must do the REVOKE first (step 1)
-- and then explicitly GRANT the safe columns.
GRANT UPDATE(full_name, phone, village, district) ON user_profiles TO authenticated;

-- ── Step 3: Tighten the RLS UPDATE policy ────────────────────────────────

-- Re-create the UPDATE policy with an explicit WITH CHECK so the row-level
-- restriction is clear in both USING (before update) and WITH CHECK (after).
-- This adds belt-and-suspenders on top of the column-level GRANT.
DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
CREATE POLICY "users_update_own_profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING   (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── What is NOT changed ────────────────────────────────────────────────────
-- SELECT privilege: unchanged (authenticated can SELECT their own row via RLS)
-- INSERT privilege: unchanged (authenticated can INSERT their own row at signup;
--   the INSERT includes role, which is the only time role can be set by the user)
-- anon SELECT: unchanged (no anon SELECT RLS policy exists, so anon cannot read)
-- anon INSERT: unchanged (no anon INSERT RLS policy exists on user_profiles)
-- Farmer / produce_listings / reservations policies: untouched
-- Admin reservation policies: untouched

-- ── Security posture after this patch ─────────────────────────────────────
-- Allowed for authenticated (own row only):
--   SELECT full_name, phone, role, village, district, created_at, id   ✓
--   INSERT (all columns at signup, role set once)                        ✓
--   UPDATE full_name, phone, village, district                           ✓
-- Blocked for authenticated:
--   UPDATE role                                                          ✗
--   UPDATE id                                                            ✗
--   UPDATE created_at                                                    ✗
--
-- MVP note:
--   Admin role is still assigned manually via Supabase Dashboard > Table Editor
--   or via the service_role key. Normal users cannot set or change their role
--   after signup.
--
-- Production recommendation:
--   Move admin checks from user_profiles.role to auth.jwt() -> app_metadata.role
--   set via the Supabase service_role key or an Edge Function. This fully
--   removes the user_profiles table from the admin-access trust chain.
