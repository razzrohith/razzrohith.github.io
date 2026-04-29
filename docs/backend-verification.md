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
- Anonymous community thread/reply/report insert blocked by RLS/auth policy: pass after
  `supabase/migrations/20260429000000_add_community_forum_foundation.sql`

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

The frontend auth foundation and protected action wiring now exist. Full logged-in write QA was temporarily skipped because Supabase email confirmation/rate limiting blocked creation of a confirmed normal test session.

Until a confirmed test user exists, authenticated-only inserts are verified by:

- RLS policy definitions in the Supabase migrations.
- Anonymous REST insert denial checks.
- Unique database constraints for one vote/save per user per deal.
- Public feed checks showing only `moderation_status = 'approved'` and `status in ('live', 'expiring_soon')`.
- Public forum checks showing only `community_threads.status = 'approved'` and
  `community_posts.status = 'approved'` to guests.
- Owner checks confirming normal users can submit only pending community threads/replies and cannot approve, hide, lock, or resolve reports.

## Admin Moderation Notes

The admin moderation panel is available at `admin.html`, but full approval/rejection testing requires a signed-in user with a `user_roles` row of `admin` or `moderator`.

Manual role setup SQL:

```sql
insert into public.user_roles (user_id, role)
values ('REPLACE_WITH_AUTH_USER_ID', 'admin')
on conflict (user_id, role) do nothing;
```

Use `moderator` instead of `admin` to test moderator access.
