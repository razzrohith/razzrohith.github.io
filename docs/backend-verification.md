# DealNest Backend Verification

Backend verification was performed before connecting the frontend to Supabase.

## Automated Guest API Checks

These checks use only `SUPABASE_URL` and `SUPABASE_ANON_KEY` from local `.env`.

- Public read access for public-visible deals (`live`, `expiring_soon`): pass
- Public read access for active categories: pass
- Public read access for active stores: pass
- Public read access for active coupons: pass
- Anonymous deal insert blocked by RLS/auth policy: pass
- Anonymous comment insert blocked by RLS/auth policy: pass
- Anonymous vote insert blocked by RLS/auth policy: pass
- Anonymous save insert blocked by RLS/auth policy: pass
- Anonymous report insert blocked by RLS/auth policy: pass
- Anonymous alert insert blocked by RLS/auth policy: pass

## SQL Verification Checklist

Run `supabase/verification.sql` in Supabase SQL Editor to inspect:

- RLS status for all protected tables
- Seed row counts, including `public_visible_deals`
- Public-visible deal join correctness
- Unique indexes for duplicate votes, saved deals, and coupons
- Default pending deal status for user-created deals
- Admin/moderator policy definitions
- Storage bucket setup

## Authenticated Path Notes

The frontend auth flow has not been built yet. Until a real authenticated test user exists, authenticated-only inserts are verified by:

- RLS policy definitions in `supabase/migrations/20260427000000_initial_dealnest_schema.sql`
- Anonymous REST insert denial checks
- Unique database constraints for one vote/save per user per deal

Full signed-in integration tests should be added when the auth phase begins.
