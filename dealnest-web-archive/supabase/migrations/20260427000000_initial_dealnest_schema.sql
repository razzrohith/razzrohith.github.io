-- DealNest initial Supabase schema
-- Run this once in the Supabase SQL Editor before connecting the frontend.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  reputation integer not null default 0 check (reputation >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'moderator', 'admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create or replace function public.has_role(required_role text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = required_role
  );
$$;

create or replace function public.is_moderator_or_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_role('moderator') or public.has_role('admin');
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text,
  tone text,
  description text,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  initials text,
  logo_url text,
  website_url text,
  description text,
  followers_count integer not null default 0 check (followers_count >= 0),
  rating numeric(2,1) not null default 0 check (rating >= 0 and rating <= 5),
  trust_label text not null default 'Community watched',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  instructions text,
  deal_url text,
  image_url text,
  current_price numeric(12,2) not null check (current_price >= 0),
  original_price numeric(12,2) check (original_price is null or original_price >= 0),
  discount_percent integer check (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100)),
  store_id uuid not null references public.stores(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  posted_by uuid references public.profiles(id) on delete set null,
  shipping_info text,
  coupon_code text,
  status text not null default 'pending' check (status in ('pending', 'live', 'expiring_soon', 'expired', 'rejected', 'hidden')),
  moderation_status text not null default 'approved' check (moderation_status in ('pending', 'approved', 'rejected', 'needs_review')),
  featured boolean not null default false,
  trending boolean not null default false,
  expires_at timestamptz,
  heat_score integer not null default 0 check (heat_score >= 0),
  vote_count integer not null default 0 check (vote_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deal_images (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  code text not null,
  description text,
  category text,
  verified boolean not null default false,
  status text not null default 'active' check (status in ('active', 'expired', 'disabled')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deal_votes (
  deal_id uuid not null references public.deals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  value integer not null default 1 check (value in (1)),
  created_at timestamptz not null default now(),
  primary key (deal_id, user_id)
);

create table if not exists public.saved_deals (
  deal_id uuid not null references public.deals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (deal_id, user_id)
);

create table if not exists public.deal_comments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  body text not null,
  status text not null default 'approved' check (status in ('pending', 'approved', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deal_reports (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deal_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  keyword text,
  category_id uuid references public.categories(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  max_price numeric(12,2) check (max_price is null or max_price >= 0),
  min_discount_percent integer check (min_discount_percent is null or (min_discount_percent >= 0 and min_discount_percent <= 100)),
  notify_email boolean not null default true,
  notify_browser boolean not null default false,
  notify_dashboard boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_threads (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  tag text,
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'approved' check (status in ('pending', 'approved', 'hidden', 'locked')),
  reply_count integer not null default 0 check (reply_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  body text not null,
  status text not null default 'approved' check (status in ('pending', 'approved', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.moderation_queue (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('deal', 'comment', 'thread', 'coupon', 'store', 'report')),
  entity_id uuid,
  title text not null,
  reason text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid references public.moderation_queue(id) on delete set null,
  moderator_id uuid references public.profiles(id) on delete set null,
  action text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists deals_store_id_idx on public.deals(store_id);
create index if not exists deals_category_id_idx on public.deals(category_id);
create index if not exists deals_status_idx on public.deals(status, moderation_status);
create index if not exists deals_search_idx on public.deals using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));
create index if not exists coupons_store_id_idx on public.coupons(store_id);
create unique index if not exists coupons_store_code_unique_idx on public.coupons(store_id, code);
create index if not exists comments_deal_id_idx on public.deal_comments(deal_id);
create index if not exists alerts_user_id_idx on public.deal_alerts(user_id);

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists categories_touch_updated_at on public.categories;
create trigger categories_touch_updated_at before update on public.categories for each row execute function public.touch_updated_at();
drop trigger if exists stores_touch_updated_at on public.stores;
create trigger stores_touch_updated_at before update on public.stores for each row execute function public.touch_updated_at();
drop trigger if exists deals_touch_updated_at on public.deals;
create trigger deals_touch_updated_at before update on public.deals for each row execute function public.touch_updated_at();
drop trigger if exists coupons_touch_updated_at on public.coupons;
create trigger coupons_touch_updated_at before update on public.coupons for each row execute function public.touch_updated_at();
drop trigger if exists comments_touch_updated_at on public.deal_comments;
create trigger comments_touch_updated_at before update on public.deal_comments for each row execute function public.touch_updated_at();
drop trigger if exists reports_touch_updated_at on public.deal_reports;
create trigger reports_touch_updated_at before update on public.deal_reports for each row execute function public.touch_updated_at();
drop trigger if exists alerts_touch_updated_at on public.deal_alerts;
create trigger alerts_touch_updated_at before update on public.deal_alerts for each row execute function public.touch_updated_at();
drop trigger if exists threads_touch_updated_at on public.community_threads;
create trigger threads_touch_updated_at before update on public.community_threads for each row execute function public.touch_updated_at();
drop trigger if exists posts_touch_updated_at on public.community_posts;
create trigger posts_touch_updated_at before update on public.community_posts for each row execute function public.touch_updated_at();
drop trigger if exists moderation_touch_updated_at on public.moderation_queue;
create trigger moderation_touch_updated_at before update on public.moderation_queue for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.stores enable row level security;
alter table public.deals enable row level security;
alter table public.deal_images enable row level security;
alter table public.coupons enable row level security;
alter table public.deal_votes enable row level security;
alter table public.saved_deals enable row level security;
alter table public.deal_comments enable row level security;
alter table public.deal_reports enable row level security;
alter table public.deal_alerts enable row level security;
alter table public.community_threads enable row level security;
alter table public.community_posts enable row level security;
alter table public.moderation_queue enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Public can read profiles" on public.profiles;
create policy "Public can read profiles" on public.profiles for select using (true);
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can read own roles" on public.user_roles;
create policy "Users can read own roles" on public.user_roles for select using (auth.uid() = user_id or public.is_moderator_or_admin());
drop policy if exists "Admins manage roles" on public.user_roles;
create policy "Admins manage roles" on public.user_roles for all using (public.has_role('admin')) with check (public.has_role('admin'));

drop policy if exists "Public read active categories" on public.categories;
create policy "Public read active categories" on public.categories for select using (is_active = true);
drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories" on public.categories for all using (public.has_role('admin')) with check (public.has_role('admin'));

drop policy if exists "Public read active stores" on public.stores;
create policy "Public read active stores" on public.stores for select using (is_active = true);
drop policy if exists "Admins manage stores" on public.stores;
create policy "Admins manage stores" on public.stores for all using (public.has_role('admin')) with check (public.has_role('admin'));

drop policy if exists "Guests read approved deals" on public.deals;
drop policy if exists "Guests read public visible deals" on public.deals;
create policy "Guests read public visible deals" on public.deals for select using (moderation_status = 'approved' and status in ('live', 'expiring_soon'));
drop policy if exists "Authenticated users create pending deals" on public.deals;
create policy "Authenticated users create pending deals" on public.deals for insert with check (auth.uid() = posted_by and status = 'pending' and moderation_status = 'pending');
drop policy if exists "Owners update own nonapproved deals" on public.deals;
create policy "Owners update own nonapproved deals" on public.deals for update using (auth.uid() = posted_by and moderation_status in ('pending', 'rejected')) with check (auth.uid() = posted_by);
drop policy if exists "Moderators manage deals" on public.deals;
create policy "Moderators manage deals" on public.deals for all using (public.is_moderator_or_admin()) with check (public.is_moderator_or_admin());

drop policy if exists "Public read deal images" on public.deal_images;
create policy "Public read deal images" on public.deal_images for select using (true);
drop policy if exists "Owners add images to own deals" on public.deal_images;
create policy "Owners add images to own deals" on public.deal_images for insert with check (exists (select 1 from public.deals where deals.id = deal_id and deals.posted_by = auth.uid()));
drop policy if exists "Moderators manage deal images" on public.deal_images;
create policy "Moderators manage deal images" on public.deal_images for all using (public.is_moderator_or_admin()) with check (public.is_moderator_or_admin());

drop policy if exists "Public read active coupons" on public.coupons;
create policy "Public read active coupons" on public.coupons for select using (status = 'active');
drop policy if exists "Moderators manage coupons" on public.coupons;
create policy "Moderators manage coupons" on public.coupons for all using (public.is_moderator_or_admin()) with check (public.is_moderator_or_admin());

drop policy if exists "Users read own votes" on public.deal_votes;
create policy "Users read own votes" on public.deal_votes for select using (auth.uid() = user_id or public.is_moderator_or_admin());
drop policy if exists "Users insert own votes" on public.deal_votes;
create policy "Users insert own votes" on public.deal_votes for insert with check (auth.uid() = user_id);
drop policy if exists "Users delete own votes" on public.deal_votes;
create policy "Users delete own votes" on public.deal_votes for delete using (auth.uid() = user_id);

drop policy if exists "Users manage own saved deals" on public.saved_deals;
create policy "Users manage own saved deals" on public.saved_deals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Public read approved comments" on public.deal_comments;
create policy "Public read approved comments" on public.deal_comments for select using (status = 'approved');
drop policy if exists "Users add own comments" on public.deal_comments;
create policy "Users add own comments" on public.deal_comments for insert with check (auth.uid() = user_id);
drop policy if exists "Users update own comments" on public.deal_comments;
create policy "Users update own comments" on public.deal_comments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Moderators manage comments" on public.deal_comments;
create policy "Moderators manage comments" on public.deal_comments for all using (public.is_moderator_or_admin()) with check (public.is_moderator_or_admin());

drop policy if exists "Users create deal reports" on public.deal_reports;
create policy "Users create deal reports" on public.deal_reports for insert with check (auth.uid() = user_id);
drop policy if exists "Users read own reports" on public.deal_reports;
create policy "Users read own reports" on public.deal_reports for select using (auth.uid() = user_id or public.is_moderator_or_admin());
drop policy if exists "Moderators manage reports" on public.deal_reports;
create policy "Moderators manage reports" on public.deal_reports for all using (public.is_moderator_or_admin()) with check (public.is_moderator_or_admin());

drop policy if exists "Users manage own alerts" on public.deal_alerts;
create policy "Users manage own alerts" on public.deal_alerts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Public read approved threads" on public.community_threads;
create policy "Public read approved threads" on public.community_threads for select using (status = 'approved');
drop policy if exists "Users create own threads" on public.community_threads;
create policy "Users create own threads" on public.community_threads for insert with check (auth.uid() = user_id);
drop policy if exists "Moderators manage threads" on public.community_threads;
create policy "Moderators manage threads" on public.community_threads for all using (public.is_moderator_or_admin()) with check (public.is_moderator_or_admin());

drop policy if exists "Public read approved posts" on public.community_posts;
create policy "Public read approved posts" on public.community_posts for select using (status = 'approved');
drop policy if exists "Users create own posts" on public.community_posts;
create policy "Users create own posts" on public.community_posts for insert with check (auth.uid() = user_id);
drop policy if exists "Users update own posts" on public.community_posts;
create policy "Users update own posts" on public.community_posts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Moderators manage posts" on public.community_posts;
create policy "Moderators manage posts" on public.community_posts for all using (public.is_moderator_or_admin()) with check (public.is_moderator_or_admin());

drop policy if exists "Moderators manage moderation queue" on public.moderation_queue;
create policy "Moderators manage moderation queue" on public.moderation_queue for all using (public.is_moderator_or_admin()) with check (public.is_moderator_or_admin());
drop policy if exists "Moderators read actions" on public.moderation_actions;
create policy "Moderators read actions" on public.moderation_actions for select using (public.is_moderator_or_admin());
drop policy if exists "Moderators create actions" on public.moderation_actions;
create policy "Moderators create actions" on public.moderation_actions for insert with check (public.is_moderator_or_admin());
drop policy if exists "Admins read audit logs" on public.audit_logs;
create policy "Admins read audit logs" on public.audit_logs for select using (public.has_role('admin'));

insert into storage.buckets (id, name, public)
values
  ('deal-images', 'deal-images', true),
  ('store-logos', 'store-logos', true),
  ('avatars', 'avatars', true),
  ('community-uploads', 'community-uploads', true)
on conflict (id) do nothing;

drop policy if exists "Public read deal images bucket" on storage.objects;
create policy "Public read deal images bucket" on storage.objects for select using (bucket_id = 'deal-images');
drop policy if exists "Public read store logos bucket" on storage.objects;
create policy "Public read store logos bucket" on storage.objects for select using (bucket_id = 'store-logos');
drop policy if exists "Public read avatars bucket" on storage.objects;
create policy "Public read avatars bucket" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "Public read community uploads bucket" on storage.objects;
create policy "Public read community uploads bucket" on storage.objects for select using (bucket_id = 'community-uploads');

drop policy if exists "Authenticated upload deal images" on storage.objects;
create policy "Authenticated upload deal images" on storage.objects for insert with check (bucket_id = 'deal-images' and auth.role() = 'authenticated');
drop policy if exists "Authenticated upload own avatars" on storage.objects;
create policy "Authenticated upload own avatars" on storage.objects for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
drop policy if exists "Authenticated upload community files" on storage.objects;
create policy "Authenticated upload community files" on storage.objects for insert with check (bucket_id = 'community-uploads' and auth.role() = 'authenticated');
drop policy if exists "Admins upload store logos" on storage.objects;
create policy "Admins upload store logos" on storage.objects for insert with check (bucket_id = 'store-logos' and public.has_role('admin'));
