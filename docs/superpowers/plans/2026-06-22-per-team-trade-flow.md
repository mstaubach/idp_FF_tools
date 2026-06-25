# Per-Team Trade Flow Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the league-wide trade list with a per-team view that lays a team's trades on a horizontal time-ordered canvas and draws arrows tracing a draft pick from the trade where the team received it to the later trade where they traded it away.

**Architecture:** A new pure data layer (`team-view.ts`) transforms the existing `buildLeagueTrades` output into a focal-team shape (`receives`/`tradedAway` per trade + pick-chain links). The league route becomes a team picker; a new `/team/[rosterId]` route renders a client `TeamTradeCanvas` that places `TeamTradeCard`s left→right and draws SVG arrows between pick anchors. The old Sankey-based components are deleted.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript (strict), Tailwind, Vitest + Testing Library.

## Global Constraints

- TypeScript `strict` is on — no `any` leaks; all new types fully specified.
- Path alias `@/*` → `src/*` (works in both `tsconfig.json` and `vitest.config.ts`).
- Draft-pick identity is `season:round:originalRoster` — the one source of truth, via the exported `pickKey` helper.
- Sleeper data flows through the existing `buildLeagueTrades` only; the new data layer adds NO Sleeper fetching.
- Chainable assets = draft picks only. Players never get arrows.
- Cards are ordered oldest→newest; arrows always point rightward (forward in time).
- Tailwind palette in use: `pitch-700/800/900` (borders/surfaces), `emerald-400` (links), `sky-300`/`#38bdf8` (picks/arrows), `slate-*` (text).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/trade-tracker/resolve.ts` (modify) | Add `originalRoster` to pick asset, `teams` to `LeagueTrades`, export `pickKey`, `TeamMeta` |
| `src/lib/trade-tracker/team-view.ts` (create) | Pure derivation: `deriveLeagueTeams`, `deriveTeamView`; async wrappers `listLeagueTeams`, `buildTeamView` |
| `src/components/trade-tracker/arrowPath.ts` (create) | Pure `computeArrowPath(from, to)` → SVG cubic-bezier `d` string |
| `src/components/trade-tracker/PickOutcomeBadge.tsx` (create) | Terminal pick outcome badge (lifted from `TradeCard`) |
| `src/components/trade-tracker/TeamTradeCard.tsx` (create) | One trade: "Trade w/ X" header + Traded Away / Receives columns, anchors |
| `src/components/trade-tracker/TeamTradeCanvas.tsx` (create) | Client: horizontal track of cards + SVG arrow overlay |
| `src/components/trade-tracker/Message.tsx` (create) | Shared empty/error panel (lifted from the league page) |
| `src/app/trade-tracker/league/[leagueId]/page.tsx` (rewrite) | Team picker |
| `src/app/trade-tracker/league/[leagueId]/team/[rosterId]/page.tsx` (create) | Per-team page |
| `src/components/trade-tracker/TradeCard.tsx` (delete) | Replaced |
| `src/components/trade-tracker/TradeSankey.tsx` (delete) | Replaced |
| `src/lib/trade-tracker/sankey.ts` (delete) | Replaced |
| `__tests__/trade-tracker/resolve.test.ts` (rewrite) | Adds `teams` + `originalRoster` coverage via a shared mock seed |
| `__tests__/trade-tracker/team-view.test.ts` (create) | Pure-derivation coverage with fixtures |
| `__tests__/trade-tracker/arrowPath.test.ts` (create) | Arrow-path math |
| `__tests__/trade-tracker/TeamTradeCard.test.tsx` (create) | Card render + anchors |

---

## Task 1: Extend the resolve data model

**Files:**
- Modify: `src/lib/trade-tracker/resolve.ts`
- Test: `__tests__/trade-tracker/resolve.test.ts` (rewrite)

**Interfaces:**
- Consumes: existing `buildLeagueTrades`, `ReceivedAsset`, `LeagueTrades`, `indexDraftPicks`, `resolvePick`.
- Produces:
  - `export function pickKey(season: string, round: number, originalRoster: number): string`
  - pick `ReceivedAsset` gains `originalRoster: number`
  - `export interface TeamMeta { rosterId: number; teamName: string; ownerName: string }`
  - `LeagueTrades` gains `teams: TeamMeta[]`

- [ ] **Step 1: Rewrite the test file with a shared mock seed and three assertions**

Replace the entire contents of `__tests__/trade-tracker/resolve.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/trade-tracker/sleeper', () => ({
  getLeagueChain: vi.fn(),
  getUsers: vi.fn(),
  getRosters: vi.fn(),
  getTransactions: vi.fn(),
  getDrafts: vi.fn(),
  getDraft: vi.fn(),
  getDraftPicks: vi.fn(),
  getPlayers: vi.fn(),
}));

import { buildLeagueTrades } from '@/lib/trade-tracker/resolve';
import * as sleeper from '@/lib/trade-tracker/sleeper';

function seedMocks() {
  vi.mocked(sleeper.getLeagueChain).mockResolvedValue([
    {
      league_id: 'L1',
      name: 'Test League',
      season: '2024',
      previous_league_id: null,
      draft_id: 'D1',
      total_rosters: 2,
    },
  ]);
  vi.mocked(sleeper.getUsers).mockResolvedValue([
    { user_id: 'u1', display_name: 'Alice', avatar: null, metadata: { team_name: 'Alpha' } },
    { user_id: 'u2', display_name: 'Bob', avatar: null },
  ]);
  vi.mocked(sleeper.getRosters).mockResolvedValue([
    { roster_id: 1, owner_id: 'u1' },
    { roster_id: 2, owner_id: 'u2' },
  ]);
  vi.mocked(sleeper.getTransactions).mockResolvedValue([
    {
      transaction_id: 't1',
      type: 'trade',
      status: 'complete',
      created: 1000,
      roster_ids: [1, 2],
      adds: null,
      drops: null,
      draft_picks: [
        { season: '2024', round: 1, roster_id: 1, previous_owner_id: 1, owner_id: 2 },
      ],
    },
  ]);
  vi.mocked(sleeper.getDrafts).mockResolvedValue([
    { draft_id: 'D1', season: '2024', league_id: 'L1', status: 'complete', slot_to_roster_id: undefined as never },
  ]);
  vi.mocked(sleeper.getDraft).mockResolvedValue({
    draft_id: 'D1', season: '2024', league_id: 'L1', status: 'complete', slot_to_roster_id: { '1': 1, '2': 2 },
  });
  vi.mocked(sleeper.getDraftPicks).mockResolvedValue([
    {
      round: 1, pick_no: 1, draft_slot: 1, player_id: 'p1', picked_by: 'u2', roster_id: 2,
      metadata: { first_name: 'Marvin', last_name: 'Harrison', position: 'WR', team: 'ARI' },
    },
  ]);
  vi.mocked(sleeper.getPlayers).mockResolvedValue({});
}

describe('buildLeagueTrades', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedMocks();
  });

  it('resolves a traded pick to the player who was drafted with it', async () => {
    const result = await buildLeagueTrades('L1');
    expect(result).not.toBeNull();
    const pickAsset = result!.trades[0].flows.find((f) => f.asset.kind === 'pick')!.asset;
    if (pickAsset.kind !== 'pick') throw new Error('expected pick');
    expect(pickAsset.outcome.status).toBe('drafted');
    if (pickAsset.outcome.status !== 'drafted') throw new Error('expected drafted');
    expect(pickAsset.outcome.playerName).toBe('Marvin Harrison');
  });

  it('stamps the original roster on each pick asset', async () => {
    const result = await buildLeagueTrades('L1');
    const pickAsset = result!.trades[0].flows.find((f) => f.asset.kind === 'pick')!.asset;
    if (pickAsset.kind !== 'pick') throw new Error('expected pick');
    expect(pickAsset.originalRoster).toBe(1);
  });

  it('returns the newest league roster list with team and owner names', async () => {
    const result = await buildLeagueTrades('L1');
    expect(result!.teams).toEqual([
      { rosterId: 1, teamName: 'Alpha', ownerName: 'Alice' },
      { rosterId: 2, teamName: 'Bob', ownerName: 'Bob' },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify the two new ones fail**

Run: `npx vitest run __tests__/trade-tracker/resolve.test.ts`
Expected: the `original roster` test FAILS (`originalRoster` is `undefined`) and the `teams` test FAILS (`result.teams` is `undefined`). The first test still passes.

- [ ] **Step 3: Add `pickKey` and use it in the index/lookup**

In `src/lib/trade-tracker/resolve.ts`, add the helper near the top (after the imports) and refactor the two key sites to use it.

Add:

```typescript
export function pickKey(
  season: string,
  round: number,
  originalRoster: number,
): string {
  return `${season}:${round}:${originalRoster}`;
}
```

In `indexDraftPicks`, replace:

```typescript
    into.set(`${draft.season}:${pick.round}:${originalRoster}`, pick);
```

with:

```typescript
    into.set(pickKey(draft.season, pick.round, originalRoster), pick);
```

In `resolvePick`, replace:

```typescript
  const match = draftIndex.get(`${season}:${round}:${originalRoster}`);
```

with:

```typescript
  const match = draftIndex.get(pickKey(season, round, originalRoster));
```

- [ ] **Step 4: Add `originalRoster` to the pick asset type and populate it**

In `resolve.ts`, extend the pick member of `ReceivedAsset`:

```typescript
  | {
      kind: "pick";
      season: string;
      round: number;
      originalRoster: number;
      label: string;
      outcome: PickOutcome;
    };
```

In `buildPickAsset`, set the field in the returned object:

```typescript
  return {
    kind: "pick",
    season: pick.season,
    round: pick.round,
    originalRoster: pick.roster_id,
    label,
    outcome: resolvePick(
      pick.season,
      pick.round,
      pick.roster_id,
      draftIndex,
      seasonsWithDraft,
      players,
    ),
  };
```

- [ ] **Step 5: Add `TeamMeta`, extend `LeagueTrades`, and populate `teams`**

In `resolve.ts`, add the interface (near `LeagueTrades`):

```typescript
export interface TeamMeta {
  rosterId: number;
  teamName: string;
  ownerName: string;
}
```

Add `teams` to `LeagueTrades`:

```typescript
export interface LeagueTrades {
  leagueName: string;
  seasons: string[];
  teams: TeamMeta[];
  trades: TradeView[];
}
```

In `buildLeagueTrades`, build the team list from the newest league (`chain[0]`, i.e. `perLeague[0]`) just before the final `return`. Insert:

```typescript
  const newest = perLeague[0];
  const newestUserById = new Map(newest.users.map((u) => [u.user_id, u]));
  const teams: TeamMeta[] = newest.rosters.map((roster) => {
    const user = roster.owner_id ? newestUserById.get(roster.owner_id) : undefined;
    return {
      rosterId: roster.roster_id,
      teamName:
        user?.metadata?.team_name || user?.display_name || `Roster ${roster.roster_id}`,
      ownerName: user?.display_name || "Unknown",
    };
  });
```

Change the return to include `teams`:

```typescript
  return { leagueName: chain[0].name, seasons, teams, trades };
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run __tests__/trade-tracker/resolve.test.ts && npm run typecheck`
Expected: all 3 tests PASS; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/trade-tracker/resolve.ts __tests__/trade-tracker/resolve.test.ts
git commit -m "Add pick identity, originalRoster, and team list to resolve model"
```

---

## Task 2: Pure per-team data layer

**Files:**
- Create: `src/lib/trade-tracker/team-view.ts`
- Test: `__tests__/trade-tracker/team-view.test.ts`

**Interfaces:**
- Consumes: `LeagueTrades`, `ReceivedAsset`, `TeamMeta`, `pickKey`, `buildLeagueTrades` from `./resolve`.
- Produces:
  - `interface TeamSummary extends TeamMeta { tradeCount: number }`
  - `interface LeagueTeams { leagueName: string; teams: TeamSummary[] }`
  - `interface TeamTrade { tradeId: string; season: string; createdAt: number; counterparties: string[]; tradedAway: ReceivedAsset[]; receives: ReceivedAsset[] }`
  - `interface PickChainLink { assetKey: string; fromTradeId: string; toTradeId: string }`
  - `interface TeamView { leagueName: string; teamName: string; trades: TeamTrade[]; chainLinks: PickChainLink[] }`
  - `function deriveLeagueTeams(lt: LeagueTrades): LeagueTeams`
  - `function deriveTeamView(lt: LeagueTrades, rosterId: number): TeamView | null`
  - `async function listLeagueTeams(leagueId: string): Promise<LeagueTeams | null>`
  - `async function buildTeamView(leagueId: string, rosterId: number): Promise<TeamView | null>`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/trade-tracker/team-view.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { deriveLeagueTeams, deriveTeamView } from '@/lib/trade-tracker/team-view';
import type {
  LeagueTrades,
  ReceivedAsset,
  TradeFlow,
  TradeView,
} from '@/lib/trade-tracker/resolve';

function pickAsset(season: string, round: number, originalRoster: number): ReceivedAsset {
  return {
    kind: 'pick',
    season,
    round,
    originalRoster,
    label: `${season} round ${round}`,
    outcome: { status: 'pending' },
  };
}

function playerAsset(name: string): ReceivedAsset {
  return { kind: 'player', playerName: name, position: 'WR', team: 'ARI' };
}

function flow(
  fromRosterId: number | null,
  fromTeamName: string | null,
  toRosterId: number,
  toTeamName: string,
  asset: ReceivedAsset,
): TradeFlow {
  return { fromRosterId, fromTeamName, toRosterId, toTeamName, asset };
}

function trade(id: string, createdAt: number, flows: TradeFlow[]): TradeView {
  return { id, leagueId: 'L1', season: '2024', createdAt, sides: [], flows };
}

// Team 1 (Alpha) receives team 2's 2024 2nd in trade t1, then trades it to
// team 3 in the later trade t2. Team 1 also gets a player in t1.
function fixture(): LeagueTrades {
  return {
    leagueName: 'Test League',
    seasons: ['2024'],
    teams: [
      { rosterId: 1, teamName: 'Alpha', ownerName: 'Alice' },
      { rosterId: 2, teamName: 'Bravo', ownerName: 'Bob' },
      { rosterId: 3, teamName: 'Charlie', ownerName: 'Cara' },
    ],
    trades: [
      trade('t1', 1000, [
        flow(2, 'Bravo', 1, 'Alpha', pickAsset('2024', 2, 2)),
        flow(1, 'Alpha', 2, 'Bravo', playerAsset('Player1')),
      ]),
      trade('t2', 2000, [
        flow(1, 'Alpha', 3, 'Charlie', pickAsset('2024', 2, 2)),
        flow(3, 'Charlie', 1, 'Alpha', playerAsset('Player3')),
      ]),
    ],
  };
}

describe('deriveLeagueTeams', () => {
  it('counts each team\'s trades', () => {
    const { teams } = deriveLeagueTeams(fixture());
    const byId = Object.fromEntries(teams.map((t) => [t.rosterId, t.tradeCount]));
    expect(byId).toEqual({ 1: 2, 2: 1, 3: 1 });
  });
});

describe('deriveTeamView', () => {
  it('returns null for an unknown roster', () => {
    expect(deriveTeamView(fixture(), 99)).toBeNull();
  });

  it('splits each trade into receives and tradedAway for the focal team', () => {
    const view = deriveTeamView(fixture(), 1)!;
    expect(view.teamName).toBe('Alpha');
    expect(view.trades.map((t) => t.tradeId)).toEqual(['t1', 't2']);

    const t1 = view.trades[0];
    expect(t1.receives.map((a) => (a.kind === 'pick' ? 'pick' : a.playerName))).toEqual(['pick']);
    expect(t1.tradedAway.map((a) => (a.kind === 'player' ? a.playerName : 'pick'))).toEqual(['Player1']);
    expect(t1.counterparties).toEqual(['Bravo']);
  });

  it('links a received pick to the later trade where it was traded away', () => {
    const view = deriveTeamView(fixture(), 1)!;
    expect(view.chainLinks).toEqual([
      { assetKey: '2024:2:2', fromTradeId: 't1', toTradeId: 't2' },
    ]);
  });

  it('does not link picks that were kept (no later trade-away)', () => {
    const view = deriveTeamView(fixture(), 3)!;
    expect(view.chainLinks).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/trade-tracker/team-view.test.ts`
Expected: FAIL with "Failed to resolve import '@/lib/trade-tracker/team-view'".

- [ ] **Step 3: Implement the data layer**

Create `src/lib/trade-tracker/team-view.ts`:

```typescript
import { buildLeagueTrades, pickKey } from "./resolve";
import type { LeagueTrades, ReceivedAsset, TeamMeta } from "./resolve";

export interface TeamSummary extends TeamMeta {
  tradeCount: number;
}

export interface LeagueTeams {
  leagueName: string;
  teams: TeamSummary[];
}

export interface TeamTrade {
  tradeId: string;
  season: string;
  createdAt: number;
  counterparties: string[];
  tradedAway: ReceivedAsset[];
  receives: ReceivedAsset[];
}

// A draft pick this team received in one trade and traded away in a later one.
export interface PickChainLink {
  assetKey: string;
  fromTradeId: string;
  toTradeId: string;
}

export interface TeamView {
  leagueName: string;
  teamName: string;
  trades: TeamTrade[];
  chainLinks: PickChainLink[];
}

function assetKeyOf(asset: ReceivedAsset): string | null {
  return asset.kind === "pick"
    ? pickKey(asset.season, asset.round, asset.originalRoster)
    : null;
}

export function deriveLeagueTeams(lt: LeagueTrades): LeagueTeams {
  const counts = new Map<number, number>();
  for (const trade of lt.trades) {
    const involved = new Set<number>();
    for (const f of trade.flows) {
      if (f.fromRosterId != null) involved.add(f.fromRosterId);
      involved.add(f.toRosterId);
    }
    for (const rid of involved) counts.set(rid, (counts.get(rid) ?? 0) + 1);
  }
  return {
    leagueName: lt.leagueName,
    teams: lt.teams.map((t) => ({ ...t, tradeCount: counts.get(t.rosterId) ?? 0 })),
  };
}

export function deriveTeamView(
  lt: LeagueTrades,
  rosterId: number,
): TeamView | null {
  const meta = lt.teams.find((t) => t.rosterId === rosterId);
  if (!meta) return null;

  const trades: TeamTrade[] = lt.trades
    .filter((tv) =>
      tv.flows.some((f) => f.fromRosterId === rosterId || f.toRosterId === rosterId),
    )
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((tv) => {
      const receives: ReceivedAsset[] = [];
      const tradedAway: ReceivedAsset[] = [];
      const counterparties = new Set<string>();
      for (const f of tv.flows) {
        if (f.toRosterId === rosterId) {
          receives.push(f.asset);
          if (f.fromTeamName) counterparties.add(f.fromTeamName);
        }
        if (f.fromRosterId === rosterId) {
          tradedAway.push(f.asset);
          counterparties.add(f.toTeamName);
        }
      }
      return {
        tradeId: tv.id,
        season: tv.season,
        createdAt: tv.createdAt,
        counterparties: Array.from(counterparties),
        tradedAway,
        receives,
      };
    });

  // Index where the team later traded each pick away.
  const tradedAwayByKey = new Map<string, { tradeId: string; createdAt: number }[]>();
  for (const t of trades) {
    for (const asset of t.tradedAway) {
      const key = assetKeyOf(asset);
      if (!key) continue;
      const list = tradedAwayByKey.get(key) ?? [];
      list.push({ tradeId: t.tradeId, createdAt: t.createdAt });
      tradedAwayByKey.set(key, list);
    }
  }

  const chainLinks: PickChainLink[] = [];
  for (const t of trades) {
    for (const asset of t.receives) {
      const key = assetKeyOf(asset);
      if (!key) continue;
      const later = (tradedAwayByKey.get(key) ?? [])
        .filter((x) => x.createdAt > t.createdAt)
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      if (later) {
        chainLinks.push({ assetKey: key, fromTradeId: t.tradeId, toTradeId: later.tradeId });
      }
    }
  }

  return { leagueName: lt.leagueName, teamName: meta.teamName, trades, chainLinks };
}

export async function listLeagueTeams(
  leagueId: string,
): Promise<LeagueTeams | null> {
  const lt = await buildLeagueTrades(leagueId);
  return lt ? deriveLeagueTeams(lt) : null;
}

export async function buildTeamView(
  leagueId: string,
  rosterId: number,
): Promise<TeamView | null> {
  const lt = await buildLeagueTrades(leagueId);
  return lt ? deriveTeamView(lt, rosterId) : null;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run __tests__/trade-tracker/team-view.test.ts && npm run typecheck`
Expected: all tests PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/trade-tracker/team-view.ts __tests__/trade-tracker/team-view.test.ts
git commit -m "Add pure per-team trade-view derivation layer"
```

---

## Task 3: Arrow-path helper

**Files:**
- Create: `src/components/trade-tracker/arrowPath.ts`
- Test: `__tests__/trade-tracker/arrowPath.test.ts`

**Interfaces:**
- Produces:
  - `interface Point { x: number; y: number }`
  - `function computeArrowPath(from: Point, to: Point): string` — cubic-bezier `d` attribute with horizontal control handles.

- [ ] **Step 1: Write the failing test**

Create `__tests__/trade-tracker/arrowPath.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeArrowPath } from '@/components/trade-tracker/arrowPath';

describe('computeArrowPath', () => {
  it('starts at `from`, ends at `to`, and is a cubic bezier', () => {
    const d = computeArrowPath({ x: 10, y: 20 }, { x: 210, y: 80 });
    expect(d.startsWith('M 10 20')).toBe(true);
    expect(d).toContain('C');
    expect(d.trim().endsWith('210 80')).toBe(true);
  });

  it('uses horizontal control handles (control y matches endpoint y)', () => {
    const d = computeArrowPath({ x: 0, y: 0 }, { x: 100, y: 50 });
    // M 0 0 C <c1x> 0, <c2x> 50, 100 50
    const match = d.match(/C\s+[\d.]+\s+(\d+),\s+[\d.]+\s+(\d+),/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('0');
    expect(match![2]).toBe('50');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/trade-tracker/arrowPath.test.ts`
Expected: FAIL with "Failed to resolve import '.../arrowPath'".

- [ ] **Step 3: Implement**

Create `src/components/trade-tracker/arrowPath.ts`:

```typescript
export interface Point {
  x: number;
  y: number;
}

// A left-to-right cubic bezier with horizontal control handles, so arrows leave
// the source row horizontally and arrive at the target row horizontally.
export function computeArrowPath(from: Point, to: Point): string {
  const handle = Math.max(40, Math.abs(to.x - from.x) / 2);
  const c1x = from.x + handle;
  const c2x = to.x - handle;
  return `M ${from.x} ${from.y} C ${c1x} ${from.y}, ${c2x} ${to.y}, ${to.x} ${to.y}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/trade-tracker/arrowPath.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/trade-tracker/arrowPath.ts __tests__/trade-tracker/arrowPath.test.ts
git commit -m "Add cubic-bezier arrow-path helper"
```

---

## Task 4: PickOutcomeBadge and TeamTradeCard

**Files:**
- Create: `src/components/trade-tracker/PickOutcomeBadge.tsx`
- Create: `src/components/trade-tracker/TeamTradeCard.tsx`
- Test: `__tests__/trade-tracker/TeamTradeCard.test.tsx`

**Interfaces:**
- Consumes: `ReceivedAsset`, `pickKey` from `@/lib/trade-tracker/resolve`; `TeamTrade` from `@/lib/trade-tracker/team-view`.
- Produces:
  - `PickOutcomeBadge` default export: `({ asset }: { asset: Extract<ReceivedAsset, { kind: "pick" }> })`
  - `TeamTradeCard` default export: `({ trade, sourceKeys, targetKeys }: { trade: TeamTrade; sourceKeys: Set<string>; targetKeys: Set<string> })`
  - DOM contract: a re-traded received pick renders `data-anchor="src:<assetKey>"`; the matching traded-away pick renders `data-anchor="dst:<assetKey>"`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/trade-tracker/TeamTradeCard.test.tsx`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import TeamTradeCard from '@/components/trade-tracker/TeamTradeCard';
import type { TeamTrade } from '@/lib/trade-tracker/team-view';
import type { ReceivedAsset } from '@/lib/trade-tracker/resolve';

afterEach(cleanup);

const pick: ReceivedAsset = {
  kind: 'pick', season: '2024', round: 2, originalRoster: 2,
  label: '2024 2nd', outcome: { status: 'pending' },
};
const player: ReceivedAsset = { kind: 'player', playerName: 'Player1', position: 'WR', team: 'ARI' };

const trade: TeamTrade = {
  tradeId: 't1', season: '2024', createdAt: 1000,
  counterparties: ['Bravo'], tradedAway: [player], receives: [pick],
};

describe('TeamTradeCard', () => {
  it('shows the counterparty header and both columns', () => {
    render(<TeamTradeCard trade={trade} sourceKeys={new Set()} targetKeys={new Set()} />);
    expect(screen.getByText(/Trade w\/ Bravo/)).toBeTruthy();
    expect(screen.getByText('Player1')).toBeTruthy();
    expect(screen.getByText('2024 2nd')).toBeTruthy();
  });

  it('marks a re-traded received pick with a source anchor', () => {
    const { container } = render(
      <TeamTradeCard trade={trade} sourceKeys={new Set(['2024:2:2'])} targetKeys={new Set()} />,
    );
    expect(container.querySelector('[data-anchor="src:2024:2:2"]')).toBeTruthy();
  });

  it('marks an incoming traded-away pick with a target anchor', () => {
    const incoming: TeamTrade = { ...trade, tradedAway: [pick], receives: [player] };
    const { container } = render(
      <TeamTradeCard trade={incoming} sourceKeys={new Set()} targetKeys={new Set(['2024:2:2'])} />,
    );
    expect(container.querySelector('[data-anchor="dst:2024:2:2"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/trade-tracker/TeamTradeCard.test.tsx`
Expected: FAIL with "Failed to resolve import '.../TeamTradeCard'".

- [ ] **Step 3: Create `PickOutcomeBadge.tsx`**

Create `src/components/trade-tracker/PickOutcomeBadge.tsx`:

```tsx
import type { ReceivedAsset } from "@/lib/trade-tracker/resolve";

export default function PickOutcomeBadge({
  asset,
}: {
  asset: Extract<ReceivedAsset, { kind: "pick" }>;
}) {
  const { outcome } = asset;
  if (outcome.status === "drafted") {
    return (
      <span className="text-sm">
        <span className="text-slate-400">→ became </span>
        <span className="font-semibold text-emerald-400">{outcome.playerName}</span>
        {(outcome.position || outcome.team) && (
          <span className="text-slate-400">
            {" "}
            ({[outcome.position, outcome.team].filter(Boolean).join(" · ")}, pick{" "}
            {outcome.pickNo})
          </span>
        )}
      </span>
    );
  }
  if (outcome.status === "pending") {
    return <span className="text-sm text-amber-400/80">→ not yet drafted</span>;
  }
  return <span className="text-sm text-slate-500">→ selection unknown</span>;
}
```

- [ ] **Step 4: Create `TeamTradeCard.tsx`**

Create `src/components/trade-tracker/TeamTradeCard.tsx`:

```tsx
import type { ReceivedAsset } from "@/lib/trade-tracker/resolve";
import { pickKey } from "@/lib/trade-tracker/resolve";
import type { TeamTrade } from "@/lib/trade-tracker/team-view";
import PickOutcomeBadge from "./PickOutcomeBadge";

function keyOf(asset: Extract<ReceivedAsset, { kind: "pick" }>): string {
  return pickKey(asset.season, asset.round, asset.originalRoster);
}

function AssetRow({
  asset,
  side,
  sourceKeys,
  targetKeys,
}: {
  asset: ReceivedAsset;
  side: "receives" | "tradedAway";
  sourceKeys: Set<string>;
  targetKeys: Set<string>;
}) {
  if (asset.kind === "player") {
    return (
      <li className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium text-slate-100">{asset.playerName}</span>
        {(asset.position || asset.team) && (
          <span className="text-xs text-slate-400">
            {[asset.position, asset.team].filter(Boolean).join(" · ")}
          </span>
        )}
      </li>
    );
  }

  const key = keyOf(asset);
  const isSource = side === "receives" && sourceKeys.has(key);
  const isTarget = side === "tradedAway" && targetKeys.has(key);
  const anchor = isSource ? `src:${key}` : isTarget ? `dst:${key}` : undefined;

  return (
    <li
      data-anchor={anchor}
      className="flex flex-wrap items-baseline gap-x-2"
    >
      <span className="font-medium text-sky-300">{asset.label}</span>
      {isSource ? (
        <span className="text-sm text-sky-400/80">→ traded on</span>
      ) : (
        <PickOutcomeBadge asset={asset} />
      )}
    </li>
  );
}

function Column({
  title,
  assets,
  side,
  sourceKeys,
  targetKeys,
}: {
  title: string;
  assets: ReceivedAsset[];
  side: "receives" | "tradedAway";
  sourceKeys: Set<string>;
  targetKeys: Set<string>;
}) {
  return (
    <div className="rounded-lg border border-pitch-700 bg-pitch-900/60 p-4">
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        {title}
      </h4>
      {assets.length > 0 ? (
        <ul className="space-y-1.5">
          {assets.map((asset, i) => (
            <AssetRow
              key={i}
              asset={asset}
              side={side}
              sourceKeys={sourceKeys}
              targetKeys={targetKeys}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">Nothing</p>
      )}
    </div>
  );
}

export default function TeamTradeCard({
  trade,
  sourceKeys,
  targetKeys,
}: {
  trade: TeamTrade;
  sourceKeys: Set<string>;
  targetKeys: Set<string>;
}) {
  const date = new Date(trade.createdAt);
  const counterparty = trade.counterparties.join(", ") || "Unknown";
  return (
    <article className="w-80 shrink-0 rounded-xl border border-pitch-700 bg-pitch-800/60 p-5">
      <div className="mb-1 text-sm font-semibold text-slate-200">
        Trade w/ {counterparty}
      </div>
      <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
        <span>{trade.season} season</span>
        <time dateTime={date.toISOString()}>
          {date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </time>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Column
          title="Traded Away"
          assets={trade.tradedAway}
          side="tradedAway"
          sourceKeys={sourceKeys}
          targetKeys={targetKeys}
        />
        <Column
          title="Receives"
          assets={trade.receives}
          side="receives"
          sourceKeys={sourceKeys}
          targetKeys={targetKeys}
        />
      </div>
    </article>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/trade-tracker/TeamTradeCard.test.tsx`
Expected: all 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/trade-tracker/PickOutcomeBadge.tsx src/components/trade-tracker/TeamTradeCard.tsx __tests__/trade-tracker/TeamTradeCard.test.tsx
git commit -m "Add TeamTradeCard and PickOutcomeBadge components"
```

---

## Task 5: TeamTradeCanvas (client overlay)

**Files:**
- Create: `src/components/trade-tracker/TeamTradeCanvas.tsx`

**Interfaces:**
- Consumes: `TeamView` from `@/lib/trade-tracker/team-view`; `TeamTradeCard`; `computeArrowPath` from `./arrowPath`.
- Produces: `TeamTradeCanvas` default export: `({ view }: { view: TeamView })`.

This task has no unit test: its only logic beyond `computeArrowPath` (already tested) is DOM measurement, which jsdom reports as zero-sized. It is verified in Task 6's manual build/run check. Keep the component thin — all geometry math stays in `computeArrowPath`.

- [ ] **Step 1: Create the canvas component**

Create `src/components/trade-tracker/TeamTradeCanvas.tsx`:

```tsx
"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TeamView } from "@/lib/trade-tracker/team-view";
import TeamTradeCard from "./TeamTradeCard";
import { computeArrowPath } from "./arrowPath";

export default function TeamTradeCanvas({ view }: { view: TeamView }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const { sourceKeysByTrade, targetKeysByTrade } = useMemo(() => {
    const source = new Map<string, Set<string>>();
    const target = new Map<string, Set<string>>();
    for (const link of view.chainLinks) {
      if (!source.has(link.fromTradeId)) source.set(link.fromTradeId, new Set());
      source.get(link.fromTradeId)!.add(link.assetKey);
      if (!target.has(link.toTradeId)) target.set(link.toTradeId, new Set());
      target.get(link.toTradeId)!.add(link.assetKey);
    }
    return { sourceKeysByTrade: source, targetKeysByTrade: target };
  }, [view.chainLinks]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const recompute = () => {
      const origin = track.getBoundingClientRect();
      const next: string[] = [];
      for (const link of view.chainLinks) {
        const src = track.querySelector(`[data-anchor="src:${link.assetKey}"]`);
        const dst = track.querySelector(`[data-anchor="dst:${link.assetKey}"]`);
        if (!src || !dst) continue;
        const s = src.getBoundingClientRect();
        const d = dst.getBoundingClientRect();
        next.push(
          computeArrowPath(
            {
              x: s.right - origin.left + track.scrollLeft,
              y: s.top + s.height / 2 - origin.top + track.scrollTop,
            },
            {
              x: d.left - origin.left + track.scrollLeft,
              y: d.top + d.height / 2 - origin.top + track.scrollTop,
            },
          ),
        );
      }
      setPaths(next);
      setSize({ w: track.scrollWidth, h: track.scrollHeight });
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(track);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [view]);

  return (
    <div ref={trackRef} className="relative overflow-x-auto pb-4">
      <svg
        className="pointer-events-none absolute left-0 top-0"
        width={size.w}
        height={size.h}
        style={{ overflow: "visible" }}
      >
        <defs>
          <marker
            id="trade-arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="#38bdf8" />
          </marker>
        </defs>
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={2}
            markerEnd="url(#trade-arrowhead)"
          />
        ))}
      </svg>

      <div className="flex w-max items-start gap-16">
        {view.trades.map((trade) => (
          <TeamTradeCard
            key={trade.tradeId}
            trade={trade}
            sourceKeys={sourceKeysByTrade.get(trade.tradeId) ?? new Set()}
            targetKeys={targetKeysByTrade.get(trade.tradeId) ?? new Set()}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/trade-tracker/TeamTradeCanvas.tsx
git commit -m "Add TeamTradeCanvas client overlay with SVG arrows"
```

---

## Task 6: Wire pages, shared Message, delete old components

**Files:**
- Create: `src/components/trade-tracker/Message.tsx`
- Rewrite: `src/app/trade-tracker/league/[leagueId]/page.tsx`
- Create: `src/app/trade-tracker/league/[leagueId]/team/[rosterId]/page.tsx`
- Delete: `src/components/trade-tracker/TradeCard.tsx`, `src/components/trade-tracker/TradeSankey.tsx`, `src/lib/trade-tracker/sankey.ts`

**Interfaces:**
- Consumes: `listLeagueTeams`, `buildTeamView` from `@/lib/trade-tracker/team-view`; `TeamTradeCanvas`.
- Produces:
  - `Message` default export: `({ title, body }: { title: string; body: string })`
  - Team picker at `/trade-tracker/league/[leagueId]`
  - Per-team page at `/trade-tracker/league/[leagueId]/team/[rosterId]`

- [ ] **Step 1: Create the shared `Message` component**

Create `src/components/trade-tracker/Message.tsx`:

```tsx
import Link from "next/link";

export default function Message({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <main className="space-y-4">
      <div className="rounded-xl border border-pitch-700 bg-pitch-800/60 p-6">
        <h1 className="mb-1 text-xl font-bold">{title}</h1>
        <p className="text-slate-300">{body}</p>
        <Link
          href="/trade-tracker"
          className="mt-4 inline-block text-sm text-emerald-400 hover:underline"
        >
          ← Back to start
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Rewrite the league page as a team picker**

Replace the entire contents of `src/app/trade-tracker/league/[leagueId]/page.tsx` with:

```tsx
import Link from "next/link";
import Message from "@/components/trade-tracker/Message";
import { listLeagueTeams } from "@/lib/trade-tracker/team-view";

export const revalidate = 300;

export default async function LeaguePage({
  params,
}: {
  params: { leagueId: string };
}) {
  let data;
  try {
    data = await listLeagueTeams(params.leagueId);
  } catch {
    return (
      <Message
        title="Couldn't load this league"
        body="Sleeper's API didn't respond as expected. Double-check the league ID and try again."
      />
    );
  }

  if (!data) {
    return (
      <Message
        title="League not found"
        body={`No Sleeper league matched the ID "${params.leagueId}". Make sure you copied the full ID.`}
      />
    );
  }

  const teams = [...data.teams].sort(
    (a, b) => b.tradeCount - a.tradeCount || a.teamName.localeCompare(b.teamName),
  );

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{data.leagueName}</h1>
          <p className="text-sm text-slate-400">Pick a team to see its trade history</p>
        </div>
        <Link href="/trade-tracker" className="text-sm text-emerald-400 hover:underline">
          ← Track another league
        </Link>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {teams.map((t) => (
          <li key={t.rosterId}>
            <Link
              href={`/trade-tracker/league/${params.leagueId}/team/${t.rosterId}`}
              className="flex items-center justify-between rounded-xl border border-pitch-700 bg-pitch-800/60 p-4 hover:border-emerald-500/50"
            >
              <span>
                <span className="font-semibold text-slate-100">{t.teamName}</span>
                <span className="block text-xs text-slate-400">{t.ownerName}</span>
              </span>
              <span className="text-sm text-slate-400">
                {t.tradeCount} trade{t.tradeCount === 1 ? "" : "s"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: Create the per-team page**

Create `src/app/trade-tracker/league/[leagueId]/team/[rosterId]/page.tsx`:

```tsx
import Link from "next/link";
import Message from "@/components/trade-tracker/Message";
import TeamTradeCanvas from "@/components/trade-tracker/TeamTradeCanvas";
import { buildTeamView } from "@/lib/trade-tracker/team-view";

export const revalidate = 300;

export default async function TeamPage({
  params,
}: {
  params: { leagueId: string; rosterId: string };
}) {
  const rosterId = Number(params.rosterId);

  let data;
  try {
    data = Number.isNaN(rosterId)
      ? null
      : await buildTeamView(params.leagueId, rosterId);
  } catch {
    return (
      <Message
        title="Couldn't load this team"
        body="Sleeper's API didn't respond as expected. Try again in a few minutes."
      />
    );
  }

  if (!data) {
    return (
      <Message
        title="Team not found"
        body="No team matched that link. Go back and pick a team from the list."
      />
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{data.teamName}</h1>
          <p className="text-sm text-slate-400">
            {data.trades.length} trade{data.trades.length === 1 ? "" : "s"} ·{" "}
            {data.leagueName}
          </p>
        </div>
        <Link
          href={`/trade-tracker/league/${params.leagueId}`}
          className="text-sm text-emerald-400 hover:underline"
        >
          ← All teams
        </Link>
      </div>

      {data.trades.length === 0 ? (
        <Message
          title="No trades yet"
          body="This team hasn't made any trades in the league's history."
        />
      ) : (
        <TeamTradeCanvas view={data} />
      )}
    </main>
  );
}
```

- [ ] **Step 4: Delete the replaced components**

Run:

```bash
git rm src/components/trade-tracker/TradeCard.tsx src/components/trade-tracker/TradeSankey.tsx src/lib/trade-tracker/sankey.ts
```

- [ ] **Step 5: Verify nothing else references the deleted files**

Run: `grep -rn "TradeCard\|TradeSankey\|sankey" src`
Expected: no output (empty).

- [ ] **Step 6: Full verification — tests, typecheck, lint, build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all suites pass, typecheck clean, no ESLint errors, build succeeds.

- [ ] **Step 7: Manual check against a live league**

Run: `npm run dev`, then open
`http://localhost:3000/trade-tracker/league/1048426134855081984`.
Expected: a team list with trade counts. Click a team that has trades; the per-team canvas renders left→right cards. For any pick the team received and later traded away, an arrow connects the "Receives" row in the earlier card to the "Traded Away" row in the later card; terminal picks show their outcome badge.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Wire per-team trade flow pages and remove old Sankey view"
```

---

## Self-Review Notes

- **Spec coverage:** Routing (Task 6) · `team-view.ts` data layer with `listLeagueTeams`/`buildTeamView` + `PickChainLink` (Task 2) · pick identity via `pickKey` + `originalRoster` (Task 1) · `TeamTradeCanvas`/`TeamTradeCard`/`PickOutcomeBadge` (Tasks 4–5) · removal of `TradeCard`/`TradeSankey`/`sankey.ts` (Task 6) · all edge cases (originated pick = no source anchor; multi-team counterparties; kept pick = badge; zero-trade team = empty state) covered by Task 2 tests and page logic.
- **Type consistency:** `pickKey`, `originalRoster`, `TeamMeta`, `LeagueTrades.teams` defined in Task 1 and consumed unchanged in Task 2; `TeamTrade`/`TeamView`/`PickChainLink` defined in Task 2 and consumed in Tasks 4–6; anchor contract `src:`/`dst:` defined in Task 4 and read in Task 5.
- **Deferred to manual verification:** `TeamTradeCanvas` DOM measurement (jsdom can't measure layout); covered by Task 6 Step 7.
