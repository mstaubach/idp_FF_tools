# NavBar League Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move league selection into a NavBar dropdown that persists and auto-loads every tool with the active league.

**Architecture:** A pure `active-league` lib module maps pathnames → tool league routes and builds the cookie string. `ProfileContext` persists `activeLeagueId` to localStorage and mirrors it into an `idp_active_league` cookie. A new `LeagueSwitcher` NavBar component is the single league-selection UI; the four server-component landing pages read the cookie and redirect straight to the league page; the idp-checker client page syncs its league field from context.

**Tech Stack:** Next.js 16 (App Router, async `cookies()`/`searchParams`), React 19, TypeScript strict, Vitest + Testing Library (jsdom), Tailwind.

**Spec:** `docs/superpowers/specs/2026-07-03-navbar-league-switcher-design.md`

## Global Constraints

- Work on a feature branch off `main`: `git checkout -b navbar-league-switcher` before Task 1.
- Path alias `@/*` → `src/*`. Tests live under `__tests__/`, mirroring `src/lib` paths.
- Cookie name is exactly `idp_active_league`; localStorage keys are exactly `idp_dynasty_profile` (existing) and `idp_dynasty_active_league` (new).
- League IDs are valid iff they match `/^\d{6,}$/`.
- The cookie is a redirect hint only; `ProfileContext`/localStorage stays canonical for UI state.
- Do not touch the per-tool Sleeper clients or league page UIs.
- CI runs lint + build only — run `npm test` and `npm run typecheck` locally before pushing (repo convention).
- Dark slate palette / existing Tailwind class patterns; copy classes from neighboring components as shown in each task.

---

### Task 1: `active-league` pure lib module

**Files:**
- Create: `src/lib/profile/active-league.ts`
- Test: `__tests__/profile/lib/active-league.test.ts`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces (used by Tasks 2–5):
  - `ACTIVE_LEAGUE_COOKIE: string` — `'idp_active_league'`
  - `toolRootFor(pathname: string): string | null`
  - `leaguePathFor(pathname: string, leagueId: string): string | null`
  - `isValidLeagueId(value: string | undefined | null): value is string`
  - `activeLeagueCookieString(leagueId: string | null): string`

- [ ] **Step 1: Write the failing test**

Create `__tests__/profile/lib/active-league.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  ACTIVE_LEAGUE_COOKIE,
  activeLeagueCookieString,
  isValidLeagueId,
  leaguePathFor,
  toolRootFor,
} from '@/lib/profile/active-league';

describe('leaguePathFor', () => {
  it.each([
    ['/standings', '/standings/123456'],
    ['/standings/999999', '/standings/123456'],
    ['/trade-tracker', '/trade-tracker/league/123456'],
    ['/trade-tracker/league/999999', '/trade-tracker/league/123456'],
    ['/roster-management', '/roster-management/123456'],
    ['/roster-management/999999', '/roster-management/123456'],
    ['/taxi-filler', '/taxi-filler/123456'],
    ['/taxi-filler/999999', '/taxi-filler/123456'],
  ])('maps %s to %s', (pathname, expected) => {
    expect(leaguePathFor(pathname, '123456')).toBe(expected);
  });

  it.each([['/'], ['/idp-checker'], ['/injury-tracker'], ['/standings-archive']])(
    'returns null for %s',
    (pathname) => {
      expect(leaguePathFor(pathname, '123456')).toBeNull();
    }
  );
});

describe('toolRootFor', () => {
  it('returns the tool root for nested league paths', () => {
    expect(toolRootFor('/trade-tracker/league/999999')).toBe('/trade-tracker');
    expect(toolRootFor('/standings/999999')).toBe('/standings');
  });

  it('returns null off tool pages', () => {
    expect(toolRootFor('/')).toBeNull();
    expect(toolRootFor('/idp-checker')).toBeNull();
  });
});

describe('isValidLeagueId', () => {
  it('accepts 6+ digit ids', () => {
    expect(isValidLeagueId('123456')).toBe(true);
    expect(isValidLeagueId('1048426134855081984')).toBe(true);
  });

  it('rejects short, empty, non-numeric, and missing values', () => {
    expect(isValidLeagueId('12345')).toBe(false);
    expect(isValidLeagueId('')).toBe(false);
    expect(isValidLeagueId('12a456')).toBe(false);
    expect(isValidLeagueId(undefined)).toBe(false);
    expect(isValidLeagueId(null)).toBe(false);
  });
});

describe('activeLeagueCookieString', () => {
  it('sets a year-long cookie for a league id', () => {
    expect(activeLeagueCookieString('123456')).toBe(
      `${ACTIVE_LEAGUE_COOKIE}=123456; path=/; max-age=31536000; samesite=lax`
    );
  });

  it('expires the cookie for null', () => {
    expect(activeLeagueCookieString(null)).toBe(
      `${ACTIVE_LEAGUE_COOKIE}=; path=/; max-age=0; samesite=lax`
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/profile/lib/active-league.test.ts`
Expected: FAIL — cannot resolve `@/lib/profile/active-league`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/profile/active-league.ts`:

```ts
export const ACTIVE_LEAGUE_COOKIE = 'idp_active_league';

const TOOLS: Array<{ root: string; leaguePath: (id: string) => string }> = [
  { root: '/standings', leaguePath: (id) => `/standings/${id}` },
  { root: '/trade-tracker', leaguePath: (id) => `/trade-tracker/league/${id}` },
  { root: '/roster-management', leaguePath: (id) => `/roster-management/${id}` },
  { root: '/taxi-filler', leaguePath: (id) => `/taxi-filler/${id}` },
];

function toolFor(pathname: string) {
  return (
    TOOLS.find(
      ({ root }) => pathname === root || pathname.startsWith(`${root}/`)
    ) ?? null
  );
}

export function toolRootFor(pathname: string): string | null {
  return toolFor(pathname)?.root ?? null;
}

export function leaguePathFor(
  pathname: string,
  leagueId: string
): string | null {
  return toolFor(pathname)?.leaguePath(leagueId) ?? null;
}

export function isValidLeagueId(
  value: string | undefined | null
): value is string {
  return typeof value === 'string' && /^\d{6,}$/.test(value);
}

export function activeLeagueCookieString(leagueId: string | null): string {
  const maxAge = leagueId === null ? 0 : 60 * 60 * 24 * 365;
  return `${ACTIVE_LEAGUE_COOKIE}=${leagueId ?? ''}; path=/; max-age=${maxAge}; samesite=lax`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/profile/lib/active-league.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile/active-league.ts __tests__/profile/lib/active-league.test.ts
git commit -m "feat(profile): add active-league path mapping and cookie helpers"
```

---

### Task 2: Persist active league in ProfileContext (localStorage + cookie mirror)

**Files:**
- Modify: `src/context/ProfileContext.tsx`
- Test: `__tests__/profile/ProfileContext.test.tsx` (update existing + add cases)

**Interfaces:**
- Consumes: `activeLeagueCookieString` from Task 1.
- Produces: `useProfile()` keeps its exact existing signature (`profile`, `activeLeagueId`, `setProfile`, `setActiveLeagueId`, `clearProfile`) — only persistence behavior changes. Tasks 3–5 rely on: `setActiveLeagueId(id)` persisting to localStorage key `idp_dynasty_active_league` and writing the `idp_active_league` cookie; hydration restoring a stored active league when it exists in `profile.leagues`, else falling back to `primaryLeagueId`.

- [ ] **Step 1: Update and extend the tests (failing first)**

In `__tests__/profile/ProfileContext.test.tsx`:

Replace the `beforeEach` line:

```ts
beforeEach(() => {
  localStorage.clear();
  document.cookie = 'idp_active_league=; path=/; max-age=0';
});
```

Replace the entire test `'setActiveLeagueId updates session league without persisting'` with:

```ts
  it('setActiveLeagueId persists the selection and sets the cookie', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(TEST_PROFILE));
    wrap((ctx) => ctx.setActiveLeagueId('xyz'));
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/abc')
    );
    act(() => screen.getByRole('button').click());
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/xyz')
    );
    expect(localStorage.getItem('idp_dynasty_active_league')).toBe('xyz');
    expect(document.cookie).toContain('idp_active_league=xyz');
    // primary league is untouched
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).primaryLeagueId
    ).toBe('abc');
  });

  it('restores a stored active league on hydrate when it is a saved league', async () => {
    const profile: Profile = {
      ...TEST_PROFILE,
      leagues: [
        { leagueId: 'abc', name: 'IDP Dynasty 2025' },
        { leagueId: 'def', name: 'Second League' },
      ],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    localStorage.setItem('idp_dynasty_active_league', 'def');
    wrap(() => {});
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/def')
    );
    expect(document.cookie).toContain('idp_active_league=def');
  });

  it('falls back to the primary league when the stored active league is stale', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(TEST_PROFILE));
    localStorage.setItem('idp_dynasty_active_league', 'gone');
    wrap(() => {});
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/abc')
    );
    expect(localStorage.getItem('idp_dynasty_active_league')).toBe('abc');
  });

  it('clearProfile removes the active league key and cookie', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(TEST_PROFILE));
    wrap((ctx) => ctx.clearProfile());
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/abc')
    );
    act(() => screen.getByRole('button').click());
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('none/none')
    );
    expect(localStorage.getItem('idp_dynasty_active_league')).toBeNull();
    expect(document.cookie).not.toContain('idp_active_league=abc');
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run __tests__/profile/ProfileContext.test.tsx`
Expected: FAIL — new assertions on `idp_dynasty_active_league` / cookie fail; pre-existing tests still pass.

- [ ] **Step 3: Update ProfileContext**

Replace the full contents of `src/context/ProfileContext.tsx` with:

```tsx
'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  startTransition,
  ReactNode,
} from 'react';
import { Profile } from '@/lib/profile/types';
import { activeLeagueCookieString } from '@/lib/profile/active-league';

const STORAGE_KEY = 'idp_dynasty_profile';
const ACTIVE_LEAGUE_KEY = 'idp_dynasty_active_league';

function persistActiveLeague(id: string | null) {
  if (id === null) {
    localStorage.removeItem(ACTIVE_LEAGUE_KEY);
  } else {
    localStorage.setItem(ACTIVE_LEAGUE_KEY, id);
  }
  document.cookie = activeLeagueCookieString(id);
}

type ProfileContextValue = {
  profile: Profile | null;
  activeLeagueId: string | null;
  setProfile: (p: Profile) => void;
  setActiveLeagueId: (id: string) => void;
  clearProfile: () => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [activeLeagueId, setActiveLeagueIdState] = useState<string | null>(
    null
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Profile = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.leagues) && parsed.primaryLeagueId) {
          const stored = localStorage.getItem(ACTIVE_LEAGUE_KEY);
          const active = parsed.leagues.some((l) => l.leagueId === stored)
            ? (stored as string)
            : parsed.primaryLeagueId;
          persistActiveLeague(active);
          startTransition(() => {
            setProfileState(parsed);
            setActiveLeagueIdState(active);
          });
        }
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  const setActiveLeagueId = (id: string) => {
    persistActiveLeague(id);
    setActiveLeagueIdState(id);
  };

  const setProfile = (p: Profile) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    const active = p.leagues.some((l) => l.leagueId === activeLeagueId)
      ? (activeLeagueId as string)
      : p.primaryLeagueId;
    persistActiveLeague(active);
    setProfileState(p);
    setActiveLeagueIdState(active);
  };

  const clearProfile = () => {
    localStorage.removeItem(STORAGE_KEY);
    persistActiveLeague(null);
    setProfileState(null);
    setActiveLeagueIdState(null);
  };

  return (
    <ProfileContext.Provider
      value={{ profile, activeLeagueId, setProfile, setActiveLeagueId, clearProfile }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
```

Behavior notes baked into the code above:
- `setProfile` now keeps the current active league if the edited profile still contains it (previously it always reset to primary).
- Hydration re-writes the cookie, so a cleared cookie self-heals from localStorage.

- [ ] **Step 4: Run the full profile test file**

Run: `npx vitest run __tests__/profile/ProfileContext.test.tsx`
Expected: PASS (all tests, including the pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/context/ProfileContext.tsx __tests__/profile/ProfileContext.test.tsx
git commit -m "feat(profile): persist active league to localStorage and cookie"
```

---

### Task 3: LeagueSwitcher component + NavBar integration

**Files:**
- Create: `src/components/profile/LeagueSwitcher.tsx`
- Modify: `src/app/(components)/NavBar.jsx`
- Test: `__tests__/profile/LeagueSwitcher.test.tsx`

**Interfaces:**
- Consumes: `useProfile()` (Task 2 semantics), `leaguePathFor` / `toolRootFor` (Task 1).
- Produces: `<LeagueSwitcher />` (no props), rendered by NavBar. Nothing else depends on it.

- [ ] **Step 1: Write the failing component test**

Create `__tests__/profile/LeagueSwitcher.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import LeagueSwitcher from '@/components/profile/LeagueSwitcher';
import { ProfileProvider } from '@/context/ProfileContext';
import { Profile } from '@/lib/profile/types';

const push = vi.fn();
let pathname = '/standings/111111';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}));

const PROFILE: Profile = {
  sleeperUsername: 'mstaubach',
  sleeperUserId: '123',
  leagues: [
    { leagueId: '111111', name: 'League One' },
    { leagueId: '222222', name: 'League Two' },
  ],
  primaryLeagueId: '111111',
};

function renderSwitcher() {
  return render(
    <ProfileProvider>
      <LeagueSwitcher />
    </ProfileProvider>
  );
}

async function openDropdown() {
  // Before opening, the active league name appears exactly once (button label)
  await waitFor(() => screen.getByText('League One'));
  fireEvent.click(screen.getByText('League One'));
}

beforeEach(() => {
  localStorage.clear();
  document.cookie = 'idp_active_league=; path=/; max-age=0';
  push.mockClear();
  pathname = '/standings/111111';
});

describe('LeagueSwitcher', () => {
  it('renders nothing when no profile exists', () => {
    const { container } = renderSwitcher();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the active league name as the button label', async () => {
    localStorage.setItem('idp_dynasty_profile', JSON.stringify(PROFILE));
    renderSwitcher();
    await waitFor(() =>
      expect(screen.getByText('League One')).toBeInTheDocument()
    );
  });

  it('selecting a league navigates the current tool to that league', async () => {
    localStorage.setItem('idp_dynasty_profile', JSON.stringify(PROFILE));
    renderSwitcher();
    await openDropdown();
    fireEvent.click(screen.getByText('League Two'));
    expect(push).toHaveBeenCalledWith('/standings/222222');
    expect(localStorage.getItem('idp_dynasty_active_league')).toBe('222222');
  });

  it('maps trade-tracker paths to the nested league route', async () => {
    pathname = '/trade-tracker/league/111111';
    localStorage.setItem('idp_dynasty_profile', JSON.stringify(PROFILE));
    renderSwitcher();
    await openDropdown();
    fireEvent.click(screen.getByText('League Two'));
    expect(push).toHaveBeenCalledWith('/trade-tracker/league/222222');
  });

  it('does not navigate from non-tool pages but still updates the league', async () => {
    pathname = '/';
    localStorage.setItem('idp_dynasty_profile', JSON.stringify(PROFILE));
    renderSwitcher();
    await openDropdown();
    fireEvent.click(screen.getByText('League Two'));
    expect(push).not.toHaveBeenCalled();
    expect(localStorage.getItem('idp_dynasty_active_league')).toBe('222222');
  });

  it('links "Different league…" to the tool landing page with picker=1', async () => {
    localStorage.setItem('idp_dynasty_profile', JSON.stringify(PROFILE));
    renderSwitcher();
    await openDropdown();
    const link = screen.getByText('Different league…');
    expect(link).toHaveAttribute('href', '/standings?picker=1');
  });

  it('hides "Different league…" off tool pages', async () => {
    pathname = '/';
    localStorage.setItem('idp_dynasty_profile', JSON.stringify(PROFILE));
    renderSwitcher();
    await openDropdown();
    expect(screen.queryByText('Different league…')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/profile/LeagueSwitcher.test.tsx`
Expected: FAIL — cannot resolve `@/components/profile/LeagueSwitcher`.

- [ ] **Step 3: Create the component**

Create `src/components/profile/LeagueSwitcher.tsx`:

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useProfile } from '@/context/ProfileContext';
import { leaguePathFor, toolRootFor } from '@/lib/profile/active-league';

export default function LeagueSwitcher() {
  const { profile, activeLeagueId, setActiveLeagueId } = useProfile();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () =>
      document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  if (!profile || profile.leagues.length === 0) return null;

  const activeLeague =
    profile.leagues.find((l) => l.leagueId === activeLeagueId) ?? null;
  const toolRoot = toolRootFor(pathname);

  const handleSelect = (leagueId: string) => {
    setActiveLeagueId(leagueId);
    setOpen(false);
    const target = leaguePathFor(pathname, leagueId);
    if (target) router.push(target);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[14rem] items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-pitch-800 dark:hover:text-white"
      >
        <span className="truncate">
          {activeLeague ? activeLeague.name : 'Select league'}
        </span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[13rem] rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-pitch-700 dark:bg-pitch-800">
          {profile.leagues.map((league) => {
            const isPrimary = league.leagueId === profile.primaryLeagueId;
            const isActive = league.leagueId === activeLeagueId;
            return (
              <button
                key={league.leagueId}
                onClick={() => handleSelect(league.leagueId)}
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium transition ${
                  isActive
                    ? 'bg-green-700 text-white'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-200 dark:hover:bg-pitch-700 dark:hover:text-white'
                }`}
              >
                {isPrimary && <span className="text-amber-400">★</span>}
                <span className="flex-1 truncate">{league.name}</span>
              </button>
            );
          })}
          {toolRoot && (
            <>
              <hr className="my-1 border-gray-100 dark:border-pitch-700" />
              <Link
                href={`${toolRoot}?picker=1`}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-200 dark:hover:bg-pitch-700 dark:hover:text-white"
              >
                Different league…
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/profile/LeagueSwitcher.test.tsx`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Integrate into NavBar**

In `src/app/(components)/NavBar.jsx`:

a. Add the import:

```jsx
import LeagueSwitcher from "@/components/profile/LeagueSwitcher";
```

b. Change the `useProfile` destructuring (league selection moves out of NavBar):

```jsx
  const { profile, clearProfile } = useProfile();
```

c. Render the switcher just before the profile area — after the closing of the `dropdowns.map(...)` block and before the `{/* Profile area */}` comment:

```jsx
            <LeagueSwitcher />

            {/* Profile area */}
```

d. In the profile dropdown (`profileDropdownOpen && (...)`), delete the entire `profile.leagues.map((league) => { ... })` block and the `<hr .../>` that follows it, keeping only the "Edit profile" and "Clear profile" buttons. The dropdown body becomes:

```jsx
                {profileDropdownOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1 min-w-[13rem] rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-pitch-700 dark:bg-pitch-800">
                    <button
                      onClick={() => {
                        closeProfileDropdown();
                        setProfileModalOpen(true);
                      }}
                      className="block w-full px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-200 dark:hover:bg-pitch-700 dark:hover:text-white"
                    >
                      Edit profile
                    </button>
                    <button
                      onClick={() => {
                        clearProfile();
                        closeProfileDropdown();
                      }}
                      className="block w-full px-4 py-2 text-left text-sm font-medium text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      Clear profile
                    </button>
                  </div>
                )}
```

Note: `LeagueSwitcher` manages its own click-outside closing; the NavBar's existing `handleClickOutside` does not need to know about it because the switcher renders inside `navRef`'s subtree but closes itself independently.

- [ ] **Step 6: Verify build health**

Run: `npm run typecheck && npm run lint`
Expected: both pass with no errors (NavBar is `.jsx`, so typecheck mainly guards LeagueSwitcher and the lib imports).

- [ ] **Step 7: Commit**

```bash
git add src/components/profile/LeagueSwitcher.tsx __tests__/profile/LeagueSwitcher.test.tsx "src/app/(components)/NavBar.jsx"
git commit -m "feat(navbar): add league switcher dropdown, slim profile menu"
```

---

### Task 4: Cookie redirect on the four route-based landing pages

**Files:**
- Modify: `src/app/standings/page.tsx`
- Modify: `src/app/trade-tracker/page.tsx`
- Modify: `src/app/roster-management/page.tsx`
- Modify: `src/app/taxi-filler/page.tsx`

**Interfaces:**
- Consumes: `ACTIVE_LEAGUE_COOKIE`, `isValidLeagueId` from Task 1; the `idp_active_league` cookie written by Task 2.
- Produces: landing pages that `redirect()` to the tool's league page when the cookie holds a valid ID and `?picker=1` is absent. Task 5 relies on `YourLeagues` no longer being imported anywhere after this task plus Task 5's own edit.

All four pages get the same three changes (shown in full for each page below):
1. Imports: drop `YourLeagues`, add `cookies` + the lib helpers.
2. `goToLeague`'s error redirect gains `&picker=1` (otherwise the error state would immediately redirect away to the league page and the user would never see the message).
3. The page component awaits `picker`, checks the cookie, and redirects; the `<YourLeagues ... />` element is removed (the manual form, `FirstVisitPrompt`, and help section stay).

- [ ] **Step 1: Update `src/app/standings/page.tsx`**

Replace the imports, `goToLeague`, and the component signature/opening with:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import FirstVisitPrompt from "@/components/profile/FirstVisitPrompt";
import {
  ACTIVE_LEAGUE_COOKIE,
  isValidLeagueId,
} from "@/lib/profile/active-league";

async function goToLeague(formData: FormData) {
  "use server";
  const raw = String(formData.get("leagueId") ?? "").trim();
  const match = raw.match(/(\d{6,})/);
  if (match) redirect(`/standings/${match[1]}`);
  redirect("/standings?error=1&picker=1");
}

export default async function StandingsHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; picker?: string }>;
}) {
  const { error, picker } = await searchParams;
  if (!picker) {
    const active = (await cookies()).get(ACTIVE_LEAGUE_COOKIE)?.value;
    if (isValidLeagueId(active)) redirect(`/standings/${active}`);
  }
  return (
```

Then delete the line `<YourLeagues toolPath="/standings" />` (and the now-unused `YourLeagues` import if the block above didn't already replace it). Everything else in the file stays unchanged.

- [ ] **Step 2: Update `src/app/trade-tracker/page.tsx`**

Same shape — note the nested league route:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import FirstVisitPrompt from "@/components/profile/FirstVisitPrompt";
import {
  ACTIVE_LEAGUE_COOKIE,
  isValidLeagueId,
} from "@/lib/profile/active-league";

async function goToLeague(formData: FormData) {
  "use server";
  const raw = String(formData.get("leagueId") ?? "").trim();
  const match = raw.match(/(\d{6,})/);
  if (match) redirect(`/trade-tracker/league/${match[1]}`);
  redirect("/trade-tracker?error=1&picker=1");
}

export default async function TradeTrackerHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; picker?: string }>;
}) {
  const { error, picker } = await searchParams;
  if (!picker) {
    const active = (await cookies()).get(ACTIVE_LEAGUE_COOKIE)?.value;
    if (isValidLeagueId(active)) redirect(`/trade-tracker/league/${active}`);
  }
  return (
```

Delete `<YourLeagues toolPath="/trade-tracker/league" />` and the `YourLeagues` import.

- [ ] **Step 3: Update `src/app/roster-management/page.tsx`**

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import FirstVisitPrompt from "@/components/profile/FirstVisitPrompt";
import {
  ACTIVE_LEAGUE_COOKIE,
  isValidLeagueId,
} from "@/lib/profile/active-league";

export const metadata = { title: "Roster Management — IDP Dynasty HQ" };

async function goToLeague(formData: FormData) {
  "use server";
  const raw = String(formData.get("leagueId") ?? "").trim();
  const match = raw.match(/(\d{6,})/);
  if (match) redirect(`/roster-management/${match[1]}`);
  redirect("/roster-management?error=1&picker=1");
}

export default async function RosterManagementHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; picker?: string }>;
}) {
  const { error, picker } = await searchParams;
  if (!picker) {
    const active = (await cookies()).get(ACTIVE_LEAGUE_COOKIE)?.value;
    if (isValidLeagueId(active)) redirect(`/roster-management/${active}`);
  }
  return (
```

Delete `<YourLeagues toolPath="/roster-management" />` and the `YourLeagues` import. Keep the existing `metadata` export as shown.

- [ ] **Step 4: Update `src/app/taxi-filler/page.tsx`**

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import FirstVisitPrompt from "@/components/profile/FirstVisitPrompt";
import {
  ACTIVE_LEAGUE_COOKIE,
  isValidLeagueId,
} from "@/lib/profile/active-league";

export const metadata = { title: "Taxi Filler — IDP Dynasty HQ" };

async function goToLeague(formData: FormData) {
  "use server";
  const raw = String(formData.get("leagueId") ?? "").trim();
  const match = raw.match(/(\d{6,})/);
  if (match) redirect(`/taxi-filler/${match[1]}`);
  redirect("/taxi-filler?error=1&picker=1");
}

export default async function TaxiFillerHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; picker?: string }>;
}) {
  const { error, picker } = await searchParams;
  if (!picker) {
    const active = (await cookies()).get(ACTIVE_LEAGUE_COOKIE)?.value;
    if (isValidLeagueId(active)) redirect(`/taxi-filler/${active}`);
  }
  return (
```

Delete `<YourLeagues toolPath="/taxi-filler" />` and the `YourLeagues` import.

- [ ] **Step 5: Verify build health**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all pass. The four landing pages now render dynamically (they read cookies) — the build must not error on this.

- [ ] **Step 6: Commit**

```bash
git add src/app/standings/page.tsx src/app/trade-tracker/page.tsx src/app/roster-management/page.tsx src/app/taxi-filler/page.tsx
git commit -m "feat(tools): auto-redirect landing pages to the active league"
```

---

### Task 5: idp-checker league sync + remove YourLeagues

**Files:**
- Modify: `src/app/idp-checker/page.tsx`
- Delete: `src/components/profile/YourLeagues.tsx`

**Interfaces:**
- Consumes: `useProfile().activeLeagueId` (Task 2).
- Produces: nothing new — final cleanup task.

- [ ] **Step 1: Update `src/app/idp-checker/page.tsx`**

a. Change the react import and add `useProfile`; drop the `YourLeagues` import and the `DEFAULT_LEAGUE_ID` constant:

```tsx
import { useState, useCallback, useEffect } from 'react';
import { useProfile } from '@/context/ProfileContext';
```

(remove the lines `import YourLeagues from '@/components/profile/YourLeagues';` and `const DEFAULT_LEAGUE_ID = '';`)

b. Inside the component, replace

```tsx
  const [leagueId, setLeagueId] = useState(DEFAULT_LEAGUE_ID);
```

with

```tsx
  const { activeLeagueId } = useProfile();
  const [leagueId, setLeagueId] = useState('');

  useEffect(() => {
    if (activeLeagueId) setLeagueId(activeLeagueId);
  }, [activeLeagueId]);
```

The `LeagueInput` below stays as-is and remains a manual override — typing a different ID only changes local state; the navbar selection is untouched.

c. Delete the `YourLeagues` element (the whole block):

```tsx
        <YourLeagues
          toolPath="/idp-checker"
          onLeagueSelect={(id) => setLeagueId(id)}
        />
```

- [ ] **Step 2: Verify no remaining YourLeagues references, then delete it**

Run: `grep -rn "YourLeagues" src/`
Expected: only `src/components/profile/YourLeagues.tsx` itself.

```bash
git rm src/components/profile/YourLeagues.tsx
```

- [ ] **Step 3: Verify build health**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/idp-checker/page.tsx
git commit -m "feat(idp-checker): sync league from navbar switcher, drop YourLeagues"
```

---

### Task 6: Full verification and manual smoke test

**Files:** none (verification only).

- [ ] **Step 1: Run the full local gate**

```bash
npm test && npm run typecheck && npm run lint && npm run build
```

Expected: all four pass.

- [ ] **Step 2: Manual smoke test**

Run `npm run dev` and verify in the browser (needs outbound access to `api.sleeper.app`):

1. **No profile:** visit `/standings` — landing page with manual form and "Set up →" prompt renders; no switcher in navbar.
2. **Create a profile** with 2+ leagues via the navbar "Set up profile". Switcher appears showing the primary league's name.
3. **Auto-load:** click "Standings" in the nav — you land directly on `/standings/<activeLeagueId>` (no picker screen). Repeat for Trade Tracker, Roster Management, Taxi Filler.
4. **Live switch:** while on a standings league page, pick the other league in the switcher — the page navigates to that league's standings. Repeat once on trade-tracker (nested `/league/` route).
5. **idp-checker:** visit `/idp-checker` — the league ID field is pre-filled with the active league.
6. **Persistence:** switch to the non-primary league, hard-reload — the switcher and pages still use the non-primary league.
7. **Escape hatch:** open the switcher on a tool page, click "Different league…" — the landing page with the manual form renders (no redirect). Submit a bogus ID (`abc`) — the error message is visible (not redirected away).
8. **Clear profile:** navbar → @username → Clear profile — switcher disappears; `/standings` shows the landing page again (cookie cleared).

- [ ] **Step 3: Final commit / push**

If the smoke test required any fixes, commit them individually. Then push the branch and open a PR:

```bash
git push -u origin navbar-league-switcher
```

PR title: `feat: navbar league switcher with auto-loading tools`. Body should reference the spec at `docs/superpowers/specs/2026-07-03-navbar-league-switcher-design.md` and end with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
