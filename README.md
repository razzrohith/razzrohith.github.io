# RaithuFresh

Connecting Telangana farmers directly with local buyers. MVP React web app with PWA support and Supabase backend.

---

## Supabase Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a free project. Choose any region (preferably Asia South for lower latency in India).

### 2. Add environment variables in Replit Secrets

Go to your Supabase project → **Settings → API**, then copy:

| Secret name | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | **Project URL** (e.g. `https://abcdef.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | **anon / public** key under "Project API keys" |

Add both to Replit Secrets. **Use the Project URL only** — do not include `/rest/v1/` at the end.

### 3. Run the schema

In your Supabase project, go to **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and click **Run**.

This creates 5 tables:
- `waitlist_leads` — waitlist form submissions
- `farmers` — farmer profiles
- `produce_listings` — produce listings
- `reservations` — buyer reservation requests
- `agent_call_requests` — agent-assisted farmer requests

### 4. Load seed data (optional)

To populate the database with realistic Telangana test data, open **SQL Editor → New query**, paste `supabase/seed.sql`, and run it.

This inserts:
- 8 verified farmers from Shadnagar, Vikarabad, Warangal, Karimnagar, Siddipet, Nalgonda, Khammam, Nizamabad
- 15 active produce listings (mangoes, tomatoes, bananas, guava, brinjal, green chilli, etc.)

---

## Agent Call Requests

The `agent_call_requests` table lets agents record farmer assistance and callback requests directly from the Agent Dashboard.

### What it does

- An agent fills in **Farmer Name**, **Farmer Phone**, optional **Village**, and an optional **Request Note**
- On submit, a new row is inserted into `agent_call_requests` with `status = pending`
- The **Callback Requests** section below the form loads all recent requests from Supabase (most recent first, up to 20)
- Each request card shows: name, phone, village, note, date, and current status badge
- The agent can update the status with the **Mark Called** / **Mark Resolved** / **Mark Pending** buttons without reloading the page

### Status lifecycle

```
pending  →  called  →  resolved
```

Any transition is allowed (e.g. resolved → pending if needed).

### RLS — MVP security note

The `anon` role is granted SELECT, INSERT, and UPDATE (status column only) on `agent_call_requests`. This is intentional for the no-auth MVP so agents can use the dashboard without logging in.

**Before going to production:** restrict these policies to an authenticated `agent` or `admin` role. The minimum safe production policy would be:

```sql
-- Allow insert only for authenticated users
CREATE POLICY "auth_insert_call_requests" ON agent_call_requests
  FOR INSERT TO authenticated WITH CHECK (true);

-- Allow read for authenticated users
CREATE POLICY "auth_read_call_requests" ON agent_call_requests
  FOR SELECT TO authenticated USING (true);

-- Allow status update for authenticated users only
CREATE POLICY "auth_update_call_request_status" ON agent_call_requests
  FOR UPDATE TO authenticated USING (true)
  WITH CHECK (status IN ('pending', 'called', 'resolved'));

-- Revoke anon grants
REVOKE ALL ON agent_call_requests FROM anon;
```

### How to test the Agent Dashboard callback request

1. Go to **Agent Dashboard** (`/agent`)
2. Scroll to **Log Farmer Assistance Request**
3. Fill in Farmer Name and Phone (10 digits) — Village and Note are optional
4. Click **Save Callback Request**
5. The new request appears in the **Callback Requests** list below with status **Pending**
6. Click **Mark Called** → status changes to **Called** (confirmed live in Supabase)
7. Click **Mark Resolved** → status changes to **Resolved**
8. Use the **Refresh** button to reload the list from Supabase at any time
9. Verify in Supabase → Table Editor → `agent_call_requests`

---

## Admin Dashboard — Agent Requests view

Admin can monitor all farmer assistance and callback requests created by agents.

### What Admin can see and do

- **Agent Callback Requests** analytics section (above the tabs) shows four live cards:
  - **Total Requests** — total rows in `agent_call_requests`
  - **Pending** — requests not yet acted on
  - **Called** — agent has contacted the farmer
  - **Resolved** — request fully handled
- The **Agent Requests** tab lists every request with farmer name, phone, village, note, date, and current status badge
- Admin can update status using **Mark Pending / Mark Called / Mark Resolved** buttons on each card
- A **Refresh** button reloads all request data from Supabase
- The **Agent Requests** tab shows a pending-count badge when there are unactioned requests

### How to test Admin agent request monitoring

1. Go to **Admin Dashboard** (`/admin`)
2. The **Agent Callback Requests** section shows live counts — Total, Pending, Called, Resolved
3. Click the **Agent Requests** tab
4. All requests saved from the Agent Dashboard appear here
5. Click **Mark Called** or **Mark Resolved** on any request — the status badge updates instantly and is persisted to Supabase
6. Add a new request on the Agent Dashboard, then return here and click **Refresh** — the new request appears

### MVP security note

For MVP testing, the `anon` role can view and update agent request status from both the Agent Dashboard and Admin Dashboard. This must be restricted to authenticated agent/admin roles before going to production. See the RLS section above for the exact SQL to tighten this.

---

## Testing

### Waitlist form
1. Go to the home page
2. Scroll to "Join the Waitlist"
3. Fill out name, phone, role, and village
4. Submit — the lead is saved to `waitlist_leads` in Supabase
5. Verify in Supabase → Table Editor → `waitlist_leads`

### Reservation flow
1. Go to Browse Produce
2. Click **Reserve** on any listing
3. Fill out name, phone, quantity
4. Submit — the reservation is saved to `reservations` in Supabase
5. Verify in Supabase → Table Editor → `reservations`

### Farmer listing form
1. Go to Farmer Dashboard
2. Click **Add New Listing**
3. Fill out all fields and submit
4. The listing is saved to `produce_listings` in Supabase under the demo farmer's UUID

### Admin analytics
1. Go to Admin Dashboard
2. If Supabase is configured, the top cards show **live counts** from the database
3. If not configured, mock counts are shown

---

## Authentication

RaithuFresh uses Supabase Auth (email + password). User roles are stored in the `user_profiles` table.

### How auth works

1. On signup, a Supabase auth user is created and a `user_profiles` row is inserted with the chosen role
2. On login, the session is stored in the browser (localStorage via Supabase SDK)
3. Auth state is tracked by `AuthContext` — provides `user`, `profile`, `role`, `signIn`, `signUp`, `signOut`
4. The Navbar shows the user's name + role badge when logged in, and Log In / Sign Up buttons when logged out
5. Protected routes check the user's role before rendering the page

### Roles and access

| Role | Accessible pages |
|---|---|
| `buyer` | Home, Browse Produce, Produce Detail |
| `farmer` | Home, Browse, Produce Detail, **Farmer Dashboard** |
| `agent` | Home, Browse, Produce Detail, **Agent Dashboard** |
| `admin` | All pages including **Admin Dashboard** |

Browse Produce and Produce Detail remain public — no login required to browse listings or view details. Reservation form is also public (no login required).

If a user visits a protected page while logged out, they see "Please log in to continue."
If a logged-in user visits a page their role does not permit, they see "You do not have access to this page."

### How to create test users

1. Go to the **Sign Up** page (`/signup`)
2. Fill in: Full Name, Phone, Email, Password, Role (buyer / farmer / agent), optional Village
3. Supabase sends a confirmation email — confirm it before logging in
4. Log in at `/login`

**To skip email confirmation for testing:** go to your Supabase project → Authentication → Settings → disable "Enable email confirmations".

### How to manually make an admin user

Admin accounts cannot be created via the signup form (the role selector only shows buyer, farmer, agent). To promote a user to admin:

1. Go to your Supabase project → Table Editor → `user_profiles`
2. Find the user's row by their UUID
3. Update the `role` column to `admin`
4. That user can now access the Admin Dashboard

Or run SQL:
```sql
UPDATE user_profiles SET role = 'admin' WHERE id = '<user-uuid>';
```

### Farmer auth linking

When a user signs up or logs in with `role = farmer`, they get a linked row in the `farmers` table:

**How it works:**

1. On signup (if email confirmation is disabled): a `farmers` row is created immediately from the user's `user_profiles` data
2. On first Farmer Dashboard load (after login): `getOrCreateFarmerForCurrentUser()` checks for an existing `farmers` row linked via `user_id = auth.uid()`. If none exists, it creates one from the `user_profiles` data
3. The `farmers.user_id` column links `auth.users.id` to the farmer row via a UNIQUE constraint
4. All produce_listings inserted from the Farmer Dashboard use `farmer_id = <linked farmers row id>` — never the hardcoded demo UUID
5. The Farmer Dashboard loads only that farmer's own listings (any status) via `getFarmerListings(farmerId)`
6. Status updates (Sold / Out of Stock) hit Supabase and only succeed if the farmer's row owns the listing (enforced by RLS)

**Seed farmers** (from `seed.sql`) have `user_id = NULL`. They remain visible on Browse Produce because `public_read_active_listings` (status = 'active') is unaffected.

**What happens if the farmers row cannot be created:**
- The dashboard shows a warning banner
- Listings are not saved to the database
- This can happen if the user signed up with email confirmation pending and has never logged in since — refreshing after confirming email resolves it

**helpers added in `supabase.ts`:**
- `getFarmerByCurrentUser()` — fetches the farmers row linked to `auth.uid()`
- `getOrCreateFarmerForCurrentUser(profile)` — get or create, non-fatal on failure
- `getFarmerListings(farmerId)` — all listings for a farmer (any status)
- `createFarmerListing(farmerId, data)` — inserts listing with correct farmer_id
- `updateListingStatus(listingId, status)` — updates status, RLS ensures only own listings

### SQL patches

Apply in order if setting up from scratch:

```
pnpm --filter @workspace/scripts run db:patch-auth          # user_profiles + RLS
pnpm --filter @workspace/scripts run db:patch-farmer-link   # farmers.user_id + produce_listings RLS
```

Or paste each file's contents into Supabase → SQL Editor.

### Current MVP limitations

- **Email confirmation** is required by default in Supabase — disable it in Supabase settings for faster testing
- **Buyer Reservations on Farmer Dashboard**: the reservations section still uses mock data. Linking real Supabase reservations to the farmer's listings is the next step
- **Admin profile reads**: the admin can only read their own profile via RLS. Reading all user profiles requires either a Supabase Edge Function with service_role or app_metadata-based JWT checks
- **Anon RLS still present**: the existing anon policies (from schema.sql) remain alongside the authenticated ones. Remove anon INSERT grants before production

### Production hardening checklist

- [ ] Disable public anon INSERT on `produce_listings` (now handled by farmer-scoped authenticated INSERT)
- [ ] Disable public anon INSERT/UPDATE on `agent_call_requests`
- [ ] Add admin RLS using `auth.jwt() ->> 'app_metadata'` for reading all `user_profiles`
- [ ] Enable email confirmation in Supabase Auth settings for production
- [ ] Link Supabase `reservations` to the farmer's listings so they appear on Farmer Dashboard
- [ ] Move service-role operations to a Supabase Edge Function

---

## Mock fallback

If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing or invalid, every page falls back to local mock data automatically — no crash, no broken UI. This means the app works fully in demo mode without any backend.

---

## PWA / Offline

The app is installable as a PWA. On Android Chrome, the install banner appears automatically. On iOS, use "Add to Home Screen" from the Safari share menu.

The service worker only registers in production builds. In development, mock data is always used regardless of Supabase configuration (because `import.meta.env.PROD` is false in dev).

---

## Environment variables summary

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | No (has mock fallback) | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | No (has mock fallback) | Supabase anon/public API key |

---

## Tech stack

- React + Vite + TypeScript
- Tailwind CSS + shadcn/ui components
- Framer Motion for animations
- react-hook-form + zod for form validation
- Supabase (postgres + REST API)
- Wouter for routing
- Sonner for toasts
- PWA: Web App Manifest + Service Worker
