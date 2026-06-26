# UI Redesign: Dark Editorial + Light/Dark Toggle

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the site from a dark Sleeper-like UI to a "Dark Editorial" aesthetic with a forest green + amber palette, bolder typography, a light/dark mode toggle (dark default), and rename the "IDP Checker" tool to "Waiver Check" throughout.

**Architecture:** Add `next-themes` for theme management (class-based, `.dark` on `<html>`). Configure Tailwind v4 to use the `.dark` class instead of the media query. Update NavBar, Footer, landing page, and all Waiver Check page components to be dark/light aware using `dark:` utility prefixes. No layout restructuring — only color/typography tokens change.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4.3 (CSS-first config, no `tailwind.config.js`), `next-themes`, TypeScript 6

## Global Constraints

- Route `/idp-checker` stays the same — only the display label changes to "Waiver Check"
- Do NOT touch Trade Tracker, Standings, or Injury Tracker components — out of scope for this pass
- Dark mode is the default on first visit (`defaultTheme: "dark"`)
- Forest green = `green-700` (#15803d); amber = `amber-400` (dark mode), `amber-500` (light mode)
- `npm run build` and `npm run typecheck` must pass after every task commit
- No new tests required for these visual changes — verify via build + typecheck

---

## File Map

| File | Action |
|---|---|
| `package.json` | Add `next-themes` dependency |
| `src/app/globals.css` | Override dark variant to class-based; update body light/dark styles |
| `src/app/layout.tsx` | Wrap with `ThemeProvider`; add `suppressHydrationWarning` to `<html>` |
| `src/app/(components)/ThemeToggle.tsx` | **New** — sun/moon toggle button (client component) |
| `src/app/(components)/NavBar.jsx` | Rename "IDP Checker" → "Waiver Check"; amber active pill; add ThemeToggle; light-mode colors |
| `src/app/(components)/Footer.jsx` | Light/dark color tokens |
| `src/app/page.tsx` | Bolder typography; forest green + amber palette; rename IDP Checker tool card |
| `src/app/idp-checker/page.tsx` | Remove white wrapper; title → "Waiver Check"; dark-aware card surfaces |
| `src/components/idp-checker/LeagueInput.tsx` | Dark-aware colors |
| `src/components/idp-checker/PlayerInput.tsx` | Dark-aware colors; brand colors for tabs + submit button |
| `src/components/idp-checker/PlayerInput/PasteTab.tsx` | Dark-aware colors |
| `src/components/idp-checker/PlayerInput/ManualTab.tsx` | Dark-aware colors; dropdown |
| `src/components/idp-checker/PlayerInput/UploadTab.tsx` | Dark-aware colors; brand colors |
| `src/components/idp-checker/ResultsTable.tsx` | Dark-aware colors; dark-aware status badges |
| `src/components/idp-checker/Filters.tsx` | Dark-aware colors |
| `src/components/idp-checker/WaiverInfo.tsx` | Dark-aware colors |
| `src/components/idp-checker/UnmatchedPlayers.tsx` | Dark-aware warning colors |
| `src/components/idp-checker/ErrorBanner.tsx` | Dark-aware error colors |

---

## Task 1: Create branch + install next-themes

**Files:**
- Modify: `package.json` (via npm install)

**Interfaces:**
- Produces: `next-themes` available for import in layout and components

- [ ] **Step 1: Create the feature branch**

```bash
git checkout -b feat/ui-redesign-waiver-check
```

- [ ] **Step 2: Install next-themes**

```bash
npm install next-themes
```

- [ ] **Step 3: Verify the package was added**

```bash
grep next-themes package.json
```
Expected output: `"next-themes": "^x.x.x"` in dependencies

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install next-themes for light/dark toggle"
```

---

## Task 2: Theme infrastructure — globals.css, layout.tsx, ThemeToggle

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Create: `src/app/(components)/ThemeToggle.tsx`

**Interfaces:**
- Produces: `ThemeToggle` default export (no props); `ThemeProvider` wrapping the app; `dark:` Tailwind utilities respond to `.dark` class on `<html>`

- [ ] **Step 1: Update globals.css**

Replace the entire file at `src/app/globals.css`:

```css
@import 'tailwindcss';

/* Override the built-in dark variant to use the .dark class instead of prefers-color-scheme */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-pitch-700: #1f2937;
  --color-pitch-800: #111827;
  --color-pitch-900: #0b1120;

  --background-image-gradient-radial: radial-gradient(var(--tw-gradient-stops));
  --background-image-gradient-conic: conic-gradient(
    from 180deg at 50% 50%,
    var(--tw-gradient-stops)
  );
}

@layer base {
  *,
  ::after,
  ::before,
  ::backdrop,
  ::file-selector-button {
    border-color: var(--color-gray-200, currentcolor);
  }
}

@utility text-balance {
  text-wrap: balance;
}

@layer utilities {
  body {
    @apply bg-gray-50 text-gray-900 antialiased dark:bg-pitch-900 dark:text-slate-100;
  }
}
```

- [ ] **Step 2: Update layout.tsx**

Replace the entire file at `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import NavBar from "./(components)/NavBar";
import Footer from "./(components)/Footer";

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
        <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
          <NavBar />
          <div className="mx-auto max-w-[120rem] px-4 py-8">{children}</div>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Note: `suppressHydrationWarning` on `<html>` is required — next-themes mutates the `class` attribute on the server/client boundary, which would otherwise cause a hydration warning.

- [ ] **Step 3: Create ThemeToggle.tsx**

Create `src/app/(components)/ThemeToggle.tsx`:

```tsx
"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Render a placeholder during SSR to avoid layout shift
  if (!mounted) return <div className="h-8 w-8" />;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-pitch-800 dark:hover:text-white"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```
Expected: build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx src/app/(components)/ThemeToggle.tsx
git commit -m "feat: add theme infrastructure — next-themes provider, dark variant, ThemeToggle"
```

---

## Task 3: Update NavBar

**Files:**
- Modify: `src/app/(components)/NavBar.jsx`

**Interfaces:**
- Consumes: `ThemeToggle` from `src/app/(components)/ThemeToggle.tsx`
- Produces: Nav with "Waiver Check" label, amber active pill, ThemeToggle on right, light/dark aware

- [ ] **Step 1: Replace NavBar.jsx**

Replace the entire file at `src/app/(components)/NavBar.jsx`:

```jsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const links = [
  { href: "/", label: "Home" },
  { href: "/standings", label: "Standings" },
  { href: "/trade-tracker", label: "Trade Tracker" },
  { href: "/idp-checker", label: "Waiver Check" },
  { href: "/injury-tracker", label: "Injury Tracker" },
];

const NavBar = () => {
  const pathname = usePathname();

  const isActive = (href) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="border-b border-gray-200 bg-white/90 backdrop-blur-sm dark:border-pitch-700 dark:bg-pitch-900/80">
      <div className="mx-auto flex max-w-[120rem] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🏈</span>
          <span className="text-lg font-black tracking-tighter text-gray-900 dark:text-slate-100">
            IDP Dynasty HQ
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive(href)
                  ? "bg-amber-400 text-gray-900"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-pitch-800 dark:hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
```

- [ ] **Step 2: Verify build and typecheck**

```bash
npm run build && npm run typecheck
```
Expected: both pass with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(components)/NavBar.jsx
git commit -m "feat: update NavBar — Waiver Check label, amber active pill, theme toggle"
```

---

## Task 4: Update Footer

**Files:**
- Modify: `src/app/(components)/Footer.jsx`

**Interfaces:**
- Produces: Footer with light/dark aware border and text colors

- [ ] **Step 1: Replace Footer.jsx**

Replace the entire file at `src/app/(components)/Footer.jsx`:

```jsx
const Footer = () => {
  return (
    <footer className="mt-16 border-t border-gray-200 dark:border-pitch-700">
      <div className="mx-auto max-w-[120rem] px-4 py-6 text-sm text-gray-400 dark:text-slate-500">
        <p>Created by Michael Staubach.</p>
        <p className="mt-1">
          Not affiliated with Sleeper. Data from the public, read-only Sleeper
          API.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(components)/Footer.jsx
git commit -m "feat: update Footer with dark/light mode colors"
```

---

## Task 5: Update landing page

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Produces: Landing page with bolder typography, forest green + amber palette, light/dark aware cards, "Waiver Check" tool card

- [ ] **Step 1: Replace page.tsx**

Replace the entire file at `src/app/page.tsx`:

```tsx
import Link from "next/link";

const tools = [
  {
    href: "/standings",
    icon: "🏆",
    title: "League Standings",
    description:
      "Enter any Sleeper league ID to see its standings — wins, losses, and ties for every roster, pulled straight from Sleeper.",
    cta: "View standings",
  },
  {
    href: "/trade-tracker",
    icon: "🔁",
    title: "Trade Tracker",
    description:
      "See what your trades actually became. Follows every traded draft pick into the draft and shows exactly which player was selected with it.",
    cta: "Track a trade",
  },
  {
    href: "/idp-checker",
    icon: "🛡️",
    title: "Waiver Check",
    description:
      "Paste your IDP rankings or upload a CSV and instantly see which defensive players are still available on the waiver wire in your league.",
    cta: "Check waivers",
  },
  {
    href: "/injury-tracker",
    icon: "🚑",
    title: "Injury Tracker",
    description:
      "Keep tabs on injury news for the players on your rosters — practice status, game designations, and return timelines.",
    cta: "Coming soon",
    soon: true,
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl space-y-12">
      <section className="space-y-4 py-6 text-center">
        <span className="inline-block rounded-full bg-green-700/20 px-3 py-1 text-sm font-medium text-green-600 dark:text-green-400">
          For Sleeper IDP dynasty leagues
        </span>
        <h1 className="text-5xl font-black tracking-tighter sm:text-6xl text-gray-900 dark:text-slate-100">
          IDP Dynasty HQ
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-slate-300">
          One home for the fantasy football tools that used to live in four
          separate apps. Browse league standings, settle trade debates, and scout
          the IDP waiver wire — all powered by the public Sleeper API. No login,
          no API keys, just a league ID.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href="/trade-tracker"
            className="rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white transition hover:bg-green-600"
          >
            Track a trade
          </Link>
          <Link
            href="/idp-checker"
            className="rounded-lg border border-amber-400 px-5 py-2.5 font-semibold text-amber-500 transition hover:bg-amber-400/10 dark:text-amber-400"
          >
            Check waivers
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">
          The tools
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-green-600/60 hover:bg-gray-50 dark:border-pitch-700 dark:bg-pitch-800/50 dark:hover:border-green-600/60 dark:hover:bg-pitch-800"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="text-3xl">{tool.icon}</span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                  {tool.title}
                </h3>
                {tool.soon && (
                  <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                    Soon
                  </span>
                )}
              </div>
              <p className="flex-1 text-gray-600 dark:text-slate-300">
                {tool.description}
              </p>
              <span className="mt-4 text-sm font-semibold text-amber-500 group-hover:underline dark:text-amber-400">
                {tool.cta} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-500 dark:border-pitch-700 dark:bg-pitch-800/30 dark:text-slate-400">
        <h2 className="mb-2 text-base font-semibold text-gray-800 dark:text-slate-200">
          How it works
        </h2>
        <p>
          Every tool reads from the public, read-only Sleeper API. Find your
          league ID in your Sleeper URL
          (<code className="text-green-600 dark:text-green-400">sleeper.com/leagues/&lt;LEAGUE_ID&gt;</code>),
          drop it into the tool you want, and go. Nothing is stored and no account
          is required.
        </p>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify build and typecheck**

```bash
npm run build && npm run typecheck
```
Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: update landing page — bolder typography, green/amber palette, Waiver Check card"
```

---

## Task 6: Waiver Check page

**Files:**
- Modify: `src/app/idp-checker/page.tsx`

**Interfaces:**
- Produces: Page with "Waiver Check" title, dark-aware card surfaces, no jarring white wrapper in dark mode

- [ ] **Step 1: Replace idp-checker/page.tsx**

Replace the entire file at `src/app/idp-checker/page.tsx`:

```tsx
'use client';

import { useState, useCallback } from 'react';
import LeagueInput from '@/components/idp-checker/LeagueInput';
import PlayerInput from '@/components/idp-checker/PlayerInput';
import ResultsTable from '@/components/idp-checker/ResultsTable';
import Filters from '@/components/idp-checker/Filters';
import WaiverInfo from '@/components/idp-checker/WaiverInfo';
import UnmatchedPlayers from '@/components/idp-checker/UnmatchedPlayers';
import ErrorBanner from '@/components/idp-checker/ErrorBanner';
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
      <p className="text-gray-600 dark:text-slate-400 mb-6">
        Paste your IDP rankings and check player availability in your Sleeper league.
      </p>

      <div className="space-y-6">
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

- [ ] **Step 2: Verify build and typecheck**

```bash
npm run build && npm run typecheck
```
Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/idp-checker/page.tsx
git commit -m "feat: rename IDP Checker → Waiver Check, remove white wrapper, dark-aware cards"
```

---

## Task 7: Waiver Check sub-components — dark/light aware

**Files:**
- Modify: `src/components/idp-checker/LeagueInput.tsx`
- Modify: `src/components/idp-checker/PlayerInput.tsx`
- Modify: `src/components/idp-checker/PlayerInput/PasteTab.tsx`
- Modify: `src/components/idp-checker/PlayerInput/ManualTab.tsx`
- Modify: `src/components/idp-checker/PlayerInput/UploadTab.tsx`
- Modify: `src/components/idp-checker/ResultsTable.tsx`
- Modify: `src/components/idp-checker/Filters.tsx`
- Modify: `src/components/idp-checker/WaiverInfo.tsx`
- Modify: `src/components/idp-checker/UnmatchedPlayers.tsx`
- Modify: `src/components/idp-checker/ErrorBanner.tsx`

**Interfaces:**
- All components: visual changes only, props and logic unchanged

- [ ] **Step 1: Replace LeagueInput.tsx**

```tsx
'use client';

interface LeagueInputProps {
  leagueId: string;
  onChange: (id: string) => void;
}

export default function LeagueInput({ leagueId, onChange }: LeagueInputProps) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor="league-id" className="text-sm font-medium text-gray-700 dark:text-slate-300 whitespace-nowrap">
        Sleeper League ID
      </label>
      <input
        id="league-id"
        type="text"
        value={leagueId}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your Sleeper league ID"
        className="flex-1 px-3 py-2 border border-gray-300 dark:border-pitch-700 rounded-md text-sm text-gray-900 dark:text-slate-100 bg-white dark:bg-pitch-900 focus:ring-2 focus:ring-green-600 focus:border-green-600"
      />
    </div>
  );
}
```

- [ ] **Step 2: Replace PlayerInput.tsx**

```tsx
'use client';

import { useState, useCallback } from 'react';
import PasteTab from './PlayerInput/PasteTab';
import UploadTab from './PlayerInput/UploadTab';
import ManualTab from './PlayerInput/ManualTab';
import { ParsedPlayer } from '@/lib/idp-checker/types';
import { parseTextInput, parseCSV } from '@/lib/idp-checker/parser';

type Tab = 'paste' | 'upload' | 'manual';

interface PlayerInputProps {
  onSubmit: (players: ParsedPlayer[]) => void;
  isLoading: boolean;
}

export default function PlayerInput({ onSubmit, isLoading }: PlayerInputProps) {
  const [activeTab, setActiveTab] = useState<Tab>('paste');
  const [pasteValue, setPasteValue] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [manualPlayers, setManualPlayers] = useState<{ name: string; position?: string }[]>([]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'paste', label: 'Paste Text' },
    { key: 'upload', label: 'Upload File' },
    { key: 'manual', label: 'Manual Entry' },
  ];

  const handleSubmit = useCallback(() => {
    let players: ParsedPlayer[] = [];

    switch (activeTab) {
      case 'paste':
        players = parseTextInput(pasteValue);
        break;
      case 'upload':
        players = uploadContent.includes(',') ? parseCSV(uploadContent) : parseTextInput(uploadContent);
        break;
      case 'manual':
        players = manualPlayers.map((p, i) => ({
          name: p.name,
          position: p.position,
          rank: i + 1,
        }));
        break;
    }

    if (players.length === 0) return;
    onSubmit(players);
  }, [activeTab, pasteValue, uploadContent, manualPlayers, onSubmit]);

  const hasInput = activeTab === 'paste' ? pasteValue.trim().length > 0
    : activeTab === 'upload' ? uploadContent.length > 0
    : manualPlayers.length > 0;

  return (
    <div>
      <div className="flex border-b border-gray-200 dark:border-pitch-700 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-amber-400 text-amber-500 dark:text-amber-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'paste' && <PasteTab value={pasteValue} onChange={setPasteValue} />}
      {activeTab === 'upload' && <UploadTab onFileContent={(content) => setUploadContent(content)} />}
      {activeTab === 'manual' && (
        <ManualTab
          players={manualPlayers}
          onAdd={(name, position) => setManualPlayers(prev => [...prev, { name, position }])}
          onRemove={(i) => setManualPlayers(prev => prev.filter((_, idx) => idx !== i))}
        />
      )}

      <button
        onClick={handleSubmit}
        disabled={!hasInput || isLoading}
        className="mt-4 w-full px-4 py-2.5 bg-green-700 text-white text-sm font-medium rounded-md hover:bg-green-600 disabled:bg-gray-200 dark:disabled:bg-pitch-700 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Checking Availability...' : 'Check Availability'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Replace PlayerInput/PasteTab.tsx**

```tsx
'use client';

interface PasteTabProps {
  value: string;
  onChange: (value: string) => void;
}

export default function PasteTab({ value, onChange }: PasteTabProps) {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Paste your IDP rankings here...\n\nExamples:\n1. Patrick Queen LB BAL\n2. Roquan Smith LB BAL\n\nOr just names:\nPatrick Queen\nRoquan Smith`}
        className="w-full h-48 px-3 py-2 border border-gray-300 dark:border-pitch-700 rounded-md text-sm text-gray-900 dark:text-slate-100 bg-white dark:bg-pitch-900 font-mono focus:ring-2 focus:ring-green-600 focus:border-green-600 resize-y"
      />
      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Max 200 players. Supports numbered lists, tab-separated, comma-separated, or plain names.</p>
    </div>
  );
}
```

- [ ] **Step 4: Replace PlayerInput/ManualTab.tsx**

```tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';

interface AutocompletePlayer {
  id: string;
  name: string;
  position: string;
  team: string;
}

interface ManualTabProps {
  players: { name: string; position?: string }[];
  onAdd: (name: string, position?: string) => void;
  onRemove: (index: number) => void;
}

export default function ManualTab({ players, onAdd, onRemove }: ManualTabProps) {
  const [query, setQuery] = useState('');
  const [allPlayers, setAllPlayers] = useState<AutocompletePlayer[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/players')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAllPlayers(data);
      })
      .catch(() => {});
  }, []);

  const suggestions = useMemo<AutocompletePlayer[]>(() => {
    if (query.length < 2) return [];
    const lower = query.toLowerCase();
    return allPlayers
      .filter(p => p.name.toLowerCase().includes(lower))
      .slice(0, 8);
  }, [query, allPlayers]);

  const handleSelect = (player: AutocompletePlayer) => {
    onAdd(player.name, player.position);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault();
      if (suggestions.length > 0) {
        handleSelect(suggestions[0]);
      } else {
        onAdd(query.trim());
        setQuery('');
      }
    }
  };

  return (
    <div>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Type a player name..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-pitch-700 rounded-md text-sm text-gray-900 dark:text-slate-100 bg-white dark:bg-pitch-900 focus:ring-2 focus:ring-green-600 focus:border-green-600"
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-pitch-800 border border-gray-200 dark:border-pitch-700 rounded-md shadow-lg max-h-48 overflow-auto">
            {suggestions.map((p) => (
              <li
                key={p.id}
                onMouseDown={() => handleSelect(p)}
                className="px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-pitch-700 cursor-pointer flex justify-between text-gray-900 dark:text-slate-100"
              >
                <span>{p.name}</span>
                <span className="text-gray-400 dark:text-slate-500">{p.position} - {p.team}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {players.length > 0 && (
        <div className="mt-3 space-y-1">
          {players.map((p, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-pitch-900 px-3 py-1.5 rounded-sm text-sm text-gray-900 dark:text-slate-100">
              <span>{i + 1}. {p.name} {p.position && <span className="text-gray-400 dark:text-slate-500">({p.position})</span>}</span>
              <button onClick={() => onRemove(i)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">Type to search, press Enter to add. Max 200 players.</p>
    </div>
  );
}
```

- [ ] **Step 5: Replace PlayerInput/UploadTab.tsx**

```tsx
'use client';

import { useCallback, useState } from 'react';

interface UploadTabProps {
  onFileContent: (content: string, fileName: string) => void;
}

export default function UploadTab({ onFileContent }: UploadTabProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (file.size > 1_000_000) {
      alert('File must be under 1MB');
      return;
    }
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      alert('Only .csv and .txt files are supported');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFileName(file.name);
      onFileContent(content, file.name);
    };
    reader.readAsText(file);
  }, [onFileContent]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-md p-8 text-center transition-colors ${
        dragOver
          ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
          : 'border-gray-300 dark:border-pitch-700'
      }`}
    >
      {fileName ? (
        <p className="text-sm text-gray-700 dark:text-slate-300">Loaded: <strong>{fileName}</strong></p>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-2">Drag and drop a .csv or .txt file here</p>
          <label className="inline-block px-4 py-2 bg-green-700 text-white text-sm rounded-md cursor-pointer hover:bg-green-600">
            Choose File
            <input
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">Max 1MB. CSV or TXT files.</p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Replace ResultsTable.tsx**

```tsx
'use client';

import { PlayerResult } from '@/lib/idp-checker/types';
import { getPositionGroup } from '@/lib/idp-checker/types';

interface ResultsTableProps {
  results: PlayerResult[];
  positionFilter: string;
  availableOnly: boolean;
}

export default function ResultsTable({ results, positionFilter, availableOnly }: ResultsTableProps) {
  const filtered = results.filter((r) => {
    if (availableOnly && !r.available) return false;
    if (positionFilter !== 'ALL' && r.matchedPlayer) {
      const group = getPositionGroup(r.matchedPlayer.position);
      if (group !== positionFilter) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-8">No players match the current filters.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-pitch-700 text-left">
            <th className="px-3 py-2 font-medium text-gray-500 dark:text-slate-400">Rank</th>
            <th className="px-3 py-2 font-medium text-gray-500 dark:text-slate-400">Tier</th>
            <th className="px-3 py-2 font-medium text-gray-500 dark:text-slate-400">Player</th>
            <th className="px-3 py-2 font-medium text-gray-500 dark:text-slate-400">Pos</th>
            <th className="px-3 py-2 font-medium text-gray-500 dark:text-slate-400">NFL Team</th>
            <th className="px-3 py-2 font-medium text-gray-500 dark:text-slate-400">Status</th>
            <th className="px-3 py-2 font-medium text-gray-500 dark:text-slate-400">Rostered By</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-pitch-700/50 hover:bg-gray-50 dark:hover:bg-pitch-900/50">
              <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{r.rank ?? '—'}</td>
              <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{r.tier ? `T${r.tier}` : '—'}</td>
              <td className="px-3 py-2 font-medium text-gray-900 dark:text-slate-100">
                {r.matchedPlayer?.name ?? r.inputName}
              </td>
              <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{r.matchedPlayer?.position ?? '—'}</td>
              <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{r.matchedPlayer?.team ?? '—'}</td>
              <td className="px-3 py-2">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  r.available
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {r.available ? 'Available' : 'Rostered'}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{r.rosteredBy?.teamName ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 7: Replace Filters.tsx**

```tsx
'use client';

interface FiltersProps {
  positionFilter: string;
  onPositionChange: (value: string) => void;
  availableOnly: boolean;
  onAvailableOnlyChange: (value: boolean) => void;
}

export default function Filters({
  positionFilter,
  onPositionChange,
  availableOnly,
  onAvailableOnlyChange,
}: FiltersProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <label htmlFor="pos-filter" className="text-sm text-gray-600 dark:text-slate-400">Position:</label>
        <select
          id="pos-filter"
          value={positionFilter}
          onChange={(e) => onPositionChange(e.target.value)}
          className="px-2 py-1.5 border border-gray-300 dark:border-pitch-700 rounded-md text-sm bg-white dark:bg-pitch-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-green-600"
        >
          <option value="ALL">All</option>
          <option value="LB">LB</option>
          <option value="DL">DL (DE/DT)</option>
          <option value="DB">DB (CB/S)</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400 cursor-pointer">
        <input
          type="checkbox"
          checked={availableOnly}
          onChange={(e) => onAvailableOnlyChange(e.target.checked)}
          className="rounded-sm border-gray-300 dark:border-pitch-700 text-green-700 focus:ring-green-600"
        />
        Available only
      </label>
    </div>
  );
}
```

- [ ] **Step 8: Replace WaiverInfo.tsx**

```tsx
'use client';

import { WaiverInfo as WaiverInfoType } from '@/lib/idp-checker/types';

interface WaiverInfoProps {
  waiverInfo: WaiverInfoType;
}

export default function WaiverInfo({ waiverInfo }: WaiverInfoProps) {
  return (
    <div className="bg-gray-50 dark:bg-pitch-900 rounded-md p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
        Waiver Info — {waiverInfo.type === 'faab' ? 'FAAB' : waiverInfo.type === 'rolling' ? 'Rolling Waivers' : 'Unknown Type'}
      </h3>

      {waiverInfo.type === 'faab' && waiverInfo.faabBudgets && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {waiverInfo.faabBudgets
            .sort((a, b) => b.remaining - a.remaining)
            .map((team, i) => (
              <div key={i} className="bg-white dark:bg-pitch-800 border border-gray-200 dark:border-pitch-700 rounded-sm px-3 py-2 text-xs">
                <div className="font-medium text-gray-700 dark:text-slate-300 truncate">{team.teamName}</div>
                <div className="text-gray-500 dark:text-slate-500">${team.remaining} remaining</div>
              </div>
            ))}
        </div>
      )}

      {waiverInfo.type === 'rolling' && waiverInfo.waiverOrder && (
        <ol className="space-y-1">
          {waiverInfo.waiverOrder.map((team, i) => (
            <li key={i} className="text-xs text-gray-600 dark:text-slate-400">
              <span className="font-medium text-gray-700 dark:text-slate-300">{team.priority}.</span> {team.teamName}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Replace UnmatchedPlayers.tsx**

```tsx
interface UnmatchedPlayersProps {
  players: string[];
}

export default function UnmatchedPlayers({ players }: UnmatchedPlayersProps) {
  if (players.length === 0) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
      <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">
        Unmatched Players ({players.length})
      </h3>
      <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">
        These players could not be matched in the Sleeper database. Check for typos.
      </p>
      <ul className="space-y-1">
        {players.map((name, i) => (
          <li key={i} className="text-xs text-yellow-700 dark:text-yellow-400">{name}</li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 10: Replace ErrorBanner.tsx**

```tsx
interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export default function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 flex items-start justify-between">
      <div className="flex items-start gap-2">
        <span className="text-red-500 dark:text-red-400 font-bold">!</span>
        <p className="text-sm text-red-700 dark:text-red-400">{message}</p>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-sm">
          Dismiss
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 11: Verify build and typecheck**

```bash
npm run build && npm run typecheck
```
Expected: both pass with no errors.

- [ ] **Step 12: Run tests**

```bash
npm test
```
Expected: all existing tests pass (these are logic tests for idp-checker lib — no UI tests exist).

- [ ] **Step 13: Commit**

```bash
git add src/components/idp-checker/
git commit -m "feat: make all Waiver Check sub-components dark/light aware"
```

---

## Task 8: Final verification

**Files:** None modified

- [ ] **Step 1: Full build + typecheck + lint**

```bash
npm run build && npm run typecheck && npm run lint
```
Expected: all three pass cleanly.

- [ ] **Step 2: Run dev server and verify visually**

```bash
npm run dev
```

Open `http://localhost:3000` and verify:
- Dark mode is active on first load (no flash of light mode)
- NavBar shows "Waiver Check" instead of "IDP Checker"
- Active nav link uses amber pill
- Theme toggle (sun icon in dark mode) appears on the right of the nav
- Clicking toggle switches to light mode: white background, gray-900 text, same green/amber accents
- Preference persists across page navigation and reloads
- `/idp-checker` page: no white box artifact in dark mode; title reads "Waiver Check"
- Landing page: larger bold heading, forest green badge, green primary CTA, amber secondary CTA, amber card arrows

- [ ] **Step 3: Open a PR**

```bash
git push -u origin feat/ui-redesign-waiver-check
gh pr create --title "UI redesign: Dark Editorial + light/dark toggle + Waiver Check rename" --body "$(cat <<'EOF'
## Summary
- Adds light/dark mode toggle (dark default) via next-themes
- Evolves palette from Sleeper-inspired emerald to forest green + amber
- Bolder typography (font-black, tracking-tighter) on headings throughout
- Renames "IDP Checker" → "Waiver Check" in nav, landing page, and page title
- Fixes jarring white-box artifact on Waiver Check page in dark mode
- All Waiver Check sub-components are now dark/light aware

## Test plan
- [ ] Dark mode active on first visit, no flash of light mode
- [ ] Theme toggle in nav switches between dark and light
- [ ] Preference persists across page navigation and browser reloads
- [ ] "Waiver Check" label appears in nav and on the tool page
- [ ] No white-box artifact on /idp-checker in dark mode
- [ ] `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` all pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
