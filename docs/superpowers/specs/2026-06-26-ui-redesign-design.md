# UI Redesign: Dark Editorial + Light/Dark Toggle

**Date:** 2026-06-26
**Status:** Approved

## Goal

Evolve the site's visual style from a Sleeper-inspired dark UI to a "Dark Editorial" aesthetic drawing from The IDP Show (theidpshow.com) — bold typography, forest green + amber palette, cleaner card surfaces — while keeping the dark background as the foundation. Add a light/dark mode toggle with dark as the default.

Also rename the IDP Checker tool to "Waiver Check" throughout the site.

---

## Color System

### Dark Mode (default)

| Role | Token | Hex |
|---|---|---|
| Page background | `pitch-900` | #0b1120 |
| Surface (cards) | `pitch-800` | #111827 |
| Border | `pitch-700` | #1f2937 |
| Primary accent | `green-700` | #15803d |
| Secondary accent / active | `amber-400` | #fbbf24 |
| Primary text | `slate-100` | #f1f5f9 |
| Secondary text | `slate-300` | #cbd5e1 |
| Muted text | `slate-500` | #64748b |

### Light Mode

| Role | Token | Hex |
|---|---|---|
| Page background | `gray-50` | #f9fafb |
| Surface (cards) | `white` | #ffffff |
| Border | `gray-200` | #e5e7eb |
| Primary accent | `green-700` | #15803d |
| Secondary accent / active | `amber-500` | #f59e0b |
| Primary text | `gray-900` | #111827 |
| Secondary text | `gray-600` | #4b5563 |
| Muted text | `gray-400` | #9ca3af |

The two accents (forest green, amber) are shared across both modes; only brightness/saturation adjusts slightly for light-mode contrast.

---

## Typography

All fonts remain Inter. Changes from current:

- `h1` headings: `font-black tracking-tighter` (up from `font-extrabold tracking-tight`)
- `h2` section headings: `font-bold tracking-tight` (unchanged weight, add tighter tracking)
- Nav wordmark: `font-black` (up from `font-extrabold`)
- Body/description text: unchanged

---

## Component Changes

### NavBar (`src/app/(components)/NavBar.jsx`)

- Rename link label "IDP Checker" → "Waiver Check" (href stays `/idp-checker`)
- Active link pill: `bg-amber-400 text-gray-900` (replaces `bg-emerald-600 text-white`)
- Inactive links: same hover behavior, color tokens updated for light/dark
- Add **theme toggle button** to the right of the nav links:
  - Sun icon in dark mode, moon icon in light mode
  - Uses `useTheme()` from `next-themes`
  - Icon size: `w-5 h-5`, styled as a ghost button
- Light mode nav: `bg-white border-gray-200`, dark mode: keep `bg-pitch-900/80 border-pitch-700`

### Footer (`src/app/(components)/Footer.jsx`)

- Light mode: `bg-white border-gray-200 text-gray-400`
- Dark mode: unchanged (`border-pitch-700 text-slate-500`)

### Landing Page (`src/app/page.tsx`)

- Hero `h1`: bump to `text-5xl sm:text-6xl font-black tracking-tighter`
- Badge: switch from `bg-emerald-600/20 text-emerald-400` to `bg-green-700/20 text-green-400`
- Primary CTA button: `bg-green-700 hover:bg-green-600` (replaces emerald)
- Secondary CTA button: `border-amber-400 text-amber-400 hover:bg-amber-400/10` (replaces pitch-800 border)
- Tool card "IDP Availability Checker": rename title to "Waiver Check", update CTA text to "Check waivers"
- Tool card hover border: `hover:border-green-600/60` (replaces emerald)
- Tool card CTA arrow text: `text-amber-400` (replaces emerald)
- Light mode cards: `bg-white border-gray-200 hover:border-green-600/60`

### Waiver Check Page (`src/app/idp-checker/page.tsx`)

- Remove the `bg-gray-50 text-gray-900 rounded-2xl border border-pitch-700` wrapper div — this creates a jarring white box inside the dark layout.
- Page `h1`: "Waiver Check" (replaces "Sleeper IDP Availability Checker")
- Page subtitle: "Paste your IDP rankings and check player availability in your Sleeper league." (unchanged)
- Inner cards (`LeagueInput`, `PlayerInput`, results, `WaiverInfo`): change from `bg-white border` to `bg-pitch-800 border border-pitch-700` in dark mode, `bg-white border border-gray-200` in light mode
- All text inside cards: drop hardcoded `text-gray-900` / `text-gray-600` classes; let theme cascade

### IDP Checker Sub-components

The following components contain hardcoded light-mode colors that must be updated to be theme-aware:

- `src/components/idp-checker/LeagueInput.tsx`
- `src/components/idp-checker/PlayerInput.tsx` (and sub-tabs)
- `src/components/idp-checker/ResultsTable.tsx`
- `src/components/idp-checker/Filters.tsx`
- `src/components/idp-checker/WaiverInfo.tsx`
- `src/components/idp-checker/UnmatchedPlayers.tsx`
- `src/components/idp-checker/ErrorBanner.tsx`

Each needs hardcoded `text-gray-*`, `bg-white`, `border-gray-*` classes replaced with dark/light equivalents using Tailwind's `dark:` prefix.

---

## Theme Infrastructure

### Package

Add `next-themes` to dependencies.

### `src/app/layout.tsx`

Wrap `<body>` children with `<ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>` from `next-themes`. Move `<NavBar>` and `<Footer>` inside the provider.

### `src/app/globals.css`

Add Tailwind v4 class-based dark mode variant:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Update `body` base styles to be theme-aware via `dark:` utilities rather than hardcoded dark-only values.

---

## Scope Boundaries

- **In scope:** NavBar, Footer, landing page, Waiver Check page and its sub-components, globals.css, layout.tsx
- **Out of scope:** Trade Tracker pages/components, Standings pages/components, Injury Tracker placeholder — these can be updated in a follow-up pass once the pattern is established
- **Route unchanged:** `/idp-checker` URL stays the same; only the display label changes to "Waiver Check"
- **No font change:** Inter stays; only weight/tracking adjustments

---

## Success Criteria

1. Dark mode is the default on first visit
2. Toggle in NavBar switches between dark and light; preference persists across page navigation (next-themes handles this via localStorage)
3. No white-box artifact on the Waiver Check page in dark mode
4. NavBar shows "Waiver Check" instead of "IDP Checker"
5. Forest green + amber palette visible throughout (active nav, CTAs, card hovers)
6. `npm run build` and `npm run typecheck` pass cleanly
