-- DealNest backend verification queries.
-- Run in Supabase SQL Editor after the migration and seed files.
-- These checks are read-only and safe to rerun.

-- 1. RLS should be enabled on every application table.
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles',
    'user_roles',
    'categories',
    'stores',
    'deals',
    'deal_images',
    'coupons',
    'deal_votes',
    'saved_deals',
    'deal_comments',
    'deal_reports',
    'deal_alerts',
    'community_threads',
    'community_posts',
    'moderation_queue',
    'moderation_actions',
    'audit_logs'
  )
order by tablename;

-- 2. Public seed data counts.
select 'categories' as table_name, count(*) as row_count from public.categories
union all select 'stores', count(*) from public.stores
union all select 'public_visible_deals', count(*) from public.deals where moderation_status = 'approved' and status in ('live', 'expiring_soon')
union all select 'active_coupons', count(*) from public.coupons where status = 'active'
union all select 'approved_threads', count(*) from public.community_threads where status = 'approved'
union all select 'moderation_queue', count(*) from public.moderation_queue;

-- 3. Guest-readable tables should have approved/active rows.
select
  d.slug,
  d.title,
  d.status,
  d.moderation_status,
  s.name as store_name,
  c.name as category_name
from public.deals d
join public.stores s on s.id = d.store_id
join public.categories c on c.id = d.category_id
where d.moderation_status = 'approved'
  and d.status in ('live', 'expiring_soon')
order by d.heat_score desc
limit 10;

-- 4. Unique constraints/indexes used for duplicate prevention.
select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('deal_votes', 'saved_deals', 'coupons')
  and (
    indexname in ('deal_votes_pkey', 'saved_deals_pkey', 'coupons_store_code_unique_idx')
    or indexdef ilike '%unique%'
  )
order by tablename, indexname;

-- 5. Defaults for user-created deals.
select
  column_name,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'deals'
  and column_name in ('status', 'moderation_status', 'created_at', 'updated_at');

-- 6. RLS policies summary.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 7. Storage bucket setup.
select
  id,
  name,
  public
from storage.buckets
where id in ('deal-images', 'store-logos', 'avatars', 'community-uploads')
order by id;
