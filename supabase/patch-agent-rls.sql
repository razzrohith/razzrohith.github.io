-- =============================================================
-- RaithuFresh — Agent Call Requests RLS Patch
-- Adds missing GRANT statements and SELECT/UPDATE policies.
-- MVP-level security. Tighten when real auth is added.
-- =============================================================

-- Grant table-level privileges to anon role
-- (RLS policies alone are not enough — Postgres also needs GRANT)
GRANT SELECT, INSERT ON agent_call_requests TO anon;

-- Also fix the other tables that may be missing grants
GRANT SELECT, INSERT ON waitlist_leads TO anon;
GRANT SELECT, INSERT ON produce_listings TO anon;
GRANT SELECT, INSERT ON reservations TO anon;
GRANT SELECT ON farmers TO anon;

-- Allow anon to update only the status column on agent_call_requests
-- MVP: any anon user can update status. Tighten to agent role when auth is added.
GRANT UPDATE (status) ON agent_call_requests TO anon;

-- Drop existing insert policy and recreate (in case it was created with wrong syntax)
DROP POLICY IF EXISTS "public_insert_call_requests" ON agent_call_requests;
CREATE POLICY "public_insert_call_requests" ON agent_call_requests
  FOR INSERT TO anon WITH CHECK (true);

-- Add SELECT policy (was missing — needed to load request list)
DROP POLICY IF EXISTS "public_read_call_requests" ON agent_call_requests;
CREATE POLICY "public_read_call_requests" ON agent_call_requests
  FOR SELECT TO anon USING (true);

-- Add UPDATE policy for status field
-- MVP: allows anon to update status (pending -> called -> resolved)
-- TODO: restrict to authenticated agent role when auth is added
DROP POLICY IF EXISTS "public_update_call_request_status" ON agent_call_requests;
CREATE POLICY "public_update_call_request_status" ON agent_call_requests
  FOR UPDATE TO anon USING (true) WITH CHECK (status IN ('pending', 'called', 'resolved'));
