# Sleeper Profile & League Switcher — Design Spec

**Date:** 2026-06-29  
**Status:** Approved

## Overview

Add a lightweight profile system that lets users enter their Sleeper username once, save their leagues, designate a primary, and jump directly into any tool without re-entering a league ID each visit. No backend required — all data comes from the public Sleeper API and is persisted in `localStorage`.

---

## Data Model

Single JSON blob stored in `localStorage` under the key `idp_dynasty_profile`.

```typescript
type SavedLeague = {
  leagueId: string;
  name: string; // fetched from Sleeper, e.g. "IDP Dynasty 2025"
};

type Profile = {
  sleeperUsername: string;
  sleeperUserId: string;
  leagues: SavedLeague[];
  primaryLeagueId: string;
};
```

### Active League (session state, not persisted)

The context also tracks `activeLeagueId` in memory. It initializes to `primaryLeagueId` on each page load and can be switched per-session via the NavBar league switcher. Switching the active league does not modify `localStorage`.

---

## ProfileContext

A `ProfileContext` is provided at the root of the app. Because `layout.tsx` is a server component, the provider is extracted into a thin `ProfileProvider` client component and inserted into `layout.tsx`.

**Exposed shape:**

```typescript
type ProfileContextValue = {
  profile: Profile | null;
  activeLeagueId: string | null;
  setProfile: (p: Profile) => void;
  setActiveLeagueId: (id: string) => void;
  clearProfile: () => void;
};
```

The provider hydrates `profile` from `localStorage` on mount (inside a `useEffect` to avoid SSR mismatch). Writes to `setProfile` immediately update both context state and `localStorage`.

---

## Sleeper API Calls

Both endpoints are public, read-only, and require no authentication.

| Step | Endpoint | Purpose |
|------|----------|---------|
| 1 | `GET https://api.sleeper.app/v1/user/<username>` | Resolve username → `user_id`, `display_name` |
| 2 | `GET https://api.sleeper.app/v1/user/<user_id>/leagues/nfl/2025` | Fetch all leagues for the current season |

The current NFL season (2025) is hardcoded. Dynasty league IDs persist across seasons, so fetching the current season captures all active dynasty leagues.

Both calls are made client-side from within the profile setup modal. Errors (username not found, network failure) are shown inline.

---

## Profile Setup Flow

1. User opens the modal (via NavBar button or first-visit prompt)
2. Enters their Sleeper username → clicks "Look up"
3. App calls endpoint 1 — inline error shown if username not found
4. App calls endpoint 2 — leagues rendered as a selectable list (name + league ID)
5. All leagues pre-checked; user unchecks any they don't want saved
6. User clicks the star icon on one league to mark it as primary
7. "Save profile" writes to `localStorage`, closes modal, context updates

---

## NavBar Changes

**No profile set:**
- A "Set up profile" button appears in the nav alongside the existing dropdowns

**Profile set:**
- Button is replaced by a username chip: `@<username> ▾`
- Clicking opens a small dropdown containing:
  - Each saved league listed, primary marked with ★
  - Clicking a league sets it as the session's `activeLeagueId`
  - "Edit profile" — re-opens the full setup modal pre-populated with the existing username and existing league selections; user can change username or league picks
  - "Clear profile" — removes `localStorage` entry and resets context

---

## First-Visit Prompt

Shown on every tool input page when no profile exists. Appears as a subtle callout directly below the page title — not a blocking modal.

**Copy:**
> *Save your league IDs — set up a profile to jump straight to your leagues next time.* **Set up →**

Clicking "Set up →" opens the profile setup modal. Once a profile is saved, the callout is replaced by the "Your Leagues" section on the next render.

---

## "Your Leagues" Section on Tool Pages

Shown above the existing league ID form when a profile exists. The existing form stays below as a manual fallback.

```
Your Leagues
[ ★ IDP Dynasty 2025 ]  [ Redraft League ]  [ Best Ball ]
──────────────────────────────────────────────────────────
Or enter a league ID manually
[ input field ]  [ Submit button ]
```

- Each league is a button; clicking navigates directly to that tool's results page using the league's ID via `useRouter().push()`
- Primary league (★) has an amber border to match house style
- Currently active session league (when it differs from primary) has a green filled background
- **IDP Checker exception:** does not redirect on league selection. `YourLeagues` accepts an optional `onLeagueSelect?: (leagueId: string) => void` prop; when provided it is called instead of navigating. The IDP checker page passes a callback that sets its `leagueId` state.
- Tool input pages (standings, trade-tracker, roster-management, taxi-filler) are server components and render `YourLeagues` and `FirstVisitPrompt` as client component imports — valid in Next.js App Router

---

## Affected Files

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Wrap children with `ProfileProvider` |
| `src/context/ProfileContext.tsx` | New — context + provider + localStorage persistence |
| `src/app/(components)/NavBar.jsx` | Add profile button / username chip + dropdown |
| `src/components/profile/ProfileModal.tsx` | New — setup modal (username input → league list → primary selection) |
| `src/components/profile/YourLeagues.tsx` | New — shared "Your Leagues" section rendered on tool input pages |
| `src/components/profile/FirstVisitPrompt.tsx` | New — callout shown when no profile exists |
| `src/app/standings/page.tsx` | Add `YourLeagues` + `FirstVisitPrompt` |
| `src/app/trade-tracker/page.tsx` | Add `YourLeagues` + `FirstVisitPrompt` |
| `src/app/idp-checker/page.tsx` | Add `YourLeagues` (sets state) + `FirstVisitPrompt` |
| `src/app/roster-management/page.tsx` | Add `YourLeagues` + `FirstVisitPrompt` |
| `src/app/taxi-filler/page.tsx` | Add `YourLeagues` + `FirstVisitPrompt` |

---

## Out of Scope

- Multi-device sync (localStorage only; no backend)
- Custom league nicknames (Sleeper league names used as-is)
- Fetching leagues from past seasons (current season 2025 only)
- Any auth beyond Sleeper username lookup
