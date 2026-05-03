-- Tighten owner deal edits so normal users cannot self-approve submissions.
-- Admin/moderator approval still uses the existing "Moderators manage deals" policy.

begin;

drop policy if exists "Owners update own nonapproved deals" on public.deals;
create policy "Owners update own pending deals" on public.deals
  for update
  using (
    auth.uid() = posted_by
    and status = 'pending'
    and moderation_status = 'pending'
  )
  with check (
    auth.uid() = posted_by
    and status = 'pending'
    and moderation_status = 'pending'
  );

commit;
