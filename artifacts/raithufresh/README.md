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

## Security notes

- No service_role key in frontend
- RLS verified
- Buyer phone privacy preserved
- No paid services

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

## Testing notes

- **Unique Emails:** Use unique fake emails for signup tests (e.g. `test-1234@example.com`).
- **Duplicate Signups:** If a fake email was already used, log in instead. Duplicate signups will correctly return an error message: "An account with this email already exists. Please log in instead." 
- **Session Safety:** The app is configured to clear any accidental auth sessions created during a duplicate signup attempt. This ensures that users are not silently logged in if they try to re-register an existing account.
- **Role Editing:** User roles are read-only once an account is created. To test a different role, use a new unique email.
- **Phone Numbers:** Use fake 10-digit phone numbers only (e.g. `9000000001`).
- **Rate Limits:** Supabase email rate limits may block rapid signups. If you see an email limit error, wait or disable email confirmations in your Supabase dashboard.
- **No Real Data:** Never use real personal data for testing purposes.

## Next phase

Flutter native mobile app planning.
