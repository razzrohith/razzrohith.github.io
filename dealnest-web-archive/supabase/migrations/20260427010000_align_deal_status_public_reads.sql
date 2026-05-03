-- Align DealNest public deal visibility with the final status model.
-- Public/guest deal reads are limited to live and expiring_soon deals.

begin;

drop policy if exists "Guests read approved deals" on public.deals;
drop policy if exists "Guests read public visible deals" on public.deals;
create policy "Guests read public visible deals" on public.deals
  for select
  using (
    moderation_status = 'approved'
    and status in ('live', 'expiring_soon')
  );

drop policy if exists "Authenticated users create pending deals" on public.deals;
create policy "Authenticated users create pending deals" on public.deals
  for insert
  with check (
    auth.uid() = posted_by
    and status = 'pending'
    and moderation_status = 'pending'
  );

alter table public.deals
  drop constraint if exists deals_status_check;

alter table public.deals
  add constraint deals_status_check
  check (status in ('pending', 'live', 'expiring_soon', 'expired', 'rejected', 'hidden'));

alter table public.deals
  alter column status set default 'pending';

commit;
