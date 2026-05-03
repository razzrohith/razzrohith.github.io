# RaithuFresh

Telangana-first fruits and vegetables marketplace connecting farmers, buyers, agents, and admins.

## Current status

Web/PWA MVP Release Candidate Ready.

## Main features

- Landing page
- Browse produce
- Produce detail
- Farmer profile
- Buyer dashboard
- Farmer dashboard
- Agent dashboard
- Admin dashboard
- Profile management
- Waitlist
- PWA support

## Tech stack

- React
- Vite
- TypeScript
- Supabase
- PWA
- Flutter native mobile app planned separately

## Environment variables

Required for the web app:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server-side scripts only:

- `SUPABASE_DB_URL`

Never use `SUPABASE_DB_URL` in frontend code.

## Local setup

```bash
pnpm install
pnpm --filter @workspace/raithufresh run dev
```

## Build

Production builds require `PORT`, `BASE_PATH`, and Supabase frontend variables to be set in the environment or a `.env.local` file:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

```bash
PORT=3000 BASE_PATH=/ pnpm run build
```

- No service_role key in frontend
- RLS verified
- Buyer phone privacy preserved
- No paid services

## Supabase Auth Configuration

To support email verification and password reset, configure your Supabase project as follows:

### URL Configuration
- **Site URL**: `https://razzrohith.com`
- **Additional Redirect URLs**:
  - `https://razzrohith.com/auth/callback`
  - `https://razzrohith.com/reset-password`
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/reset-password`

### Email Templates
- Ensure the **Confirm signup** template points to `{{ .SiteURL }}/auth/callback` or uses the default redirect logic.
- Ensure the **Reset password** template points to `{{ .ConfirmationURL }}`.

### Rate Limits
Supabase's free tier has strict email rate limits (usually 3 emails per hour per address). For extensive testing:
1. Use unique fake emails.
2. Disable "Confirm email" in Auth Settings temporarily if needed.
3. Use a custom SMTP provider for production.

## Deployment plan

- Source repo: `razzrohith/raithufresh-web`
- Live repo later: `razzrohith/razzrohith.github.io`
- Do not replace live DealNest until DealNest is backed up

## DealNest migration note

DealNest must be preserved separately in `razzrohith/dealnest-web-archive`.

## Known limitations

- Build requires `PORT` and `BASE_PATH` during production build
- Supabase email confirmation may require manual login flow depending on project settings
- GitHub deployment is not configured yet

## Testing & QA Notes

- **Unique Emails:** Use unique fake emails for signup tests (e.g. `test-1234@example.com`).
- **Duplicate Signups:** Duplicate signups correctly return an error message: "An account with this email already exists. Please log in instead." 
- **Session Safety:** `AuthContext` strictly guards routes and acts as a single source of truth. Logouts fully clear application state and `localStorage` keys immediately.
- **Role Editing:** User roles are read-only once an account is created. To test a different role, use a new unique email. If a profile creation fails initially, it can be recovered gracefully on the next login or via the `/profile` route.
- **Phone Numbers:** Use fake 10-digit phone numbers only (e.g. `9000000001`).
- **Rate Limits:** Supabase email rate limits may block rapid signups. If you see an email limit error, wait or disable email confirmations in your Supabase dashboard.
- **Route Protection:** Only logged-in users with correct roles can access their dashboards. Buyers cannot access Farmer dashboards, etc. Unauthenticated users are safely redirected to the login gate.
- **Direct URLs (SPA Fallback):** The app uses a `404.html` redirect script to ensure direct URL navigation (e.g., `razzrohith.com/login`) works flawlessly on GitHub Pages.
- **No Real Data:** Never use real personal data for testing purposes.

## Next phase

Flutter native mobile app planning.
