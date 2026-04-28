# DealNest Click Tracking Foundation

This phase adds an affiliate-ready outbound click foundation without adding any real affiliate network credentials.

## Manual Supabase Step

Run this migration in Supabase SQL Editor before expecting live click writes:

`supabase/migrations/20260428020000_add_click_tracking_foundation.sql`

## Privacy Model

`click_events` stores only session-safe click metadata:

- `deal_id`
- `store_id`
- optional `user_id` for signed-in users
- `clicked_at`
- `source_page`
- `destination_host`
- `outbound_url`
- a random local `session_key`
- small non-sensitive JSON metadata

It does not collect IP addresses, user agents, emails, precise location, browser history, or any private telemetry.

## RLS Model

- Guests and authenticated users may insert clicks only for public-visible deals:
  - `moderation_status = 'approved'`
  - `status in ('live', 'expiring_soon')`
- Guests insert with `user_id = null`.
- Signed-in users may include only their own `user_id`.
- Only admin/moderator roles can read raw click analytics.
- Only admins can delete click events.

## Affiliate Readiness

The frontend routes outbound clicks through `redirect.html?deal=<id>&source=<page>`.

The redirect page validates that the destination is an HTTP/HTTPS external URL. Unsafe schemes such as `javascript:` are blocked. If tracking fails, the user can still open a safe destination.

The current seed data still uses placeholder/internal deal URLs in some places. Those are intentionally blocked by the redirect page until real merchant or affiliate-safe URLs are configured.
