# Roster Management UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add slot usage counts, drag-and-drop position correction for dual-eligible IDP players, and full player names to the roster management depth chart tool.

**Architecture:** `buildDepthChart` (pure, in `src/lib/roster-management/depth-chart.ts`) changes its cell shape from a plain display-name string to a `DepthChartCell` object carrying `playerId`, `displayName`, and `eligiblePositions`, plus gains an optional `overrides` map so a corrected column assignment can be re-applied on every rebuild. `DepthChartTable` becomes a client component that owns the `overrides` state (persisted to `localStorage`), recomputes the grid via `useMemo`, and wraps rendering in a `@dnd-kit/core` `DndContext`. A new sibling module, `roster-counts.ts`, computes used/total slot counts independently of the grid.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Vitest + Testing Library, Tailwind. New dependency: `@dnd-kit/core`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-05-roster-management-ux-design.md` — follow it for anything not spelled out below.
- Persistence for drag corrections is `localStorage`, keyed `roster-mgmt:overrides:{leagueId}:{rosterId}` — not session-only.
- Only one new dependency is in scope: `@dnd-kit/core`. Do not add `@dnd-kit/sortable`, `@dnd-kit/utilities`, or any other DnD package.
- Drag-and-drop only corrects which position *column* a player sits in within a section (Starting/Bench/Taxi/IR). It must never move a player between sections — this tool has no write access to Sleeper.
- Full keyboard-operable drag-and-drop (a custom `coordinateGetter`) is explicitly out of scope for this iteration — mouse/touch pointer only. Don't add it.
- `src/lib/roster-management/` and `src/components/roster-management/` stay isolated from idp-checker/trade-tracker per this repo's per-tool namespacing convention (see `CLAUDE.md`) — do not import from or share code with those tools' clients.
- Run `npm run lint`, `npm run typecheck`, and `npm test` locally before pushing (CI does not run tests). Run `npm audit` before opening the PR.
- One commit per task below (small, focused, in the order given) — matches this repo's established commit convention.

---

### Task 0: Create the feature branch

**Files:** none (git operation only)

- [ ] **Step 1: Confirm the working tree is clean and on `main`**

Run: `git status`
Expected: `On branch main`, `nothing to commit, working tree clean`

- [ ] **Step 2: Create and switch to the feature branch**

Run: `git switch -c feature/roster-management-ux main`
Expected: `Switched to a new branch 'feature/roster-management-ux'`

---

### Task 1: Show full player names instead of last-name-only

**Files:**
- Modify: `src/lib/roster-management/depth-chart.ts:43-67` (the `buildDisplayNames` function)
- Test: `__tests__/roster-management/lib/depth-chart.test.ts:149-162` (the disambiguation test)

**Interfaces:**
- Consumes: nothing new.
- Produces: `buildDisplayNames` still returns `Map<string, string>` keyed by player id — only the string values change (full name instead of last name / initialed last name). No other task depends on its internals changing further.

- [ ] **Step 1: Write the failing test**

In `__tests__/roster-management/lib/depth-chart.test.ts`, replace the test named `"disambiguates players sharing a last name with first initial"` with:

```ts
  it("shows each player's full first and last name", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: ["5"],
      players: ["5", "6"],
      taxi: null,
      reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting.rows[0][POSITIONS.indexOf("WR")]).toBe("Tyler Williams");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/roster-management/lib/depth-chart.test.ts -t "full first and last name"`
Expected: FAIL — actual value is `"T. Williams"`, not `"Tyler Williams"`.

- [ ] **Step 3: Simplify `buildDisplayNames`**

In `src/lib/roster-management/depth-chart.ts`, replace the entire `buildDisplayNames` function with:

```ts
function buildDisplayNames(
  playerIds: string[],
  players: Record<string, SleeperPlayer>,
): Map<string, string> {
  const result = new Map<string, string>();
  for (const id of playerIds) {
    const p = players[id];
    if (!p?.last_name) continue;
    result.set(id, p.first_name ? `${p.first_name} ${p.last_name}` : p.last_name);
  }
  return result;
}
```

This removes the last-name-count/ambiguity-abbreviation logic entirely — full names naturally disambiguate common surnames.

- [ ] **Step 4: Run the full depth-chart test suite to verify it passes**

Run: `npx vitest run __tests__/roster-management/lib/depth-chart.test.ts`
Expected: PASS (all tests, including the earlier ones asserting `"Herbert"`, `"McCaffrey"`, etc. — those assertions still pass because those players have no `first_name`... wait, they do. Re-check Step 5.)

- [ ] **Step 5: Update remaining assertions that still expect last-name-only**

The existing tests assert last-name-only values (e.g. `.toBe("Herbert")`). Update every such assertion in `__tests__/roster-management/lib/depth-chart.test.ts` to the full name, matching the `PLAYERS` fixture already in the file:

- `"Herbert"` → `"Justin Herbert"`
- `"McCaffrey"` → `"Christian McCaffrey"`
- `"Adams"` → `"Davante Adams"`
- `"Kelce"` → `"Travis Kelce"` (both occurrences: the Bench test and the IR test)
- `"Parsons"` → `"Micah Parsons"`
- `"Garrett"` → `"Myles Garrett"`

Leave `"Tucker"`'s test alone — the kicker test never asserts a display name (it asserts `grid.sections` is empty).

- [ ] **Step 6: Run the full test suite to verify it passes**

Run: `npx vitest run __tests__/roster-management/lib/depth-chart.test.ts`
Expected: PASS (all tests)

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0 with no errors

- [ ] **Step 8: Commit**

```bash
git add src/lib/roster-management/depth-chart.ts __tests__/roster-management/lib/depth-chart.test.ts
git commit -m "feat(roster-management): show full player names instead of last name only"
```

---

### Task 2: Extract `deriveBenchIds` and add `computeRosterCounts`

**Files:**
- Modify: `src/lib/roster-management/types.ts` (add `settings` to `SleeperLeague`)
- Modify: `src/lib/roster-management/depth-chart.ts` (extract `deriveBenchIds`)
- Create: `src/lib/roster-management/roster-counts.ts`
- Test: `__tests__/roster-management/lib/roster-counts.test.ts`

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces: `deriveBenchIds(roster: SleeperRoster): string[]` (exported from `depth-chart.ts`, used by `roster-counts.ts` and internally by `buildDepthChart`). `computeRosterCounts(roster: SleeperRoster, players: Record<string, SleeperPlayer>, rosterPositions: string[], settings: SleeperLeague["settings"]): RosterCounts` and the `RosterCounts`/`SlotCount` types (exported from `roster-counts.ts`) — Task 3 and Task 4 depend on these exact names and signature.

- [ ] **Step 1: Add `settings` to the `SleeperLeague` type**

In `src/lib/roster-management/types.ts`, replace:

```ts
export type SleeperLeague = {
  name: string;
  roster_positions: string[];
};
```

with:

```ts
export type SleeperLeague = {
  name: string;
  roster_positions: string[];
  settings: {
    taxi_slots?: number;
    reserve_slots?: number;
  };
};
```

- [ ] **Step 2: Extract `deriveBenchIds` in `depth-chart.ts`**

In `src/lib/roster-management/depth-chart.ts`, replace the start of `buildDepthChart`:

```ts
export function buildDepthChart(
  roster: SleeperRoster,
  players: Record<string, SleeperPlayer>,
  positions: string[],
): DepthChartGrid {
  const taxiSet = new Set(roster.taxi ?? []);
  const reserveSet = new Set(roster.reserve ?? []);
  const starterSet = new Set(roster.starters);

  const bench = roster.players.filter(
    (id) => !starterSet.has(id) && !taxiSet.has(id) && !reserveSet.has(id),
  );
```

with:

```ts
export function deriveBenchIds(roster: SleeperRoster): string[] {
  const taxiSet = new Set(roster.taxi ?? []);
  const reserveSet = new Set(roster.reserve ?? []);
  const starterSet = new Set(roster.starters);
  return roster.players.filter(
    (id) => !starterSet.has(id) && !taxiSet.has(id) && !reserveSet.has(id),
  );
}

export function buildDepthChart(
  roster: SleeperRoster,
  players: Record<string, SleeperPlayer>,
  positions: string[],
): DepthChartGrid {
  const bench = deriveBenchIds(roster);
```

This is a pure refactor — behavior is unchanged, so the existing depth-chart test suite should still pass without modification.

- [ ] **Step 3: Run the depth-chart tests to confirm no regression**

Run: `npx vitest run __tests__/roster-management/lib/depth-chart.test.ts`
Expected: PASS (all tests, unchanged from Task 1's end state)

- [ ] **Step 4: Write the failing roster-counts test**

Create `__tests__/roster-management/lib/roster-counts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeRosterCounts } from "@/lib/roster-management/roster-counts";
import type { SleeperPlayer, SleeperRoster } from "@/lib/roster-management/types";

const PLAYERS: Record<string, SleeperPlayer> = {
  "1": { player_id: "1", first_name: "Justin", last_name: "Herbert", position: "QB" },
  "2": { player_id: "2", first_name: "Christian", last_name: "McCaffrey", position: "RB" },
  "3": { player_id: "3", first_name: "Davante", last_name: "Adams", position: "WR" },
  "4": { player_id: "4", first_name: "Travis", last_name: "Kelce", position: "TE" },
};

const ROSTER_POSITIONS = ["QB", "RB", "WR", "TE", "FLEX", "BN", "BN", "BN"];

describe("computeRosterCounts", () => {
  it("counts starting slots used vs total, ignoring empty '0' slots", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["1", "2", "0"], players: ["1", "2"], taxi: null, reserve: null,
    };
    const counts = computeRosterCounts(roster, PLAYERS, ROSTER_POSITIONS, {});
    expect(counts.starting).toEqual({ used: 2, total: 3 });
  });

  it("counts bench slots from players not in starters, taxi, or reserve", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["1"], players: ["1", "3", "4"], taxi: null, reserve: null,
    };
    const counts = computeRosterCounts(roster, PLAYERS, ROSTER_POSITIONS, {});
    expect(counts.bench).toEqual({ used: 2, total: 3 });
  });

  it("counts taxi slots against the league's taxi_slots setting", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: [], players: ["3"], taxi: ["3"], reserve: null,
    };
    const counts = computeRosterCounts(roster, PLAYERS, ROSTER_POSITIONS, { taxi_slots: 4 });
    expect(counts.taxi).toEqual({ used: 1, total: 4 });
  });

  it("counts IR slots against the league's reserve_slots setting", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: [], players: ["4"], taxi: null, reserve: ["4"],
    };
    const counts = computeRosterCounts(roster, PLAYERS, ROSTER_POSITIONS, { reserve_slots: 2 });
    expect(counts.ir).toEqual({ used: 1, total: 2 });
  });

  it("reports a zero total when the league has no taxi or IR settings", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: [], players: [], taxi: null, reserve: null,
    };
    const counts = computeRosterCounts(roster, PLAYERS, ROSTER_POSITIONS, {});
    expect(counts.taxi).toEqual({ used: 0, total: 0 });
    expect(counts.ir).toEqual({ used: 0, total: 0 });
  });

  it("excludes unknown player ids and the '0' sentinel from used counts", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: [], players: [], taxi: ["999", "0"], reserve: null,
    };
    const counts = computeRosterCounts(roster, PLAYERS, ROSTER_POSITIONS, { taxi_slots: 4 });
    expect(counts.taxi).toEqual({ used: 0, total: 4 });
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npx vitest run __tests__/roster-management/lib/roster-counts.test.ts`
Expected: FAIL with a module-not-found error for `@/lib/roster-management/roster-counts`

- [ ] **Step 6: Implement `roster-counts.ts`**

Create `src/lib/roster-management/roster-counts.ts`:

```ts
import type { SleeperLeague, SleeperPlayer, SleeperRoster } from "./types";
import { deriveBenchIds } from "./depth-chart";

export type SlotCount = { used: number; total: number };

export type RosterCounts = {
  starting: SlotCount;
  bench: SlotCount;
  taxi: SlotCount;
  ir: SlotCount;
};

function countValid(ids: string[], players: Record<string, SleeperPlayer>): number {
  return ids.filter((id) => id !== "0" && players[id]).length;
}

export function computeRosterCounts(
  roster: SleeperRoster,
  players: Record<string, SleeperPlayer>,
  rosterPositions: string[],
  settings: SleeperLeague["settings"],
): RosterCounts {
  const bench = deriveBenchIds(roster);
  const benchTotal = rosterPositions.filter((p) => p === "BN").length;

  return {
    starting: { used: countValid(roster.starters, players), total: roster.starters.length },
    bench: { used: countValid(bench, players), total: benchTotal },
    taxi: { used: countValid(roster.taxi ?? [], players), total: settings.taxi_slots ?? 0 },
    ir: { used: countValid(roster.reserve ?? [], players), total: settings.reserve_slots ?? 0 },
  };
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run __tests__/roster-management/lib/roster-counts.test.ts`
Expected: PASS (all 6 tests)

- [ ] **Step 8: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0 with no errors

- [ ] **Step 9: Commit**

```bash
git add src/lib/roster-management/types.ts src/lib/roster-management/depth-chart.ts src/lib/roster-management/roster-counts.ts __tests__/roster-management/lib/roster-counts.test.ts
git commit -m "feat(roster-management): add computeRosterCounts for slot usage math"
```

---

### Task 3: Add the `RosterCountsSummary` component

**Files:**
- Create: `src/components/roster-management/RosterCountsSummary.tsx`
- Test: `__tests__/roster-management/RosterCountsSummary.test.tsx`

**Interfaces:**
- Consumes: `RosterCounts` type from `@/lib/roster-management/roster-counts` (Task 2).
- Produces: default export `RosterCountsSummary({ counts: RosterCounts })` — Task 4 renders this.

- [ ] **Step 1: Write the failing test**

Create `__tests__/roster-management/RosterCountsSummary.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import RosterCountsSummary from "@/components/roster-management/RosterCountsSummary";
import type { RosterCounts } from "@/lib/roster-management/roster-counts";

afterEach(cleanup);

describe("RosterCountsSummary", () => {
  it("renders a badge for each section with a nonzero total", () => {
    const counts: RosterCounts = {
      starting: { used: 9, total: 9 },
      bench: { used: 6, total: 8 },
      taxi: { used: 3, total: 4 },
      ir: { used: 1, total: 2 },
    };
    render(<RosterCountsSummary counts={counts} />);
    expect(screen.getByText("Starting 9/9")).toBeTruthy();
    expect(screen.getByText("Bench 6/8")).toBeTruthy();
    expect(screen.getByText("Taxi 3/4")).toBeTruthy();
    expect(screen.getByText("IR 1/2")).toBeTruthy();
  });

  it("hides badges whose total is zero", () => {
    const counts: RosterCounts = {
      starting: { used: 9, total: 9 },
      bench: { used: 6, total: 8 },
      taxi: { used: 0, total: 0 },
      ir: { used: 0, total: 0 },
    };
    render(<RosterCountsSummary counts={counts} />);
    expect(screen.queryByText(/Taxi/)).toBeNull();
    expect(screen.queryByText(/IR/)).toBeNull();
  });

  it("renders nothing when every section total is zero", () => {
    const counts: RosterCounts = {
      starting: { used: 0, total: 0 },
      bench: { used: 0, total: 0 },
      taxi: { used: 0, total: 0 },
      ir: { used: 0, total: 0 },
    };
    const { container } = render(<RosterCountsSummary counts={counts} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run __tests__/roster-management/RosterCountsSummary.test.tsx`
Expected: FAIL with a module-not-found error for `@/components/roster-management/RosterCountsSummary`

- [ ] **Step 3: Implement the component**

Create `src/components/roster-management/RosterCountsSummary.tsx`:

```tsx
import type { RosterCounts, SlotCount } from "@/lib/roster-management/roster-counts";

function Badge({ label, slot }: { label: string; slot: SlotCount }) {
  return (
    <span className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-300">
      {label} {slot.used}/{slot.total}
    </span>
  );
}

export default function RosterCountsSummary({ counts }: { counts: RosterCounts }) {
  const sections: Array<[string, SlotCount]> = [
    ["Starting", counts.starting],
    ["Bench", counts.bench],
    ["Taxi", counts.taxi],
    ["IR", counts.ir],
  ];
  const visible = sections.filter(([, slot]) => slot.total > 0);
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map(([label, slot]) => (
        <Badge key={label} label={label} slot={slot} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/roster-management/RosterCountsSummary.test.tsx`
Expected: PASS (all 3 tests)

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0 with no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/roster-management/RosterCountsSummary.tsx __tests__/roster-management/RosterCountsSummary.test.tsx
git commit -m "feat(roster-management): add RosterCountsSummary badge row"
```

---

### Task 4: Wire slot counts into the depth chart page

**Files:**
- Modify: `src/app/roster-management/[leagueId]/[rosterId]/page.tsx`

**Interfaces:**
- Consumes: `computeRosterCounts` (Task 2), `RosterCountsSummary` (Task 3).
- Produces: nothing new for later tasks — Task 8 rewrites this file again for the drag-and-drop wiring, but that rewrite keeps everything this task adds.

- [ ] **Step 1: Add the new imports**

In `src/app/roster-management/[leagueId]/[rosterId]/page.tsx`, replace:

```tsx
import Link from "next/link";
import DepthChartTable from "@/components/roster-management/DepthChartTable";
import {
  getLeague,
  getRosters,
  getUsers,
  getPlayers,
} from "@/lib/roster-management/sleeper";
import {
  buildDepthChart,
  derivePositionColumns,
} from "@/lib/roster-management/depth-chart";
```

with:

```tsx
import Link from "next/link";
import DepthChartTable from "@/components/roster-management/DepthChartTable";
import RosterCountsSummary from "@/components/roster-management/RosterCountsSummary";
import {
  getLeague,
  getRosters,
  getUsers,
  getPlayers,
} from "@/lib/roster-management/sleeper";
import {
  buildDepthChart,
  derivePositionColumns,
} from "@/lib/roster-management/depth-chart";
import { computeRosterCounts } from "@/lib/roster-management/roster-counts";
```

- [ ] **Step 2: Compute counts and render the summary**

Replace:

```tsx
  const positions = derivePositionColumns(league.roster_positions);
  const grid = buildDepthChart(roster, players, positions);

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-gray-900 dark:text-slate-100">
            {ownerName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {league.name}
          </p>
        </div>
        <Link
          href={`/roster-management/${leagueId}`}
          className="text-sm text-green-600 hover:underline dark:text-green-400"
        >
          ← Back to teams
        </Link>
      </div>

      <DepthChartTable grid={grid} />
    </main>
  );
```

with:

```tsx
  const positions = derivePositionColumns(league.roster_positions);
  const grid = buildDepthChart(roster, players, positions);
  const counts = computeRosterCounts(roster, players, league.roster_positions, league.settings);

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-gray-900 dark:text-slate-100">
            {ownerName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {league.name}
          </p>
        </div>
        <Link
          href={`/roster-management/${leagueId}`}
          className="text-sm text-green-600 hover:underline dark:text-green-400"
        >
          ← Back to teams
        </Link>
      </div>

      <RosterCountsSummary counts={counts} />

      <DepthChartTable grid={grid} />
    </main>
  );
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0 with no errors

- [ ] **Step 4: Run the full test suite to confirm no regression**

Run: `npm test`
Expected: PASS (all suites)

- [ ] **Step 5: Commit**

```bash
git add src/app/roster-management/\[leagueId\]/\[rosterId\]/page.tsx
git commit -m "feat(roster-management): show slot usage counts on the depth chart page"
```

---

### Task 5: Add `fantasy_positions` to the player type and slim it in

**Files:**
- Modify: `src/lib/roster-management/types.ts` (add `fantasy_positions` to `SleeperPlayer`)
- Modify: `src/lib/roster-management/sleeper.ts:38-63` (`_fetchPlayersRaw`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `SleeperPlayer.fantasy_positions?: string[] | null` — Task 6 reads this field. Kept optional (not required) so no existing test fixture across the codebase needs updating just because this field was added.

- [ ] **Step 1: Add the field to `SleeperPlayer`**

In `src/lib/roster-management/types.ts`, replace:

```ts
export type SleeperPlayer = {
  player_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
};
```

with:

```ts
export type SleeperPlayer = {
  player_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  fantasy_positions?: string[] | null;
};
```

- [ ] **Step 2: Slim `fantasy_positions` through in `_fetchPlayersRaw`**

In `src/lib/roster-management/sleeper.ts`, replace:

```ts
    const raw = (await res.json()) as Record<
      string,
      { first_name?: string | null; last_name?: string | null; position?: string | null }
    >;
    const slim: Record<string, SleeperPlayer> = {};
    for (const [id, p] of Object.entries(raw)) {
      slim[id] = {
        player_id: id,
        first_name: p.first_name ?? null,
        last_name: p.last_name ?? null,
        position: p.position ?? null,
      };
    }
    return slim;
```

with:

```ts
    const raw = (await res.json()) as Record<
      string,
      {
        first_name?: string | null;
        last_name?: string | null;
        position?: string | null;
        fantasy_positions?: string[] | null;
      }
    >;
    const slim: Record<string, SleeperPlayer> = {};
    for (const [id, p] of Object.entries(raw)) {
      slim[id] = {
        player_id: id,
        first_name: p.first_name ?? null,
        last_name: p.last_name ?? null,
        position: p.position ?? null,
        fantasy_positions: p.fantasy_positions ?? null,
      };
    }
    return slim;
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0 with no errors

- [ ] **Step 4: Run the full test suite to confirm no regression**

Run: `npm test`
Expected: PASS (all suites — this task has no new tests of its own; `fantasy_positions` isn't exercised until Task 6)

- [ ] **Step 5: Verify the slimmed players payload still fits Next's 2MB `unstable_cache` limit**

This tool's `/players/nfl` cache previously stayed under the 2MB `unstable_cache` limit by slimming to 4 fields; `fantasy_positions` is a new 5th field (a short string array) added for ~11,000 players. Run the dev server and confirm Next does **not** log a cache-size warning for the `roster-management-players` cache key:

Run: `npm run dev` (in one terminal), then in another terminal: `curl -s http://localhost:3000/roster-management/<a-real-sleeper-league-id> > /dev/null`
Expected: no `Failed to set Next.js data cache` / cache-size warning in the `npm run dev` terminal output. Stop the dev server (Ctrl-C) once confirmed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/roster-management/types.ts src/lib/roster-management/sleeper.ts
git commit -m "feat(roster-management): fetch fantasy_positions for dual-eligible players"
```

---

### Task 6: Refactor `buildDepthChart` to cell objects with eligible positions and overrides

**Files:**
- Modify: `src/lib/roster-management/depth-chart.ts` (full rewrite)
- Modify: `__tests__/roster-management/lib/depth-chart.test.ts` (full rewrite)

**Interfaces:**
- Consumes: `SleeperPlayer.fantasy_positions` (Task 5).
- Produces: `DepthChartCell` type (`{ playerId: string; displayName: string; eligiblePositions: string[] }`), `DepthChartSection.rows: (DepthChartCell | null)[][]`, `derivePlayerEligiblePositions(player, positions): string[]`, and `buildDepthChart(roster, players, positions, overrides?: Record<string, string>): DepthChartGrid`. Task 7's `DepthChartTable` consumes all of these exact names.

- [ ] **Step 1: Replace `src/lib/roster-management/depth-chart.ts` in full**

```ts
import type { SleeperPlayer, SleeperRoster } from "./types";

// Entries in roster_positions that represent slot types, not player positions.
const SLOT_ONLY = new Set([
  "BN", "FLEX", "IDP_FLEX", "REC_FLEX", "SUPER_FLEX", "DEF", "TAXI", "IR",
]);

// Sleeper sometimes stores granular positions (DE, DT, CB, S, OLB, MLB).
// Map these to the grouped columns used in dynasty depth charts.
const POSITION_MAP: Record<string, string> = {
  DE: "DL", DT: "DL", NT: "DL",
  CB: "DB", S: "DB", SS: "DB", FS: "DB",
  OLB: "LB", ILB: "LB", MLB: "LB",
};

export function derivePositionColumns(rosterPositions: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const pos of rosterPositions) {
    if (!SLOT_ONLY.has(pos) && !seen.has(pos)) {
      seen.add(pos);
      result.push(pos);
    }
  }
  return result;
}

export function normalizePosition(position: string | null): string | null {
  if (!position) return null;
  return POSITION_MAP[position] ?? position;
}

// The set of grouped columns a player could reasonably sit in, derived from
// Sleeper's fantasy_positions (falling back to the single `position` field).
// Used both to pick a default column and to constrain drag-and-drop targets.
export function derivePlayerEligiblePositions(
  player: SleeperPlayer,
  positions: string[],
): string[] {
  const raw =
    player.fantasy_positions && player.fantasy_positions.length > 0
      ? player.fantasy_positions
      : player.position
        ? [player.position]
        : [];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const pos of raw) {
    const normalized = normalizePosition(pos);
    if (normalized && positions.includes(normalized) && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

export function deriveBenchIds(roster: SleeperRoster): string[] {
  const taxiSet = new Set(roster.taxi ?? []);
  const reserveSet = new Set(roster.reserve ?? []);
  const starterSet = new Set(roster.starters);
  return roster.players.filter(
    (id) => !starterSet.has(id) && !taxiSet.has(id) && !reserveSet.has(id),
  );
}

export type DepthChartCell = {
  playerId: string;
  displayName: string;
  eligiblePositions: string[];
};

export type DepthChartSection = {
  label: "Starting" | "Bench" | "Taxi" | "IR";
  rows: (DepthChartCell | null)[][];
};

export type DepthChartGrid = {
  positions: string[];
  sections: DepthChartSection[];
};

function buildDisplayNames(
  playerIds: string[],
  players: Record<string, SleeperPlayer>,
): Map<string, string> {
  const result = new Map<string, string>();
  for (const id of playerIds) {
    const p = players[id];
    if (!p?.last_name) continue;
    result.set(id, p.first_name ? `${p.first_name} ${p.last_name}` : p.last_name);
  }
  return result;
}

function buildSection(
  label: DepthChartSection["label"],
  playerIds: string[],
  positions: string[],
  players: Record<string, SleeperPlayer>,
  displayNames: Map<string, string>,
  overrides: Record<string, string>,
): DepthChartSection | null {
  // Discard empty Sleeper sentinel ("0") and unknown player IDs.
  const valid = playerIds.filter((id) => id !== "0" && players[id]);
  if (valid.length === 0) return null;

  const byPosition = new Map<string, string[]>();
  for (const id of valid) {
    const player = players[id];
    const eligiblePositions = derivePlayerEligiblePositions(player, positions);
    if (eligiblePositions.length === 0) continue;

    const defaultPos = normalizePosition(player.position ?? null);
    const overridePos = overrides[id];
    const assignedPos =
      overridePos && eligiblePositions.includes(overridePos)
        ? overridePos
        : defaultPos && eligiblePositions.includes(defaultPos)
          ? defaultPos
          : eligiblePositions[0];

    const group = byPosition.get(assignedPos) ?? [];
    group.push(id);
    byPosition.set(assignedPos, group);
  }

  const maxRows = Math.max(
    0,
    ...positions.map((p) => byPosition.get(p)?.length ?? 0),
  );
  if (maxRows === 0) return null;

  const rows: (DepthChartCell | null)[][] = Array.from({ length: maxRows }, (_, r) =>
    positions.map((pos) => {
      const id = byPosition.get(pos)?.[r];
      if (id === undefined) return null;
      return {
        playerId: id,
        displayName: displayNames.get(id) ?? "",
        eligiblePositions: derivePlayerEligiblePositions(players[id], positions),
      };
    }),
  );

  return { label, rows };
}

export function buildDepthChart(
  roster: SleeperRoster,
  players: Record<string, SleeperPlayer>,
  positions: string[],
  overrides: Record<string, string> = {},
): DepthChartGrid {
  const bench = deriveBenchIds(roster);

  // Build the full-name lookup once across every section's players.
  // Deduplicate because roster.players already includes taxi/reserve members.
  const allIds = [...new Set([...roster.players, ...(roster.taxi ?? []), ...(roster.reserve ?? [])])];
  const displayNames = buildDisplayNames(allIds, players);

  const sections: DepthChartSection[] = [];

  const starting = buildSection("Starting", roster.starters, positions, players, displayNames, overrides);
  if (starting) sections.push(starting);

  const benchSection = buildSection("Bench", bench, positions, players, displayNames, overrides);
  if (benchSection) sections.push(benchSection);

  const taxiSection = buildSection("Taxi", roster.taxi ?? [], positions, players, displayNames, overrides);
  if (taxiSection) sections.push(taxiSection);

  const irSection = buildSection("IR", roster.reserve ?? [], positions, players, displayNames, overrides);
  if (irSection) sections.push(irSection);

  return { positions, sections };
}
```

- [ ] **Step 2: Replace `__tests__/roster-management/lib/depth-chart.test.ts` in full**

```ts
import { describe, it, expect } from "vitest";
import {
  buildDepthChart,
  derivePositionColumns,
  derivePlayerEligiblePositions,
  normalizePosition,
} from "@/lib/roster-management/depth-chart";
import type { SleeperRoster, SleeperPlayer } from "@/lib/roster-management/types";

// ── derivePositionColumns ──────────────────────────────────────────────────

describe("derivePositionColumns", () => {
  it("removes slot-only types and deduplicates, preserving order", () => {
    const input = [
      "QB", "RB", "RB", "WR", "WR", "WR", "TE",
      "FLEX", "K", "BN", "BN", "TAXI", "DL", "LB", "DB", "IDP_FLEX",
    ];
    expect(derivePositionColumns(input)).toEqual([
      "QB", "RB", "WR", "TE", "K", "DL", "LB", "DB",
    ]);
  });

  it("returns empty array when all entries are slot-only", () => {
    expect(derivePositionColumns(["BN", "FLEX", "TAXI"])).toEqual([]);
  });
});

// ── normalizePosition ──────────────────────────────────────────────────────

describe("normalizePosition", () => {
  it("maps DE to DL", () => expect(normalizePosition("DE")).toBe("DL"));
  it("maps DT to DL", () => expect(normalizePosition("DT")).toBe("DL"));
  it("maps CB to DB", () => expect(normalizePosition("CB")).toBe("DB"));
  it("maps S to DB", () => expect(normalizePosition("S")).toBe("DB"));
  it("maps OLB to LB", () => expect(normalizePosition("OLB")).toBe("LB"));
  it("maps MLB to LB", () => expect(normalizePosition("MLB")).toBe("LB"));
  it("passes QB through unchanged", () => expect(normalizePosition("QB")).toBe("QB"));
  it("passes DL through unchanged", () => expect(normalizePosition("DL")).toBe("DL"));
  it("returns null for null input", () => expect(normalizePosition(null)).toBeNull());
});

// ── derivePlayerEligiblePositions ──────────────────────────────────────────

const POSITIONS = ["QB", "RB", "WR", "TE", "DL", "LB", "DB"];

describe("derivePlayerEligiblePositions", () => {
  it("normalizes and dedupes fantasy_positions", () => {
    const player: SleeperPlayer = {
      player_id: "9", first_name: "Nik", last_name: "Bonitto",
      position: "LB", fantasy_positions: ["OLB", "DE"],
    };
    // OLB -> LB, DE -> DL
    expect(derivePlayerEligiblePositions(player, POSITIONS)).toEqual(["LB", "DL"]);
  });

  it("falls back to the single position field when fantasy_positions is missing", () => {
    const player: SleeperPlayer = {
      player_id: "8", first_name: "Myles", last_name: "Garrett", position: "DE",
    };
    expect(derivePlayerEligiblePositions(player, POSITIONS)).toEqual(["DL"]);
  });

  it("falls back to the single position field when fantasy_positions is empty", () => {
    const player: SleeperPlayer = {
      player_id: "8", first_name: "Myles", last_name: "Garrett", position: "DE",
      fantasy_positions: [],
    };
    expect(derivePlayerEligiblePositions(player, POSITIONS)).toEqual(["DL"]);
  });

  it("excludes positions not in the league's column list", () => {
    const player: SleeperPlayer = {
      player_id: "99", first_name: "Justin", last_name: "Tucker",
      position: "K", fantasy_positions: ["K"],
    };
    expect(derivePlayerEligiblePositions(player, POSITIONS)).toEqual([]);
  });
});

// ── buildDepthChart ────────────────────────────────────────────────────────

const PLAYERS: Record<string, SleeperPlayer> = {
  "1": { player_id: "1", first_name: "Justin", last_name: "Herbert", position: "QB", fantasy_positions: ["QB"] },
  "2": { player_id: "2", first_name: "Christian", last_name: "McCaffrey", position: "RB", fantasy_positions: ["RB"] },
  "3": { player_id: "3", first_name: "Davante", last_name: "Adams", position: "WR", fantasy_positions: ["WR"] },
  "4": { player_id: "4", first_name: "Travis", last_name: "Kelce", position: "TE", fantasy_positions: ["TE"] },
  "5": { player_id: "5", first_name: "Tyler", last_name: "Williams", position: "WR", fantasy_positions: ["WR"] },
  "6": { player_id: "6", first_name: "Garrett", last_name: "Williams", position: "DB", fantasy_positions: ["CB"] },
  "7": { player_id: "7", first_name: "Micah", last_name: "Parsons", position: "LB", fantasy_positions: ["OLB"] },
  "8": { player_id: "8", first_name: "Myles", last_name: "Garrett", position: "DE", fantasy_positions: ["DE"] },
  "9": { player_id: "9", first_name: "Nik", last_name: "Bonitto", position: "LB", fantasy_positions: ["LB", "DL"] },
};

describe("buildDepthChart", () => {
  it("assigns starters to Starting section in correct position columns", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["1", "2", "3"], players: ["1", "2", "3"],
      taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting).toBeDefined();
    expect(starting.rows[0][POSITIONS.indexOf("QB")]?.displayName).toBe("Justin Herbert");
    expect(starting.rows[0][POSITIONS.indexOf("RB")]?.displayName).toBe("Christian McCaffrey");
    expect(starting.rows[0][POSITIONS.indexOf("WR")]?.displayName).toBe("Davante Adams");
  });

  it("assigns non-starter non-taxi non-reserve players to Bench", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["1"], players: ["1", "4"],
      taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const bench = grid.sections.find((s) => s.label === "Bench")!;
    expect(bench).toBeDefined();
    expect(bench.rows[0][POSITIONS.indexOf("TE")]?.displayName).toBe("Travis Kelce");
  });

  it("ignores empty starter slots ('0')", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["1", "0", "0"], players: ["1"],
      taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting.rows).toHaveLength(1);
  });

  it("omits sections that have no players", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["1"], players: ["1"],
      taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const labels = grid.sections.map((s) => s.label);
    expect(labels).not.toContain("Taxi");
    expect(labels).not.toContain("IR");
    expect(labels).not.toContain("Bench");
  });

  it("assigns taxi players to Taxi section", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: [], players: ["7"], taxi: ["7"], reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const taxi = grid.sections.find((s) => s.label === "Taxi")!;
    expect(taxi).toBeDefined();
    expect(taxi.rows[0][POSITIONS.indexOf("LB")]?.displayName).toBe("Micah Parsons");
  });

  it("assigns reserve players to IR section", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: [], players: ["4"], taxi: null, reserve: ["4"],
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const ir = grid.sections.find((s) => s.label === "IR")!;
    expect(ir).toBeDefined();
    expect(ir.rows[0][POSITIONS.indexOf("TE")]?.displayName).toBe("Travis Kelce");
  });

  it("shows each player's full first and last name", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["5"], players: ["5", "6"], taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting.rows[0][POSITIONS.indexOf("WR")]?.displayName).toBe("Tyler Williams");
  });

  it("maps DE to the DL column via normalizePosition", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["8"], players: ["8"], taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting.rows[0][POSITIONS.indexOf("DL")]?.displayName).toBe("Myles Garrett");
  });

  it("builds multiple rows when a position has more than one player in a section", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["3", "5"], players: ["3", "5"], taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting.rows).toHaveLength(2);
    expect(starting.rows[1][POSITIONS.indexOf("QB")]).toBeNull();
    expect(starting.rows[1][POSITIONS.indexOf("WR")]).not.toBeNull();
  });

  it("skips players whose position is not in the positions list", () => {
    const kicker: SleeperPlayer = {
      player_id: "99", first_name: "Justin", last_name: "Tucker", position: "K",
    };
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["99"], players: ["99"], taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, { "99": kicker }, POSITIONS);
    expect(grid.sections).toHaveLength(0);
  });

  it("reports a dual-eligible player's eligiblePositions on their cell", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["9"], players: ["9"], taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    // Defaults to LB (their primary `position` field)
    const cell = starting.rows[0][POSITIONS.indexOf("LB")];
    expect(cell?.playerId).toBe("9");
    expect(cell?.eligiblePositions).toEqual(["LB", "DL"]);
  });

  it("moves a dual-eligible player to their override column", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["9"], players: ["9"], taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS, { "9": "DL" });
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting.rows[0][POSITIONS.indexOf("DL")]?.playerId).toBe("9");
    expect(starting.rows[0][POSITIONS.indexOf("LB")]).toBeNull();
  });

  it("ignores an override that isn't one of the player's eligible positions", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["9"], players: ["9"], taxi: null, reserve: null,
    };
    // "9" is only eligible for LB/DL - a "WR" override should be ignored.
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS, { "9": "WR" });
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting.rows[0][POSITIONS.indexOf("LB")]?.playerId).toBe("9");
    expect(starting.rows[0][POSITIONS.indexOf("WR")]).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `npx vitest run __tests__/roster-management/lib/depth-chart.test.ts`
Expected: PASS (all tests)

- [ ] **Step 4: Run the roster-counts tests to confirm `deriveBenchIds`'s import path still resolves**

Run: `npx vitest run __tests__/roster-management/lib/roster-counts.test.ts`
Expected: PASS (all 6 tests, unchanged)

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0. Typecheck will currently fail on `src/app/roster-management/[leagueId]/[rosterId]/page.tsx` and `src/components/roster-management/DepthChartTable.tsx` since they still expect string cells — that's expected and fixed by Tasks 7-8. If it's more convenient to verify in isolation first, run `npx tsc --noEmit -p . 2>&1 | grep depth-chart` and confirm no errors reference `depth-chart.ts` itself.

- [ ] **Step 6: Commit**

```bash
git add src/lib/roster-management/depth-chart.ts __tests__/roster-management/lib/depth-chart.test.ts
git commit -m "feat(roster-management): support dual-eligible positions and column overrides in buildDepthChart"
```

---

### Task 7: Drag-and-drop position correction in `DepthChartTable`

**Files:**
- Modify: `package.json` (add `@dnd-kit/core`)
- Modify: `src/components/roster-management/DepthChartTable.tsx` (full rewrite; becomes a client component)
- Test: `__tests__/roster-management/DepthChartTable.test.tsx`

**Interfaces:**
- Consumes: `buildDepthChart`, `DepthChartCell`, `DepthChartSection` (Task 6); `SleeperPlayer`, `SleeperRoster` (Task 5 / `types.ts`).
- Produces: `DepthChartTable({ roster, players, positions, leagueId, rosterId })` — Task 8 wires this new prop contract into the page. This **replaces** the current `DepthChartTable({ grid })` prop contract from Task 4.

- [ ] **Step 1: Install `@dnd-kit/core`**

Run: `npm install @dnd-kit/core`
Expected: `package.json` gains a `"@dnd-kit/core": "^..."` dependency entry; `package-lock.json` updates.

- [ ] **Step 2: Write the failing tests**

Create `__tests__/roster-management/DepthChartTable.test.tsx`:

```tsx
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import DepthChartTable from "@/components/roster-management/DepthChartTable";
import type { SleeperPlayer, SleeperRoster } from "@/lib/roster-management/types";

afterEach(cleanup);
beforeEach(() => window.localStorage.clear());

const POSITIONS = ["QB", "DL", "LB"];

const PLAYERS: Record<string, SleeperPlayer> = {
  "1": { player_id: "1", first_name: "Justin", last_name: "Herbert", position: "QB", fantasy_positions: ["QB"] },
  "9": { player_id: "9", first_name: "Nik", last_name: "Bonitto", position: "LB", fantasy_positions: ["LB", "DL"] },
};

const ROSTER: SleeperRoster = {
  roster_id: 1, owner_id: "u1",
  starters: ["1", "9"], players: ["1", "9"], taxi: null, reserve: null,
};

describe("DepthChartTable", () => {
  it("renders full player names in their default columns", () => {
    render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    expect(screen.getByText("Justin Herbert")).toBeTruthy();
    expect(screen.getByText("Nik Bonitto")).toBeTruthy();
  });

  it("marks a dual-eligible player's cell as draggable", () => {
    render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    expect(screen.getByText("Nik Bonitto").getAttribute("data-draggable")).toBe("true");
  });

  it("does not mark a single-position player's cell as draggable", () => {
    render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    expect(screen.getByText("Justin Herbert").getAttribute("data-draggable")).toBeNull();
  });

  it("shows no reset control when there are no saved corrections", () => {
    render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    expect(screen.queryByRole("button", { name: "Reset corrections" })).toBeNull();
  });

  it("renders a loaded correction in its overridden column", () => {
    window.localStorage.setItem("roster-mgmt:overrides:league1:1", JSON.stringify({ "9": "DL" }));
    const { container } = render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    const dlCell = container.querySelector('td[data-position="DL"]');
    const lbCell = container.querySelector('td[data-position="LB"]');
    expect(dlCell?.textContent).toContain("Nik Bonitto");
    expect(lbCell?.textContent).not.toContain("Nik Bonitto");
  });

  it("shows and clears a reset control when a correction is loaded from storage", () => {
    window.localStorage.setItem("roster-mgmt:overrides:league1:1", JSON.stringify({ "9": "DL" }));
    render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    const resetButton = screen.getByRole("button", { name: "Reset corrections" });
    fireEvent.click(resetButton);
    expect(window.localStorage.getItem("roster-mgmt:overrides:league1:1")).toBe(JSON.stringify({}));
    expect(screen.queryByRole("button", { name: "Reset corrections" })).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run __tests__/roster-management/DepthChartTable.test.tsx`
Expected: FAIL — the current component still takes a `grid` prop and renders plain strings, not `data-draggable`/`data-position` markup.

- [ ] **Step 4: Replace `src/components/roster-management/DepthChartTable.tsx` in full**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  buildDepthChart,
  type DepthChartCell,
  type DepthChartSection,
} from "@/lib/roster-management/depth-chart";
import type { SleeperPlayer, SleeperRoster } from "@/lib/roster-management/types";

function overridesKey(leagueId: string, rosterId: number): string {
  return `roster-mgmt:overrides:${leagueId}:${rosterId}`;
}

function loadOverrides(leagueId: string, rosterId: number): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(overridesKey(leagueId, rosterId));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveOverrides(leagueId: string, rosterId: number, overrides: Record<string, string>) {
  try {
    window.localStorage.setItem(overridesKey(leagueId, rosterId), JSON.stringify(overrides));
  } catch {
    // Private browsing or storage disabled - corrections just won't persist.
  }
}

function DraggableCell({
  cell,
  section,
  position,
}: {
  cell: DepthChartCell;
  section: string;
  position: string;
}) {
  const draggable = cell.eligiblePositions.length > 1;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${section}:${position}:${cell.playerId}`,
    data: { cell, section },
    disabled: !draggable,
  });

  if (!draggable) {
    return <span>{cell.displayName}</span>;
  }

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 10 }
    : undefined;

  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-draggable="true"
      style={style}
      className={`cursor-grab rounded bg-green-50 px-1 dark:bg-pitch-700/60 ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      {cell.displayName}
    </span>
  );
}

function DroppableCell({
  section,
  position,
  rowIndex,
  cell,
}: {
  section: string;
  position: string;
  rowIndex: number;
  cell: DepthChartCell | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${section}:${position}:${rowIndex}`,
    data: { section, position },
  });

  return (
    <td
      ref={setNodeRef}
      data-position={position}
      data-section={section}
      className={`border-b border-l border-gray-100 px-4 py-2 text-center text-gray-900 dark:border-pitch-700 dark:text-slate-100 ${
        isOver ? "bg-green-100 dark:bg-green-900/40" : ""
      }`}
    >
      {cell ? <DraggableCell cell={cell} section={section} position={position} /> : ""}
    </td>
  );
}

export default function DepthChartTable({
  roster,
  players,
  positions,
  leagueId,
  rosterId,
}: {
  roster: SleeperRoster;
  players: Record<string, SleeperPlayer>;
  positions: string[];
  leagueId: string;
  rosterId: number;
}) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    setOverrides(loadOverrides(leagueId, rosterId));
  }, [leagueId, rosterId]);

  const grid = useMemo(
    () => buildDepthChart(roster, players, positions, overrides),
    [roster, players, positions, overrides],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as { cell: DepthChartCell; section: string } | undefined;
    const overData = over.data.current as { section: string; position: string } | undefined;
    if (!activeData || !overData) return;
    if (activeData.section !== overData.section) return;
    if (!activeData.cell.eligiblePositions.includes(overData.position)) return;

    const next = { ...overrides, [activeData.cell.playerId]: overData.position };
    setOverrides(next);
    saveOverrides(leagueId, rosterId, next);
  }

  function handleReset() {
    setOverrides({});
    saveOverrides(leagueId, rosterId, {});
  }

  return (
    <div className="space-y-2">
      {Object.keys(overrides).length > 0 && (
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-green-600 hover:underline dark:text-green-400"
        >
          Reset corrections
        </button>
      )}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-pitch-700">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-gray-200 bg-gray-100 px-4 py-2.5 text-center font-bold text-gray-700 dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-300">
                  Rank
                </th>
                {grid.positions.map((pos) => (
                  <th
                    key={pos}
                    className="border-b border-l border-gray-200 bg-green-700 px-4 py-2.5 text-center font-bold text-white dark:border-pitch-700"
                  >
                    {pos}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.sections.map((section: DepthChartSection, si: number) =>
                section.rows.map((row, ri) => (
                  <tr
                    key={`${section.label}-${ri}`}
                    className={
                      si > 0 && ri === 0
                        ? "border-t-2 border-gray-300 dark:border-pitch-700"
                        : ""
                    }
                  >
                    <td className="border-b border-gray-100 px-4 py-2 text-center font-bold text-gray-700 dark:border-pitch-700 dark:text-slate-300">
                      {section.label}
                    </td>
                    {row.map((cell, ci) => (
                      <DroppableCell
                        key={ci}
                        section={section.label}
                        position={grid.positions[ci]}
                        rowIndex={ri}
                        cell={cell}
                      />
                    ))}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </DndContext>
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run __tests__/roster-management/DepthChartTable.test.tsx`
Expected: PASS (all 6 tests)

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: lint passes; typecheck will still show an error in `src/app/roster-management/[leagueId]/[rosterId]/page.tsx` since it still calls `<DepthChartTable grid={grid} />` with the old prop shape — expected, fixed in Task 8.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/components/roster-management/DepthChartTable.tsx __tests__/roster-management/DepthChartTable.test.tsx
git commit -m "feat(roster-management): drag-and-drop correction for dual-eligible position columns"
```

---

### Task 8: Wire the new `DepthChartTable` props into the page

**Files:**
- Modify: `src/app/roster-management/[leagueId]/[rosterId]/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `DepthChartTable({ roster, players, positions, leagueId, rosterId })` (Task 7), `RosterCountsSummary` (Task 3), `computeRosterCounts` (Task 2), `derivePositionColumns` (existing).
- Produces: nothing further downstream — this is the last file in the chain.

- [ ] **Step 1: Replace `src/app/roster-management/[leagueId]/[rosterId]/page.tsx` in full**

```tsx
import Link from "next/link";
import DepthChartTable from "@/components/roster-management/DepthChartTable";
import RosterCountsSummary from "@/components/roster-management/RosterCountsSummary";
import {
  getLeague,
  getRosters,
  getUsers,
  getPlayers,
} from "@/lib/roster-management/sleeper";
import { derivePositionColumns } from "@/lib/roster-management/depth-chart";
import { computeRosterCounts } from "@/lib/roster-management/roster-counts";
import type { SleeperPlayer } from "@/lib/roster-management/types";

export const dynamic = "force-dynamic";

export default async function RosterPage({
  params,
}: {
  params: Promise<{ leagueId: string; rosterId: string }>;
}) {
  const { leagueId, rosterId } = await params;
  const rosterIdNum = Number(rosterId);

  const [league, rosters, users, players] = await Promise.all([
    getLeague(leagueId),
    getRosters(leagueId),
    getUsers(leagueId),
    getPlayers(),
  ]);

  if (!league) {
    return (
      <main className="mx-auto max-w-2xl py-12 text-center">
        <p className="mb-4 text-gray-600 dark:text-slate-300">
          League not found.
        </p>
        <Link
          href="/roster-management"
          className="text-sm text-green-600 hover:underline dark:text-green-400"
        >
          ← Start over
        </Link>
      </main>
    );
  }

  const roster = rosters.find((r) => r.roster_id === rosterIdNum);
  if (!roster) {
    return (
      <main className="mx-auto max-w-2xl py-12 text-center">
        <p className="mb-4 text-gray-600 dark:text-slate-300">
          Roster not found in this league.
        </p>
        <Link
          href={`/roster-management/${leagueId}`}
          className="text-sm text-green-600 hover:underline dark:text-green-400"
        >
          ← Back to teams
        </Link>
      </main>
    );
  }

  const userMap = new Map(users.map((u) => [u.user_id, u.display_name]));
  const ownerName = roster.owner_id
    ? (userMap.get(roster.owner_id) ?? "Unknown")
    : "Unowned";

  const positions = derivePositionColumns(league.roster_positions);
  const counts = computeRosterCounts(roster, players, league.roster_positions, league.settings);

  const rosterPlayerIds = new Set([
    ...roster.players,
    ...(roster.taxi ?? []),
    ...(roster.reserve ?? []),
  ]);
  const rosterPlayers: Record<string, SleeperPlayer> = {};
  for (const id of rosterPlayerIds) {
    if (players[id]) rosterPlayers[id] = players[id];
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-gray-900 dark:text-slate-100">
            {ownerName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {league.name}
          </p>
        </div>
        <Link
          href={`/roster-management/${leagueId}`}
          className="text-sm text-green-600 hover:underline dark:text-green-400"
        >
          ← Back to teams
        </Link>
      </div>

      <RosterCountsSummary counts={counts} />

      <DepthChartTable
        roster={roster}
        players={rosterPlayers}
        positions={positions}
        leagueId={leagueId}
        rosterId={rosterIdNum}
      />
    </main>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0 with no errors — this resolves the prop-shape error carried since Task 7.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS (every suite across idp-checker, trade-tracker, standings, taxi-filler, profile, and roster-management)

- [ ] **Step 4: Commit**

```bash
git add src/app/roster-management/\[leagueId\]/\[rosterId\]/page.tsx
git commit -m "feat(roster-management): wire drag-and-drop depth chart into the roster page"
```

---

### Task 9: Manual verification, `npm audit`, and PR

**Files:** none (verification and delivery only)

- [ ] **Step 1: Manually verify the live feature in a browser**

Run: `npm run dev`, then open `http://localhost:3000/roster-management/<a-real-sleeper-league-id>` and pick a team. Confirm:
- The slot count badges above the table show sensible used/total numbers.
- Player names are full first + last name.
- A player with dual `fantasy_positions` (e.g. an edge rusher rostered as LB) shows a visibly draggable cell (grab cursor, tinted background); dragging it to an eligible alternate column moves it there, and reloading the page keeps the correction.
- "Reset corrections" appears after a correction is made and clears it when clicked.

Stop the dev server (Ctrl-C) once confirmed. If no real Sleeper league ID is available for manual testing, note this explicitly rather than claiming it was verified.

- [ ] **Step 2: Run the full verification suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all three exit 0

- [ ] **Step 3: Run `npm audit`**

Run: `npm audit`
Expected: review the output. If it reports vulnerabilities introduced by `@dnd-kit/core`'s dependency tree, resolve them (`npm audit fix`) or report the specifics to the user before proceeding — do not silently ignore findings.

- [ ] **Step 4: Push the branch**

Run: `git push -u origin feature/roster-management-ux`

- [ ] **Step 5: Open the PR**

```bash
gh pr create --title "Roster management: slot counts, position drag-and-drop, full names" --body "$(cat <<'EOF'
## Summary
- Show Starting/Bench/Taxi/IR used-vs-total slot counts on the depth chart page
- Let users drag dual-eligible IDP players (e.g. LB/DL) between position columns to correct Sleeper's default grouping, persisted per-browser via localStorage
- Show full player names instead of last-name-only

## Test plan
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm audit`
- [x] Manually verified in browser: counts, full names, drag-and-drop correction + persistence across reload, reset control

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR created; report the PR URL back to the user.

---

## Self-Review Notes

- **Spec coverage:** slot counts (Tasks 2-4), drag-and-drop correction (Tasks 5-8), full names (Task 1) — all three spec sections have corresponding tasks. `localStorage` persistence and `@dnd-kit/core` choice (the two provisional decisions) are implemented exactly as approved.
- **Placeholder scan:** no TBD/TODO markers; every step shows complete, runnable code.
- **Type consistency:** `DepthChartCell`, `RosterCounts`/`SlotCount`, and `DepthChartTable`'s prop shape are each defined once (Tasks 6, 2, 7 respectively) and referenced identically by every later consumer (Tasks 7, 3-4, 8).
