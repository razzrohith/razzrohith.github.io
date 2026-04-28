-- DealNest alert matching and in-app notification foundation.
-- Additive only: keeps existing deal_alerts RLS and adds owner-only notification rows.

alter table public.deal_alerts
  add column if not exists require_free_shipping boolean not null default false,
  add column if not exists require_coupon boolean not null default false,
  add column if not exists require_expiring_soon boolean not null default false;

create table if not exists public.deal_alert_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  alert_id uuid references public.deal_alerts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique(user_id, alert_id, deal_id)
);

create index if not exists deal_alert_notifications_user_id_idx on public.deal_alert_notifications(user_id, created_at desc);
create index if not exists deal_alert_notifications_alert_id_idx on public.deal_alert_notifications(alert_id);
create index if not exists deal_alert_notifications_unread_idx on public.deal_alert_notifications(user_id, is_read);

alter table public.deal_alert_notifications enable row level security;

drop policy if exists "Users manage own alert notifications" on public.deal_alert_notifications;
create policy "Users manage own alert notifications"
on public.deal_alert_notifications
for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    alert_id is null
    or exists (
      select 1
      from public.deal_alerts
      where deal_alerts.id = deal_alert_notifications.alert_id
        and deal_alerts.user_id = auth.uid()
    )
  )
  and (
    deal_id is null
    or public.is_public_click_deal(deal_id)
  )
);

grant select, insert, update, delete on public.deal_alert_notifications to authenticated;
