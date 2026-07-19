# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**IDP Dynasty HQ** — a single Next.js (App Router) app that merges formerly separate fantasy-football tools for Sleeper IDP dynasty leagues. The tools read from the public, read-only [Sleeper API](https://api.sleeper.app/v1) at request time and work without signing in — just a Sleeper league ID. The running environment therefore needs outbound network access to `api.sleeper.app`. Optional user accounts (email + password) with server-side profile storage sit alongside the tools; they need `DATABASE_URL` (Postgres) and `AUTH_SECRET` env vars, and the whole rest of the site must keep working when those are unset.

Tools (each a route under `src/app/`): `/standings`, `/trade-tracker`, `/idp-checker`, `/injury-tracker` (placeholder), plus the `/` landing page.

## Commands

```bash
npm run dev         # dev server at http://localhost:3000
npm run build       # production build
npm run lint        # next lint (eslint-config-next)
npm run typecheck   # tsc --noEmit
npm test            # vitest run (single pass)
npm run test:watch  # vitest watch mode
npm run db:generate # drizzle-kit: regenerate SQL migrations from src/lib/db/schema.ts
npm run db:migrate  # drizzle-kit: apply migrations (needs DATABASE_URL)
npm run db:push     # drizzle-kit: push schema directly (dev only, needs DATABASE_URL)
```

Run a single test file: `npx vitest run __tests__/idp-checker/lib/matcher.test.ts`. Filter by name: `npx vitest run -t "fuzzy"`.

CI (`.github/workflows`) runs **lint + build** on every PR/push, plus a gitleaks secret scan and an automated Claude code review. Note: CI does **not** run the test suite, so run `npm test` and `npm run typecheck` locally before pushing.

## Architecture

The defining constraint: two of the tools (idp-checker, trade-tracker) each have their **own independent Sleeper API client and type module**. They are intentionally **not** shared. Everything under `src/lib/<tool>/` and `src/components/<tool>/` is namespaced per tool so the two clients, two `types.ts`, and two sets of Sleeper response shapes never collide. When touching Sleeper-facing code, stay inside the relevant tool's namespace — do not "deduplicate" the two clients into one.

Layer split (per tool):
- `src/lib/<tool>/` — pure logic: parsing, matching, resolution, and the Sleeper client. This is where the tested business logic lives.
- `src/components/<tool>/` — client UI components.
- `src/app/<tool>/` — route pages (server components by default) that wire lib → components.
- `src/app/(components)/` — shared shell pieces (NavBar, Footer, StandingsTable, FirstPlaceFinish).

### Two different Sleeper-fetch + caching strategies

The tools cache Sleeper calls differently — match the surrounding tool's approach:

- **idp-checker** (`src/lib/idp-checker/sleeper.ts`): wraps raw `_fetch*Raw` functions in `unstable_cache` with explicit TTLs (players 1h, league data 5m), and uses `fetchWithTimeout` (10s `AbortController`). Data flows through the `/api/check-availability` and `/api/players` route handlers.
- **trade-tracker** (`src/lib/trade-tracker/sleeper.ts`): plain `fetch` with `next: { revalidate }` per-call TTLs; a shared `getJson` helper returns `null` on 404. Consumed directly by the server component page (`revalidate = 300`), not via API routes.
- **standings** (`src/app/standings/[leagueId]/page.tsx`): `export const dynamic = "force-dynamic"` with `cache: "no-store"` — fetched live per request so the build never needs network access.

### Key domain logic

- **trade-tracker `resolve.ts`** is the heart of that tool. `buildLeagueTrades` walks the `previous_league_id` chain (`getLeagueChain`) to gather every season of a dynasty league, then does a two-pass build: first index every completed draft selection keyed by `${season}:${round}:${originalRoster}` (the original roster comes from `slot_to_roster_id`, so a traded pick still maps back to its origin franchise), then resolve each traded pick to its outcome (`drafted` / `pending` / `unknown`). Output drives a Sankey-style giver → asset → outcome view.
- **idp-checker `matcher.ts`** does two-pass fuzzy matching with Fuse.js: a strict full-name pass, then a last-name-focused fallback for abbreviated first names (e.g. "Pat Queen"), with position-group/team tiebreakers. IDP positions are filtered in `sleeper.ts` via `IDP_POSITIONS`.

### Accounts, auth, and data storage

Email + password accounts via Auth.js v5 (Credentials provider, **JWT sessions** — no DB reads per request) with Postgres via Drizzle ORM. Layering:

- `src/lib/db/` — Drizzle schema (`users` table) and a **lazy** client (`getDb()`): nothing connects at import time, so build and Sleeper-only deployments never need `DATABASE_URL`. Schema changes go through `npm run db:generate` → commit the SQL in `drizzle/`.
- `src/lib/auth/` — pure, tested logic: zod schemas (`validation.ts`), bcrypt wrappers (`passwords.ts`), plan gating (`entitlements.ts`), and the import-light Auth.js config (`config.ts`). Heavy imports (db, bcrypt) live only in `src/auth.ts`, which adds the Credentials provider and exports `handlers`/`auth`/`signIn`/`signOut`.
- Routes: `/api/auth/[...nextauth]` (Auth.js), `/api/auth/signup`, `/api/profile` (GET/PUT of the user's Sleeper profile JSON). Pages: `/login`, `/signup`, `/account` (server component, `force-dynamic`, redirects when signed out).
- `src/proxy.ts` gates members-only routes (currently `/account`) by reading the session JWT with `getToken` — add new protected prefixes to both `PROTECTED_PREFIXES` and the matcher. If `AUTH_SECRET` is unset, visitors are treated as signed out and the rest of the site is unaffected.
- The browser-local Sleeper profile (`ProfileContext`, localStorage) stays the source of truth for the tools; signed-in users sync it explicitly to/from `users.profile` (jsonb) on `/account` — same `Profile` shape on both sides, validated by `profileSchema`.
- **Paid access seam**: `users.plan` (`free`/`pro`) flows into the session (`session.user.plan`); gate features with `canAccess(plan, feature)` from `src/lib/auth/entitlements.ts`. A future payment webhook only has to flip `users.plan`.

## Conventions

- Path alias `@/*` → `src/*` (configured in both `tsconfig.json` and `vitest.config.ts`).
- TypeScript `strict` is on. The two `types.ts` files mirror the Sleeper API response shapes the respective tool consumes.
- Tests use Vitest + Testing Library (jsdom env, globals enabled) and live under `__tests__/`, mirroring the `src/lib` path. Only idp-checker lib/api logic is currently covered.
- Tailwind for styling; dark slate palette is the house style.
