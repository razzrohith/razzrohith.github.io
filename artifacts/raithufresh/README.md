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

- Use unique fake emails for signup tests (e.g. `test-1234@example.com`).
- If a fake email was already used, log in instead — duplicate signups will show a friendly "already exists" message.
- Use fake 10-digit phone numbers only (e.g. `9000000001`).
- Do not use real personal data for testing.
- Supabase email rate limits may block rapid signups — disable email confirmations in Supabase dashboard for local testing, or wait between attempts.

## Next phase

Flutter native mobile app planning.
