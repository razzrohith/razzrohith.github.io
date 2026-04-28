-- Fix click_events public insert checks after live RLS verification.
-- The policy uses a security-definer helper so the click insert policy can
-- validate public-visible deals without depending on nested RLS visibility.

create or replace function public.is_public_click_deal(target_deal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.deals
    where id = target_deal_id
      and moderation_status = 'approved'
      and status in ('live', 'expiring_soon')
  );
$$;

revoke all on function public.is_public_click_deal(uuid) from public;
grant execute on function public.is_public_click_deal(uuid) to anon, authenticated;

alter table public.click_events
  drop constraint if exists click_events_http_outbound_url;

alter table public.click_events
  add constraint click_events_http_outbound_url
  check (outbound_url is null or outbound_url ~* '^https?://');

drop policy if exists "Anyone can record public deal clicks" on public.click_events;
create policy "Anyone can record public deal clicks"
on public.click_events
for insert
to anon, authenticated
with check (
  public.is_public_click_deal(deal_id)
  and (user_id is null or auth.uid() = user_id)
);
