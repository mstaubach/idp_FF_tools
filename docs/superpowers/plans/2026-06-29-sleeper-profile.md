# Sleeper Profile & League Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Sleeper-username-based profile system that lets users save their leagues and jump directly into any tool, persisted in localStorage with no backend.

**Architecture:** A `ProfileContext` (React Context + localStorage) wraps the app in `layout.tsx`. Profile setup happens in a modal triggered from the NavBar and from a first-visit prompt on tool input pages. Tool pages render a `YourLeagues` client component above their existing manual-entry form.

**Tech Stack:** Next.js 14 App Router, React Context, localStorage, Sleeper public API (no auth), Tailwind, Vitest + Testing Library

## Global Constraints

- No new npm dependencies — use only what is already installed
- `"use client"` required on every new component that uses hooks or context
- Path alias `@/*` → `src/*` — use for all internal imports
- Dark-mode classes required on every UI element (`dark:` Tailwind variants)
- House color palette: green-700 for primary actions, amber-400/500 for stars/highlights, pitch-700/800/900 for dark backgrounds
- All new files are TypeScript (`.tsx` / `.ts`)
- Test files live under `__tests__/` mirroring the `src/` path (e.g. `src/lib/profile/sleeper.ts` → `__tests__/profile/lib/sleeper.test.ts`)
- Run `npm run typecheck && npm test` before each commit; both must pass

---

### Task 1: Profile types + Sleeper lib

**Files:**
- Create: `src/lib/profile/types.ts`
- Create: `src/lib/profile/sleeper.ts`
- Create: `__tests__/profile/lib/sleeper.test.ts`

**Interfaces:**
- Produces: `SavedLeague`, `Profile`, `SleeperUser` types; `lookupSleeperUser(username)`, `fetchUserLeagues(userId, season)` functions used by Task 4 (ProfileModal)

---

- [ ] **Step 1: Create the types file**

Create `src/lib/profile/types.ts`:

```typescript
export type SavedLeague = {
  leagueId: string;
  name: string;
};

export type Profile = {
  sleeperUsername: string;
  sleeperUserId: string;
  leagues: SavedLeague[];
  primaryLeagueId: string;
};
```

- [ ] **Step 2: Create the Sleeper lib file**

Create `src/lib/profile/sleeper.ts`:

```typescript
import { SavedLeague } from './types';

export type SleeperUser = {
  user_id: string;
  username: string;
  display_name: string;
};

export const CURRENT_SEASON = '2025';

export async function lookupSleeperUser(username: string): Promise<SleeperUser> {
  const res = await fetch(
    `https://api.sleeper.app/v1/user/${encodeURIComponent(username)}`
  );
  if (!res.ok) throw new Error('User not found');
  const data = await res.json();
  if (!data || !data.user_id) throw new Error('User not found');
  return data as SleeperUser;
}

export async function fetchUserLeagues(
  userId: string,
  season: string
): Promise<SavedLeague[]> {
  const res = await fetch(
    `https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${season}`
  );
  if (!res.ok) throw new Error('Failed to fetch leagues');
  const data = await res.json();
  return (data ?? []).map((l: { league_id: string; name: string }) => ({
    leagueId: l.league_id,
    name: l.name,
  }));
}
```

- [ ] **Step 3: Write the failing tests**

Create `__tests__/profile/lib/sleeper.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookupSleeperUser, fetchUserLeagues } from '@/lib/profile/sleeper';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

describe('lookupSleeperUser', () => {
  it('returns user on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user_id: '123',
        username: 'mstaubach',
        display_name: 'Michael',
      }),
    });
    const user = await lookupSleeperUser('mstaubach');
    expect(user.user_id).toBe('123');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.sleeper.app/v1/user/mstaubach'
    );
  });

  it('throws when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => null });
    await expect(lookupSleeperUser('nobody')).rejects.toThrow('User not found');
  });

  it('throws when response has no user_id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => null,
    });
    await expect(lookupSleeperUser('nobody')).rejects.toThrow('User not found');
  });

  it('URL-encodes the username', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user_id: '9', username: 'a b', display_name: 'A B' }),
    });
    await lookupSleeperUser('a b');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.sleeper.app/v1/user/a%20b'
    );
  });
});

describe('fetchUserLeagues', () => {
  it('maps Sleeper response to SavedLeague array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { league_id: 'abc', name: 'IDP Dynasty 2025' },
        { league_id: 'def', name: 'Best Ball' },
      ],
    });
    const leagues = await fetchUserLeagues('123', '2025');
    expect(leagues).toEqual([
      { leagueId: 'abc', name: 'IDP Dynasty 2025' },
      { leagueId: 'def', name: 'Best Ball' },
    ]);
  });

  it('returns empty array when API returns null', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => null });
    const leagues = await fetchUserLeagues('123', '2025');
    expect(leagues).toEqual([]);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => null });
    await expect(fetchUserLeagues('123', '2025')).rejects.toThrow(
      'Failed to fetch leagues'
    );
  });
});
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
npx vitest run __tests__/profile/lib/sleeper.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/profile/types.ts src/lib/profile/sleeper.ts __tests__/profile/lib/sleeper.test.ts
git commit -m "feat(profile): add types and Sleeper lookup lib"
```

---

### Task 2: ProfileContext

**Files:**
- Create: `src/context/ProfileContext.tsx`
- Create: `__tests__/profile/ProfileContext.test.tsx`

**Interfaces:**
- Consumes: `Profile`, `SavedLeague` from `@/lib/profile/types`
- Produces: `ProfileProvider` (wraps the app), `useProfile()` hook — used by Tasks 4, 5, 6

---

- [ ] **Step 1: Write the failing tests**

Create `__tests__/profile/ProfileContext.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { ProfileProvider, useProfile } from '@/context/ProfileContext';
import { Profile } from '@/lib/profile/types';

const STORAGE_KEY = 'idp_dynasty_profile';

const TEST_PROFILE: Profile = {
  sleeperUsername: 'mstaubach',
  sleeperUserId: '123',
  leagues: [{ leagueId: 'abc', name: 'IDP Dynasty 2025' }],
  primaryLeagueId: 'abc',
};

function Harness({
  onAction,
}: {
  onAction: (ctx: ReturnType<typeof useProfile>) => void;
}) {
  const ctx = useProfile();
  return (
    <button onClick={() => onAction(ctx)}>
      {ctx.profile?.sleeperUsername ?? 'none'}/{ctx.activeLeagueId ?? 'none'}
    </button>
  );
}

function wrap(onAction: (ctx: ReturnType<typeof useProfile>) => void) {
  return render(
    <ProfileProvider>
      <Harness onAction={onAction} />
    </ProfileProvider>
  );
}

beforeEach(() => localStorage.clear());

describe('ProfileProvider', () => {
  it('starts with null profile when localStorage is empty', async () => {
    wrap(() => {});
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('none/none')
    );
  });

  it('hydrates from localStorage on mount', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(TEST_PROFILE));
    wrap(() => {});
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/abc')
    );
  });

  it('setProfile updates state and localStorage', async () => {
    wrap((ctx) => ctx.setProfile(TEST_PROFILE));
    act(() => screen.getByRole('button').click());
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/abc')
    );
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(
      TEST_PROFILE
    );
  });

  it('clearProfile resets state and removes localStorage entry', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(TEST_PROFILE));
    wrap((ctx) => ctx.clearProfile());
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/abc')
    );
    act(() => screen.getByRole('button').click());
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('none/none')
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('setActiveLeagueId updates session league without persisting', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(TEST_PROFILE));
    wrap((ctx) => ctx.setActiveLeagueId('xyz'));
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/abc')
    );
    act(() => screen.getByRole('button').click());
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/xyz')
    );
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).primaryLeagueId
    ).toBe('abc');
  });
});
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
npx vitest run __tests__/profile/ProfileContext.test.tsx
```

Expected: FAIL — `@/context/ProfileContext` not found.

- [ ] **Step 3: Implement ProfileContext**

Create `src/context/ProfileContext.tsx`:

```typescript
'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { Profile } from '@/lib/profile/types';

const STORAGE_KEY = 'idp_dynasty_profile';

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
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Profile = JSON.parse(raw);
        setProfileState(parsed);
        setActiveLeagueId(parsed.primaryLeagueId);
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  const setProfile = (p: Profile) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    setProfileState(p);
    setActiveLeagueId(p.primaryLeagueId);
  };

  const clearProfile = () => {
    localStorage.removeItem(STORAGE_KEY);
    setProfileState(null);
    setActiveLeagueId(null);
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

- [ ] **Step 4: Run tests — expect them to pass**

```bash
npx vitest run __tests__/profile/ProfileContext.test.tsx
```

Expected: all 5 tests pass.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/context/ProfileContext.tsx __tests__/profile/ProfileContext.test.tsx
git commit -m "feat(profile): add ProfileContext with localStorage persistence"
```

---

### Task 3: Wire ProfileProvider into layout

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `ProfileProvider` from `@/context/ProfileContext`

---

- [ ] **Step 1: Update layout.tsx**

Replace the contents of `src/app/layout.tsx` with:

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import NavBar from "./(components)/NavBar";
import Footer from "./(components)/Footer";
import { ProfileProvider } from "@/context/ProfileContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IDP Dynasty HQ",
  description:
    "A suite of fantasy football tools for Sleeper IDP dynasty leagues — standings, trade tracking, IDP availability, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen`}>
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          <ProfileProvider>
            <div className="flex min-h-screen flex-col">
              <NavBar />
              <div className="mx-auto w-full max-w-[120rem] flex-1 px-4 py-8">
                {children}
              </div>
              <Footer />
            </div>
          </ProfileProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Typecheck + run all tests**

```bash
npm run typecheck && npm test
```

Expected: no errors, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(profile): wrap app in ProfileProvider"
```

---

### Task 4: ProfileModal

**Files:**
- Create: `src/components/profile/ProfileModal.tsx`

**Interfaces:**
- Consumes: `useProfile` from `@/context/ProfileContext`; `lookupSleeperUser`, `fetchUserLeagues`, `CURRENT_SEASON` from `@/lib/profile/sleeper`; `SavedLeague`, `Profile` from `@/lib/profile/types`
- Produces: `ProfileModal` — default export, accepts `{ onClose: () => void }`. Used by Tasks 5 (FirstVisitPrompt) and 6 (NavBar).

The modal has two steps:
- **Step `username`:** text input + "Look up" button. On submit, calls Sleeper, advances to `leagues`.
- **Step `leagues`:** list of leagues with checkbox + star button. "Save profile" writes to context and calls `onClose`.

When opened with an existing profile, the modal starts on step `leagues` with the current username, leagues, and primary pre-populated. "Back" on step `leagues` returns to step `username` so the user can switch accounts.

---

- [ ] **Step 1: Create ProfileModal**

Create `src/components/profile/ProfileModal.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { lookupSleeperUser, fetchUserLeagues, CURRENT_SEASON } from '@/lib/profile/sleeper';
import { SavedLeague, Profile } from '@/lib/profile/types';

type Step = 'username' | 'leagues';

type Props = {
  onClose: () => void;
};

export default function ProfileModal({ onClose }: Props) {
  const { profile, setProfile } = useProfile();

  const [step, setStep] = useState<Step>(profile ? 'leagues' : 'username');
  const [username, setUsername] = useState(profile?.sleeperUsername ?? '');
  const [userId, setUserId] = useState(profile?.sleeperUserId ?? '');
  const [leagues, setLeagues] = useState<SavedLeague[]>(profile?.leagues ?? []);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(profile?.leagues.map((l) => l.leagueId) ?? [])
  );
  const [primaryLeagueId, setPrimaryLeagueId] = useState(
    profile?.primaryLeagueId ?? ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await lookupSleeperUser(username.trim());
      const fetched = await fetchUserLeagues(user.user_id, CURRENT_SEASON);
      setUserId(user.user_id);
      setLeagues(fetched);
      setSelected(new Set(fetched.map((l) => l.leagueId)));
      setPrimaryLeagueId(fetched[0]?.leagueId ?? '');
      setStep('leagues');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const toggleLeague = (leagueId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(leagueId)) {
        next.delete(leagueId);
        if (primaryLeagueId === leagueId) {
          const remaining = leagues.find((l) => next.has(l.leagueId));
          setPrimaryLeagueId(remaining?.leagueId ?? '');
        }
      } else {
        next.add(leagueId);
      }
      return next;
    });
  };

  const handleSave = () => {
    const saved = leagues.filter((l) => selected.has(l.leagueId));
    if (!saved.length) {
      setError('Select at least one league.');
      return;
    }
    if (!primaryLeagueId || !selected.has(primaryLeagueId)) {
      setError('Choose a primary league (click the ★).');
      return;
    }
    const newProfile: Profile = {
      sleeperUsername: username.trim(),
      sleeperUserId: userId,
      leagues: saved,
      primaryLeagueId,
    };
    setProfile(newProfile);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-pitch-700 dark:bg-pitch-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
            {step === 'username' ? 'Set up your profile' : 'Your leagues'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {step === 'username' && (
          <form onSubmit={handleLookup} className="space-y-4">
            <div>
              <label
                htmlFor="sleeper-username"
                className="block text-sm font-medium text-gray-700 dark:text-slate-300"
              >
                Sleeper username
              </label>
              <input
                id="sleeper-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. mstaubach"
                required
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-green-600 focus:outline-hidden dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-green-700 px-4 py-2.5 font-semibold text-white transition hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Looking up…' : 'Look up'}
            </button>
          </form>
        )}

        {step === 'leagues' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Select leagues to save. Star one as your primary.
            </p>
            {leagues.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-slate-500">
                No leagues found for the {CURRENT_SEASON} season.
              </p>
            )}
            <ul className="space-y-2">
              {leagues.map((league) => (
                <li key={league.leagueId} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`league-${league.leagueId}`}
                    checked={selected.has(league.leagueId)}
                    onChange={() => toggleLeague(league.leagueId)}
                    className="h-4 w-4 accent-green-600"
                  />
                  <label
                    htmlFor={`league-${league.leagueId}`}
                    className="flex-1 cursor-pointer text-sm text-gray-800 dark:text-slate-200"
                  >
                    {league.name}
                    <span className="ml-1 text-xs text-gray-400 dark:text-slate-500">
                      {league.leagueId}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setPrimaryLeagueId(league.leagueId)}
                    disabled={!selected.has(league.leagueId)}
                    title={
                      primaryLeagueId === league.leagueId
                        ? 'Primary league'
                        : 'Set as primary'
                    }
                    className={`text-lg disabled:opacity-30 ${
                      primaryLeagueId === league.leagueId
                        ? 'text-amber-400'
                        : 'text-gray-300 hover:text-amber-400'
                    }`}
                  >
                    ★
                  </button>
                </li>
              ))}
            </ul>
            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep('username');
                  setError(null);
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-pitch-700 dark:text-slate-300 dark:hover:bg-pitch-800"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-600"
              >
                Save profile
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + run all tests**

```bash
npm run typecheck && npm test
```

Expected: no errors, all existing tests still pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/ProfileModal.tsx
git commit -m "feat(profile): add ProfileModal component"
```

---

### Task 5: YourLeagues + FirstVisitPrompt

**Files:**
- Create: `src/components/profile/YourLeagues.tsx`
- Create: `src/components/profile/FirstVisitPrompt.tsx`

**Interfaces:**
- Consumes: `useProfile` from `@/context/ProfileContext`; `ProfileModal` from `./ProfileModal`; `useRouter` from `next/navigation`
- Produces:
  - `YourLeagues` — `({ toolPath: string; onLeagueSelect?: (leagueId: string) => void }) => JSX.Element | null`
  - `FirstVisitPrompt` — `() => JSX.Element | null`
  - Both used by Task 7 (tool pages)

`YourLeagues` returns `null` when there is no profile. It renders a separator ("or enter a league ID manually") at its bottom so the tool page forms need no changes.

---

- [ ] **Step 1: Create YourLeagues**

Create `src/components/profile/YourLeagues.tsx`:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useProfile } from '@/context/ProfileContext';

type Props = {
  toolPath: string;
  onLeagueSelect?: (leagueId: string) => void;
};

export default function YourLeagues({ toolPath, onLeagueSelect }: Props) {
  const { profile, activeLeagueId, setActiveLeagueId } = useProfile();
  const router = useRouter();

  if (!profile || !profile.leagues.length) return null;

  const handleSelect = (leagueId: string) => {
    setActiveLeagueId(leagueId);
    if (onLeagueSelect) {
      onLeagueSelect(leagueId);
    } else {
      router.push(`${toolPath}/${leagueId}`);
    }
  };

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-700 dark:text-slate-300">
          Your Leagues
        </h2>
        <div className="flex flex-wrap gap-2">
          {profile.leagues.map((league) => {
            const isPrimary = league.leagueId === profile.primaryLeagueId;
            const isActive = league.leagueId === activeLeagueId;
            return (
              <button
                key={league.leagueId}
                onClick={() => handleSelect(league.leagueId)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'border-green-600 bg-green-700 text-white'
                    : isPrimary
                    ? 'border-amber-400 text-gray-900 hover:bg-amber-50 dark:text-slate-100 dark:hover:bg-amber-400/10'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-pitch-700 dark:text-slate-300 dark:hover:bg-pitch-800'
                }`}
              >
                {isPrimary && (
                  <span className="mr-1 text-amber-500">★</span>
                )}
                {league.name}
              </button>
            );
          })}
        </div>
      </section>
      <div className="flex items-center gap-3">
        <hr className="flex-1 border-gray-200 dark:border-pitch-700" />
        <span className="text-xs text-gray-400 dark:text-slate-500">
          or enter a league ID manually
        </span>
        <hr className="flex-1 border-gray-200 dark:border-pitch-700" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create FirstVisitPrompt**

Create `src/components/profile/FirstVisitPrompt.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useProfile } from '@/context/ProfileContext';
import ProfileModal from './ProfileModal';

export default function FirstVisitPrompt() {
  const { profile } = useProfile();
  const [modalOpen, setModalOpen] = useState(false);

  if (profile) return null;

  return (
    <>
      <p className="text-sm text-gray-500 dark:text-slate-400">
        Save your league IDs — set up a profile to jump straight to your leagues
        next time.{' '}
        <button
          onClick={() => setModalOpen(true)}
          className="font-medium text-green-600 underline hover:text-green-500 dark:text-green-400"
        >
          Set up →
        </button>
      </p>
      {modalOpen && <ProfileModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
```

- [ ] **Step 3: Typecheck + run all tests**

```bash
npm run typecheck && npm test
```

Expected: no errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/profile/YourLeagues.tsx src/components/profile/FirstVisitPrompt.tsx
git commit -m "feat(profile): add YourLeagues and FirstVisitPrompt components"
```

---

### Task 6: NavBar profile integration

**Files:**
- Modify: `src/app/(components)/NavBar.jsx`

**Interfaces:**
- Consumes: `useProfile` from `@/context/ProfileContext`; `ProfileModal` from `@/components/profile/ProfileModal`

Adds a profile button (no profile) or username chip + dropdown (profile exists) to the right side of the nav, alongside the existing `ThemeToggle`. The dropdown lists saved leagues (clicking sets `activeLeagueId`), "Edit profile" (re-opens modal pre-populated), and "Clear profile". The existing `openState` dropdown-tracking pattern is extended with a separate `profileDropdownOpen` boolean.

---

- [ ] **Step 1: Update NavBar.jsx**

Replace the full contents of `src/app/(components)/NavBar.jsx` with:

```jsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import ThemeToggle from "./ThemeToggle";
import { useProfile } from "@/context/ProfileContext";
import ProfileModal from "@/components/profile/ProfileModal";

const dropdowns = [
  {
    label: "League History",
    links: [
      { href: "/standings", label: "Standings" },
      { href: "/trade-tracker", label: "Trade Tracker" },
    ],
  },
  {
    label: "Tools",
    links: [
      { href: "/idp-checker", label: "Waiver Check" },
      { href: "/roster-management", label: "Roster Management" },
      { href: "/taxi-filler", label: "Taxi Filler" },
    ],
  },
];

const NavBar = () => {
  const pathname = usePathname();
  const [openState, setOpenState] = useState({ index: null, path: null });
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const navRef = useRef(null);

  const { profile, activeLeagueId, setActiveLeagueId, clearProfile } =
    useProfile();

  const isOpen = (i) =>
    openState.index === i && openState.path === pathname;
  const toggle = (i) =>
    setOpenState(
      isOpen(i)
        ? { index: null, path: null }
        : { index: i, path: pathname }
    );

  const isActive = (href) => pathname.startsWith(href);
  const groupIsActive = (links) => links.some(({ href }) => isActive(href));

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenState({ index: null, path: null });
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close profile dropdown on navigation
  useEffect(() => {
    setProfileDropdownOpen(false);
  }, [pathname]);

  return (
    <>
      <nav
        ref={navRef}
        className="border-b border-gray-200 bg-white/90 backdrop-blur-sm dark:border-pitch-700 dark:bg-pitch-900/80"
      >
        <div className="mx-auto flex max-w-[120rem] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🏈</span>
            <span className="text-lg font-black tracking-tighter text-gray-900 dark:text-slate-100">
              IDP Dynasty HQ
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-1">
            {dropdowns.map(({ label, links }, i) => {
              const active = groupIsActive(links);
              const open = isOpen(i);
              return (
                <div key={label} className="relative">
                  <button
                    onClick={() => toggle(i)}
                    className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? "bg-amber-400 text-gray-900"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-pitch-800 dark:hover:text-white"
                    }`}
                  >
                    {label}
                    <svg
                      className={`h-3.5 w-3.5 transition-transform ${
                        open ? "rotate-180" : ""
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
                    <div className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-pitch-700 dark:bg-pitch-800">
                      {links.map(({ href, label: linkLabel }) => (
                        <Link
                          key={href}
                          href={href}
                          className={`block px-4 py-2 text-sm font-medium transition ${
                            isActive(href)
                              ? "bg-amber-400 text-gray-900"
                              : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-200 dark:hover:bg-pitch-700 dark:hover:text-white"
                          }`}
                        >
                          {linkLabel}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Profile area */}
            {!profile ? (
              <button
                onClick={() => setProfileModalOpen(true)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-pitch-800 dark:hover:text-white"
              >
                Set up profile
              </button>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen((o) => !o)}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-pitch-800 dark:hover:text-white"
                >
                  @{profile.sleeperUsername}
                  <svg
                    className={`h-3.5 w-3.5 transition-transform ${
                      profileDropdownOpen ? "rotate-180" : ""
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
                {profileDropdownOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1 min-w-[13rem] rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-pitch-700 dark:bg-pitch-800">
                    {profile.leagues.map((league) => {
                      const isPrimary =
                        league.leagueId === profile.primaryLeagueId;
                      const isActiveLg = league.leagueId === activeLeagueId;
                      return (
                        <button
                          key={league.leagueId}
                          onClick={() => {
                            setActiveLeagueId(league.leagueId);
                            setProfileDropdownOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium transition ${
                            isActiveLg
                              ? "bg-green-700 text-white"
                              : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-200 dark:hover:bg-pitch-700 dark:hover:text-white"
                          }`}
                        >
                          {isPrimary && (
                            <span className="text-amber-400">★</span>
                          )}
                          <span className="flex-1 truncate">{league.name}</span>
                        </button>
                      );
                    })}
                    <hr className="my-1 border-gray-100 dark:border-pitch-700" />
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setProfileModalOpen(true);
                      }}
                      className="block w-full px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-200 dark:hover:bg-pitch-700 dark:hover:text-white"
                    >
                      Edit profile
                    </button>
                    <button
                      onClick={() => {
                        clearProfile();
                        setProfileDropdownOpen(false);
                      }}
                      className="block w-full px-4 py-2 text-left text-sm font-medium text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      Clear profile
                    </button>
                  </div>
                )}
              </div>
            )}

            <ThemeToggle />
          </div>
        </div>
      </nav>
      {profileModalOpen && (
        <ProfileModal onClose={() => setProfileModalOpen(false)} />
      )}
    </>
  );
};

export default NavBar;
```

- [ ] **Step 2: Typecheck + run all tests**

```bash
npm run typecheck && npm test
```

Expected: no errors, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/(components)/NavBar.jsx
git commit -m "feat(profile): add profile button and league switcher to NavBar"
```

---

### Task 7: Tool page integration

**Files:**
- Modify: `src/app/standings/page.tsx`
- Modify: `src/app/trade-tracker/page.tsx`
- Modify: `src/app/roster-management/page.tsx`
- Modify: `src/app/taxi-filler/page.tsx`
- Modify: `src/app/idp-checker/page.tsx`

**Interfaces:**
- Consumes: `YourLeagues` from `@/components/profile/YourLeagues`; `FirstVisitPrompt` from `@/components/profile/FirstVisitPrompt`

The four redirect-based pages (standings, trade-tracker, roster-management, taxi-filler) are server components — they can import and render client components without any changes to their own component type. Each gets `<YourLeagues toolPath="..." />` and `<FirstVisitPrompt />` inserted between the header section and the form. `YourLeagues` renders its own "or enter a league ID manually" separator, so the existing form label ("Sleeper League ID") is unchanged.

The IDP checker is a client component. It gets `<YourLeagues toolPath="/idp-checker" onLeagueSelect={(id) => setLeagueId(id)} />` and `<FirstVisitPrompt />` between the title paragraph and the league input card.

---

- [ ] **Step 1: Update standings/page.tsx**

Replace `src/app/standings/page.tsx` with:

```typescript
import { redirect } from "next/navigation";
import YourLeagues from "@/components/profile/YourLeagues";
import FirstVisitPrompt from "@/components/profile/FirstVisitPrompt";

async function goToLeague(formData: FormData) {
  "use server";
  const raw = String(formData.get("leagueId") ?? "").trim();
  const match = raw.match(/(\d{6,})/);
  if (match) redirect(`/standings/${match[1]}`);
  redirect("/standings?error=1");
}

export default async function StandingsHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-5xl space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-black tracking-tighter text-gray-900 dark:text-slate-100">
          League Standings
        </h1>
        <p className="text-gray-600 dark:text-slate-300">
          Enter any Sleeper league ID to see its all-time standings — total wins,
          losses, and championships for every manager across the dynasty&apos;s
          history, with a drill-down into any individual season.
        </p>
        <FirstVisitPrompt />
      </section>

      <YourLeagues toolPath="/standings" />

      <form action={goToLeague} className="space-y-3">
        <label
          htmlFor="leagueId"
          className="block text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          Sleeper League ID
        </label>
        <div className="flex gap-2">
          <input
            id="leagueId"
            name="leagueId"
            type="text"
            inputMode="numeric"
            placeholder="e.g. 1048426134855081984"
            required
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-green-600 focus:outline-hidden dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white transition hover:bg-green-600"
          >
            View standings
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-500 dark:text-red-400">
            Please enter a valid Sleeper league ID.
          </p>
        )}
      </form>

      <section className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600 dark:border-pitch-700 dark:bg-pitch-800/50 dark:text-slate-300">
        <h2 className="mb-2 font-semibold text-gray-900 dark:text-slate-100">
          Where do I find my league ID?
        </h2>
        <p>
          Open your league in the Sleeper web app. The long number in the URL
          (
          <code className="text-green-600 dark:text-green-400">
            sleeper.com/leagues/&lt;LEAGUE_ID&gt;
          </code>
          ) is your league ID. You can paste the whole URL above too.
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Update trade-tracker/page.tsx**

Replace `src/app/trade-tracker/page.tsx` with:

```typescript
import { redirect } from "next/navigation";
import YourLeagues from "@/components/profile/YourLeagues";
import FirstVisitPrompt from "@/components/profile/FirstVisitPrompt";

async function goToLeague(formData: FormData) {
  "use server";
  const raw = String(formData.get("leagueId") ?? "").trim();
  const match = raw.match(/(\d{6,})/);
  if (match) redirect(`/trade-tracker/league/${match[1]}`);
  redirect("/trade-tracker?error=1");
}

export default async function TradeTrackerHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-5xl space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-black tracking-tighter text-gray-900 dark:text-slate-100">
          Trade Tracker
        </h1>
        <p className="text-gray-600 dark:text-slate-300">
          Trade away a first-round pick for Tee Higgins? This tool follows that
          pick to the draft and shows you exactly who got selected with it — so
          you can finally settle who won the trade.
        </p>
        <FirstVisitPrompt />
      </section>

      <YourLeagues toolPath="/trade-tracker/league" />

      <form action={goToLeague} className="space-y-3">
        <label
          htmlFor="leagueId"
          className="block text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          Sleeper League ID
        </label>
        <div className="flex gap-2">
          <input
            id="leagueId"
            name="leagueId"
            type="text"
            inputMode="numeric"
            placeholder="e.g. 992734045862027264"
            required
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-green-600 focus:outline-hidden dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white transition hover:bg-green-600"
          >
            Track trades
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-500 dark:text-red-400">
            Please enter a valid Sleeper league ID.
          </p>
        )}
      </form>

      <section className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600 dark:border-pitch-700 dark:bg-pitch-800/50 dark:text-slate-300">
        <h2 className="mb-2 font-semibold text-gray-900 dark:text-slate-100">
          Where do I find my league ID?
        </h2>
        <p>
          Open your league in the Sleeper web app. The long number in the URL
          (
          <code className="text-green-600 dark:text-green-400">
            sleeper.com/leagues/&lt;LEAGUE_ID&gt;
          </code>
          ) is your league ID. You can paste the whole URL above too.
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Update roster-management/page.tsx**

Replace `src/app/roster-management/page.tsx` with:

```typescript
import { redirect } from "next/navigation";
import YourLeagues from "@/components/profile/YourLeagues";
import FirstVisitPrompt from "@/components/profile/FirstVisitPrompt";

export const metadata = { title: "Roster Management — IDP Dynasty HQ" };

async function goToLeague(formData: FormData) {
  "use server";
  const raw = String(formData.get("leagueId") ?? "").trim();
  const match = raw.match(/(\d{6,})/);
  if (match) redirect(`/roster-management/${match[1]}`);
  redirect("/roster-management?error=1");
}

export default async function RosterManagementHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-5xl space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-black tracking-tighter text-gray-900 dark:text-slate-100">
          Roster Management
        </h1>
        <p className="text-gray-600 dark:text-slate-300">
          See your entire dynasty roster organized as a depth chart — starters,
          bench, taxi, and IR slotted by position. Enter your Sleeper league ID
          to get started.
        </p>
        <FirstVisitPrompt />
      </section>

      <YourLeagues toolPath="/roster-management" />

      <form action={goToLeague} className="space-y-3">
        <label
          htmlFor="leagueId"
          className="block text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          Sleeper League ID
        </label>
        <div className="flex gap-2">
          <input
            id="leagueId"
            name="leagueId"
            type="text"
            inputMode="numeric"
            placeholder="e.g. 992734045862027264"
            required
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-green-600 focus:outline-hidden dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white transition hover:bg-green-600"
          >
            View roster
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-500 dark:text-red-400">
            Please enter a valid Sleeper league ID.
          </p>
        )}
      </form>

      <section className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600 dark:border-pitch-700 dark:bg-pitch-800/50 dark:text-slate-300">
        <h2 className="mb-2 font-semibold text-gray-900 dark:text-slate-100">
          Where do I find my league ID?
        </h2>
        <p>
          Open your league in the Sleeper web app. The long number in the URL (
          <code className="text-green-600 dark:text-green-400">
            sleeper.com/leagues/&lt;LEAGUE_ID&gt;
          </code>
          ) is your league ID. You can paste the whole URL above too.
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Update taxi-filler/page.tsx**

Replace `src/app/taxi-filler/page.tsx` with:

```typescript
import { redirect } from "next/navigation";
import YourLeagues from "@/components/profile/YourLeagues";
import FirstVisitPrompt from "@/components/profile/FirstVisitPrompt";

export const metadata = { title: "Taxi Filler — IDP Dynasty HQ" };

async function goToLeague(formData: FormData) {
  "use server";
  const raw = String(formData.get("leagueId") ?? "").trim();
  const match = raw.match(/(\d{6,})/);
  if (match) redirect(`/taxi-filler/${match[1]}`);
  redirect("/taxi-filler?error=1");
}

export default async function TaxiFillerHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-5xl space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-black tracking-tighter text-gray-900 dark:text-slate-100">
          Taxi Filler
        </h1>
        <p className="text-gray-600 dark:text-slate-300">
          Find rookies and young players on the waiver wire who are eligible for
          your league&apos;s taxi squad — ranked by Sleeper&apos;s player rating
          so you can spot the best stashes fast.
        </p>
        <FirstVisitPrompt />
      </section>

      <YourLeagues toolPath="/taxi-filler" />

      <form action={goToLeague} className="space-y-3">
        <label
          htmlFor="leagueId"
          className="block text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          Sleeper League ID
        </label>
        <div className="flex gap-2">
          <input
            id="leagueId"
            name="leagueId"
            type="text"
            inputMode="numeric"
            placeholder="e.g. 992734045862027264"
            required
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-green-600 focus:outline-hidden dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white transition hover:bg-green-600"
          >
            Find players
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-500 dark:text-red-400">
            Please enter a valid Sleeper league ID.
          </p>
        )}
      </form>

      <section className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600 dark:border-pitch-700 dark:bg-pitch-800/50 dark:text-slate-300">
        <h2 className="mb-2 font-semibold text-gray-900 dark:text-slate-100">
          Where do I find my league ID?
        </h2>
        <p>
          Open your league in the Sleeper web app. The long number in the URL (
          <code className="text-green-600 dark:text-green-400">
            sleeper.com/leagues/&lt;LEAGUE_ID&gt;
          </code>
          ) is your league ID. You can paste the whole URL above too.
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Update idp-checker/page.tsx**

Replace `src/app/idp-checker/page.tsx` with:

```typescript
'use client';

import { useState, useCallback } from 'react';
import LeagueInput from '@/components/idp-checker/LeagueInput';
import PlayerInput from '@/components/idp-checker/PlayerInput';
import ResultsTable from '@/components/idp-checker/ResultsTable';
import Filters from '@/components/idp-checker/Filters';
import WaiverInfo from '@/components/idp-checker/WaiverInfo';
import UnmatchedPlayers from '@/components/idp-checker/UnmatchedPlayers';
import ErrorBanner from '@/components/idp-checker/ErrorBanner';
import YourLeagues from '@/components/profile/YourLeagues';
import FirstVisitPrompt from '@/components/profile/FirstVisitPrompt';
import { ParsedPlayer, CheckAvailabilityResponse } from '@/lib/idp-checker/types';

const DEFAULT_LEAGUE_ID = '';

export default function IdpCheckerPage() {
  const [leagueId, setLeagueId] = useState(DEFAULT_LEAGUE_ID);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CheckAvailabilityResponse | null>(null);
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [availableOnly, setAvailableOnly] = useState(false);

  const handleSubmit = useCallback(async (players: ParsedPlayer[]) => {
    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch('/api/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players, leagueId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      const result: CheckAvailabilityResponse = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [leagueId]);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-black tracking-tighter text-gray-900 dark:text-slate-100 mb-2">
        Waiver Check
      </h1>
      <p className="text-gray-600 dark:text-slate-400 mb-2">
        Paste your IDP rankings and check player availability in your Sleeper league.
      </p>
      <FirstVisitPrompt />

      <div className="space-y-6 mt-6">
        <YourLeagues
          toolPath="/idp-checker"
          onLeagueSelect={(id) => setLeagueId(id)}
        />

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-pitch-700 dark:bg-pitch-800">
          <LeagueInput leagueId={leagueId} onChange={setLeagueId} />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-pitch-700 dark:bg-pitch-800">
          <PlayerInput onSubmit={handleSubmit} isLoading={isLoading} />
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {data && (
          <>
            {data.waiverInfo && (
              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-pitch-700 dark:bg-pitch-800">
                <WaiverInfo waiverInfo={data.waiverInfo} />
              </div>
            )}

            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-pitch-700 dark:bg-pitch-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                  Results ({data.results.length} players)
                </h2>
                <Filters
                  positionFilter={positionFilter}
                  onPositionChange={setPositionFilter}
                  availableOnly={availableOnly}
                  onAvailableOnlyChange={setAvailableOnly}
                />
              </div>
              <ResultsTable
                results={data.results}
                positionFilter={positionFilter}
                availableOnly={availableOnly}
              />
            </div>

            <UnmatchedPlayers players={data.unmatchedPlayers} />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck + run all tests**

```bash
npm run typecheck && npm test
```

Expected: no errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/standings/page.tsx src/app/trade-tracker/page.tsx src/app/roster-management/page.tsx src/app/taxi-filler/page.tsx src/app/idp-checker/page.tsx
git commit -m "feat(profile): add YourLeagues and FirstVisitPrompt to all tool pages"
```
