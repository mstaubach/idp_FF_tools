# Roster Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder Injury Tracker with a Roster Management tool that shows a positional depth chart (Starting / Bench / Taxi / IR) for any team in a Sleeper IDP dynasty league.

**Architecture:** Three-level server-rendered routing (`/roster-management` → `[leagueId]` → `[rosterId]`) following the trade-tracker pattern. Pure business logic lives in `src/lib/roster-management/depth-chart.ts` and is fully unit-tested. The `DepthChartTable` server component receives a pre-built `DepthChartGrid` and renders an HTML table.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Tailwind CSS, Vitest, Sleeper public API.

## Global Constraints

- TypeScript `strict` mode is on. No `any` casts.
- Path alias `@/*` maps to `src/*` (configured in both `tsconfig.json` and `vitest.config.ts`).
- All code is namespaced under `src/lib/roster-management/`, `src/components/roster-management/`, `src/app/roster-management/`. Do **not** import from or share with `idp-checker` or `trade-tracker` namespaces.
- Sleeper API base: `https://api.sleeper.app/v1`.
- League endpoints use `fetch` with `next: { revalidate: 300 }`. Player DB uses `unstable_cache` with 1-hour TTL.
- No API route handlers — all fetching in server components.
- Tailwind palette: `green-700` primary, `amber-400` secondary, `pitch-900/800/700` dark surfaces, `gray-50/white/gray-200` light surfaces, `slate-100/300` dark text, `gray-900/600` light text.
- Run `npm run typecheck && npm test` before each commit to catch regressions.

---

### Task 1: Types + Sleeper API Client

**Files:**
- Create: `src/lib/roster-management/types.ts`
- Create: `src/lib/roster-management/sleeper.ts`

**Interfaces:**
- Produces: `SleeperLeague`, `SleeperRoster`, `SleeperPlayer`, `SleeperUser` types; exported functions `getLeague`, `getRosters`, `getUsers`, `getPlayers`.

- [ ] **Step 1: Create `src/lib/roster-management/types.ts`**

```ts
// Shapes returned by the public Sleeper API. Only fields this tool uses are typed.

export type SleeperLeague = {
  name: string;
  roster_positions: string[];
};

export type SleeperRoster = {
  roster_id: number;
  owner_id: string | null;
  starters: string[];
  players: string[];
  taxi: string[] | null;
  reserve: string[] | null;
};

export type SleeperPlayer = {
  player_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
};

export type SleeperUser = {
  user_id: string;
  display_name: string;
};
```

- [ ] **Step 2: Create `src/lib/roster-management/sleeper.ts`**

```ts
import { unstable_cache } from "next/cache";
import type {
  SleeperLeague,
  SleeperPlayer,
  SleeperRoster,
  SleeperUser,
} from "./types";

const BASE = "https://api.sleeper.app/v1";

class SleeperError extends Error {}

async function getJson<T>(
  path: string,
  revalidate: number,
): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate } });
  if (res.status === 404) return null;
  if (!res.ok) throw new SleeperError(`Sleeper ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export async function getLeague(
  leagueId: string,
): Promise<SleeperLeague | null> {
  return getJson<SleeperLeague>(`/league/${leagueId}`, 300);
}

export async function getRosters(leagueId: string): Promise<SleeperRoster[]> {
  return (
    (await getJson<SleeperRoster[]>(`/league/${leagueId}/rosters`, 300)) ?? []
  );
}

export async function getUsers(leagueId: string): Promise<SleeperUser[]> {
  return (
    (await getJson<SleeperUser[]>(`/league/${leagueId}/users`, 300)) ?? []
  );
}

async function _fetchPlayersRaw(): Promise<Record<string, SleeperPlayer>> {
  const res = await fetch(`${BASE}/players/nfl`);
  if (!res.ok) throw new SleeperError(`Sleeper ${res.status}: /players/nfl`);
  return res.json() as Promise<Record<string, SleeperPlayer>>;
}

export const getPlayers = unstable_cache(
  _fetchPlayersRaw,
  ["roster-management-players"],
  { revalidate: 3600 },
);
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/roster-management/types.ts src/lib/roster-management/sleeper.ts
git commit -m "feat(roster-management): add Sleeper API client and types"
```

---

### Task 2: Depth Chart Logic (TDD)

**Files:**
- Create: `src/lib/roster-management/depth-chart.ts`
- Create: `__tests__/roster-management/lib/depth-chart.test.ts`

**Interfaces:**
- Consumes: `SleeperRoster`, `SleeperPlayer` from `@/lib/roster-management/types`
- Produces:
  - `derivePositionColumns(rosterPositions: string[]): string[]`
  - `normalizePosition(position: string | null): string | null`
  - `buildDepthChart(roster: SleeperRoster, players: Record<string, SleeperPlayer>, positions: string[]): DepthChartGrid`
  - `type DepthChartGrid = { positions: string[]; sections: DepthChartSection[] }`
  - `type DepthChartSection = { label: 'Starting' | 'Bench' | 'Taxi' | 'IR'; rows: (string | null)[][] }`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/roster-management/lib/depth-chart.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  buildDepthChart,
  derivePositionColumns,
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

// ── buildDepthChart ────────────────────────────────────────────────────────

const POSITIONS = ["QB", "RB", "WR", "TE", "DL", "LB", "DB"];

const PLAYERS: Record<string, SleeperPlayer> = {
  "1": { player_id: "1", first_name: "Justin", last_name: "Herbert", position: "QB" },
  "2": { player_id: "2", first_name: "Christian", last_name: "McCaffrey", position: "RB" },
  "3": { player_id: "3", first_name: "Davante", last_name: "Adams", position: "WR" },
  "4": { player_id: "4", first_name: "Travis", last_name: "Kelce", position: "TE" },
  "5": { player_id: "5", first_name: "Tyler", last_name: "Williams", position: "WR" },
  "6": { player_id: "6", first_name: "Garrett", last_name: "Williams", position: "DB" },
  "7": { player_id: "7", first_name: "Micah", last_name: "Parsons", position: "LB" },
  "8": { player_id: "8", first_name: "Myles", last_name: "Garrett", position: "DE" },
};

describe("buildDepthChart", () => {
  it("assigns starters to Starting section in correct position columns", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: ["1", "2", "3"],
      players: ["1", "2", "3"],
      taxi: null,
      reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting).toBeDefined();
    expect(starting.rows[0][POSITIONS.indexOf("QB")]).toBe("Herbert");
    expect(starting.rows[0][POSITIONS.indexOf("RB")]).toBe("McCaffrey");
    expect(starting.rows[0][POSITIONS.indexOf("WR")]).toBe("Adams");
  });

  it("assigns non-starter non-taxi non-reserve players to Bench", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: ["1"],
      players: ["1", "4"],
      taxi: null,
      reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const bench = grid.sections.find((s) => s.label === "Bench")!;
    expect(bench).toBeDefined();
    expect(bench.rows[0][POSITIONS.indexOf("TE")]).toBe("Kelce");
  });

  it("ignores empty starter slots ('0')", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: ["1", "0", "0"],
      players: ["1"],
      taxi: null,
      reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting.rows).toHaveLength(1);
  });

  it("omits sections that have no players", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: ["1"],
      players: ["1"],
      taxi: null,
      reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const labels = grid.sections.map((s) => s.label);
    expect(labels).not.toContain("Taxi");
    expect(labels).not.toContain("IR");
    expect(labels).not.toContain("Bench");
  });

  it("assigns taxi players to Taxi section", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: [],
      players: ["7"],
      taxi: ["7"],
      reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const taxi = grid.sections.find((s) => s.label === "Taxi")!;
    expect(taxi).toBeDefined();
    expect(taxi.rows[0][POSITIONS.indexOf("LB")]).toBe("Parsons");
  });

  it("assigns reserve players to IR section", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: [],
      players: ["4"],
      taxi: null,
      reserve: ["4"],
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const ir = grid.sections.find((s) => s.label === "IR")!;
    expect(ir).toBeDefined();
    expect(ir.rows[0][POSITIONS.indexOf("TE")]).toBe("Kelce");
  });

  it("disambiguates players sharing a last name with first initial", () => {
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
    // Both Williams are on the roster so both get first-initial prefix
    expect(starting.rows[0][POSITIONS.indexOf("WR")]).toBe("T. Williams");
  });

  it("maps DE to the DL column via normalizePosition", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: ["8"],
      players: ["8"],
      taxi: null,
      reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting.rows[0][POSITIONS.indexOf("DL")]).toBe("Garrett");
  });

  it("builds multiple rows when a position has more than one player in a section", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: ["3", "5"],   // two WRs
      players: ["3", "5"],
      taxi: null,
      reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting.rows).toHaveLength(2);
    // Second row: WR cell filled, QB cell null
    expect(starting.rows[1][POSITIONS.indexOf("QB")]).toBeNull();
    expect(starting.rows[1][POSITIONS.indexOf("WR")]).not.toBeNull();
  });

  it("skips players whose position is not in the positions list", () => {
    const kicker: SleeperPlayer = {
      player_id: "99",
      first_name: "Justin",
      last_name: "Tucker",
      position: "K",
    };
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: ["99"],
      players: ["99"],
      taxi: null,
      reserve: null,
    };
    // POSITIONS does not include K
    const grid = buildDepthChart(roster, { "99": kicker }, POSITIONS);
    // No sections because the only player has no column
    expect(grid.sections).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the tests — verify they fail**

```bash
npx vitest run __tests__/roster-management/lib/depth-chart.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/roster-management/depth-chart.ts`**

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

export type DepthChartSection = {
  label: "Starting" | "Bench" | "Taxi" | "IR";
  rows: (string | null)[][];
};

export type DepthChartGrid = {
  positions: string[];
  sections: DepthChartSection[];
};

function buildDisplayNames(
  playerIds: string[],
  players: Record<string, SleeperPlayer>,
): Map<string, string> {
  const lastNameCounts = new Map<string, number>();
  for (const id of playerIds) {
    const lastName = players[id]?.last_name;
    if (!lastName) continue;
    lastNameCounts.set(lastName, (lastNameCounts.get(lastName) ?? 0) + 1);
  }

  const result = new Map<string, string>();
  for (const id of playerIds) {
    const p = players[id];
    if (!p?.last_name) continue;
    const ambiguous = (lastNameCounts.get(p.last_name) ?? 0) > 1;
    result.set(
      id,
      ambiguous && p.first_name
        ? `${p.first_name[0]}. ${p.last_name}`
        : p.last_name,
    );
  }
  return result;
}

function buildSection(
  label: DepthChartSection["label"],
  playerIds: string[],
  positions: string[],
  players: Record<string, SleeperPlayer>,
  displayNames: Map<string, string>,
): DepthChartSection | null {
  // Discard empty Sleeper sentinel ("0") and unknown player IDs.
  const valid = playerIds.filter((id) => id !== "0" && players[id]);
  if (valid.length === 0) return null;

  const byPosition = new Map<string, string[]>();
  for (const id of valid) {
    const pos = normalizePosition(players[id].position ?? null);
    if (!pos || !positions.includes(pos)) continue;
    const group = byPosition.get(pos) ?? [];
    group.push(id);
    byPosition.set(pos, group);
  }

  const maxRows = Math.max(
    0,
    ...positions.map((p) => byPosition.get(p)?.length ?? 0),
  );
  if (maxRows === 0) return null;

  const rows: (string | null)[][] = Array.from({ length: maxRows }, (_, r) =>
    positions.map((pos) => {
      const id = byPosition.get(pos)?.[r];
      return id !== undefined ? (displayNames.get(id) ?? null) : null;
    }),
  );

  return { label, rows };
}

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

  // Compute display names across all players on the roster so disambiguation
  // is consistent regardless of which section a player appears in.
  const allIds = [...roster.players, ...(roster.taxi ?? []), ...(roster.reserve ?? [])];
  const displayNames = buildDisplayNames(allIds, players);

  const sections: DepthChartSection[] = [];

  const starting = buildSection("Starting", roster.starters, positions, players, displayNames);
  if (starting) sections.push(starting);

  const benchSection = buildSection("Bench", bench, positions, players, displayNames);
  if (benchSection) sections.push(benchSection);

  const taxiSection = buildSection("Taxi", roster.taxi ?? [], positions, players, displayNames);
  if (taxiSection) sections.push(taxiSection);

  const irSection = buildSection("IR", roster.reserve ?? [], positions, players, displayNames);
  if (irSection) sections.push(irSection);

  return { positions, sections };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run __tests__/roster-management/lib/depth-chart.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/roster-management/depth-chart.ts __tests__/roster-management/lib/depth-chart.test.ts
git commit -m "feat(roster-management): add depth chart logic with tests"
```

---

### Task 3: Entry Form + Team Picker Pages

**Files:**
- Create: `src/app/roster-management/page.tsx`
- Create: `src/app/roster-management/[leagueId]/page.tsx`

**Interfaces:**
- Consumes: `getLeague`, `getRosters`, `getUsers` from `@/lib/roster-management/sleeper`

- [ ] **Step 1: Create entry form `src/app/roster-management/page.tsx`**

```tsx
import { redirect } from "next/navigation";

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

- [ ] **Step 2: Create team picker `src/app/roster-management/[leagueId]/page.tsx`**

```tsx
import Link from "next/link";
import { getLeague, getRosters, getUsers } from "@/lib/roster-management/sleeper";

export const revalidate = 300;

export default async function RosterManagementLeaguePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  const [league, rosters, users] = await Promise.all([
    getLeague(leagueId),
    getRosters(leagueId),
    getUsers(leagueId),
  ]);

  if (!league) {
    return (
      <main className="mx-auto max-w-2xl py-12 text-center">
        <p className="mb-4 text-gray-600 dark:text-slate-300">
          No Sleeper league matched &ldquo;{leagueId}&rdquo;. Check the ID and
          try again.
        </p>
        <Link
          href="/roster-management"
          className="text-sm text-green-600 hover:underline dark:text-green-400"
        >
          ← Try another league
        </Link>
      </main>
    );
  }

  const userMap = new Map(users.map((u) => [u.user_id, u.display_name]));

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-gray-900 dark:text-slate-100">
            {league.name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Pick a team to view its depth chart
          </p>
        </div>
        <Link
          href="/roster-management"
          className="text-sm text-green-600 hover:underline dark:text-green-400"
        >
          ← Try another league
        </Link>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {rosters.map((roster) => {
          const ownerName = roster.owner_id
            ? (userMap.get(roster.owner_id) ?? "Unknown")
            : "Unowned";
          return (
            <li key={roster.roster_id}>
              <Link
                href={`/roster-management/${leagueId}/${roster.roster_id}`}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 transition hover:border-green-600/50 dark:border-pitch-700 dark:bg-pitch-800/60 dark:hover:border-green-600/50"
              >
                <span className="font-semibold text-gray-900 dark:text-slate-100">
                  {ownerName}
                </span>
                <span className="text-sm text-gray-500 dark:text-slate-400">
                  Team {roster.roster_id}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck and build**

```bash
npm run typecheck && npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/roster-management/page.tsx src/app/roster-management/[leagueId]/page.tsx
git commit -m "feat(roster-management): add entry form and team picker pages"
```

---

### Task 4: DepthChartTable Component + Depth Chart Page

**Files:**
- Create: `src/components/roster-management/DepthChartTable.tsx`
- Create: `src/app/roster-management/[leagueId]/[rosterId]/page.tsx`

**Interfaces:**
- Consumes: `DepthChartGrid`, `DepthChartSection` from `@/lib/roster-management/depth-chart`; `getLeague`, `getRosters`, `getUsers`, `getPlayers` from `@/lib/roster-management/sleeper`; `buildDepthChart`, `derivePositionColumns` from `@/lib/roster-management/depth-chart`

- [ ] **Step 1: Create `src/components/roster-management/DepthChartTable.tsx`**

This is a server component — `overflow-x-auto` is CSS-only and needs no client-side JS.

```tsx
import type { DepthChartGrid } from "@/lib/roster-management/depth-chart";

export default function DepthChartTable({ grid }: { grid: DepthChartGrid }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-pitch-700">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-gray-200 bg-gray-100 px-4 py-2.5 text-left font-bold text-gray-700 dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-300">
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
          {grid.sections.map((section, si) =>
            section.rows.map((row, ri) => (
              <tr
                key={`${section.label}-${ri}`}
                className={
                  si > 0 && ri === 0
                    ? "border-t-2 border-gray-300 dark:border-pitch-600"
                    : ""
                }
              >
                <td className="border-b border-gray-100 px-4 py-2 font-bold text-gray-700 dark:border-pitch-700 dark:text-slate-300">
                  {section.label}
                </td>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="border-b border-l border-gray-100 px-4 py-2 text-gray-900 dark:border-pitch-700 dark:text-slate-100"
                  >
                    {cell ?? ""}
                  </td>
                ))}
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create depth chart page `src/app/roster-management/[leagueId]/[rosterId]/page.tsx`**

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

export const revalidate = 300;

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
}
```

- [ ] **Step 3: Typecheck and build**

```bash
npm run typecheck && npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/roster-management/DepthChartTable.tsx src/app/roster-management/[leagueId]/[rosterId]/page.tsx
git commit -m "feat(roster-management): add DepthChartTable and depth chart page"
```

---

### Task 5: Navigation, Homepage, Delete Injury Tracker

**Files:**
- Modify: `src/app/(components)/NavBar.jsx`
- Modify: `src/app/page.tsx`
- Delete: `src/app/injury-tracker/page.tsx`

- [ ] **Step 1: Update NavBar to replace the injury-tracker link**

In `src/app/(components)/NavBar.jsx`, change the `links` array from:

```js
const links = [
  { href: "/", label: "Home" },
  { href: "/standings", label: "Standings" },
  { href: "/trade-tracker", label: "Trade Tracker" },
  { href: "/idp-checker", label: "Waiver Check" },
  { href: "/injury-tracker", label: "Injury Tracker" },
];
```

To:

```js
const links = [
  { href: "/", label: "Home" },
  { href: "/standings", label: "Standings" },
  { href: "/trade-tracker", label: "Trade Tracker" },
  { href: "/idp-checker", label: "Waiver Check" },
  { href: "/roster-management", label: "Roster Management" },
];
```

- [ ] **Step 2: Update homepage tool card in `src/app/page.tsx`**

In `src/app/page.tsx`, replace the injury-tracker entry in the `tools` array:

```ts
// Remove this:
{
  href: "/injury-tracker",
  icon: "🚑",
  title: "Injury Tracker",
  description:
    "Keep tabs on injury news for the players on your rosters — practice status, game designations, and return timelines.",
  cta: "Coming soon",
  soon: true,
},
```

```ts
// Add this:
{
  href: "/roster-management",
  icon: "📋",
  title: "Roster Management",
  description:
    "See your entire dynasty roster as a depth chart — starters, bench, taxi, and IR organized by position. Built for IDP leagues.",
  cta: "View depth chart",
},
```

- [ ] **Step 3: Delete the injury-tracker route (stages the deletion)**

```bash
git rm src/app/injury-tracker/page.tsx
rmdir src/app/injury-tracker
```

- [ ] **Step 4: Typecheck and full build**

```bash
npm run typecheck && npm run build
```

Expected: no errors, no references to `/injury-tracker` remaining in the build.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/(components)/NavBar.jsx src/app/page.tsx
git commit -m "feat(roster-management): wire into nav and homepage, remove injury tracker"
```
