# NavBar League Switcher — Design

**Date:** 2026-07-03
**Status:** Approved

## Problem

League selection currently lives on every tool's landing page: users with a
saved profile must click a `YourLeagues` chip (or type a league ID) each time
they visit a tool. The NavBar profile dropdown already lists saved leagues and
sets `activeLeagueId` in `ProfileContext`, but selecting a league there has no
effect on tool pages.

## Goal

Move league selection into the toolbar as a dedicated dropdown. The selected
league persists and every tool auto-loads with it on page visit — no
per-tool, per-visit selection.

## Design

### 1. `LeagueSwitcher` component (NavBar)

A new client component `src/components/profile/LeagueSwitcher.tsx`, rendered
in the NavBar between the nav dropdowns and the profile button:

- Shows the **active league's name** as the button label (truncated), with a
  chevron. Hidden entirely when no profile exists.
- Dropdown lists all saved leagues (★ marks the primary, active league
  highlighted) — same visual language as the existing profile dropdown.
- Selecting a league: `setActiveLeagueId(id)` **and**, when the current route
  is a league-scoped tool page, navigates to the same tool for the new league
  (live switcher — the page always matches the selection).
- A final "Different league…" item links to the current tool's landing page
  with `?picker=1` so manual league-ID entry stays reachable for profile
  users (see §4).
- The league list is **removed from the profile dropdown**; `@username` keeps
  only Edit profile / Clear profile. The NavBar's single source of league
  selection is the switcher.

### 2. Tool path mapping

A small pure module `src/lib/profile/active-league.ts` (also home to the
cookie name/validation helpers of §3) exporting
`leaguePathFor(pathname: string, leagueId: string): string | null`:

| Current pathname prefix        | Result                              |
| ------------------------------ | ----------------------------------- |
| `/standings`                   | `/standings/<id>`                   |
| `/trade-tracker`               | `/trade-tracker/league/<id>`        |
| `/roster-management`           | `/roster-management/<id>`           |
| `/taxi-filler`                 | `/taxi-filler/<id>`                 |
| `/idp-checker`                 | `null` (context-driven, no route)   |
| anything else (`/`, unknown)   | `null` (no navigation)              |

`null` means: update context only, don't navigate. Pure and unit-tested.

### 3. Persistence: localStorage + cookie mirror

`ProfileContext` changes:

- Persist `activeLeagueId` in localStorage under its own key
  (`idp_dynasty_active_league`) so the selection survives reloads. On load,
  validate it against `profile.leagues`; fall back to `primaryLeagueId` if
  missing/stale.
- Mirror the active league ID into a client-set cookie
  `idp_active_league` (path=/, ~1 year, SameSite=Lax) whenever it changes.
  `clearProfile()` deletes the cookie. The cookie is a **redirect hint only**;
  `ProfileContext`/localStorage remains canonical for the UI.

### 4. Auto-load on tool landing pages

**Route-based tools** (`/standings`, `/trade-tracker`, `/roster-management`,
`/taxi-filler`): the server-component landing page reads the
`idp_active_league` cookie via `next/headers` `cookies()` and, when present
(and `?picker=1` is not set), `redirect()`s to the tool's league page. Reading
cookies makes these pages dynamic — acceptable; they contain server actions
already and fetch nothing at build time.

- `?picker=1` skips the redirect so the manual form is reachable (linked from
  the switcher's "Different league…" item).
- Users **without** a profile (no cookie) see the landing page unchanged:
  `FirstVisitPrompt` + manual league-ID form.
- The `YourLeagues` chip rows are removed from all landing pages (the navbar
  switcher replaces them). Delete `YourLeagues.tsx` once unused.

**idp-checker** (client page, league is component state, no league route):
initialize/sync `leagueId` state from `activeLeagueId` via `useEffect`. The
existing `LeagueInput` stays as a manual override. No redirect involved.

### 5. Error handling

- Cookie present but league page fails (deleted/bogus league): the league
  pages' existing error handling applies unchanged; user can pick another
  league from the switcher.
- Cookie present but localStorage cleared (profile gone): redirect still
  works — league pages don't require a profile. The switcher simply won't
  render until a profile is recreated.
- Malformed cookie value: treat as absent (validate `/^\d{6,}$/` before
  redirecting).

## Testing

- Unit tests for `leaguePathFor` (all tool prefixes, nested league paths,
  unknown paths) under `__tests__/profile/lib/`.
- Cookie value validation helper unit-tested alongside.
- Component/context behavior verified manually (`npm run dev`): switch league
  on each tool page, reload persistence, no-profile fallback, `?picker=1`.

## Out of scope

- Any change to the per-tool Sleeper clients, caching, or league page UIs.
- Auth or server-side profile storage.
- The `/injury-tracker` placeholder.
