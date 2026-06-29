# Taxi Filler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Taxi Filler tool that lists waiver-wire players eligible for a dynasty taxi squad (by experience), ranked by Sleeper's `search_rank`, with position filter tabs.

**Architecture:** Three-layer structure matching the existing tools — own Sleeper client + types in `src/lib/taxi-filler/`, pure filter logic in `filter.ts`, one client component in `src/components/taxi-filler/`, and two server-component pages in `src/app/taxi-filler/`. No code is shared with other tools' namespaces.

**Tech Stack:** Next.js 14 App Router (server components), Sleeper public API, Tailwind CSS, TypeScript strict mode, Vitest for tests.

## Global Constraints

- Path alias `@/*` → `src/*` — use it in all imports.
- TypeScript `strict` mode is on — no implicit `any`, no non-null assertions without justification.
- Do NOT import from `src/lib/roster-management/`, `src/lib/idp-checker/`, or `src/lib/trade-tracker/` — all code lives in the `taxi-filler` namespace.
- Cache strategy: league endpoints use `next: { revalidate: 300 }`, player DB uses `unstable_cache` from `next/cache` with `{ revalidate: 3600 }`.
- The full `/players/nfl` response is ~16MB — slim it inside the fetch function before caching (same pattern as `src/lib/roster-management/sleeper.ts`).
- Tailwind palette: `green-700` for primary actions, `pitch-700`/`pitch-800`/`pitch-900` for dark mode backgrounds, `slate-*` for dark mode text. No new colors.
- Run `npm run typecheck && npm test` before each commit to catch regressions.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/taxi-filler/types.ts` | Sleeper API shapes + `TaxiCandidate` output type |
| Create | `src/lib/taxi-filler/sleeper.ts` | Own Sleeper client — `getLeague`, `getRosters`, `getPlayers` |
| Create | `src/lib/taxi-filler/filter.ts` | Pure logic — `deriveEligiblePositions`, `buildTaxiCandidates` |
| Create | `__tests__/taxi-filler/filter.test.ts` | Unit tests for all filter logic |
| Create | `src/app/taxi-filler/page.tsx` | Entry form (server component) |
| Create | `src/components/taxi-filler/TaxiFillerTable.tsx` | Position tabs + player table (client component) |
| Create | `src/app/taxi-filler/[leagueId]/page.tsx` | Results page (server component) |
| Modify | `src/app/(components)/NavBar.jsx` | Add "Taxi Filler" to Tools dropdown |
| Modify | `src/app/page.tsx` | Add Taxi Filler card to the tools grid |

---

## Task 1: Types and Sleeper Client

**Files:**
- Create: `src/lib/taxi-filler/types.ts`
- Create: `src/lib/taxi-filler/sleeper.ts`

**Interfaces:**
- Produces: `SleeperLeague`, `SleeperRoster`, `SleeperPlayer`, `TaxiCandidate` types; `getLeague()`, `getRosters()`, `getPlayers()` functions consumed by Task 3's results page and Task 2's filter.

- [ ] **Step 1: Create `src/lib/taxi-filler/types.ts`**

```typescript
export type SleeperLeague = {
  name: string;
  roster_positions: string[];
  settings: {
    taxi_years?: number;
  };
};

export type SleeperRoster = {
  roster_id: number;
  players: string[] | null;
  taxi: string[] | null;
  reserve: string[] | null;
};

export type SleeperPlayer = {
  player_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  team: string | null;
  age: number | null;
  years_exp: number | null;
  search_rank: number | null;
  active: boolean;
};

export type TaxiCandidate = {
  playerId: string;
  name: string;
  position: string;
  team: string | null;
  age: number | null;
  yearsExp: number;
  searchRank: number | null;
};
```

- [ ] **Step 2: Create `src/lib/taxi-filler/sleeper.ts`**

```typescript
import { unstable_cache } from "next/cache";
import type { SleeperLeague, SleeperPlayer, SleeperRoster } from "./types";

const BASE = "https://api.sleeper.app/v1";

class SleeperError extends Error {}

async function getJson<T>(path: string, revalidate: number): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate } });
  if (res.status === 404) return null;
  if (!res.ok) throw new SleeperError(`Sleeper ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export async function getLeague(leagueId: string): Promise<SleeperLeague | null> {
  return getJson<SleeperLeague>(`/league/${leagueId}`, 300);
}

export async function getRosters(leagueId: string): Promise<SleeperRoster[]> {
  return (await getJson<SleeperRoster[]>(`/league/${leagueId}/rosters`, 300)) ?? [];
}

async function _fetchPlayersRaw(): Promise<Record<string, SleeperPlayer>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${BASE}/players/nfl`, { signal: controller.signal });
    if (!res.ok) throw new SleeperError(`Sleeper ${res.status}: /players/nfl`);
    const raw = (await res.json()) as Record<
      string,
      {
        first_name?: string | null;
        last_name?: string | null;
        position?: string | null;
        team?: string | null;
        age?: number | null;
        years_exp?: number | null;
        search_rank?: number | null;
        active?: boolean;
      }
    >;
    // Slim the payload — the full response is ~16MB, well over Next.js's
    // 2MB unstable_cache limit. Only keep fields this tool uses.
    const slim: Record<string, SleeperPlayer> = {};
    for (const [id, p] of Object.entries(raw)) {
      if (!p.active) continue;
      slim[id] = {
        player_id: id,
        first_name: p.first_name ?? null,
        last_name: p.last_name ?? null,
        position: p.position ?? null,
        team: p.team ?? null,
        age: p.age ?? null,
        years_exp: p.years_exp ?? null,
        search_rank: p.search_rank ?? null,
        active: true,
      };
    }
    return slim;
  } finally {
    clearTimeout(timeout);
  }
}

export const getPlayers = unstable_cache(
  _fetchPlayersRaw,
  ["taxi-filler-players"],
  { revalidate: 3600 },
);
```

- [ ] **Step 3: Verify types compile**

```bash
npm run typecheck
```

Expected: no errors from the two new files.

- [ ] **Step 4: Commit**

```bash
git add src/lib/taxi-filler/types.ts src/lib/taxi-filler/sleeper.ts
git commit -m "feat(taxi-filler): add types and Sleeper client"
```

---

## Task 2: Filter Logic (TDD)

**Files:**
- Create: `__tests__/taxi-filler/filter.test.ts`
- Create: `src/lib/taxi-filler/filter.ts`

**Interfaces:**
- Consumes: `SleeperRoster`, `SleeperPlayer`, `TaxiCandidate` from `@/lib/taxi-filler/types`
- Produces:
  - `deriveEligiblePositions(rosterPositions: string[]): string[]` — filters slot-only types, deduplicates, preserves order
  - `buildTaxiCandidates(rosters: SleeperRoster[], players: Record<string, SleeperPlayer>, leaguePositions: string[], taxiYears: number): TaxiCandidate[]`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/taxi-filler/filter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  buildTaxiCandidates,
  deriveEligiblePositions,
} from "@/lib/taxi-filler/filter";
import type { SleeperPlayer, SleeperRoster } from "@/lib/taxi-filler/types";

function makePlayer(overrides: Partial<SleeperPlayer> = {}): SleeperPlayer {
  return {
    player_id: "1",
    first_name: "John",
    last_name: "Doe",
    position: "WR",
    team: "SF",
    age: 22,
    years_exp: 0,
    search_rank: 100,
    active: true,
    ...overrides,
  };
}

const BASE_POSITIONS = ["QB", "RB", "WR", "TE"];

describe("deriveEligiblePositions", () => {
  it("excludes slot-only types", () => {
    expect(
      deriveEligiblePositions(["QB", "RB", "BN", "FLEX", "TAXI", "IR", "IDP_FLEX"]),
    ).toEqual(["QB", "RB"]);
  });

  it("deduplicates positions while preserving first-seen order", () => {
    expect(deriveEligiblePositions(["WR", "QB", "WR", "RB"])).toEqual([
      "WR",
      "QB",
      "RB",
    ]);
  });

  it("returns empty array when all positions are slot-only", () => {
    expect(deriveEligiblePositions(["BN", "FLEX", "TAXI"])).toEqual([]);
  });
});

describe("buildTaxiCandidates", () => {
  it("excludes players on any roster's players array", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      players: ["1"],
      taxi: null,
      reserve: null,
    };
    const players = { "1": makePlayer({ player_id: "1" }) };
    expect(buildTaxiCandidates([roster], players, BASE_POSITIONS, 1)).toEqual(
      [],
    );
  });

  it("excludes players on roster taxi array", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      players: [],
      taxi: ["1"],
      reserve: null,
    };
    const players = { "1": makePlayer({ player_id: "1" }) };
    expect(buildTaxiCandidates([roster], players, BASE_POSITIONS, 1)).toEqual(
      [],
    );
  });

  it("excludes players on roster reserve (IR) array", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      players: [],
      taxi: null,
      reserve: ["1"],
    };
    const players = { "1": makePlayer({ player_id: "1" }) };
    expect(buildTaxiCandidates([roster], players, BASE_POSITIONS, 1)).toEqual(
      [],
    );
  });

  it("ignores Sleeper sentinel '0' in roster arrays", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      players: ["0"],
      taxi: null,
      reserve: null,
    };
    const players = { "1": makePlayer({ player_id: "1" }) };
    const result = buildTaxiCandidates([roster], players, BASE_POSITIONS, 1);
    expect(result).toHaveLength(1);
  });

  it("excludes players with years_exp >= taxiYears (taxi_years=1 → only rookies)", () => {
    const players = {
      "1": makePlayer({ player_id: "1", years_exp: 1 }),
    };
    expect(buildTaxiCandidates([], players, BASE_POSITIONS, 1)).toEqual([]);
  });

  it("includes rookies (years_exp=0) when taxiYears=1", () => {
    const players = { "1": makePlayer({ player_id: "1", years_exp: 0 }) };
    const result = buildTaxiCandidates([], players, BASE_POSITIONS, 1);
    expect(result).toHaveLength(1);
    expect(result[0].yearsExp).toBe(0);
  });

  it("includes both rookies and 1-year players when taxiYears=2", () => {
    const players = {
      "1": makePlayer({ player_id: "1", years_exp: 0, search_rank: 10 }),
      "2": makePlayer({ player_id: "2", years_exp: 1, search_rank: 20 }),
      "3": makePlayer({ player_id: "3", years_exp: 2, search_rank: 5 }),
    };
    const result = buildTaxiCandidates([], players, BASE_POSITIONS, 2);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.yearsExp).sort()).toEqual([0, 1]);
  });

  it("excludes players whose position is not in leaguePositions", () => {
    const players = { "1": makePlayer({ player_id: "1", position: "K" }) };
    expect(buildTaxiCandidates([], players, BASE_POSITIONS, 1)).toEqual([]);
  });

  it("normalizes granular IDP positions before matching (DE → DL)", () => {
    const idpPositions = [...BASE_POSITIONS, "DL", "LB", "DB"];
    const players = { "1": makePlayer({ player_id: "1", position: "DE" }) };
    const result = buildTaxiCandidates([], players, idpPositions, 1);
    expect(result).toHaveLength(1);
    expect(result[0].position).toBe("DL");
  });

  it("normalizes CB → DB", () => {
    const positions = [...BASE_POSITIONS, "DB"];
    const players = { "1": makePlayer({ player_id: "1", position: "CB" }) };
    const result = buildTaxiCandidates([], players, positions, 1);
    expect(result[0].position).toBe("DB");
  });

  it("normalizes OLB → LB", () => {
    const positions = [...BASE_POSITIONS, "LB"];
    const players = { "1": makePlayer({ player_id: "1", position: "OLB" }) };
    const result = buildTaxiCandidates([], players, positions, 1);
    expect(result[0].position).toBe("LB");
  });

  it("sorts by searchRank ascending", () => {
    const players = {
      "1": makePlayer({ player_id: "1", search_rank: 200 }),
      "2": makePlayer({ player_id: "2", search_rank: 50 }),
    };
    const result = buildTaxiCandidates([], players, BASE_POSITIONS, 1);
    expect(result[0].searchRank).toBe(50);
    expect(result[1].searchRank).toBe(200);
  });

  it("sorts null searchRank players to the bottom", () => {
    const players = {
      "1": makePlayer({ player_id: "1", search_rank: null }),
      "2": makePlayer({ player_id: "2", search_rank: 100 }),
    };
    const result = buildTaxiCandidates([], players, BASE_POSITIONS, 1);
    expect(result[0].searchRank).toBe(100);
    expect(result[1].searchRank).toBeNull();
  });

  it("builds name from first_name + last_name", () => {
    const players = {
      "1": makePlayer({ player_id: "1", first_name: "Patrick", last_name: "Mahomes" }),
    };
    const result = buildTaxiCandidates([], players, BASE_POSITIONS, 1);
    expect(result[0].name).toBe("Patrick Mahomes");
  });

  it("handles null first_name gracefully", () => {
    const players = {
      "1": makePlayer({ player_id: "1", first_name: null, last_name: "Smith" }),
    };
    const result = buildTaxiCandidates([], players, BASE_POSITIONS, 1);
    expect(result[0].name).toBe("Smith");
  });

  it("returns team as null for free agents", () => {
    const players = {
      "1": makePlayer({ player_id: "1", team: null }),
    };
    const result = buildTaxiCandidates([], players, BASE_POSITIONS, 1);
    expect(result[0].team).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
npx vitest run __tests__/taxi-filler/filter.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/taxi-filler/filter'`

- [ ] **Step 3: Create `src/lib/taxi-filler/filter.ts`**

```typescript
import type { SleeperPlayer, SleeperRoster, TaxiCandidate } from "./types";

const SLOT_ONLY = new Set([
  "BN", "FLEX", "IDP_FLEX", "REC_FLEX", "SUPER_FLEX", "DEF", "TAXI", "IR",
]);

const POSITION_MAP: Record<string, string> = {
  DE: "DL", DT: "DL", NT: "DL",
  CB: "DB", S: "DB", SS: "DB", FS: "DB",
  OLB: "LB", ILB: "LB", MLB: "LB",
};

function normalizePosition(position: string): string {
  return POSITION_MAP[position] ?? position;
}

export function deriveEligiblePositions(rosterPositions: string[]): string[] {
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

export function buildTaxiCandidates(
  rosters: SleeperRoster[],
  players: Record<string, SleeperPlayer>,
  leaguePositions: string[],
  taxiYears: number,
): TaxiCandidate[] {
  // Build the set of all rostered player IDs across every roster.
  // NOTE: taxiYears semantics — Sleeper's taxi_years=1 means only season-1
  // players (years_exp=0) qualify; taxi_years=2 adds season-2 (years_exp=1).
  // Filter is years_exp < taxiYears. Verify against the real API if results
  // seem off and adjust this line.
  const rostered = new Set<string>();
  for (const roster of rosters) {
    for (const id of [
      ...(roster.players ?? []),
      ...(roster.taxi ?? []),
      ...(roster.reserve ?? []),
    ]) {
      if (id && id !== "0") rostered.add(id);
    }
  }

  const leaguePositionSet = new Set(leaguePositions);

  return Object.values(players)
    .filter((p) => {
      if (!p.active) return false;
      if (rostered.has(p.player_id)) return false;
      if ((p.years_exp ?? Infinity) >= taxiYears) return false;
      const normalized = p.position ? normalizePosition(p.position) : null;
      if (!normalized || !leaguePositionSet.has(normalized)) return false;
      return true;
    })
    .map((p) => ({
      playerId: p.player_id,
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown",
      position: normalizePosition(p.position!),
      team: p.team ?? null,
      age: p.age ?? null,
      yearsExp: p.years_exp ?? 0,
      searchRank: p.search_rank ?? null,
    }))
    .sort((a, b) => {
      if (a.searchRank === null && b.searchRank === null) return 0;
      if (a.searchRank === null) return 1;
      if (b.searchRank === null) return -1;
      return a.searchRank - b.searchRank;
    });
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
npx vitest run __tests__/taxi-filler/filter.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add __tests__/taxi-filler/filter.test.ts src/lib/taxi-filler/filter.ts
git commit -m "feat(taxi-filler): add filter logic with tests"
```

---

## Task 3: Entry Page

**Files:**
- Create: `src/app/taxi-filler/page.tsx`

**Interfaces:**
- Consumes: nothing from prior tasks (standalone server action)
- Produces: `/taxi-filler` route with league ID input form

- [ ] **Step 1: Create `src/app/taxi-filler/page.tsx`**

```tsx
import { redirect } from "next/navigation";

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
          Find rookies and young players on the waiver wire who are eligible
          for your league&apos;s taxi squad — ranked by Sleeper&apos;s player
          rating so you can spot the best stashes fast.
        </p>
      </section>

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

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/taxi-filler/page.tsx
git commit -m "feat(taxi-filler): add league ID entry page"
```

---

## Task 4: TaxiFillerTable Component

**Files:**
- Create: `src/components/taxi-filler/TaxiFillerTable.tsx`

**Interfaces:**
- Consumes: `TaxiCandidate` from `@/lib/taxi-filler/types`
- Produces: `<TaxiFillerTable candidates={TaxiCandidate[]} positions={string[]} />` — used by Task 5's results page

- [ ] **Step 1: Create `src/components/taxi-filler/TaxiFillerTable.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { TaxiCandidate } from "@/lib/taxi-filler/types";

export default function TaxiFillerTable({
  candidates,
  positions,
}: {
  candidates: TaxiCandidate[];
  positions: string[];
}) {
  const [activePosition, setActivePosition] = useState<string>("All");

  // Only show a position tab if at least one candidate has that position.
  const presentPositions = positions.filter((pos) =>
    candidates.some((c) => c.position === pos),
  );

  const filtered =
    activePosition === "All"
      ? candidates
      : candidates.filter((c) => c.position === activePosition);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["All", ...presentPositions].map((pos) => (
          <button
            key={pos}
            onClick={() => setActivePosition(pos)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              activePosition === pos
                ? "bg-green-700 text-white"
                : "border border-gray-200 bg-white text-gray-700 hover:border-green-600/50 dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-300 dark:hover:border-green-600/50"
            }`}
          >
            {pos}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-pitch-700">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {["Rank", "Name", "Position", "Team", "Age", "Exp"].map((col) => (
                <th
                  key={col}
                  className="border-b border-gray-200 bg-green-700 px-4 py-2.5 text-center font-bold text-white dark:border-pitch-700"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.playerId}
                className="border-b border-gray-100 dark:border-pitch-700"
              >
                {/* Left border on first cell — border-l on <tr> doesn't render inside border-collapse tables */}
                <td
                  className={`px-4 py-2 text-center text-gray-700 dark:text-slate-300 ${
                    c.yearsExp === 0 ? "border-l-2 border-l-green-500" : ""
                  }`}
                >
                  {c.searchRank ?? "—"}
                </td>
                <td className="px-4 py-2 text-center font-medium text-gray-900 dark:text-slate-100">
                  {c.name}
                </td>
                <td className="px-4 py-2 text-center text-gray-700 dark:text-slate-300">
                  {c.position}
                </td>
                <td className="px-4 py-2 text-center text-gray-700 dark:text-slate-300">
                  {c.team ?? "FA"}
                </td>
                <td className="px-4 py-2 text-center text-gray-700 dark:text-slate-300">
                  {c.age ?? "—"}
                </td>
                <td className="px-4 py-2 text-center text-gray-700 dark:text-slate-300">
                  {c.yearsExp === 0 ? "Rookie" : `${c.yearsExp} yr`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/taxi-filler/TaxiFillerTable.tsx
git commit -m "feat(taxi-filler): add TaxiFillerTable component"
```

---

## Task 5: Results Page

**Files:**
- Create: `src/app/taxi-filler/[leagueId]/page.tsx`

**Interfaces:**
- Consumes: `getLeague`, `getRosters`, `getPlayers` from `@/lib/taxi-filler/sleeper`; `buildTaxiCandidates`, `deriveEligiblePositions` from `@/lib/taxi-filler/filter`; `<TaxiFillerTable>` from `@/components/taxi-filler/TaxiFillerTable`

- [ ] **Step 1: Create `src/app/taxi-filler/[leagueId]/page.tsx`**

```tsx
import Link from "next/link";
import TaxiFillerTable from "@/components/taxi-filler/TaxiFillerTable";
import { getLeague, getRosters, getPlayers } from "@/lib/taxi-filler/sleeper";
import {
  buildTaxiCandidates,
  deriveEligiblePositions,
} from "@/lib/taxi-filler/filter";

export const revalidate = 300;

export default async function TaxiFillerLeaguePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  const [league, rosters, players] = await Promise.all([
    getLeague(leagueId),
    getRosters(leagueId),
    getPlayers(),
  ]);

  if (!league) {
    return (
      <main className="mx-auto max-w-2xl py-12 text-center">
        <p className="mb-4 text-gray-600 dark:text-slate-300">
          No Sleeper league matched &ldquo;{leagueId}&rdquo;. Check the ID and
          try again.
        </p>
        <Link
          href="/taxi-filler"
          className="text-sm text-green-600 hover:underline dark:text-green-400"
        >
          ← Try another league
        </Link>
      </main>
    );
  }

  const taxiYears = league.settings.taxi_years ?? 1;
  const leaguePositions = deriveEligiblePositions(league.roster_positions);
  const candidates = buildTaxiCandidates(rosters, players, leaguePositions, taxiYears);

  const subtitle =
    taxiYears === 1
      ? "Showing rookies available on waivers"
      : `Showing rookies + players with up to ${taxiYears - 1} year${
          taxiYears - 1 === 1 ? "" : "s"
        } of experience available on waivers`;

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-gray-900 dark:text-slate-100">
            {league.name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>
        <Link
          href="/taxi-filler"
          className="text-sm text-green-600 hover:underline dark:text-green-400"
        >
          ← Try another league
        </Link>
      </div>

      {candidates.length === 0 ? (
        <p className="text-gray-600 dark:text-slate-300">
          No eligible players found on the waiver wire for this league&apos;s
          taxi settings.
        </p>
      ) : (
        <TaxiFillerTable candidates={candidates} positions={leaguePositions} />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Build to confirm no server-component errors**

```bash
npm run build
```

Expected: successful build. If the build fetches live data and times out, that's a network issue in CI — the build itself should not error on missing data.

- [ ] **Step 4: Commit**

```bash
git add src/app/taxi-filler/[leagueId]/page.tsx
git commit -m "feat(taxi-filler): add results page"
```

---

## Task 6: NavBar + Landing Page

**Files:**
- Modify: `src/app/(components)/NavBar.jsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: nothing from prior tasks — pure navigation wiring

- [ ] **Step 1: Add "Taxi Filler" to NavBar Tools dropdown**

In `src/app/(components)/NavBar.jsx`, find the `dropdowns` array and add the new link to the Tools group:

```js
// Before:
{
  label: "Tools",
  links: [
    { href: "/idp-checker", label: "Waiver Check" },
    { href: "/roster-management", label: "Roster Management" },
  ],
},

// After:
{
  label: "Tools",
  links: [
    { href: "/idp-checker", label: "Waiver Check" },
    { href: "/roster-management", label: "Roster Management" },
    { href: "/taxi-filler", label: "Taxi Filler" },
  ],
},
```

- [ ] **Step 2: Add Taxi Filler card to landing page**

In `src/app/page.tsx`, find the `tools` array and append the new card:

```ts
// Add after the roster-management entry:
{
  href: "/taxi-filler",
  icon: "🚕",
  title: "Taxi Filler",
  description:
    "Find rookies and young players on the waiver wire who qualify for your taxi squad. Ranked by Sleeper's player rating so you can spot the best stashes quickly.",
  cta: "Find taxi targets",
},
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass including the new `__tests__/taxi-filler/filter.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/app/(components)/NavBar.jsx src/app/page.tsx
git commit -m "feat(taxi-filler): wire into NavBar and landing page"
```

---

## Verification Checklist

After all tasks are complete, manually verify in the dev server (`npm run dev`):

- [ ] `/taxi-filler` loads — shows entry form with "Find players" button
- [ ] Pasting a Sleeper URL into the input extracts the league ID and redirects
- [ ] An invalid ID shows the error message and stays on the entry page
- [ ] `/taxi-filler/[leagueId]` loads — shows league name, subtitle, position tabs, and player table
- [ ] Rookies have the green left border; 1-year players do not
- [ ] Position tabs filter the table correctly; "All" shows everything
- [ ] Rank column shows "—" for players with no `search_rank`
- [ ] Team column shows "FA" for free agents with no team
- [ ] "← Try another league" link returns to `/taxi-filler`
- [ ] NavBar → Tools dropdown shows "Taxi Filler" and links correctly
- [ ] Landing page shows the Taxi Filler card
- [ ] Dark mode looks correct throughout
