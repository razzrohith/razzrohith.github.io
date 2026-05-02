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

## Public Farmer Profile — `/farmers/:id`

### What was added

#### 1. New public route `/farmers/:id`

Registered in `App.tsx` alongside the other public routes. No authentication required. Completely separate from `/farmer` (the protected Farmer Dashboard). Uses Wouter route parameter `:id`.

#### 2. Farmer profile data loaded from Supabase

Two new helper functions in `src/lib/supabase.ts`:

| Function | Query | Access |
|---|---|---|
| `getFarmerProfileById(farmerId)` | `farmers` table by id | Anon (public RLS on `farmers`) |
| `getActiveListingsByFarmer(farmerId)` | `produce_listings` where `status = 'active'` and `farmer_id = farmerId` | Anon (RLS enforces status=active) |

No RLS policies were changed. Both functions return null/empty on error.

#### 3. Profile card shows

- Farmer name (large heading)
- Village, District (with MapPin icon)
- Star rating (if available)
- Verified Farmer badge (green, BadgeCheck icon)
- Agent Assisted badge (amber, for `assisted_mode = true`)
- Active listings count
- Trust note: "Contact the farmer before pickup. Payment is Cash or UPI directly to the farmer. RaithuFresh does not handle online payment."

#### 4. Active listings section

Shows only `status = 'active'` listings. Sold, out_of_stock, and reserved listings are never shown publicly. Each listing card includes:

- Produce name + category badge
- Price per kg / quantity available
- Harvest date, pickup location, distance, quality notes
- Reserve button → opens ReservationModal (real `listing_id`)
- Contact button → opens ContactFarmerDialog (farmer phone, produce name pre-filled for WhatsApp)
- Share button → `shareListing()` helper (Web Share API → clipboard → toast fallback)
- View full details → `/produce/:id`

#### 5. Empty / not-found / loading states

| State | Behavior |
|---|---|
| Loading | Spinner: "Loading farmer profile..." |
| Not found (invalid id, RLS blocked, no row) | Error card: "Farmer not found" + Browse Produce button |
| Active listings = 0 | "No active listings from this farmer right now." + Browse all produce button |

#### 6. Share Farmer Profile

A "Share Profile" button in the top-right (next to Back to Browse) uses Web Share API if available, then clipboard copy, then toast with URL. Share text:
> "View Ramaiah's fresh fruit and vegetable listings on RaithuFresh near Shadnagar, Rangareddy."

#### 7. Links added

- **Browse Produce**: Farmer name on each card is now a clickable link → `/farmers/:id`
- **Produce Detail**: Farmer name is now a clickable link + small "View Farmer Profile" text link below

#### 8. Privacy rules maintained

- Farmer phone: available only through the Contact Farmer dialog (explicitly opt-in)
- Buyer phone (`reservations.buyer_phone`): never shown on this page
- No reservation data shown on the public profile
- No admin-only data shown

#### 9. Files changed

| File | Change |
|---|---|
| `src/lib/supabase.ts` | Added `getFarmerProfileById`, `getActiveListingsByFarmer` |
| `src/pages/FarmerProfilePage.tsx` | New — complete public profile page |
| `src/App.tsx` | Imported `FarmerProfilePage`, added `Route path="/farmers/:id"` |
| `src/pages/BrowsePage.tsx` | Farmer name now links to `/farmers/:id` |
| `src/pages/ProduceDetailPage.tsx` | Farmer name links to `/farmers/:id`; "View Farmer Profile" link added |

#### 10. Test farmer IDs (fake/mock seed data)

| Farmer | ID |
|---|---|
| Ramaiah (Shadnagar, Rangareddy) | `11111111-0001-0001-0001-000000000001` |
| Lakshmi Devi (Vikarabad) | `11111111-0001-0001-0001-000000000002` |
| Venkat Rao (Narayanpet) | `11111111-0001-0001-0001-000000000003` |
| Srinivas (Siddipet) | `11111111-0001-0001-0001-000000000004` |
| Yellamma (Nizamabad) | `11111111-0001-0001-0001-000000000005` |
| Narayana (Khammam) | `11111111-0001-0001-0001-000000000006` |
| Padma Bai (Warangal) | `11111111-0001-0001-0001-000000000007` |
| Suresh Kumar (Karimnagar) | `11111111-0001-0001-0001-000000000008` |

All names, phones, villages, and IDs are fake/mock test data. No real personal data used.

---

## Buyer Reservation Detail + Dashboard Flow Phase

### Overview

Adds a focused `/buyer/reservations/:id` detail page for logged-in buyers, a sort dropdown to the dashboard, and View Details links on each dashboard card.

---

### Files Changed

| File | Change |
|---|---|
| `src/lib/supabase.ts` | Added `BuyerReservationDetail` type + `getBuyerReservationById()` helper |
| `src/pages/BuyerReservationDetail.tsx` | New — reservation detail page (protected, buyer + admin) |
| `src/pages/BuyerDashboard.tsx` | Added sort dropdown, View Details button on each card |
| `src/App.tsx` | Added `/buyer/reservations/:id` protected route |

---

### Route Added

| Route | Protection | Access |
|---|---|---|
| `/buyer/reservations/:id` | ProtectedRoute `["buyer", "admin"]` | Buyer sees own reservation only; admin allowed by RLS |

---

### `getBuyerReservationById()` Helper

```ts
getBuyerReservationById(reservationId: string): Promise<BuyerReservationDetail | null>
```

- Double-guards: `.eq("id", id).eq("buyer_user_id", user.id)` (client) + RLS SELECT policy (server)
- Returns `null` if reservation not found, belongs to another buyer, or user is not logged in
- Joins: produce_listings with `harvest_datetime`, `district`, `status`; farmers with `rating`, `verified`, `phone`

---

### `BuyerReservationDetail` Type

```ts
export type BuyerReservationDetail = {
  id, listing_id, buyer_name, quantity_kg, status, payment_method, created_at,
  produce_listings?: {
    produce_name, category, price_per_kg,
    harvest_datetime: string | null,
    pickup_location: string | null,
    district: string | null,
    status: string,
    farmers?: {
      name, village, district,
      rating: number | null,
      verified: boolean | null,
      phone: string | null,
    } | null,
  } | null,
}
```

---

### Reservation Detail Page

| Section | Content |
|---|---|
| Header card | Produce name + category SVG icon, status badge |
| Reservation details | Quantity, estimated total, reserved date + time, expected harvest date, payment method |
| Pickup location | Address text, district, "Open in map" link (OpenStreetMap search, free, no API key) |
| Farmer card | Name, Verified badge (ShieldCheck), village/district, star rating |
| Actions | View Listing, View Farmer Profile, Contact Farmer, Cancel Request (pending only) |

#### States

| State | Display |
|---|---|
| Loading | Spinner + "Loading reservation..." |
| Not found / access denied | XCircle + "Reservation not found" + Back to Buyer Dashboard |
| Loaded | Full detail layout |

#### Pickup location map link

- URL: `https://www.openstreetmap.org/search?query={encodeURIComponent(pickup_location)}`
- Free, no API key, no embedding, no paid service
- Opens in new tab (`target="_blank" rel="noopener noreferrer"`)

#### Cancel Request from detail page

- Same `cancelBuyerReservation()` helper as dashboard
- Same RLS USING+WITH CHECK protection
- On success: updates local state → status badge changes to Cancelled, Cancel Request button disappears

---

### Buyer Dashboard Changes

#### Sort Dropdown

| Option | Sort logic |
|---|---|
| Newest first | `created_at` DESC (default) |
| Oldest first | `created_at` ASC |
| Quantity high to low | `quantity_kg` DESC |
| By status | pending → confirmed → completed → cancelled |

- Client-side only, no server call
- Sort applied before filter and search
- Dropdown closes on outside click (transparent fixed backdrop)

#### View Details Button

- Added as the primary (default variant) action button on each dashboard card
- Links to `/buyer/reservations/:id`
- Other buttons remain: View Listing (outline), Contact Farmer (outline), Cancel Request (ghost/destructive for pending)

---

### Access Control

| Attempt | Result |
|---|---|
| Guest visits `/buyer/reservations/:id` | ProtectedRoute → "Please log in to continue" |
| Buyer visits own reservation | Loads correctly |
| Buyer visits another buyer's reservation | `getBuyerReservationById` returns null (client `.eq("buyer_user_id", user.id)` + RLS) → "Reservation not found" |
| Invalid UUID | Supabase returns null → "Reservation not found" |
| Buyer cancels own pending from detail | Works — Cancel Request disappears, badge becomes Cancelled |
| Buyer cancels confirmed/completed | Cancel button never shown (only shown for pending) |

---

### Privacy / Security

| Rule | Status |
|---|---|
| Buyer sees only own reservation | Client double-guard + RLS SELECT policy |
| Cross-buyer isolation | `buyer_user_id = auth.uid()` enforced at both layers |
| Guest blocked | ProtectedRoute gate |
| Cancel limited to pending only | RLS USING gate + button conditionally rendered |
| Farmer phone | Only in authenticated Contact Farmer dialog on own reservation |
| Buyer phone | Not selected in any buyer helper |
| service_role key | Not used |
| Secrets | Not printed |
| No paid services | OpenStreetMap (free), all icons Lucide or local SVGs |

---

### TypeScript Result

Exit 0 — zero errors.

### Console Errors

None.

---

### Remaining Limitations

| Limitation | Notes |
|---|---|
| View Farmer Profile button uses `listing_id` as farmer ID | Farmer ID not available in `BuyerReservation` type — fix: extend query to include farmer `id` in a future patch |
| No back-navigation on cancel from detail | User stays on detail page after cancel (status updates in place) |
| No pagination on dashboard | All reservations loaded at once |

---

## Buyer Dashboard Reservation Management + UX Polish Phase

### Overview

This phase adds status filters, client-side search, buyer cancellation (pending only), improved reservation cards with a 2-column detail grid, and better empty states to the Buyer Dashboard.

---

### Files Changed

| File | Change |
|---|---|
| `supabase/patch-buyer-cancel-reservation.sql` | New — adds buyer UPDATE RLS policy (cancel own pending only) |
| `src/lib/supabase.ts` | Added `cancelBuyerReservation(reservationId)` helper |
| `src/pages/BuyerDashboard.tsx` | Full UX overhaul: filters, search, cancel button, better cards, better empty states |

---

### Database Patch — `patch-buyer-cancel-reservation.sql`

Run once. Idempotent. Safe to re-run.

| Change | Details |
|---|---|
| Policy name | `buyers_cancel_own_pending_reservations` |
| Type | `FOR UPDATE TO authenticated` |
| USING | `buyer_user_id = auth.uid() AND status = 'pending'` — buyer must own it AND it must be pending |
| WITH CHECK | `buyer_user_id = auth.uid() AND status = 'cancelled'` — the only allowed new status is `cancelled` |
| No DELETE | Buyers cannot delete reservations |
| Existing policies | Farmer UPDATE, admin UPDATE, anon INSERT, authenticated SELECT/INSERT — all untouched |

**Why this is safe:**

- `USING` clause blocks access to any row the buyer does not own, or any non-pending row.
- `WITH CHECK` clause blocks setting any status other than `cancelled`.
- The Supabase PostgREST layer enforces both clauses server-side, independent of the client.
- Buyer cannot update `buyer_name`, `buyer_phone`, `listing_id`, `quantity_kg`, `payment_method`, or `created_at` — column-level updates still go through WITH CHECK which only validates `status = 'cancelled'`, but the client only sends `{ status: 'cancelled' }`.

---

### `cancelBuyerReservation()` Helper

```ts
cancelBuyerReservation(reservationId: string): Promise<boolean>
```

- Calls `.update({ status: 'cancelled' }).eq('id', reservationId)`
- RLS USING+WITH CHECK enforces ownership and pending-only protection server-side
- Returns `true` on success, `false` on error (logs warning)
- Updates local React state immediately after success (optimistic-like: no refetch)

---

### Buyer Dashboard UX

#### Status Tiles (clickable)

- Tiles are now buttons — clicking a tile filters the list to that status
- Clicking the active tile again resets to "All"
- Ring highlight when a tile is active

#### Filter Tabs

| Tab | Shows |
|---|---|
| All | All reservations (count badge) |
| Pending | Pending only (count badge) |
| Confirmed | Confirmed only |
| Completed | Completed only |
| Cancelled | Cancelled only |

- Active tab: green filled
- Inactive tab: white/border

#### Client-Side Search

- Search input with magnifier icon and clear (X) button
- Matches: produce name, farmer name, village, district, status
- No server call — filters the already-loaded list in real time
- `useMemo` for performance

#### Reservation Cards (improved)

- 2-column detail grid (quantity/total and pickup, date and payment)
- `AnimatePresence` for smooth enter/exit animations
- `layout` prop so cards reflow smoothly when filtered
- Cancelled cards rendered at 70% opacity
- Status badge icons and colors unchanged

#### Cancel Request Button

- Shown only when `reservation.status === 'pending'`
- Styled: ghost/destructive (red text, red hover bg)
- Shows spinner + "Cancelling..." while in-flight
- On confirm: calls `cancelBuyerReservation()`, updates local state — no full reload
- After cancellation: card status badge updates to Cancelled, Cancel Request button disappears, Pending count decrements

#### Empty States

| Condition | Display |
|---|---|
| No reservations at all | `empty-produce.svg` + "No reservations yet" + Browse Produce button |
| Filter/search returns nothing | Search icon + "No reservations match your filters" + Clear filters button |

#### Counts in section heading

- "Reservation History (N results)" — reflects the current filtered count

---

### Cancellation Rules

| Rule | Enforcement |
|---|---|
| Buyer can cancel own pending | RLS USING + client button visible only for pending |
| Buyer cannot cancel confirmed | RLS USING blocks (status != 'pending') |
| Buyer cannot cancel completed | RLS USING blocks |
| Buyer cannot cancel another buyer's reservation | RLS USING blocks (buyer_user_id != auth.uid()) |
| Buyer cannot set status to confirmed | RLS WITH CHECK blocks (status != 'cancelled') |
| Buyer cannot set status to completed | RLS WITH CHECK blocks |
| Buyer cannot delete | No DELETE policy |
| Buyer cannot update protected fields | Only `{ status: 'cancelled' }` sent by client; WITH CHECK validates status |

---

### Privacy / Security

| Rule | Status |
|---|---|
| Buyer sees only own reservations | RLS SELECT + client `.eq('buyer_user_id', user.id)` |
| Buyer can cancel only own pending | RLS UPDATE USING + WITH CHECK |
| Farmer reservation access unchanged | Existing policies untouched |
| Admin reservation access unchanged | Existing policies untouched |
| Guest reservation insert unchanged | Anon INSERT policy untouched |
| Buyer phone not exposed | Not in `getReservationsForCurrentBuyer` |
| Farmer phone only in authenticated context | ContactFarmerDialog in own reservations only |
| service_role key | Not used |
| Secrets | Not printed |

---

### TypeScript Result

Exit 0 — zero errors.

---

### Console Errors

None.

---

### No Paid Services Used

All icons are Lucide or local SVGs. No paid APIs, no external image hotlinks.

---

### Remaining Limitations

| Limitation | Notes |
|---|---|
| Old guest reservations | `buyer_user_id = NULL` — not cancellable via Buyer Dashboard (no RLS auth.uid() match) |
| No pagination | All reservations loaded at once — sufficient for pilot scale |
| No sort order toggle | Newest first always |
| Buyer profile edit | Not in this phase |

---

## Buyer Account Reservation Link + Buyer Dashboard Phase

### Overview

This phase allows logged-in buyers to track their own reservation history in a protected `/buyer` dashboard. Guest reservation flow continues to work unchanged.

---

### Files Changed

| File | Change |
|---|---|
| `supabase/patch-buyer-reservation-link.sql` | Adds `buyer_user_id` column + index + RLS policies to `reservations` |
| `src/lib/supabase.ts` | Added `BuyerReservation` type and `getReservationsForCurrentBuyer()` helper |
| `src/components/ReservationModal.tsx` | Auth-aware: pre-fills buyer name, attaches `buyer_user_id`, shows different success message |
| `src/pages/BuyerDashboard.tsx` | New protected page at `/buyer` with reservation history, status counts, Contact Farmer |
| `src/App.tsx` | Added `/buyer` protected route (`buyer`, `admin` roles) |
| `src/components/Navbar.tsx` | Added "Buyer Dashboard" link in user menu dropdown (desktop) and mobile menu |

---

### Database Patch — `patch-buyer-reservation-link.sql`

Run once against the Supabase Postgres database. All statements are idempotent (safe to re-run).

| Change | Details |
|---|---|
| Column added | `buyer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL` — nullable, defaults to NULL for old/guest rows |
| Index | `idx_reservations_buyer_user_id WHERE buyer_user_id IS NOT NULL` for fast buyer dashboard queries |
| RLS: buyer SELECT | `buyers_select_own_reservations` — authenticated users see only rows where `buyer_user_id = auth.uid()` |
| RLS: authenticated INSERT | `buyers_insert_own_reservations` — allows `buyer_user_id = auth.uid()` OR NULL (backward compat) |
| Untouched | Existing anon INSERT policy (guest buyers), farmer SELECT/UPDATE policies, admin policies |

---

### Guest vs Logged-In Reservation Behavior

| Scenario | `buyer_user_id` | Success message |
|---|---|---|
| Guest (not logged in) | NULL (anon INSERT policy applies) | "... Log in next time to track your reservation history." |
| Logged-in buyer | `auth.uid()` (authenticated INSERT policy applies) | "... You can track it from your Buyer Dashboard." + Go to Buyer Dashboard button |

---

### `getReservationsForCurrentBuyer()` Helper

```ts
getReservationsForCurrentBuyer(): Promise<BuyerReservation[]>
```

- Calls `getSupabase().auth.getUser()` to get the current user — returns `[]` if not logged in
- Queries `reservations WHERE buyer_user_id = auth.uid()` — enforced both client-side and server-side via RLS
- Joins `produce_listings(produce_name, category, price_per_kg, pickup_location, farmers(name, village, district, phone))`
- Farmer phone included for ContactFarmerDialog in the Buyer Dashboard (authenticated context, own reservations only)
- `buyer_phone` NOT selected — buyers know their own phone

---

### `BuyerReservation` Type

```ts
export type BuyerReservation = {
  id: string;
  listing_id: string;
  buyer_name: string;
  quantity_kg: number;
  status: ReservationStatus;
  payment_method: string | null;
  created_at: string;
  produce_listings?: {
    produce_name: string;
    category: string;
    price_per_kg: number;
    pickup_location: string | null;
    farmers?: {
      name: string;
      village: string | null;
      district: string | null;
      phone: string | null;      // for ContactFarmerDialog only
    } | null;
  } | null;
};
```

---

### Buyer Dashboard (`/buyer`)

Protected route — allowed roles: `buyer`, `admin`.

| Section | Details |
|---|---|
| Header | Buyer name (from profile or email), email |
| Status tiles | Pending / Confirmed / Completed / Cancelled counts |
| Reservation cards | Produce name + category SVG icon, farmer name + location, quantity, estimated total, pickup location, reserved date, payment method |
| Actions per card | View Listing (→ `/produce/:id`), Contact Farmer (opens ContactFarmerDialog — only if farmer phone available) |
| Empty state | `empty-produce.svg` illustration + Browse Produce button |

---

### ReservationModal Changes

- Imports `useAuth()` — no extra API call (reuses existing auth state)
- Pre-fills buyer name from `profile.full_name` when modal opens
- On submit: attaches `buyer_user_id = user.id` to the insert payload when logged in
- Tracks `submittedAsLoggedIn` to show the correct success message
- Success screen for logged-in buyers: includes a "Go to Buyer Dashboard" button

---

### Navbar Changes

| Location | Change |
|---|---|
| Desktop user dropdown | "Buyer Dashboard" link with ClipboardList icon, visible when role = buyer or admin |
| Mobile menu | "Buyer Dashboard" link, same role condition, active-state highlighted |

---

### Privacy / Security

| Rule | Status |
|---|---|
| Buyer sees only their own reservations | Enforced by RLS `buyer_user_id = auth.uid()` AND client-side `.eq("buyer_user_id", user.id)` |
| Other buyers' reservations not visible | Yes — RLS blocks cross-buyer access |
| Buyer cannot update reservation status | No UPDATE policy exists for buyer role |
| Farmer can still see reservations for their listings | Existing farmer SELECT policy unchanged |
| Admin can still see all reservations | Existing admin SELECT policy unchanged |
| Guest users cannot read reservations | No anon SELECT policy on reservations table |
| Buyer phone not exposed publicly | `buyer_phone` not included in `getReservationsForCurrentBuyer` query |
| Farmer phone exposed only in authenticated context | Only available via ContactFarmerDialog when viewing own reservations |
| service_role key | Not used |
| Secrets | Not printed |

---

### Fake/Mock Testing Rule

All test names, phones, villages, and IDs are fake/mock data. No real personal data used.

Test buyer: Ravi Test Buyer, phone: 9876500001, email: fakebuyer@example.com (mock only).

---

### No Paid Services

All icons are Lucide or local SVGs. No paid images, no external image hotlinks, no paid APIs.

---

### TypeScript Result

Exit 0 — zero errors.

---

### Remaining Buyer Dashboard Limitations

| Limitation | Notes |
|---|---|
| Buyer cannot cancel their own reservation | Status update requires farmer action — by design (MVP) |
| Old guest reservations with `buyer_user_id = NULL` | Not visible in Buyer Dashboard — shown to farmer and admin as before |
| No pagination | Reservation history shows all records in descending order |
| No filter by status | All statuses shown together — filter tabs can be added in a future phase |
| Buyer profile edit | Name and email not editable from dashboard — future phase |

---

## Produce Detail Conversion + Farmer Cross-Sell Phase

### Overview

This phase improves `ProduceDetailPage.tsx` for better buyer decision-making:
- Added "More from this farmer" section with up to 3 cross-sell cards
- Added dedicated Farmer Trust card (icon, verified badge, stars, View Profile + Contact)
- Replaced plain "not found" block with the existing `empty-produce.svg`
- Added `getOtherActiveListingsByFarmer()` helper to `src/lib/supabase.ts`
- All buyer actions (Reserve, Contact, WhatsApp, Share, View Details) remain intact

---

### Files Changed

| File | Change |
|---|---|
| `src/lib/supabase.ts` | Added `getOtherActiveListingsByFarmer(farmerId, excludeListingId)` helper |
| `src/pages/ProduceDetailPage.tsx` | Farmer Trust card, "More from this farmer" section, improved empty state, `modalListing` state for per-card Reserve modal |

---

### `getOtherActiveListingsByFarmer()` Helper

```ts
getOtherActiveListingsByFarmer(farmerId: string, excludeListingId: string): Promise<SupabaseListing[]>
```

- Queries `produce_listings` where `farmer_id = farmerId`, `status = 'active'`, `id != excludeListingId`
- Joins `farmers(id, name, village, district, rating, verified)` — **no `phone` field**
- Orders by `created_at DESC`, limit 3
- Returns empty array on any error (best-effort, never crashes the page)
- Uses current RLS — no weakening

**Privacy rules confirmed:**
- Farmer phone: not included in the join — only reachable via Contact Farmer dialog
- Buyer phone: not queried anywhere on this page
- Reservation data: not queried
- `service_role` key: not used

---

### Produce Detail Page — Section Order

1. Top bar: Back to Browse + Share Listing
2. Main listing card: name, farmer attribution, category badge + SVG icon, price/qty tiles, harvest date, pickup location, quality notes, status
3. **Farmer Trust Card** (new): farmer icon, name, Verified badge, star rating, View Farmer Profile + Contact Farmer buttons
4. Pickup Directions
5. Before You Come for Pickup (4 checklist items)
6. Reserve This Produce / Sold state
7. **More from this farmer** (new): up to 3 cross-sell cards
8. Similar produce nearby (existing)

---

### "More from this farmer" Cards

Each card shows:
- Produce name + harvest date + pickup location
- Category SVG icon + category badge
- Price per kg tile + quantity available tile
- View Details button (navigates to that listing's detail page)
- Reserve button (opens `ReservationModal` with that listing's data)
- Contact Farmer button (reuses main farmer's `ContactFarmerDialog` — same farmer)
- Share button (calls `shareListing()` with that listing's data)

If the farmer has no other active listings, the section is hidden entirely.

---

### Farmer Trust Card

Shows:
- `icon-farmer-week.svg` avatar (local SVG asset)
- Farmer name
- "Verified" badge (BadgeCheck icon, only if `verified = true`)
- Star rating (amber filled stars, only if `rating > 0`)
- Village, district location
- View Farmer Profile button → navigates to `/farmers/:id`
- Contact Farmer button → opens `ContactFarmerDialog`

---

### `modalListing` State

Added `modalListing: ProduceListing | null` state. When Reserve is clicked:
- From the main listing section: `openModal(listing)` — passes the main listing
- From a "More from this farmer" card: `openModal(mapped)` — passes that card's mapped listing

`ReservationModal` receives `modalListing ?? listing` so it always has a valid listing.

---

### Empty / Not Found State

Uses `empty-produce.svg` illustration instead of a plain icon, with a "Back to Browse" button.

---

### All Buyer Actions Verified Working

| Action | Status |
|---|---|
| Reserve (main listing) | Working — opens modal with main listing |
| Reserve (from More from farmer) | Working — opens modal with that listing |
| Contact Farmer | Working — opens ContactFarmerDialog with farmer phone |
| WhatsApp (inside ContactFarmerDialog) | Working — `wa.me/{phone}` link |
| Tap-to-call (inside ContactFarmerDialog) | Working — `tel:{phone}` link |
| Copy phone (inside ContactFarmerDialog) | Working |
| Share Listing (top bar) | Working — `shareListing()` with main listing |
| Share (from More from farmer card) | Working — `shareListing()` with that listing |
| View Details (from More from farmer card) | Working — navigates to `/produce/{id}` |
| View Farmer Profile | Working — navigates to `/farmers/{id}` |
| Similar nearby produce | Working — unchanged |

---

### Privacy / Security

- Buyer phone: never shown on public pages
- Farmer phone: only exposed via `ContactFarmerDialog` (not in any card or listing data directly)
- `getOtherActiveListingsByFarmer` join: no `phone` field selected
- Reservation data: not queried on public Produce Detail page
- RLS: unchanged
- Secrets: not printed anywhere

---

### Fake/Mock Testing Rule

All test farmer names, phone numbers, villages, produce names, and IDs are fake/mock data. No real personal data used.

---

### No Paid Services

All icons are Lucide or local SVGs. No paid images, no external image hotlinks, no paid APIs.

---

### TypeScript Result

Exit 0 — zero errors.

---

### Remaining Produce Detail Limitations

| Limitation | Notes |
|---|---|
| Reserve qty input only on main listing | "More from farmer" cards navigate to the detail page for qty-based reservations — Reserve button opens modal with qty defaulting to 1 |
| No farmer photo | Uses `icon-farmer-week.svg` placeholder |
| No Google Maps directions | Noted on the page — planned for a future version |
| Delivery not supported | Pickup only — noted on the page |
| WhatsApp/call from "More from farmer" card | Uses the same farmer's phone (same farmer, reuses the existing dialog) |

---

## Landing Trust Indicators + Live Stats Phase

### Overview

This phase adds a live stats strip between the hero and "How the Pilot Works" sections.
All stats are computed from public-safe Supabase data using a new `getLandingStats()` helper.
No schema changes, no paid services, no private data exposed.

---

### Trust Strip — What It Shows

Positioned between the hero and the pilot steps sections.

| Stat Card | Data Source | Icon |
|---|---|---|
| Verified Farmers | `farmers WHERE verified = true` — exact count | `BadgeCheck` (Lucide) |
| Active Listings | `produce_listings WHERE status = 'active'` — row count | `ShoppingBag` (Lucide) |
| Districts | Unique `district` values from active listings | `MapPin` (Lucide) |
| Fruit Listings | Active listings where `category = 'Fruit'` | `icon-fruit.svg` |
| Vegetable Listings | Active listings where `category = 'Vegetable'` | `icon-vegetable.svg` |

Trust wording shown above the stat cards:
> "Built for local pickup. Farmers list fresh fruits and vegetables, buyers reserve and contact directly."

**Loading state**: Each stat shows `"—"` while data is loading (no spinner, no flash).

**Error/Supabase-unconfigured state**: Stats default to `0`. Page never crashes.

---

### `getLandingStats()` Helper

Added to `src/lib/supabase.ts`. Runs two parallel queries on load:

| Query | Purpose |
|---|---|
| `SELECT *, { count: "exact", head: true } FROM farmers WHERE verified = true` | Gets total verified farmer count (no rows returned, just count header) |
| `SELECT category, district FROM produce_listings WHERE status = 'active'` | Gets all active listing rows (for breakdown by category and unique districts) |

Stats derived client-side from the two queries:
- `verifiedFarmers` — from the count header of query 1
- `activeListings` — `rows.length` from query 2
- `districtsCovered` — `new Set(rows.map(r => r.district).filter(Boolean)).size`
- `fruitListings` — `rows.filter(r => r.category === "Fruit").length`
- `vegetableListings` — `rows.filter(r => r.category === "Vegetable").length`

Returns `LandingStats` type with all fields defaulting to `0` on any error.

**Privacy rules confirmed for `getLandingStats()`:**
- No `phone` field selected
- No `buyer_name`, `buyer_phone`, or reservation data queried
- No `user_profiles` or `user_id` exposed
- No `service_role` key used
- RLS unchanged

---

### `LandingStats` Type

```ts
export type LandingStats = {
  verifiedFarmers: number;
  activeListings: number;
  districtsCovered: number;
  fruitListings: number;
  vegetableListings: number;
};
```

---

### Integration in LandingPage

`getLandingStats()` runs in parallel with `getLandingFarmers()` and `getLandingListings()` inside the existing `Promise.all()` on mount — no extra loading cycle.

```ts
const [farmers, listings, stats] = await Promise.all([
  getLandingFarmers(),
  getLandingListings(),
  getLandingStats(),
]);
```

The `landingStats` state is `LandingStats | null` — null while loading, populated after.

---

### Fake/Mock Testing Rule

All test data (farmer names, villages, produce, IDs) is fake/mock. No real personal data used.

---

### Free-Only Rule

No paid services, no paid APIs, no external image hotlinks. All icons are Lucide or local SVGs.

---

### TypeScript Result

Exit 0 — zero errors.

---

### Files Changed

| File | Change |
|---|---|
| `src/lib/supabase.ts` | Added `LandingStats` type and `getLandingStats()` helper |
| `src/pages/LandingPage.tsx` | Added `landingStats` state, wired into `Promise.all`, inserted trust strip section |

---

## Landing Visual Polish + Farmer Trust Phase

### Overview

This phase adds locally-created SVG visual assets and a "Farmer of the Week" trust section to the landing page.
All assets are free, self-created, open-source only, and stored locally — no paid assets, no hotlinks, no copyrighted images.

---

### Local SVG Assets Created

Stored in `artifacts/raithufresh/public/assets/`:

| File | Purpose | Used in |
|---|---|---|
| `hero-produce.svg` | Hero illustration — mango, tomato, brinjal, banana, chili, leaves, small tomato on a platter background | Hero section (right column, desktop) |
| `icon-fruit.svg` | Stylized mango/fruit icon for fruit category | Farmer of the Week listings, Fresh Listings cards |
| `icon-vegetable.svg` | Stylized brinjal/vegetable icon for vegetable category | Farmer of the Week listings, Fresh Listings cards |
| `icon-farmer-week.svg` | Gold star-burst award badge icon | Farmer of the Week section header |
| `empty-produce.svg` | Empty basket illustration for zero-state sections | Nearby Verified Farmers empty state, Fresh Listings empty state |

#### Asset design rules

- All SVGs use the brand palette: primary `#308240`, amber, red, purple, green
- Flat-design style — geometric shapes, no photorealistic rendering
- All SVGs include `role="img"` and `aria-label` for accessibility
- All `<img>` tags in the app include descriptive `alt` text
- No external URLs, no hotlinks, no paid stock libraries
- No emojis

---

### Hero Section Update

The hero section is now a **2-column layout** on medium screens and above:

| Column | Content |
|---|---|
| Left (60%) | Pilot badge, headline, tagline, description, 3 CTA buttons |
| Right (40%) | `hero-produce.svg` illustration, visible on `md:` and above |

Mobile: illustration is hidden (`hidden md:flex`), text + CTAs fill the full width.

CTAs unchanged:
- Join as Buyer → scrolls to waitlist, preselects Buyer
- Join as Farmer → scrolls to waitlist, preselects Farmer
- Browse Produce → navigates to `/browse`

---

### How the Pilot Works — Step Icons

Each of the 4 step cards now has a contextual Lucide icon above the step number circle:

| Step | Icon | Description |
|---|---|---|
| 1 | ClipboardList | Farmer lists produce |
| 2 | Search | Buyer reserves nearby |
| 3 | Phone | Buyer contacts farmer |
| 4 | Banknote | Cash or UPI at pickup |

Icons are rendered inside a soft green rounded circle above the numbered badge.

---

### Farmer of the Week Section

A new highlighted section between "How the Pilot Works" and "Nearby Verified Farmers".

**Data source**: Top-rated verified farmer from `landingFarmers[0]` (already sorted by `rating DESC` from Supabase).

**Farmer's listings**: Derived client-side from `landingListings.filter(l => l.farmer_id === farmerOfWeek.id).slice(0, 3)` — no extra query.

**Layout**:

| Column | Content |
|---|---|
| Left | Gold star icon + "FARMER OF THE WEEK" label + farmer name, location, rating, verified badge, active listing count, View Farmer Profile button, Browse Their Produce button |
| Right | Up to 3 of the farmer's active listings, each with category SVG icon, produce name, price, quantity, harvest date, View button |

**Privacy**: Farmer phone is NOT shown in this section. No buyer or reservation data shown.

**Fallback**: Section is hidden if `dataLoading` or `landingFarmers.length === 0`. No crash.

---

### Fresh Listings — Category Icons

Each listing card in "Fresh Listings Near You" now shows a small SVG category icon alongside the category badge:

| Category | Icon |
|---|---|
| Fruit | `icon-fruit.svg` (18×18px) |
| Vegetable | `icon-vegetable.svg` (18×18px) |

The `CategoryIcon` helper component handles this uniformly.

---

### Empty States Updated

Both empty states now use `empty-produce.svg` (empty basket illustration) instead of plain Lucide icons:

| Section | Trigger | Empty state |
|---|---|---|
| Nearby Verified Farmers | `landingFarmers.length === 0` | Empty basket illustration + text |
| Fresh Listings Near You | `landingListings.length === 0` | Empty basket illustration + text + Browse button |

---

### Privacy Rules Confirmed

| Data | Shown on landing | Reason |
|---|---|---|
| Farmer phone | No | Excluded from `getLandingFarmers()` SELECT list |
| Buyer phone | No | Not queried |
| Reservation data | No | Not queried |
| Admin data | No | Not queried |
| RLS | Unchanged | No RLS edits in this phase |
| Secrets | Not printed | No secret logging |

---

### Free-Only Asset Rules

| Rule | Status |
|---|---|
| No paid stock images | Confirmed — all SVGs self-created |
| No copyrighted images | Confirmed |
| No hotlinked images | Confirmed — all assets in `public/assets/` |
| No paid APIs | Confirmed |
| No paid services | Confirmed |
| No emojis | Confirmed |

---

### Fake/Mock Testing Rule

All test data (farmer names, villages, phone numbers, produce, IDs) is fake/mock. No real personal data is used in testing.

---

### TypeScript Result

Exit 0 — zero errors after all changes.

---

### Files Changed

| File | Change |
|---|---|
| `src/pages/LandingPage.tsx` | Added 2-column hero with SVG, step icons, Farmer of the Week section, category SVG icons in listing cards, updated empty states |
| `public/assets/hero-produce.svg` | Created — hero produce illustration |
| `public/assets/icon-fruit.svg` | Created — fruit category icon |
| `public/assets/icon-vegetable.svg` | Created — vegetable category icon |
| `public/assets/icon-farmer-week.svg` | Created — Farmer of the Week gold badge |
| `public/assets/empty-produce.svg` | Created — empty basket illustration |
| `README.md` | This section added |

---

## Landing Page Conversion + Farmer Discovery

### Page Sections (in order)

| Section | Description |
|---|---|
| Hero | RaithuFresh tagline, 3 CTAs: Join as Buyer / Join as Farmer / Browse Produce |
| How the Pilot Works | 4-step visual flow |
| Nearby Verified Farmers | Live Supabase data — 6 verified farmers |
| Fresh Listings Near You | Live Supabase data — 6 active listings preview |
| The Problem | Problem for farmers and buyers explained |
| Why RaithuFresh? | Benefits side-by-side with CTA buttons in each card |
| Join the Waitlist | Improved form with validation, success state, double-submit prevention |
| Footer | Links to Browse, Join as Farmer, Join as Buyer |

---

### How the Pilot Works (4 Steps)

| Step | Title | Description |
|---|---|---|
| 1 | Farmer Lists Produce | Farmer adds fruits or vegetables — quantity, price, pickup location |
| 2 | Buyer Reserves Nearby | Buyer browses active listings and reserves the quantity needed |
| 3 | Buyer Contacts Farmer | Buyer calls or messages the farmer directly before pickup |
| 4 | Cash or UPI at Pickup | Payment directly to the farmer. No online payment. |

---

### Nearby Verified Farmers Section

Loaded from Supabase using `getLandingFarmers()` helper.

- Returns up to 6 verified farmers (`verified = true`)
- Ordered by `rating DESC`
- Fields shown: name, village, district, rating (star display), Verified badge, active listing count
- Active listing count is derived client-side from the loaded listings (no extra query)
- **Phone is never shown** on the farmer cards — only available inside the Contact Farmer dialog (from the Produce Detail or Farmer Profile page)
- Each card has a "View Farmer Profile" button → `/farmers/:id`

Fallback states:
- Loading spinner while fetching
- "No verified farmers listed yet" if array is empty or Supabase is not configured

---

### Fresh Listings Near You Section

Loaded from Supabase using `getLandingListings()` helper.

- Returns up to 15 active listings (`status = 'active'`)
- Displays first 6 on the landing page
- Shows "See all 15 listings →" button if more than 6 are available
- Fields shown: produce name, category badge, price per kg, quantity, harvest date, village/district
- **No farmer phone shown** on listing cards
- Each card has "View Details" → `/produce/:id`

Fallback states:
- Loading spinner while fetching
- "No active listings right now" message with Browse button

---

### CTA Flow

| Button | Location | Behavior |
|---|---|---|
| Join as Buyer (hero) | Hero | Scrolls to waitlist and preselects Buyer role |
| Join as Farmer (hero) | Hero | Scrolls to waitlist and preselects Farmer role |
| Browse Produce (hero) | Hero | Navigates to `/browse` |
| Join as Farmer (benefits) | Benefits card | Scrolls to waitlist and preselects Farmer role |
| Join as Buyer (benefits) | Benefits card | Scrolls to waitlist and preselects Buyer role |
| Join as Farmer (footer) | Footer | Scrolls to waitlist and preselects Farmer role |
| Join as Buyer (footer) | Footer | Scrolls to waitlist and preselects Buyer role |

---

### Waitlist Form Improvements

| Feature | Status |
|---|---|
| Clear field-level validation messages | Added — shown in red below each invalid field |
| Success message after submit | Shows name, thank-you message, Browse button |
| Double-submit prevention | `disabled={submitting}` + guard in `onSubmit` |
| Supabase insert | Inserts into `waitlist_leads` if configured |
| Local fallback | Sets `submitted = true` even if Supabase fails |
| Role preselection from hero CTAs | Role pre-filled when scrolled from CTA button |
| Spinner while saving | Loader2 spinner shown on submit button |
| Role dropdown descriptions | e.g. "Buyer — I want to buy fresh produce" |

---

### Supabase Helpers Added

| Helper | Table | Access |
|---|---|---|
| `getLandingFarmers()` | `farmers` | Anon — returns `id, name, village, district, rating, verified` only (NO phone) |
| `getLandingListings()` | `produce_listings` + `farmers` join | Anon — `status = 'active'` enforced by RLS |

Both helpers return empty arrays on failure — never crash the page.

### Type Added

`LandingFarmer` — public-safe subset of `SupabaseFarmer`, intentionally excludes `phone`, `user_id`, and `assisted_mode`.

---

### Privacy Rules

- Farmer phone: **NOT shown** on landing page farmer cards or listing cards. Only accessible via the Contact Farmer dialog on Produce Detail or Farmer Profile pages.
- Buyer phone: never shown on any public page.
- Reservations: never shown on the landing page.
- Admin data: never shown on the landing page.
- No RLS changes.
- No secrets printed.

### No Paid Services

All landing page data is loaded from the free-tier Supabase backend using the anon key. No paid analytics, ads, maps, or APIs are used.

### Files Changed

| File | Change |
|---|---|
| `src/lib/supabase.ts` | Added `getLandingFarmers()`, `getLandingListings()`, `LandingFarmer` type |
| `src/pages/LandingPage.tsx` | Full rewrite — all new sections, improved waitlist, role-aware CTAs |

---

## Browse Discovery Upgrade

### Search

The search box on Browse Produce matches against all of the following fields simultaneously (client-side, no paid search service):

| Field searched | Example |
|---|---|
| Produce name | `mango`, `tomato`, `brinjal` |
| Farmer name | `Ramaiah`, `Lakshmi` |
| Village | `Shadnagar`, `Vikarabad` |
| District | `Rangareddy`, `Khammam` |
| Category | `fruit`, `vegetable` |
| Pickup location | `Shadnagar Main Market` |

The search box has an inline clear (X) button. The search placeholder reads "Search by produce, farmer, village, district...".

### Location Filter

A district dropdown is populated dynamically from the loaded farmer data — no hardcoded list. Options:

- **All Districts** (default) — no filter
- Each unique district from loaded farmers (e.g. Rangareddy, Vikarabad, Narayanpet, Siddipet, Nizamabad, Khammam, Warangal, Karimnagar)

### Freshness Filter

Filters by `harvest_datetime` (compared to today's date in the browser):

| Option | Logic |
|---|---|
| Any Harvest Date | no filter |
| Harvested Today | `harvest_date === today` |
| Within 2 Days | `daysSinceHarvest <= 2` |
| Within This Week | `daysSinceHarvest <= 7` |

Missing `harvest_datetime` values are handled safely (listing excluded only for strict freshness filters; not crashed).

### Sort Options

| Sort | Logic |
|---|---|
| Recently Added (default) | original Supabase order (`created_at DESC`) |
| Nearest First | `distance_km` ascending |
| Lowest Price | `price_per_kg` ascending |
| Highest Quantity | `quantity_kg` descending |
| Freshest Harvest | `harvest_datetime` descending |

Missing sort fields are handled safely with fallback values.

### Active Filter Summary

A summary line appears above the listing grid:

- `Showing 15 fruit and vegetable listings`
- `Showing 5 fruit listings near Rangareddy`
- `3 results for "mango" near Rangareddy, harvested this week`
- `Showing 0 vegetable listings near Khammam`

A **Clear filters** button appears next to the summary whenever any filter is active. It resets all filters including search, category, location, freshness, max price, and sort.

### Max Price Filter (retained from v1)

- Any Price
- Up to Rs 25/kg
- Up to Rs 50/kg
- Up to Rs 80/kg

### Empty State

When no listings match, a centered message appears:

> **No matching produce found**
> Try changing your search or filters.

A **Clear all filters** button is shown below the message.

### Privacy Rules

- Farmer phone appears only inside the Contact Farmer dialog (explicitly opened by buyer). Never in the listing cards.
- Buyer phone (`reservations.buyer_phone`) is never shown on Browse.
- No reservation data appears on Browse.
- No RLS policies were changed.
- No secrets are printed anywhere.

### All Buyer Actions Preserved

| Action | Status |
|---|---|
| Reserve | Works — opens ReservationModal with correct `listing_id` |
| Contact Farmer | Works — opens ContactFarmerDialog with farmer phone + produce name |
| WhatsApp wa.me | Works — from ContactFarmerDialog |
| Tap-to-call | Works — from ContactFarmerDialog |
| Copy phone | Works — from ContactFarmerDialog |
| Share listing | Works — Web Share API → clipboard → toast fallback |
| View full details | Works — links to `/produce/:id` |
| Farmer profile link | Works — farmer name links to `/farmers/:id` |

### No Paid Services

All filtering, searching, and sorting is client-side JavaScript on data already loaded from Supabase. No Algolia, Elasticsearch, or paid search API is used.

### Files Changed

| File | Change |
|---|---|
| `src/pages/BrowsePage.tsx` | Full rewrite — added multi-field search, district filter, freshness filter, sort, summary line, clear filters, improved empty state |

---

## Buyer Sharing + Detail UX

### What changed

#### 1. Share Listing — Produce Detail

A "Share Listing" button sits in the top-right of the detail page header (next to Back to Browse). Clicking it:
1. Uses the free browser Web Share API if available (on mobile, opens the native share sheet)
2. Falls back to `navigator.clipboard.writeText()` — copies the listing URL and shows a success toast
3. If clipboard is also unavailable, shows a toast with the full URL as text

The shared text includes produce name, price/kg, village/district, and the listing URL:
> "Fresh Mango (Banaganapalli) available on RaithuFresh for Rs 80/kg near Shadnagar, Rangareddy. View listing: https://..."

No paid sharing service is used.

#### 2. Share button on Browse Produce cards

Each listing card on the Browse page has a small share icon button (square, outline) at the right of the action row. It uses the same `shareListing()` helper from `src/lib/share.ts`. The share content uses the farmer's village from the farmerMap.

#### 3. Before You Come for Pickup — buyer notes

A "Before You Come for Pickup" card appears on the detail page between Pickup Directions and the Reserve section. It contains four simple plain-language points:

- Contact the farmer before traveling to confirm the produce is still available.
- Confirm the exact quantity you need — the farmer may already have partial reservations.
- Payment is Cash or UPI directly to the farmer at pickup. No online payment is collected by RaithuFresh.
- RaithuFresh does not handle delivery in this version. Pickup is arranged directly with the farmer.

#### 4. Reservation safety improvements

- If listing status is not "Available", the Reserve section is replaced with a clear warning card showing the status and a "Browse other listings" link. Reservation is blocked.
- The quantity field clamps input between 1 and `listing.quantityKg` (`Math.min` / `Math.max`) with `min` / `max` HTML attributes.
- The ReservationModal has a runtime check that also blocks submission if quantity exceeds available.

#### 5. Similar produce section

Below the reserve section, a "Similar Fruits/Vegetables Nearby" card shows up to 3 listings from Supabase with the same category, excluding the current listing. Each row shows:
- Produce name
- Price per kg
- Village, district
- "View Details" button linking to `/produce/{id}`

If the Supabase query returns nothing (no similar, or Supabase not configured), the section is hidden. No AI, no paid recommendations API.

#### 6. Privacy rules

- Farmer phone: shown only in the Contact Farmer dialog (explicitly opt-in, never displayed on the listing card or detail card)
- Buyer phone: stored in `reservations.buyer_phone` — never exposed on public pages, never pre-filled into share text or WhatsApp messages
- No RLS changes made

#### 7. Files changed

| File | Change |
|---|---|
| `src/lib/share.ts` | New utility — Web Share API → clipboard → toast fallback |
| `src/pages/ProduceDetailPage.tsx` | Share button, Buyer Notes card, Similar listings section, `similarListings` state + effect |
| `src/pages/BrowsePage.tsx` | Share2 import, `shareListing` import, `handleShare`, share icon button on each card |

#### 8. No paid services

- Web Share API: free browser API, no key required
- Clipboard API: free browser API, no key required
- Similar listings: free Supabase query, no AI or paid recommendation engine
- All test data: fake/mock names, villages, phone numbers, prices

---

## Buyer Contact Channel Polish — WhatsApp + Phone Normalization

### What changed

#### 1. WhatsApp deep link (free, no API key)

`ContactFarmerDialog` now includes a "Message on WhatsApp" button. It uses a `wa.me` deep link — a free, publicly documented WhatsApp URL scheme. No WhatsApp Business API, no SMS API, no paid service of any kind.

Button behavior:
- Opens in a new tab (`target="_blank"`)
- Pre-fills the chat with a message including the produce name:
  `"Hi, I saw your Mango (Banaganapalli) listing on RaithuFresh. Is it still available?"`
- If no produce name is available, falls back to a generic message
- Button only appears when the farmer phone normalizes to a valid Indian number
- Closes the dialog on click

#### 2. Phone normalization (`normalizePhoneE164`)

A pure helper function inside `ContactFarmerDialog.tsx` — no database writes, no external service:

| Input | Output | Used for |
|---|---|---|
| `9876543210` (10 digits) | `919876543210` | `wa.me/919876543210` |
| `+919876543210` | `919876543210` | `tel:+919876543210` |
| `91 98765 43210` | `919876543210` | display: `+91 98765 43210` |
| `N/A`, `null`, short/long numbers | `null` | Shows fallback message |

Rules:
- Strips spaces, dashes, parentheses, and `+`
- If 10 digits: prepends `91`
- If already `91XXXXXXXXXX`: uses as-is
- Anything else: treated as invalid — WhatsApp and tel: links hidden, fallback shown
- **Database values are never modified**

#### 3. Display formatting

Phone is shown as `+91 98765 43210` (spaced) for readability. The `tel:` link uses `tel:+919876543210`. The Copy button writes `+919876543210` to clipboard.

#### 4. Produce name passed through contact flow

Both BrowsePage and ProduceDetailPage now pass `produceName` to `ContactFarmerDialog`:
- BrowsePage: `listing.name` from the clicked listing card
- ProduceDetailPage: `listing.name` from the loaded Supabase row

#### 5. Privacy rules unchanged

- Farmer phone: shown in contact dialog (intentionally public in direct-to-buyer marketplace)
- Buyer phone: stored in `reservations.buyer_phone` — never passed to wa.me, tel:, or any public surface
- No buyer data is pre-filled into WhatsApp messages

#### 6. Files changed

| File | Change |
|---|---|
| `src/components/ContactFarmerDialog.tsx` | Added `produceName` prop, `normalizePhoneE164`, `formatDisplay`, WhatsApp button, updated tel: and copy logic |
| `src/pages/BrowsePage.tsx` | `contactTarget` type gains `produceName`; `handleContact` passes `listing.name`; dialog passes `produceName` |
| `src/pages/ProduceDetailPage.tsx` | `ContactFarmerDialog` receives `produceName={listing.name}` |

---

## Buyer Contact + Reservation Polish

### What changed

#### 1. Tap-to-call support on Browse Produce and Produce Detail

Both pages now open a `ContactFarmerDialog` when the Contact Farmer button is clicked. The dialog shows the farmer's name and phone number, with two actions:

- **Call Now** — an `<a href="tel:+91{phone}">` link. On mobile, tapping this opens the native dialer. On desktop it is handled by the OS default (e.g. FaceTime, Teams).
- **Copy Number** — uses `navigator.clipboard.writeText()`. If the Clipboard API is unavailable (e.g. HTTP context), falls back to a toast showing the phone number as text.

If the farmer has no phone number on record, the dialog shows: "Please reserve first or visit the pickup location to reach this farmer."

#### 2. Farmer phone vs buyer phone — separate paths

- **Farmer phone**: from `farmers` table → shown in Contact dialog (intentionally public in a direct-to-buyer marketplace).
- **Buyer phone**: from `reservations.buyer_phone` → shown only to the farmer in their Dashboard reservation cards, and to admin. Never shown on any public page.

#### 3. Improved reservation success message

The success screen after submitting a reservation now reads:

> **Reservation Request Sent**
> Your reservation request has been sent to the farmer. Please contact the farmer before coming for pickup to confirm availability.
> Payment: Cash or UPI directly to the farmer at pickup. No online payment required.

The "Close" button is now labelled "Done" for clarity.

#### 4. Reservation quantity validation

The quantity field now has a runtime max check in `onSubmit`: if the entered quantity exceeds `listing.quantityKg`, the form shows an inline error "Only X kg available" without submitting. The `<input>` also carries `min={1}` and `max={listing.quantityKg}` HTML attributes so mobile steppers and browser validation are consistent.

#### 5. Files changed

| File | Change |
|---|---|
| `src/components/ContactFarmerDialog.tsx` | New component — tel: link, Clipboard copy, no-phone fallback |
| `src/pages/BrowsePage.tsx` | Contact button opens ContactFarmerDialog; removed toast import |
| `src/pages/ProduceDetailPage.tsx` | Contact Farmer button opens ContactFarmerDialog; removed toast import |
| `src/components/ReservationModal.tsx` | Improved success message; quantity max validation; min/max HTML attributes |

#### Testing notes

- All phone numbers used during testing are fake/mock (e.g. `9876543210`).
- No real personal data is stored or displayed.
- No paid services, no Razorpay, no Stripe, no online payment of any kind.
- Clipboard API tested with both `navigator.clipboard` (modern browsers) and fallback toast (HTTP/insecure context).

---

## Buyer Flow Cleanup — Browse Contact + Privacy

### What changed

#### 1. BrowsePage Contact Farmer — now uses live Supabase farmer phone

**Before:** The Contact button in Browse Produce called `mockFarmers.find(mf => mf.id === listing.farmerId)` regardless of whether Supabase was configured. For real Supabase listings, the mock lookup always failed (UUIDs never match mock IDs), so every Contact click showed the fallback message.

**After:** The `FarmerMap` type now includes `phone: string | null`. The Supabase fetch already joined `farmers(phone)` — that value is now stored in farmerMap and used directly in `handleContact`.

```ts
// Before (broken for Supabase listings)
const f = mockFarmers.find((mf) => mf.id === listing.farmerId);

// After (uses real Supabase farmer phone)
const f = farmerMap[listing.farmerId];
```

- If farmer has a phone number in Supabase: toast shows `FarmerName: +91 XXXXXXXXXX`
- If farmer phone is null/missing: toast shows `"Please reserve first or visit the pickup location."`
- Mock fallback (no Supabase): uses `mockFarmers` phone — behavior unchanged

#### 2. Farmer helper — no mock fallback for live listings

The `farmer(id)` display helper in BrowsePage previously fell back to `mockFarmers.find(...)` for any farmerId not found in farmerMap. For Supabase listings, all farmers are in farmerMap (populated by the join). The fallback is now removed to prevent mock data leaking into live mode.

#### 3. Buyer phone privacy

Buyer phone (`buyer_phone`) is collected only in `ReservationModal` and stored in the `reservations` table. It is:

- **Shown to**: the farmer who owns the listing (in Farmer Dashboard reservation cards — needed for pickup coordination)
- **Shown to**: admin users (in Admin Dashboard — for support/moderation)
- **Never shown on**: BrowsePage, ProduceDetailPage, LandingPage, or any public page
- **Never logged** to console
- **Never passed** to farmer phone display logic — farmer phone and buyer phone are separate data paths

The RLS policy on `reservations` (`farmer_see_own_reservations`) enforces this at the DB level.

#### 4. Farmer phone — intentionally public in listing contact flow

Farmers list their own produce. Their phone number is the contact point for buyers. Showing it via the Contact button is the intended direct-to-buyer behavior of the marketplace. Farmer phone is fetched from the `farmers` table join and shown only in the Contact toast and Farmer Dashboard profile — never from the `reservations` table.

---

## Produce Detail Page — Live Supabase Data

### What changed

`ProduceDetailPage.tsx` previously used mock data only. It now loads the real listing from Supabase by ID.

#### Data flow

1. User clicks "View full details" on any listing card in Browse Produce.
2. Browser navigates to `/produce/<supabase-uuid>`.
3. ProduceDetailPage calls `getProduceListingById(id)` — a new helper in `supabase.ts`.
4. The query fetches `produce_listings` joined with `farmers` using the existing RLS policies:
   - Anon users: `public_read_active_listings` (status='active' only)
   - Authenticated users: `auth_read_listings` (all statuses)
5. Page renders with real produce name, price, quantity, harvest date, pickup location, quality notes, and farmer name/village/rating.

#### Farmer phone

Farmer phone is shown via the Contact Farmer button if the `farmers` table row contains a phone number. This is the farmer's own contact number — intentionally public in the direct-to-buyer marketplace model. If no phone is available, the button shows: "Please reserve first or visit the pickup location."

Buyer phone numbers are never shown on this page.

#### States

| State | Condition | Display |
|---|---|---|
| Loading | Supabase fetch in progress | Spinner |
| Found | Listing exists and RLS allows access | Full detail view |
| Not found | ID missing, listing inactive (anon), or deleted | Error card + Back to Browse |
| Mock fallback | Supabase not configured, or mock ID passed | Mock listing data |

#### Reservation from detail page

The Reserve Now button opens ReservationModal with the real Supabase listing ID. The reservation inserts into the `reservations` table using the correct `listing_id`. The Farmer Dashboard's reservation list will show it under the correct listing.

#### Browse Produce link check

All listing cards in Browse Produce already link to `/produce/${listing.id}` using the real Supabase UUID. No change needed there.

#### Supabase helper added

`getProduceListingById(id: string): Promise<SupabaseListing | null>`

Added to `src/lib/supabase.ts`. Queries `produce_listings` with `farmers` join via `.maybeSingle()`. Returns null if RLS blocks access or the listing does not exist.

#### Testing guidelines

- Use only fake/mock data during all tests
- No real personal data
- No paid services, paid APIs, or paid Supabase add-ons are used

---

## Security — Reservation DELETE Grant Cleanup (patch-reservation-delete-cleanup.sql)

### Changes applied

SQL patch: `supabase/patch-reservation-delete-cleanup.sql`

Grants revoked:
- `REVOKE DELETE ON reservations FROM authenticated`
- `REVOKE DELETE ON reservations FROM anon`

No DELETE RLS policy is added. No user role can delete reservations in the MVP. The reservation lifecycle is managed through status changes only: `pending → confirmed → completed / cancelled`.

#### Testing guidelines

- Use only fake/mock data during all tests
- No real personal data
- No paid services, paid APIs, paid Supabase add-ons, or paid Replit features are used

### Apply the patch

Paste `supabase/patch-reservation-delete-cleanup.sql` into Supabase SQL Editor → Run.

---

## Security — Reservation Update Hardening (patch-reservation-update-security.sql)

### Changes applied

SQL patch: `supabase/patch-reservation-update-security.sql`

#### reservations — UPDATE restricted to status only

| Column | Farmer UPDATE | Admin UPDATE | Notes |
|---|---|---|---|
| status | Yes (own listing's reservations, domain enforced) | Yes (domain enforced) | Only updatable column |
| **id** | **No** | **No** | Protected — primary key |
| **listing_id** | **No** | **No** | Protected — reservation ownership anchor |
| **buyer_name** | **No** | **No** | Protected — buyer-submitted data |
| **buyer_phone** | **No** | **No** | Protected — buyer-submitted data |
| **quantity_kg** | **No** | **No** | Protected — buyer-submitted data |
| **payment_method** | **No** | **No** | Protected — hardcoded at insert time |
| **created_at** | **No** | **No** | Protected — immutable audit timestamp |

Grants revoked:
- `REVOKE UPDATE ON reservations FROM anon`
- `REVOKE UPDATE ON reservations FROM authenticated` (table-level, all columns)
- `REVOKE DELETE ON reservations FROM anon` (leftover cleanup)

Grant added:
- `GRANT UPDATE(status) ON reservations TO authenticated`

RLS UPDATE policies recreated (idempotent, WITH CHECK enforced):
- `farmer_update_own_reservation_status` — farmer sees only reservations for own listings, status domain enforced
- `admin_update_reservation_status` — admin (role='admin') can update any reservation status, domain enforced

Both layers now enforce the status restriction independently:
1. Column privilege layer: only the `status` column has an UPDATE grant — any attempt to write to any other column is rejected at the PostgreSQL privilege level before RLS runs.
2. RLS WITH CHECK layer: status must be in `('pending','confirmed','cancelled','completed')`.

#### produce_listings — leftover authenticated DELETE removed

The `authenticated` role retained a table-level DELETE grant from the original schema. No DELETE RLS policy existed, so it was functionally blocked. It is now revoked at the grant level as well.

Grant revoked:
- `REVOKE DELETE ON produce_listings FROM authenticated`

Farmers mark listings as sold/out_of_stock via status update — no delete is needed.

#### Testing guidelines

- Use only fake/mock data during all tests (fake buyer names, fake phone numbers)
- No real personal data
- No paid services, paid APIs, paid Supabase add-ons, or paid Replit features are used

### Apply the patch

Paste `supabase/patch-reservation-update-security.sql` into Supabase SQL Editor → Run.

---

## Security — Produce Listing Update Hardening (patch-produce-listing-update-security.sql)

### Changes applied

SQL patch: `supabase/patch-produce-listing-update-security.sql`

#### Anon write access removed from produce_listings

| Operation | Before | After |
|---|---|---|
| anon SELECT active listings | Allowed | Allowed (unchanged) |
| anon INSERT | Blocked (previous patch) | Blocked (unchanged) |
| anon UPDATE | Allowed (table grant — no RLS policy, so blocked in practice) | **Revoked at grant level** |
| anon DELETE | Allowed (table grant — no RLS policy, so blocked in practice) | **Revoked at grant level** |

Grants revoked: `REVOKE UPDATE ON produce_listings FROM anon` and `REVOKE DELETE ON produce_listings FROM anon`.

#### Farmer UPDATE restricted to safe columns only

| Column | Farmer can UPDATE | Notes |
|---|---|---|
| produce_name | Yes | Safe editable field |
| category | Yes | Safe editable field |
| quantity_kg | Yes | Safe editable field |
| price_per_kg | Yes | Safe editable field |
| harvest_datetime | Yes | Safe editable field |
| pickup_location | Yes | Safe editable field |
| district | Yes | Safe editable field |
| distance_km | Yes | Safe editable field |
| quality_notes | Yes | Safe editable field |
| status | Yes | Core farmer workflow (Sold / Out of Stock) |
| updated_at | Yes | Audit timestamp — farmer-writable |
| **id** | **No** | Protected — primary key |
| **farmer_id** | **No** | Protected — ownership anchor. Farmer cannot re-assign listing to another farmer |
| **created_at** | **No** | Protected — immutable audit timestamp |

Grant applied: `GRANT UPDATE(produce_name, category, ..., status, updated_at) ON produce_listings TO authenticated`.

The broad table-level `GRANT UPDATE ON produce_listings TO authenticated` was revoked first. The column-level grant now acts as a second, independent enforcement layer alongside the RLS `farmer_update_own_listing` row ownership policy.

#### RLS policies unchanged

All existing policies are retained:
- `public_read_active_listings` — anon SELECT WHERE status='active'
- `auth_read_listings` — authenticated SELECT all
- `farmer_insert_own_listing` — authenticated INSERT, farmer_id ownership required
- `farmer_update_own_listing` — authenticated UPDATE, row ownership enforced via farmer_id → farmers.user_id = auth.uid()

#### Testing guidelines

- Use only fake/mock data during all tests (fake names, fake phones, fake villages)
- No real personal data
- No paid services, paid APIs, paid Supabase add-ons, or paid Replit features are used

### Apply the patch

Paste `supabase/patch-produce-listing-update-security.sql` into Supabase SQL Editor → Run.

---

## Security — Post-QA Hardening (patch-post-qa-security-hardening.sql)

### Summary of changes

Applied after full role-based QA pass. Two tables were hardened.

#### A. produce_listings

| Access | Before patch | After patch |
|---|---|---|
| anon SELECT active listings | Allowed | Allowed (unchanged) |
| anon INSERT listing | Allowed (no ownership check) | **Blocked** |
| authenticated farmer INSERT | Allowed for own farmer_id | Allowed for own farmer_id (unchanged) |
| authenticated farmer UPDATE | Allowed for own farmer_id | Allowed for own farmer_id (unchanged) |

Changes made:
- `DROP POLICY public_insert_listings` — removed the schema.sql-era anon insert with no ownership check
- `REVOKE INSERT ON produce_listings FROM anon`

Browse Produce continues to work publicly. The `public_read_active_listings` policy is untouched.

#### B. agent_call_requests

| Access | Before patch | After patch |
|---|---|---|
| anon SELECT | Allowed | **Blocked** |
| anon INSERT | Allowed | **Blocked** |
| anon UPDATE status | Allowed | **Blocked** |
| buyer/farmer SELECT | Allowed (all authenticated) | **Blocked** |
| buyer/farmer INSERT | Allowed (all authenticated) | **Blocked** |
| buyer/farmer UPDATE | Allowed (all authenticated) | **Blocked** |
| agent/admin SELECT | Allowed | Allowed (role-gated) |
| agent/admin INSERT | Allowed | Allowed (role-gated) |
| agent/admin UPDATE status | Allowed | Allowed (role-gated, domain enforced) |

Policies dropped:
- `public_insert_call_requests` (anon)
- `public_read_call_requests` (anon)
- `public_update_call_request_status` (anon)
- `auth_insert_call_requests` (all authenticated)
- `auth_read_call_requests` (all authenticated)
- `auth_update_call_request_status` (all authenticated)

Grants revoked:
- `REVOKE SELECT, INSERT, UPDATE, DELETE ON agent_call_requests FROM anon`

Policies added:
- `agent_admin_read_call_requests` — SELECT WHERE role IN ('agent','admin')
- `agent_admin_insert_call_requests` — INSERT WHERE role IN ('agent','admin')
- `agent_admin_update_call_request_status` — UPDATE WHERE role IN ('agent','admin'), status domain enforced

#### Why INSERT is restricted to agent/admin for agent_call_requests

No public farmer callback form exists anywhere in the app. The only places that INSERT into `agent_call_requests` are:
- AgentDashboard (authenticated, role=agent/admin)
- AdminDashboard does not insert (read + update only)

Restricting INSERT to agent/admin is safe and correct. If a public callback form is added in a future sprint, add a dedicated `public_insert_call_requests` policy with `WITH CHECK (true)` and no SELECT/UPDATE for anon.

### Apply the patch

```bash
# Run in Supabase SQL Editor, or via scripts:
pnpm --filter @workspace/scripts exec tsx /tmp/apply_patch.ts
```

Or paste `supabase/patch-post-qa-security-hardening.sql` into Supabase SQL Editor → Run.

### Testing guidelines

- Use only fake/mock names, phone numbers, emails, villages during all tests.
- No real personal data.
- No paid services, paid APIs, paid Supabase add-ons, or paid Replit features are used.

---

## Security — Role Self-Escalation Prevention

### Problem (fixed)

`patch-auth.sql` originally issued a broad table-level grant:

```sql
GRANT SELECT, INSERT, UPDATE ON user_profiles TO anon, authenticated;
```

The `UPDATE` grant covered **all columns**, including `role`. Any authenticated user could have self-promoted to admin by sending:

```sql
UPDATE user_profiles SET role = 'admin' WHERE id = auth.uid();
```

### Fix applied

SQL patch: `supabase/patch-user-role-security.sql`

```sql
-- Remove broad UPDATE
REVOKE UPDATE ON user_profiles FROM anon;
REVOKE UPDATE ON user_profiles FROM authenticated;

-- Grant UPDATE on safe columns only
GRANT UPDATE(full_name, phone, village, district) ON user_profiles TO authenticated;
```

Column-level `GRANT UPDATE(...)` in PostgreSQL means only the listed columns can be changed. Any attempt to `UPDATE role` (or `id` or `created_at`) is rejected at the privilege layer before RLS even runs.

The RLS UPDATE policy (`auth.uid() = id`) is kept and tightened with an explicit `WITH CHECK`:

```sql
CREATE POLICY "users_update_own_profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

### What is allowed after the patch

| Operation | Authenticated user | Anon |
|---|---|---|
| SELECT own profile | Allowed (RLS) | Blocked (no anon policy) |
| INSERT own profile at signup (includes role) | Allowed (RLS) | Blocked |
| UPDATE full_name, phone, village, district | Allowed (column GRANT + RLS) | Blocked |
| UPDATE role | **Blocked (column GRANT)** | Blocked |
| UPDATE id | Blocked (column GRANT) | Blocked |
| UPDATE created_at | Blocked (column GRANT) | Blocked |

### Admin role assignment (MVP)

Admin role must be assigned **manually** via the Supabase Dashboard:

1. Go to Table Editor → `user_profiles`
2. Find the user's row
3. Set `role` = `admin`
4. Save

Alternatively use the Supabase service_role key from a server context (never from the frontend).

### Testing with fake/mock users

When testing role escalation prevention, use fake data only:

| Fake user | Email | Phone |
|---|---|---|
| Ravi Test Buyer | fakebuyer@example.com | 9876500001 |
| Ramesh Test Farmer | fakefarmer@example.com | 9876500002 |
| Suresh Test Agent | fakeagent@example.com | 9876500003 |

Expected: any attempt to `UPDATE user_profiles SET role = 'admin'` from these accounts returns a PostgreSQL privilege error. The role remains unchanged.

### Production recommendation

For production, move admin role checks from `user_profiles.role` to `auth.jwt() -> app_metadata.role`, set via:
- Supabase service_role key (backend only)
- An Edge Function triggered by an admin action

This fully removes `user_profiles` from the admin-access trust chain and eliminates any residual risk from table-level grants.

### Apply the patch

```bash
pnpm --filter @workspace/scripts run db:patch-user-role-security
```

---

## Admin Reservations Tab

Admin users can view and manage all buyer reservations across the platform from the Admin Dashboard.

### What admin can see

The Admin Dashboard now includes a **Reservations** tab that shows:
- Buyer name and phone number
- Produce name and price per kg
- Farmer name, village, and district
- Quantity reserved (kg)
- Payment method
- Reservation status (pending / confirmed / completed / cancelled)
- Received date

### Analytics cards inside the tab

| Card | Source |
|---|---|
| Total reservations | Live from Supabase |
| Pending | Live from Supabase |
| Confirmed | Live from Supabase |
| Completed | Live from Supabase |
| Cancelled | Live from Supabase |
| Total kg reserved | Live from Supabase |

The top Platform Overview cards for "Reservations" and "Reserved Quantity" also update from live data when Supabase is connected.

### Admin actions

- **Mark Pending** — move any reservation back to pending
- **Mark Confirmed** — confirm a reservation
- **Mark Completed** — mark as fulfilled
- **Mark Cancelled** — cancel a reservation

Status updates are persisted to Supabase immediately.

### Filters

- **Status filter**: All / Pending / Confirmed / Completed / Cancelled (pill buttons)
- **Search**: by buyer name, farmer name, or produce name (client-side)

### How admin reservation RLS works

SQL patch: `supabase/patch-admin-reservations.sql`

- `admin_read_all_reservations` — SELECT allowed when `user_profiles.role = 'admin'`
- `admin_update_reservation_status` — UPDATE only the `status` column when admin
- Column-level `GRANT UPDATE(status)` enforces that no other column can be changed, even if the RLS USING clause passes

Farmer policies remain unchanged:
- Farmers still see only their own reservations
- Farmers can only update status on their own listings

Buyer phone security:
- Visible only to the owning farmer and to admin users
- Not accessible by anon users, regular buyers, or other farmers

### Apply the patch

```bash
pnpm --filter @workspace/scripts run db:patch-admin-reservations
```

### How to test with fake/mock buyer data

When creating test reservations via the Reservation Modal on Browse Produce, use fake data such as:

| Field | Example |
|---|---|
| Buyer name | Ravi Kumar / Suresh Rao / Anitha Devi |
| Buyer phone | 9876500001 / 9876500002 / 9876500003 |
| Quantity | 10 / 25 / 50 kg |
| Payment method | Cash on Pickup / UPI / Bank Transfer |

Do not use real personal names or phone numbers during testing.

### MVP limitation

Admin access is gated on `user_profiles.role = 'admin'`. In production, this should be hardened with JWT claims (`app_metadata.role = 'admin'`) or a server-side Postgres function so clients cannot manipulate their own `user_profiles` row to escalate privileges. The anon key grants table access; the RLS policy is the only gate.

---

## Farmer Reservations

Farmers can now manage buyer reservations directly from the Farmer Dashboard — live from Supabase.

### How it works

- When a buyer reserves a listing via the Reservation Modal, a row is inserted into `reservations` (public INSERT policy, no auth required for buyers).
- On the Farmer Dashboard, the **Buyer Reservations** section loads all reservations for that farmer's own listings from Supabase (using `getReservationsForFarmer`).
- Each reservation card shows: buyer name, quantity, produce name, buyer phone, payment method, received date, and status badge.
- The farmer can update the status with action buttons:
  - **Pending** → [Confirm] [Cancel]
  - **Confirmed** → [Complete] [Cancel]
  - **Completed / Cancelled** — no actions (terminal state)

### Status lifecycle

```
pending  →  confirmed  →  completed
   ↓             ↓
cancelled     cancelled
```

### Security model

SQL patch: `supabase/patch-farmer-reservations.sql`

- `farmer_read_own_reservations` — SELECT only on reservations where `listing_id → produce_listings.farmer_id → farmers.user_id = auth.uid()`
- `farmer_update_own_reservation_status` — UPDATE only for own listings; column-level GRANT restricts update to `status` only
- Buyer INSERT is unchanged (anon policy from `schema.sql`)
- Admin count: degrades gracefully to 0 for MVP (admin needs own RLS policy in a future iteration)

### Apply the patch

```bash
pnpm --filter @workspace/scripts run db:patch-farmer-reservations
```

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
