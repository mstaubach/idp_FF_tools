# IDP Dynasty HQ

A unified suite of fantasy football tools for Sleeper IDP dynasty leagues. This
app merges what used to be four separate projects into a single Next.js app with
a shared navigation bar and a landing page that introduces each tool.

## Tools

| Route | Tool | What it does |
| --- | --- | --- |
| `/` | **Home** | Landing page describing the suite and linking to every tool. |
| `/standings` | **League Standings** | Live IDP Dynasty league standings from the Sleeper API. |
| `/trade-tracker` | **Trade Tracker** | Follows traded draft picks into the draft and shows which player was selected with each one, so you can see what a trade actually became. |
| `/idp-checker` | **IDP Availability Checker** | Paste rankings or upload a CSV and check which IDP players are still available in your Sleeper league. Fuzzy name matching, position filters, and waiver info. |
| `/injury-tracker` | **Injury Tracker** | Placeholder — coming soon. |

All tools read from the public, read-only [Sleeper API](https://docs.sleeper.com/)
and work without signing in — just a league ID. Optionally, users can create an
account to store their Sleeper profile (username + saved leagues) server-side;
see [Accounts](#accounts-optional) below.

## Project layout

```
src/
  app/
    page.tsx                       landing page
    layout.tsx                     shared shell (NavBar + Footer)
    (components)/                  NavBar, Footer, StandingsTable, FirstPlaceFinish
    standings/page.tsx             league standings
    trade-tracker/                 trade tracker home + league/[leagueId]
    idp-checker/page.tsx           IDP availability checker
    injury-tracker/page.tsx        coming-soon placeholder
    api/                           check-availability + players routes (IDP checker)
  components/
    idp-checker/                   IDP checker UI components
    trade-tracker/                 trade tracker UI components
  lib/
    idp-checker/                   parsing, matching, availability, Sleeper client
    trade-tracker/                 trade/pick resolution, Sankey, Sleeper client
```

Each tool's library and component code is namespaced (`idp-checker/`,
`trade-tracker/`) so the two Sleeper API clients and type modules don't collide.

## Getting Started

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run lint       # next lint
npm run typecheck  # tsc --noEmit
npm test           # run the vitest suite (IDP checker logic)
npm run test:watch # vitest in watch mode
```

> Note: the standings, trade tracker, and IDP checker call `api.sleeper.app` at
> request time, so the running environment needs outbound network access to that
> host.

## Accounts (optional)

The Sleeper tools work with zero configuration. Signup/login and server-side
profile storage additionally need a Postgres database and a session secret:

```bash
cp .env.example .env.local
# set DATABASE_URL to any Postgres (Neon, Vercel Postgres, Supabase, local)
# set AUTH_SECRET, e.g.: openssl rand -base64 32
npm run db:migrate   # apply the SQL migrations in drizzle/
```

Auth is email + password (Auth.js credentials provider, JWT sessions).
Signed-in users can sync their browser profile to their account at `/account`.
Each user row carries a `plan` (`free` / `pro`) that feature gates read via
`src/lib/auth/entitlements.ts` — the hook for paid access later. Without the
env vars the site runs exactly as before; only the account routes are inert.

## Deploying to Vercel

Standard Next.js app — import the repository in Vercel and ship with zero config.

---

Not affiliated with Sleeper. Uses the public, read-only Sleeper API.
