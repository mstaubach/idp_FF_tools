# All-Time Standings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the standings page into a running all-time tally of the dynasty's wins, losses, and championships per manager, with a champions-by-year strip and a drill-down to any single season.

**Architecture:** A new self-contained `src/lib/standings/` namespace: pure aggregation logic (`history.ts`) builds an all-time `LeagueHistory` keyed by Sleeper owner; a separate Sleeper client (`sleeper.ts`) walks the dynasty's `previous_league_id` chain and fetches per-season rosters/users/brackets. The server page computes the history and passes it to a small client component that toggles between the all-time view and a selected season.

**Tech Stack:** Next.js 16 App Router (server + client components), TypeScript (strict), Tailwind, Vitest + Testing Library.

## Global Constraints

- TypeScript `strict` is on; all new code must typecheck under `tsc --noEmit`.
- Path alias `@/*` → `src/*` (works in both `tsconfig.json` and `vitest.config.ts`).
- The `standings` Sleeper client and types are a **separate namespace** — do NOT import from or merge with `src/lib/trade-tracker/` or `src/lib/idp-checker/`.
- Standings pages must make **no network calls at build time** — the page stays dynamic; the client uses per-call `next: { revalidate }` TTLs.
- Win/loss tally = **regular season only** (Sleeper `settings.wins/losses/ties`). Championships are tracked separately.
- Team identity = Sleeper **owner `user_id`**. Departed managers stay visible; current-season members are flagged.
- Champion = winner of the `winners_bracket` match where `p === 1`; only completed seasons (decided final) produce a champion.
- Tests live under `__tests__/standings/` mirroring `src/lib`. Run `npm test` and `npm run typecheck` locally before pushing (CI does not run tests).
- House style: dark slate (`pitch-*`) palette, `emerald` accents — match existing components.

---

### Task 1: Standings types + pure history builder

**Files:**
- Create: `src/lib/standings/types.ts`
- Create: `src/lib/standings/history.ts`
- Test: `__tests__/standings/lib/history.test.ts`

**Interfaces:**
- Consumes: nothing (foundational task).
- Produces (relied on by Tasks 2 & 3):
  - Types in `src/lib/standings/types.ts`:
    - `League` = `{ league_id: string; name: string; season: string; previous_league_id: string | null; total_rosters: number; status?: string }`
    - `RosterSettings` = `{ wins: number; losses: number; ties: number; fpts?: number }`
    - `Roster` = `{ roster_id: number; owner_id: string | null; settings: RosterSettings }`
    - `SleeperUser` = `{ user_id: string; display_name: string; metadata?: { team_name?: string } }`
    - `BracketMatch` = `{ r: number; m: number; t1: number | null; t2: number | null; w: number | null; l: number | null; p?: number }`
    - `SeasonInput` = `{ league: League; rosters: Roster[]; users: SleeperUser[]; bracket: BracketMatch[] }`
    - `SeasonRow` = `{ ownerId: string; teamName: string; wins: number; losses: number; ties: number; rank: number }`
    - `SeasonStandings` = `{ season: string; leagueId: string; championOwnerId: string | null; rows: SeasonRow[] }`
    - `ManagerRecord` = `{ ownerId: string; displayName: string; wins: number; losses: number; ties: number; championships: number; winPct: number; isCurrentMember: boolean }`
    - `ChampionEntry` = `{ season: string; ownerId: string; teamName: string }`
    - `LeagueHistory` = `{ allTime: ManagerRecord[]; seasons: SeasonStandings[]; champions: ChampionEntry[] }`
  - Functions in `src/lib/standings/history.ts`:
    - `teamNameFor(user: SleeperUser | undefined): string`
    - `championOwnerId(bracket: BracketMatch[], rosters: Roster[]): string | null`
    - `buildSeasonStandings(input: SeasonInput): SeasonStandings`
    - `buildLeagueHistory(seasons: SeasonInput[]): LeagueHistory` — `seasons` passed newest-first; the newest season's members are flagged `isCurrentMember`.

- [ ] **Step 1: Create the types module**

Create `src/lib/standings/types.ts`:

```ts
// Sleeper API response shapes this tool consumes (only fields used are typed),
// plus the standings tool's own output shapes. Intentionally separate from the
// trade-tracker and idp-checker type modules — do not share or merge.

export interface League {
  league_id: string;
  name: string;
  season: string;
  previous_league_id: string | null;
  total_rosters: number;
  status?: string;
}

export interface RosterSettings {
  wins: number;
  losses: number;
  ties: number;
  fpts?: number;
}

export interface Roster {
  roster_id: number;
  owner_id: string | null;
  settings: RosterSettings;
}

export interface SleeperUser {
  user_id: string;
  display_name: string;
  metadata?: { team_name?: string };
}

// One match in /league/{id}/winners_bracket. The championship game is p === 1;
// `w` is the winning roster_id.
export interface BracketMatch {
  r: number;
  m: number;
  t1: number | null;
  t2: number | null;
  w: number | null;
  l: number | null;
  p?: number;
}

// Raw per-season data handed to the pure builder.
export interface SeasonInput {
  league: League;
  rosters: Roster[];
  users: SleeperUser[];
  bracket: BracketMatch[];
}

export interface SeasonRow {
  ownerId: string;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  rank: number;
}

export interface SeasonStandings {
  season: string;
  leagueId: string;
  championOwnerId: string | null;
  rows: SeasonRow[];
}

export interface ManagerRecord {
  ownerId: string;
  displayName: string;
  wins: number;
  losses: number;
  ties: number;
  championships: number;
  winPct: number;
  isCurrentMember: boolean;
}

export interface ChampionEntry {
  season: string;
  ownerId: string;
  teamName: string;
}

export interface LeagueHistory {
  allTime: ManagerRecord[];
  seasons: SeasonStandings[];
  champions: ChampionEntry[];
}
```

- [ ] **Step 2: Write the failing tests**

Create `__tests__/standings/lib/history.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  championOwnerId,
  buildSeasonStandings,
  buildLeagueHistory,
} from '@/lib/standings/history';
import type { SeasonInput } from '@/lib/standings/types';

// Helpers to build raw season inputs concisely.
function roster(roster_id: number, owner_id: string | null, w: number, l: number, t = 0, fpts = 0) {
  return { roster_id, owner_id, settings: { wins: w, losses: l, ties: t, fpts } };
}
function user(user_id: string, team_name: string, display_name = user_id) {
  return { user_id, display_name, metadata: { team_name } };
}

// A 4-team season. Roster 1 (alice) wins the title.
function season2024(): SeasonInput {
  return {
    league: { league_id: 'L24', name: 'Dynasty', season: '2024', previous_league_id: null, total_rosters: 4, status: 'complete' },
    rosters: [roster(1, 'alice', 10, 4, 0, 1500), roster(2, 'bob', 8, 6, 0, 1400), roster(3, 'carol', 6, 8, 0, 1300), roster(4, 'dave', 4, 10, 0, 1200)],
    users: [user('alice', 'Alice FC'), user('bob', 'Bob United'), user('carol', 'Carol City'), user('dave', 'Dave Rovers')],
    bracket: [{ r: 1, m: 1, t1: 1, t2: 4, w: 1, l: 4 }, { r: 1, m: 2, t1: 2, t2: 3, w: 2, l: 3 }, { r: 2, m: 3, t1: 1, t2: 2, w: 1, l: 2, p: 1 }],
  };
}

describe('championOwnerId', () => {
  it('returns the owner of the roster that won the p===1 match', () => {
    const s = season2024();
    expect(championOwnerId(s.bracket, s.rosters)).toBe('alice');
  });

  it('returns null when no final is decided', () => {
    const s = season2024();
    const undecided = s.bracket.map((m) => (m.p === 1 ? { ...m, w: null } : m));
    expect(championOwnerId(undecided, s.rosters)).toBeNull();
  });

  it('returns null when there is no championship match', () => {
    expect(championOwnerId([], season2024().rosters)).toBeNull();
  });
});

describe('buildSeasonStandings', () => {
  it('ranks rows by wins desc, then losses asc, then fpts desc', () => {
    const s = buildSeasonStandings(season2024());
    expect(s.rows.map((r) => r.ownerId)).toEqual(['alice', 'bob', 'carol', 'dave']);
    expect(s.rows[0].rank).toBe(1);
    expect(s.rows[3].rank).toBe(4);
  });

  it('resolves team names and the champion owner', () => {
    const s = buildSeasonStandings(season2024());
    expect(s.rows[0].teamName).toBe('Alice FC');
    expect(s.championOwnerId).toBe('alice');
    expect(s.season).toBe('2024');
  });
});

describe('buildLeagueHistory', () => {
  it('sums W/L/T across seasons and counts championships per owner', () => {
    const s2024 = season2024();
    const s2025: SeasonInput = {
      league: { league_id: 'L25', name: 'Dynasty', season: '2025', previous_league_id: 'L24', total_rosters: 4, status: 'complete' },
      rosters: [roster(1, 'alice', 9, 5, 0, 1450), roster(2, 'bob', 11, 3, 0, 1600), roster(3, 'carol', 7, 7, 0, 1350), roster(4, 'dave', 5, 9, 0, 1250)],
      users: [user('alice', 'Alice FC'), user('bob', 'Bob United'), user('carol', 'Carol City'), user('dave', 'Dave Rovers')],
      // bob wins 2025
      bracket: [{ r: 2, m: 3, t1: 2, t2: 1, w: 2, l: 1, p: 1 }],
    };
    // Newest first.
    const h = buildLeagueHistory([s2025, s2024]);
    const alice = h.allTime.find((m) => m.ownerId === 'alice')!;
    expect(alice.wins).toBe(19); // 10 + 9
    expect(alice.losses).toBe(9); // 4 + 5
    expect(alice.championships).toBe(1);
    const bob = h.allTime.find((m) => m.ownerId === 'bob')!;
    expect(bob.championships).toBe(1);
    expect(h.champions).toEqual([
      { season: '2025', ownerId: 'bob', teamName: 'Bob United' },
      { season: '2024', ownerId: 'alice', teamName: 'Alice FC' },
    ]);
  });

  it('flags only newest-season members as current and keeps departed managers', () => {
    const s2024 = season2024(); // has dave
    const s2025: SeasonInput = {
      league: { league_id: 'L25', name: 'Dynasty', season: '2025', previous_league_id: 'L24', total_rosters: 4, status: 'in_season' },
      // dave gone, replaced by erin; no champion yet (undecided)
      rosters: [roster(1, 'alice', 9, 5), roster(2, 'bob', 11, 3), roster(3, 'carol', 7, 7), roster(5, 'erin', 5, 9)],
      users: [user('alice', 'Alice FC'), user('bob', 'Bob United'), user('carol', 'Carol City'), user('erin', 'Erin Town')],
      bracket: [{ r: 2, m: 3, t1: 2, t2: 1, w: null, l: null, p: 1 }],
    };
    const h = buildLeagueHistory([s2025, s2024]);
    const dave = h.allTime.find((m) => m.ownerId === 'dave')!;
    expect(dave.isCurrentMember).toBe(false);
    expect(dave.wins).toBe(4); // retains 2024 total
    const erin = h.allTime.find((m) => m.ownerId === 'erin')!;
    expect(erin.isCurrentMember).toBe(true);
    // in-progress 2025 contributes no champion
    expect(h.champions.map((c) => c.season)).toEqual(['2024']);
  });

  it('computes winPct as (wins + 0.5*ties) / games, 0 when no games', () => {
    const s: SeasonInput = {
      league: { league_id: 'L1', name: 'X', season: '2024', previous_league_id: null, total_rosters: 2 },
      rosters: [roster(1, 'alice', 3, 1, 2), roster(2, 'zero', 0, 0, 0)],
      users: [user('alice', 'A'), user('zero', 'Z')],
      bracket: [],
    };
    const h = buildLeagueHistory([s]);
    const alice = h.allTime.find((m) => m.ownerId === 'alice')!;
    expect(alice.winPct).toBeCloseTo((3 + 1) / 6); // (3 + 0.5*2)/6
    const zero = h.allTime.find((m) => m.ownerId === 'zero')!;
    expect(zero.winPct).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run __tests__/standings/lib/history.test.ts`
Expected: FAIL — module `@/lib/standings/history` not found.

- [ ] **Step 4: Implement the pure builder**

Create `src/lib/standings/history.ts`:

```ts
import type {
  BracketMatch,
  ChampionEntry,
  LeagueHistory,
  ManagerRecord,
  Roster,
  SeasonInput,
  SeasonRow,
  SeasonStandings,
  SleeperUser,
} from "./types";

// A manager's team name: prefer their custom team_name, fall back to the
// Sleeper display_name, then a neutral placeholder.
export function teamNameFor(user: SleeperUser | undefined): string {
  return user?.metadata?.team_name || user?.display_name || "Unknown team";
}

// The champion is the owner of the roster that won the p===1 (championship)
// match. Returns null if there is no such match, no decided winner, or the
// winning roster has no owner.
export function championOwnerId(
  bracket: BracketMatch[],
  rosters: Roster[],
): string | null {
  const final = bracket.find((m) => m.p === 1);
  if (!final || final.w == null) return null;
  const winner = rosters.find((r) => r.roster_id === final.w);
  return winner?.owner_id ?? null;
}

function winPct(wins: number, losses: number, ties: number): number {
  const games = wins + losses + ties;
  if (games === 0) return 0;
  return (wins + 0.5 * ties) / games;
}

export function buildSeasonStandings(input: SeasonInput): SeasonStandings {
  const usersById = new Map(input.users.map((u) => [u.user_id, u]));

  const rows: SeasonRow[] = input.rosters
    .filter((r) => r.owner_id != null)
    .map((r) => ({
      ownerId: r.owner_id as string,
      teamName: teamNameFor(usersById.get(r.owner_id as string)),
      wins: r.settings.wins,
      losses: r.settings.losses,
      ties: r.settings.ties,
      rank: 0,
    }));

  // Wins desc, then losses asc, then points-for desc as a final tiebreak.
  const fptsByOwner = new Map(
    input.rosters
      .filter((r) => r.owner_id != null)
      .map((r) => [r.owner_id as string, r.settings.fpts ?? 0]),
  );
  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return (fptsByOwner.get(b.ownerId) ?? 0) - (fptsByOwner.get(a.ownerId) ?? 0);
  });
  rows.forEach((row, i) => {
    row.rank = i + 1;
  });

  return {
    season: input.league.season,
    leagueId: input.league.league_id,
    championOwnerId: championOwnerId(input.bracket, input.rosters),
    rows,
  };
}

// `seasons` is passed newest-first. Members of the newest season are flagged
// isCurrentMember; all owners ever seen retain their summed totals.
export function buildLeagueHistory(seasons: SeasonInput[]): LeagueHistory {
  const seasonStandings = seasons.map(buildSeasonStandings);

  const currentOwners = new Set<string>(
    seasons[0]?.rosters
      .map((r) => r.owner_id)
      .filter((id): id is string => id != null) ?? [],
  );

  // Accumulate per-owner totals. Newest-first iteration means the first time we
  // see an owner is their most recent team name.
  const byOwner = new Map<string, ManagerRecord>();
  for (const season of seasonStandings) {
    for (const row of season.rows) {
      let record = byOwner.get(row.ownerId);
      if (!record) {
        record = {
          ownerId: row.ownerId,
          displayName: row.teamName,
          wins: 0,
          losses: 0,
          ties: 0,
          championships: 0,
          winPct: 0,
          isCurrentMember: currentOwners.has(row.ownerId),
        };
        byOwner.set(row.ownerId, record);
      }
      record.wins += row.wins;
      record.losses += row.losses;
      record.ties += row.ties;
    }
    if (season.championOwnerId) {
      const champ = byOwner.get(season.championOwnerId);
      if (champ) champ.championships += 1;
    }
  }

  const allTime = [...byOwner.values()];
  for (const record of allTime) {
    record.winPct = winPct(record.wins, record.losses, record.ties);
  }
  // All-time table: most wins first, then championships, then win%.
  allTime.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.championships !== a.championships)
      return b.championships - a.championships;
    return b.winPct - a.winPct;
  });

  const champions: ChampionEntry[] = seasonStandings
    .filter((s) => s.championOwnerId)
    .map((s) => {
      const ownerId = s.championOwnerId as string;
      const row = s.rows.find((r) => r.ownerId === ownerId);
      return { season: s.season, ownerId, teamName: row?.teamName ?? "Unknown team" };
    });

  return { allTime, seasons: seasonStandings, champions };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run __tests__/standings/lib/history.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/standings/types.ts src/lib/standings/history.ts __tests__/standings/lib/history.test.ts
git commit -m "Add standings types and pure all-time history builder

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Standings Sleeper client + history loader

**Files:**
- Create: `src/lib/standings/sleeper.ts`

**Interfaces:**
- Consumes: types from `src/lib/standings/types.ts`; `buildLeagueHistory` from `src/lib/standings/history.ts`.
- Produces (relied on by Task 3):
  - `loadLeagueHistory(leagueId: string): Promise<LeagueHistory | null>` — returns `null` if the league can't be resolved (empty chain).
  - `getLeagueName(leagueId: string): Promise<string | null>`.

This task is network glue (no unit test), consistent with how trade-tracker's client is treated. Verified via typecheck + the page rendering in Task 3.

- [ ] **Step 1: Implement the client**

Create `src/lib/standings/sleeper.ts`:

```ts
import { buildLeagueHistory } from "./history";
import type {
  BracketMatch,
  League,
  LeagueHistory,
  Roster,
  SeasonInput,
  SleeperUser,
} from "./types";

const BASE = "https://api.sleeper.app/v1";

// Historical seasons rarely change; the current season's records move weekly.
const TTL_LONG = 60 * 60; // 1h — league metadata, past seasons
const TTL_SHORT = 60 * 5; // 5m — current-season rosters

async function getJson<T>(
  path: string,
  revalidateSeconds: number,
): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      next: { revalidate: revalidateSeconds },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function getLeague(leagueId: string): Promise<League | null> {
  return getJson<League>(`/league/${leagueId}`, TTL_LONG);
}

async function getUsers(leagueId: string): Promise<SleeperUser[]> {
  return (await getJson<SleeperUser[]>(`/league/${leagueId}/users`, TTL_LONG)) ?? [];
}

async function getUserLeagues(userId: string, season: string): Promise<League[]> {
  return (
    (await getJson<League[]>(`/user/${userId}/leagues/nfl/${season}`, TTL_LONG)) ??
    []
  );
}

// Sleeper leagues only point backward. To find the newest season, for each
// following season look through a current member's leagues for one whose
// previous_league_id points back at the league we're holding.
async function getNewestLeague(start: League): Promise<League> {
  let head = start;
  for (let guard = 0; guard < 20; guard++) {
    const nextSeason = String(Number(head.season) + 1);
    const members = await getUsers(head.league_id);
    let successor: League | null = null;
    for (const member of members) {
      const leagues = await getUserLeagues(member.user_id, nextSeason);
      successor =
        leagues.find((l) => l.previous_league_id === head.league_id) ?? null;
      if (successor) break;
    }
    if (!successor) break;
    head = successor;
  }
  return head;
}

// Every season this dynasty has existed, newest-first, regardless of which
// season's id was entered.
async function getLeagueChain(leagueId: string): Promise<League[]> {
  const start = await getLeague(leagueId);
  if (!start) return [];
  const newest = await getNewestLeague(start);

  const chain: League[] = [];
  let current: string | null = newest.league_id;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const league = await getLeague(current);
    if (!league) break;
    chain.push(league);
    current = league.previous_league_id;
  }
  return chain;
}

export async function getLeagueName(leagueId: string): Promise<string | null> {
  const league = await getLeague(leagueId);
  return league?.name ?? null;
}

export async function loadLeagueHistory(
  leagueId: string,
): Promise<LeagueHistory | null> {
  const chain = await getLeagueChain(leagueId); // newest-first
  if (chain.length === 0) return null;

  const newestId = chain[0]?.league_id;
  const seasons = await Promise.all(
    chain.map(async (league): Promise<SeasonInput | null> => {
      const ttl = league.league_id === newestId ? TTL_SHORT : TTL_LONG;
      const [rosters, users, bracket] = await Promise.all([
        getJson<Roster[]>(`/league/${league.league_id}/rosters`, ttl),
        getJson<SleeperUser[]>(`/league/${league.league_id}/users`, TTL_LONG),
        getJson<BracketMatch[]>(
          `/league/${league.league_id}/winners_bracket`,
          ttl,
        ),
      ]);
      // A season with no roster data can't contribute — skip it.
      if (!rosters || rosters.length === 0) return null;
      return { league, rosters, users: users ?? [], bracket: bracket ?? [] };
    }),
  );

  const usable = seasons.filter((s): s is SeasonInput => s !== null);
  if (usable.length === 0) return null;
  return buildLeagueHistory(usable);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/standings/sleeper.ts
git commit -m "Add standings Sleeper client and history loader

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Standings UI — champions strip, all-time table, year selector

**Files:**
- Create: `src/components/standings/ChampionsStrip.tsx`
- Create: `src/components/standings/AllTimeTable.tsx`
- Create: `src/components/standings/SeasonTable.tsx`
- Create: `src/components/standings/StandingsView.tsx` (client component — year toggle)
- Modify: `src/app/standings/[leagueId]/page.tsx`

**Interfaces:**
- Consumes: `loadLeagueHistory`, `getLeagueName` from `src/lib/standings/sleeper.ts`; types from `src/lib/standings/types.ts`.
- Produces: rendered standings page. No downstream tasks.

- [ ] **Step 1: Champions strip (server component)**

Create `src/components/standings/ChampionsStrip.tsx`:

```tsx
import type { ChampionEntry } from "@/lib/standings/types";

export default function ChampionsStrip({
  champions,
}: {
  champions: ChampionEntry[];
}) {
  if (champions.length === 0) {
    return (
      <section className="rounded-xl border border-pitch-700 bg-pitch-800/50 p-5 text-sm text-slate-300">
        No champions crowned yet — the first title is still up for grabs.
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-100">🏆 Champions</h2>
      <div className="flex flex-wrap gap-3">
        {champions.map((c) => (
          <div
            key={c.season}
            className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2"
          >
            <span className="text-sm font-bold text-amber-300">{c.season}</span>
            <span className="text-sm text-slate-200">{c.teamName}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: All-time table (server component)**

Create `src/components/standings/AllTimeTable.tsx`:

```tsx
import type { ManagerRecord } from "@/lib/standings/types";

function pct(winPct: number): string {
  return winPct.toFixed(3).replace(/^0/, ""); // .625
}

export default function AllTimeTable({
  records,
}: {
  records: ManagerRecord[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-pitch-700 text-left text-slate-400">
            <th className="p-3 font-medium">Manager</th>
            <th className="p-3 font-medium">W</th>
            <th className="p-3 font-medium">L</th>
            <th className="p-3 font-medium">T</th>
            <th className="p-3 font-medium">Titles</th>
            <th className="p-3 font-medium">Win%</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr
              key={r.ownerId}
              className="border-b border-pitch-800 hover:bg-pitch-800/40"
            >
              <td className="p-3">
                <span className={r.isCurrentMember ? "text-slate-100" : "text-slate-500"}>
                  {r.displayName}
                </span>
                {!r.isCurrentMember && (
                  <span className="ml-2 text-xs text-slate-600">(former)</span>
                )}
              </td>
              <td className="p-3 text-slate-200">{r.wins}</td>
              <td className="p-3 text-slate-200">{r.losses}</td>
              <td className="p-3 text-slate-200">{r.ties}</td>
              <td className="p-3 text-amber-300">
                {r.championships > 0 ? `🏆×${r.championships}` : "—"}
              </td>
              <td className="p-3 text-slate-200">{pct(r.winPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Season table (server component)**

Create `src/components/standings/SeasonTable.tsx`:

```tsx
import type { SeasonStandings } from "@/lib/standings/types";

export default function SeasonTable({ season }: { season: SeasonStandings }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-pitch-700 text-left text-slate-400">
            <th className="p-3 font-medium">#</th>
            <th className="p-3 font-medium">Team</th>
            <th className="p-3 font-medium">W</th>
            <th className="p-3 font-medium">L</th>
            <th className="p-3 font-medium">T</th>
          </tr>
        </thead>
        <tbody>
          {season.rows.map((row) => {
            const isChamp = row.ownerId === season.championOwnerId;
            return (
              <tr
                key={row.ownerId}
                className={
                  isChamp
                    ? "border-b border-pitch-800 bg-amber-500/10"
                    : "border-b border-pitch-800 hover:bg-pitch-800/40"
                }
              >
                <td className="p-3 text-slate-400">{row.rank}</td>
                <td className="p-3 text-slate-100">
                  {row.teamName}
                  {isChamp && <span className="ml-2">🏆</span>}
                </td>
                <td className="p-3 text-slate-200">{row.wins}</td>
                <td className="p-3 text-slate-200">{row.losses}</td>
                <td className="p-3 text-slate-200">{row.ties}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Client view with year selector**

Create `src/components/standings/StandingsView.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { LeagueHistory } from "@/lib/standings/types";
import AllTimeTable from "./AllTimeTable";
import SeasonTable from "./SeasonTable";

const ALL_TIME = "all-time";

export default function StandingsView({ history }: { history: LeagueHistory }) {
  const [selected, setSelected] = useState<string>(ALL_TIME);
  const season = history.seasons.find((s) => s.season === selected);

  const buttonClass = (active: boolean) =>
    active
      ? "rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white"
      : "rounded-lg border border-pitch-700 bg-pitch-800 px-3 py-1.5 text-sm text-slate-300 hover:border-emerald-500";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelected(ALL_TIME)}
          className={buttonClass(selected === ALL_TIME)}
        >
          All-time
        </button>
        {history.seasons.map((s) => (
          <button
            key={s.season}
            type="button"
            onClick={() => setSelected(s.season)}
            className={buttonClass(selected === s.season)}
          >
            {s.season}
          </button>
        ))}
      </div>

      {selected === ALL_TIME || !season ? (
        <AllTimeTable records={history.allTime} />
      ) : (
        <SeasonTable season={season} />
      )}
    </section>
  );
}
```

- [ ] **Step 5: Wire the page**

Replace `src/app/standings/[leagueId]/page.tsx` entirely:

```tsx
import Link from "next/link";
import { getLeagueName, loadLeagueHistory } from "@/lib/standings/sleeper";
import ChampionsStrip from "@/components/standings/ChampionsStrip";
import StandingsView from "@/components/standings/StandingsView";

// Standings are fetched per request (the client uses revalidate TTLs); the
// build never makes network calls.
export const dynamic = "force-dynamic";

export default async function LeagueStandingsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const [leagueName, history] = await Promise.all([
    getLeagueName(leagueId),
    loadLeagueHistory(leagueId),
  ]);

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {leagueName ?? "League Standings"}
          </h1>
          <p className="text-sm text-slate-400">All-time history · League ID {leagueId}</p>
        </div>
        <Link href="/standings" className="text-sm text-emerald-400 hover:underline">
          ← Look up another league
        </Link>
      </div>

      {history ? (
        <>
          <ChampionsStrip champions={history.champions} />
          <StandingsView history={history} />
        </>
      ) : (
        <div className="rounded-xl border border-pitch-700 bg-pitch-800/50 p-5 text-sm text-slate-300">
          Standings are temporarily unavailable. The Sleeper API couldn&apos;t be
          reached, or this league ID has no data — try again in a moment.
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 6: Typecheck, lint, build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all pass, no type/lint errors, build completes.

- [ ] **Step 7: Manual smoke test**

Run: `npm run dev`, then open `http://localhost:3000/standings/1048426134855081984`.
Expected: champions strip renders (or "no champions yet"), all-time table sorted by wins with title counts, year buttons toggle to per-season standings with the champion row highlighted.

- [ ] **Step 8: Commit**

```bash
git add src/components/standings/ src/app/standings/[leagueId]/page.tsx
git commit -m "Build all-time standings UI: champions strip, all-time table, year selector

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Update the standings landing copy

**Files:**
- Modify: `src/app/standings/page.tsx:22-25`

**Interfaces:**
- Consumes: nothing. Produces: nothing downstream. Copy-only change so the intro matches the new all-time behavior.

- [ ] **Step 1: Update the description paragraph**

In `src/app/standings/page.tsx`, replace the intro paragraph:

```tsx
        <p className="max-w-2xl text-slate-300">
          Enter any Sleeper league ID to see its all-time standings — total wins,
          losses, and championships for every manager across the dynasty&apos;s
          history, with a drill-down into any individual season.
        </p>
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/standings/page.tsx
git commit -m "Update standings landing copy for all-time view

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes on the old `StandingsTable.jsx`

The legacy `src/app/(components)/StandingsTable.jsx` (raw roster_id table) is no longer
referenced after Task 3. Confirm with `grep -rn "StandingsTable" src/` — if nothing outside
its own file references it, delete it in Task 3's commit. If the landing page or another tool
still imports it, leave it untouched and note the reference.
