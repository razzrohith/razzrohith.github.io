# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains the RaithuFresh MVP web app — a farmer-to-buyer marketplace for Telangana, India.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## RaithuFresh App (`artifacts/raithufresh`)

Frontend-only MVP. All data is mock data — no backend integration yet.

### Pages

| Route | Page | Description |
|---|---|---|
| `/` | Landing Page | Hero, problem/solution, waitlist form |
| `/browse` | Browse Produce | Search & filter all produce listings |
| `/produce/:id` | Produce Detail | Full listing detail + reservation |
| `/farmer` | Farmer Dashboard | Add/manage listings, view reservations |
| `/agent` | Agent Dashboard | Manage farmers, update stock, call logs |
| `/admin` | Admin Dashboard | Analytics, manage all users & listings |

### Key Files

- `artifacts/raithufresh/src/data/mockData.ts` — all Telangana sample data
- `artifacts/raithufresh/src/lib/types.ts` — TypeScript types
- `artifacts/raithufresh/src/pages/` — all page components
- `artifacts/raithufresh/src/components/` — Navbar, ReservationModal
- `artifacts/raithufresh/src/index.css` — green/amber agricultural theme

### Features Completed

- Landing page with waitlist form (validation)
- Buyer browse with search + filters
- Produce detail page with reservation flow
- Farmer dashboard (add listings, update status, view reservations)
- Agent dashboard (manage farmers, stock updates, callback scheduling, call logs)
- Admin dashboard (analytics, manage farmers/buyers/agents/listings)
- Reservation modal (form validation, success message)
- Mobile-first responsive design
- Realistic Telangana mock data (8 farmers, 15 listings, 5 buyers, 2 agents)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
