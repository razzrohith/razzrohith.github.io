-- DealNest auth action foundation.
-- Keeps guest browsing open while allowing members to read their own private
-- submissions and write protected actions against public-visible deals only.

begin;

drop policy if exists "Users read own submitted deals" on public.deals;
create policy "Users read own submitted deals" on public.deals
  for select
  using (auth.uid() = posted_by);

drop policy if exists "Public read deal images" on public.deal_images;
create policy "Public read deal images" on public.deal_images
  for select
  using (
    exists (
      select 1
      from public.deals
      where deals.id = deal_id
        and deals.moderation_status = 'approved'
        and deals.status in ('live', 'expiring_soon')
    )
    or exists (
      select 1
      from public.deals
      where deals.id = deal_id
        and deals.posted_by = auth.uid()
    )
    or public.is_moderator_or_admin()
  );

drop policy if exists "Users insert own votes" on public.deal_votes;
create policy "Users insert own votes" on public.deal_votes
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.deals
      where deals.id = deal_id
        and deals.moderation_status = 'approved'
        and deals.status in ('live', 'expiring_soon')
    )
  );

drop policy if exists "Users manage own saved deals" on public.saved_deals;
create policy "Users manage own saved deals" on public.saved_deals
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.deals
      where deals.id = deal_id
        and deals.moderation_status = 'approved'
        and deals.status in ('live', 'expiring_soon')
    )
  );

drop policy if exists "Users add own comments" on public.deal_comments;
create policy "Users add own comments" on public.deal_comments
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.deals
      where deals.id = deal_id
        and deals.moderation_status = 'approved'
        and deals.status in ('live', 'expiring_soon')
    )
  );

drop policy if exists "Users create deal reports" on public.deal_reports;
create policy "Users create deal reports" on public.deal_reports
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.deals
      where deals.id = deal_id
        and deals.moderation_status = 'approved'
        and deals.status in ('live', 'expiring_soon')
    )
  );

create or replace function public.refresh_deal_vote_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_deal uuid;
begin
  target_deal := coalesce(new.deal_id, old.deal_id);
  update public.deals
  set
    vote_count = (select count(*) from public.deal_votes where deal_id = target_deal),
    heat_score = greatest(0, heat_score + case when tg_op = 'INSERT' then 7 else -7 end),
    updated_at = now()
  where id = target_deal;
  return coalesce(new, old);
end;
$$;

drop trigger if exists deal_votes_refresh_totals on public.deal_votes;
create trigger deal_votes_refresh_totals
after insert or delete on public.deal_votes
for each row execute function public.refresh_deal_vote_totals();

create or replace function public.refresh_deal_comment_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_deal uuid;
begin
  target_deal := coalesce(new.deal_id, old.deal_id);
  update public.deals
  set
    comment_count = (
      select count(*)
      from public.deal_comments
      where deal_id = target_deal
        and status = 'approved'
    ),
    updated_at = now()
  where id = target_deal;
  return coalesce(new, old);
end;
$$;

drop trigger if exists deal_comments_refresh_totals on public.deal_comments;
create trigger deal_comments_refresh_totals
after insert or update or delete on public.deal_comments
for each row execute function public.refresh_deal_comment_totals();

commit;
