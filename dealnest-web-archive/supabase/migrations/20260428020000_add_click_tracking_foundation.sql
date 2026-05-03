-- DealNest outbound click tracking foundation.
-- Safe to run after the initial DealNest schema and auth/admin migrations.

create table if not exists public.click_events (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  clicked_at timestamptz not null default now(),
  source_page text,
  destination_host text,
  outbound_url text,
  session_key text,
  metadata jsonb not null default '{}'::jsonb,
  constraint click_events_source_page_len check (source_page is null or length(source_page) <= 160),
  constraint click_events_destination_host_len check (destination_host is null or length(destination_host) <= 160),
  constraint click_events_outbound_url_len check (outbound_url is null or length(outbound_url) <= 1200),
  constraint click_events_session_key_len check (session_key is null or length(session_key) <= 80)
);

create index if not exists click_events_deal_id_idx on public.click_events(deal_id);
create index if not exists click_events_store_id_idx on public.click_events(store_id);
create index if not exists click_events_clicked_at_idx on public.click_events(clicked_at desc);
create index if not exists click_events_deal_clicked_at_idx on public.click_events(deal_id, clicked_at desc);

alter table public.click_events enable row level security;

drop policy if exists "Anyone can record public deal clicks" on public.click_events;
create policy "Anyone can record public deal clicks"
on public.click_events
for insert
with check (
  exists (
    select 1
    from public.deals
    where deals.id = click_events.deal_id
      and deals.moderation_status = 'approved'
      and deals.status in ('live', 'expiring_soon')
  )
  and (user_id is null or auth.uid() = user_id)
);

drop policy if exists "Moderators read click events" on public.click_events;
create policy "Moderators read click events"
on public.click_events
for select
using (public.is_moderator_or_admin());

drop policy if exists "Admins delete click events" on public.click_events;
create policy "Admins delete click events"
on public.click_events
for delete
using (public.has_role('admin'));

grant insert on public.click_events to anon, authenticated;
grant select on public.click_events to authenticated;
grant delete on public.click_events to authenticated;
