# DealNest Deal Alerts And Notification Foundation

## Current Phase

Deal alerts are account-owned rules stored in `deal_alerts`. The frontend now matches those rules against public-visible deals and shows in-app match previews without sending real email.

## Manual Supabase Step

Run this migration in Supabase SQL Editor to enable the richer alert filters and owner-only notification rows:

`supabase/migrations/20260428040000_add_alert_notification_foundation.sql`

The frontend remains backward-safe if this migration has not been run yet, but free-shipping, coupon, and expiring-soon alert filters only persist after the migration is applied.

## In-App Matching

Matching is computed against public-visible deals already loaded through the public feed rules:

```sql
moderation_status = 'approved'
and status in ('live', 'expiring_soon')
```

Rules can match by keyword, category, store, max price, minimum discount, free shipping, coupon availability, and expiring-soon status. The UI explains why each deal matched.

## Notification Foundation

The migration adds `deal_alert_notifications` for future in-app notification persistence:

- owner-only RLS
- optional `alert_id`
- optional public-visible `deal_id`
- title/body
- read/unread state
- unique `(user_id, alert_id, deal_id)` to prevent duplicate match notifications

No external provider is connected in this phase.

## Future Email Options

When real delivery is approved later, use a server-side path rather than browser-side secrets:

- Supabase Edge Function for alert matching and email dispatch
- Scheduled job or cron trigger for periodic matching
- Provider options: Resend, Brevo, or SendGrid
- Store provider keys only as Supabase function secrets
- Add unsubscribe handling and user email preferences
- Rate limit sends per user and per alert
- Log delivery status separately from private raw provider payloads

Do not put email provider keys or service-role keys in frontend code.
