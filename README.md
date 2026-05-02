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
