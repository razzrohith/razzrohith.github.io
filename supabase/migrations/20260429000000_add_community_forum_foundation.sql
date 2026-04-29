-- DealNest community forum foundation.
-- Additive/tightening migration for thread detail content, owner-safe posting,
-- community reports, and moderator-only community moderation.

begin;

alter table public.community_threads
  add column if not exists body text not null default '',
  add column if not exists last_activity_at timestamptz not null default now();

create index if not exists community_threads_status_updated_idx
  on public.community_threads(status, updated_at desc);

create index if not exists community_threads_tag_idx
  on public.community_threads(tag);

create index if not exists community_posts_thread_status_idx
  on public.community_posts(thread_id, status, created_at);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('thread', 'post')),
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  post_id uuid references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_reports_target_check check (
    (entity_type = 'thread' and post_id is null)
    or
    (entity_type = 'post' and post_id is not null)
  )
);

create unique index if not exists community_reports_user_thread_unique_idx
  on public.community_reports(user_id, thread_id)
  where entity_type = 'thread' and post_id is null;

create unique index if not exists community_reports_user_post_unique_idx
  on public.community_reports(user_id, post_id)
  where entity_type = 'post' and post_id is not null;

create index if not exists community_reports_status_idx
  on public.community_reports(status, created_at desc);

create index if not exists community_reports_thread_idx
  on public.community_reports(thread_id);

update public.community_threads
set
  body = case slug
    when 'best-time-to-buy-travel-gear' then 'Looking for timing patterns on luggage, carry-ons, packing cubes, and commuter bags before summer trips. Share what price drops you trust and which travel categories still feel inflated.'
    when 'under-100-desk-upgrades' then 'Drop the best desk upgrades under $100 that improved your setup without turning into clutter. Bonus points for stands, lighting, cable cleanup, audio, and comfort picks.'
    when 'verify-marketplace-refurb-deals' then 'Refurb and marketplace listings can be great, but warranty, seller trust, and return windows matter. What checks do you run before calling one hot?'
    when 'coupon-stacking-wins' then 'Use this thread for coupon stacking wins from the week. Include store, code behavior, final cart price, and any limits that would help other members avoid dead ends.'
    when 'pet-feeder-reliability' then 'Smart feeders and pet cameras look similar on deal pages. Which features actually hold up, and what should members avoid?'
    else body
  end,
  last_activity_at = coalesce(last_activity_at, updated_at, now())
where slug in (
  'best-time-to-buy-travel-gear',
  'under-100-desk-upgrades',
  'verify-marketplace-refurb-deals',
  'coupon-stacking-wins',
  'pet-feeder-reliability'
);

insert into public.community_posts (thread_id, user_id, body, status)
select thread.id, null, seed.body, 'approved'
from public.community_threads thread
join (
  values
    ('best-time-to-buy-travel-gear', 'Soft luggage and packing organizers usually get better discounts right after spring break. Hard-side sets seem strongest when stores bundle all three sizes.'),
    ('best-time-to-buy-travel-gear', 'I would watch free shipping and return policy first. Oversize delivery can erase a deal quickly on luggage.'),
    ('under-100-desk-upgrades', 'A monitor arm, a small task lamp, and a better desk mat changed my setup more than another gadget would have.'),
    ('under-100-desk-upgrades', 'Cable trays under the desk are boring but worth it. The best deal is the one you notice every day.'),
    ('verify-marketplace-refurb-deals', 'I look for seller history, return window, battery health language, and whether the warranty is merchant-backed or manufacturer-backed.'),
    ('coupon-stacking-wins', 'Stacked a free-shipping threshold with a category coupon this week. Final cart mattered more than the advertised percent off.'),
    ('pet-feeder-reliability', 'Check whether the app needs a subscription for core features. A cheap device can become expensive fast if alerts are locked away.')
) as seed(slug, body) on seed.slug = thread.slug
where not exists (
  select 1
  from public.community_posts existing
  where existing.thread_id = thread.id
    and existing.body = seed.body
);

drop trigger if exists community_reports_touch_updated_at on public.community_reports;
create trigger community_reports_touch_updated_at
  before update on public.community_reports
  for each row execute function public.touch_updated_at();

alter table public.community_reports enable row level security;

drop policy if exists "Public read approved threads" on public.community_threads;
create policy "Public read approved threads" on public.community_threads
  for select using (status = 'approved');

drop policy if exists "Users read own community threads" on public.community_threads;
create policy "Users read own community threads" on public.community_threads
  for select using (auth.uid() = user_id);

drop policy if exists "Users create own threads" on public.community_threads;
drop policy if exists "Users create pending community threads" on public.community_threads;
create policy "Users create pending community threads" on public.community_threads
  for insert
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "Users update own community threads" on public.community_threads;
create policy "Users update own community threads" on public.community_threads
  for update
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "Users delete own community threads" on public.community_threads;
create policy "Users delete own community threads" on public.community_threads
  for delete
  using (auth.uid() = user_id and status = 'pending');

drop policy if exists "Moderators manage threads" on public.community_threads;
create policy "Moderators manage threads" on public.community_threads
  for all
  using (public.is_moderator_or_admin())
  with check (public.is_moderator_or_admin());

drop policy if exists "Public read approved posts" on public.community_posts;
create policy "Public read approved posts" on public.community_posts
  for select using (status = 'approved');

drop policy if exists "Users read own community posts" on public.community_posts;
create policy "Users read own community posts" on public.community_posts
  for select using (auth.uid() = user_id);

drop policy if exists "Users create own posts" on public.community_posts;
drop policy if exists "Users create pending community posts" on public.community_posts;
create policy "Users create pending community posts" on public.community_posts
  for insert
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "Users update own posts" on public.community_posts;
drop policy if exists "Users update own community posts" on public.community_posts;
create policy "Users update own community posts" on public.community_posts
  for update
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "Users delete own community posts" on public.community_posts;
create policy "Users delete own community posts" on public.community_posts
  for delete
  using (auth.uid() = user_id and status = 'pending');

drop policy if exists "Moderators manage posts" on public.community_posts;
create policy "Moderators manage posts" on public.community_posts
  for all
  using (public.is_moderator_or_admin())
  with check (public.is_moderator_or_admin());

drop policy if exists "Users create own community reports" on public.community_reports;
create policy "Users create own community reports" on public.community_reports
  for insert
  with check (
    auth.uid() = user_id
    and status = 'open'
    and exists (
      select 1
      from public.community_threads target_thread
      where target_thread.id = community_reports.thread_id
        and (target_thread.status = 'approved' or target_thread.user_id = auth.uid())
    )
    and (
      community_reports.post_id is null
      or exists (
        select 1
        from public.community_posts target_post
        where target_post.id = community_reports.post_id
          and target_post.thread_id = community_reports.thread_id
          and (target_post.status = 'approved' or target_post.user_id = auth.uid())
      )
    )
  );

drop policy if exists "Users read own community reports" on public.community_reports;
create policy "Users read own community reports" on public.community_reports
  for select
  using (auth.uid() = user_id or public.is_moderator_or_admin());

drop policy if exists "Moderators manage community reports" on public.community_reports;
create policy "Moderators manage community reports" on public.community_reports
  for all
  using (public.is_moderator_or_admin())
  with check (public.is_moderator_or_admin());

grant select, insert, update, delete on public.community_reports to authenticated;

commit;
