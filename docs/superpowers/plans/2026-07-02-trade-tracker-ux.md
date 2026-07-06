# Trade Tracker UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the trade-tracker team view pleasant: a compact season-grouped timeline becomes the default view (with chain jump-links), the pick-chain canvas becomes an opt-in "Flow view" that is denser, color-coded, hover-highlightable, and discoverable, and a summary stat strip tops the page.

**Architecture:** All changes stay inside the trade-tracker namespace (`src/lib/trade-tracker/`, `src/components/trade-tracker/`, `src/app/trade-tracker/`). Pure logic (summary stats, chain-key sets, arrow styling, layout packing, counterparty resolution) lands in small tested modules; a new client `TeamTradeView` wrapper owns the Timeline/Flow toggle and composes `SummaryStrip`, new `TradeTimeline`, and the reworked `TeamTradeCanvas`. `TeamTradeCard` becomes width-fluid and gains counterparty links, column accents, and optional chain jump buttons so both views share it.

**Tech Stack:** Next.js 14 App Router, React client components, Tailwind, Vitest + Testing Library (jsdom).

## Global Constraints

- Stay inside the trade-tracker namespace; do NOT touch idp-checker's Sleeper client/types (CLAUDE.md).
- TypeScript `strict`; path alias `@/*` → `src/*`.
- Tests live under `__tests__/trade-tracker/`, Vitest globals enabled.
- CI does not run tests — run `npm test` and `npm run typecheck` locally before pushing.
- One commit per task (user's commit-granularity preference); work on a feature branch off `main`.
- Dark slate palette is the house style; every new class needs a `dark:` variant. Page background is `gray-50` light / `pitch-900` dark (`#f9fafb` / `#0b1120` — same values already used by `captureBackground` in TeamTradeCanvas).
- Before writing `SummaryStrip` (stat tiles), the implementer MUST load the `dataviz` skill (it governs stat tile/KPI row design) and reconcile its guidance with the house palette.

---

### Task 1: Trim Sleeper team names + export `ordinal`

Sleeper team names arrive with stray whitespace ("Funded by the Saudis "). Trim them where names are resolved. Also export the private `ordinal` helper — Task 4 needs it to label arrows.

**Files:**
- Modify: `src/lib/trade-tracker/resolve.ts`
- Test: `__tests__/trade-tracker/resolve.test.ts`

**Interfaces:**
- Produces: `export function ordinal(round: number): string` from `@/lib/trade-tracker/resolve` (e.g. `ordinal(2) === "2nd"`).

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/trade-tracker/resolve.test.ts` (match the file's existing mock/setup style — it already tests `buildLeagueTrades` with mocked `./sleeper`; extend an existing fixture user with padded names, or add a focused case):

```ts
import { ordinal } from '@/lib/trade-tracker/resolve';

describe('ordinal', () => {
  it('formats draft rounds', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(9)).toBe('9th');
  });
});
```

And in the existing `buildLeagueTrades` suite, set a fixture user's `metadata.team_name` to a padded value (e.g. `'Funded by the Saudis '`) and assert the resolved team name comes back trimmed (`'Funded by the Saudis'`) wherever that fixture surfaces (`teams[].teamName` and/or a flow's `toTeamName`).

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run __tests__/trade-tracker/resolve.test.ts`
Expected: FAIL — `ordinal` is not exported; trimmed-name assertion fails.

- [ ] **Step 3: Implement**

In `src/lib/trade-tracker/resolve.ts`:

Change the `ordinal` declaration to an export:

```ts
export function ordinal(round: number): string {
  return ORDINALS[round] ?? `${round}th`;
}
```

Add a helper near `playerName`:

```ts
function cleanName(name: string | null | undefined): string {
  return name?.trim() ?? "";
}
```

Use it at both name-resolution sites:

```ts
// in the first pass over rosters:
names.set(
  roster.roster_id,
  cleanName(user?.metadata?.team_name) ||
    cleanName(user?.display_name) ||
    `Roster ${roster.roster_id}`,
);
```

```ts
// in the newest-league teams mapping:
return {
  rosterId: roster.roster_id,
  teamName:
    cleanName(user?.metadata?.team_name) ||
    cleanName(user?.display_name) ||
    `Roster ${roster.roster_id}`,
  ownerName: cleanName(user?.display_name) || "Unknown",
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/trade-tracker/resolve.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/trade-tracker/resolve.ts __tests__/trade-tracker/resolve.test.ts
git commit -m "fix(trade-tracker): trim Sleeper team names, export ordinal"
```

---

### Task 2: Counterparties carry roster IDs

`TeamTrade.counterparties` is currently `string[]`; the UI needs roster IDs to link each counterparty to their team page.

**Files:**
- Modify: `src/lib/trade-tracker/team-view.ts`
- Test: `__tests__/trade-tracker/team-view.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Counterparty { rosterId: number | null; name: string; }
  // TeamTrade.counterparties: Counterparty[]
  ```

- [ ] **Step 1: Update/write tests**

In `__tests__/trade-tracker/team-view.test.ts`, update every assertion on `counterparties` from `['Name']` form to `[{ rosterId: <id>, name: 'Name' }]`, and add a case asserting the roster ID flows through (a flow where `fromRosterId: 2, fromTeamName: 'Bravo'` toward the viewed roster must yield `{ rosterId: 2, name: 'Bravo' }`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/trade-tracker/team-view.test.ts`
Expected: FAIL (type/shape mismatch).

- [ ] **Step 3: Implement**

In `src/lib/trade-tracker/team-view.ts`:

```ts
export interface Counterparty {
  rosterId: number | null;
  name: string;
}

export interface TeamTrade {
  tradeId: string;
  season: string;
  createdAt: number;
  counterparties: Counterparty[];
  tradedAway: ReceivedAsset[];
  receives: ReceivedAsset[];
}
```

In `deriveTeamView`, replace the `Set<string>` accumulation:

```ts
const counterparties = new Map<string, Counterparty>();
for (const f of tv.flows) {
  if (f.toRosterId === rosterId) {
    receives.push(f.asset);
    if (f.fromTeamName) {
      counterparties.set(f.fromTeamName, { rosterId: f.fromRosterId, name: f.fromTeamName });
    }
  }
  if (f.fromRosterId === rosterId) {
    tradedAway.push(f.asset);
    counterparties.set(f.toTeamName, { rosterId: f.toRosterId, name: f.toTeamName });
  }
}
```

and return `counterparties: Array.from(counterparties.values())`.

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run __tests__/trade-tracker/ && npm run typecheck`
Expected: team-view tests PASS; typecheck will FAIL in `TeamTradeCard.tsx` (`trade.counterparties.join`) — fix that call site minimally now so the repo stays green (render `trade.counterparties.map((c) => c.name).join(", ")`); Task 6 replaces it properly. TeamTradeCard/tradeLayout test fixtures using `counterparties: []` still typecheck (empty array fits both shapes); fixtures with `['Bravo']` must become `[{ rosterId: 2, name: 'Bravo' }]`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/trade-tracker/team-view.ts src/components/trade-tracker/TeamTradeCard.tsx __tests__/trade-tracker/
git commit -m "feat(trade-tracker): counterparties carry roster ids"
```

---

### Task 3: Summary stats module

**Files:**
- Create: `src/lib/trade-tracker/summary.ts`
- Test: `__tests__/trade-tracker/summary.test.ts`

**Interfaces:**
- Consumes: `TeamView`, `Counterparty` from `./team-view`; `pickKey` from `./resolve`.
- Produces:
  ```ts
  export interface TeamTradeStats {
    tradeCount: number;
    playersAcquired: number;
    picksAcquired: number;
    picksFlipped: number;   // received picks later traded away again
    picksDrafted: number;   // kept picks that became players
    picksPending: number;   // kept picks awaiting a draft
    topPartner: { name: string; trades: number } | null;
  }
  export function summarizeTeamView(view: TeamView): TeamTradeStats;
  ```
  Semantics: a received pick that appears as the `fromTradeId` side of a chain link counts as flipped and is excluded from drafted/pending; `topPartner` is the counterparty appearing in the most trades (ties: first encountered wins).

- [ ] **Step 1: Write the failing tests**

Create `__tests__/trade-tracker/summary.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { summarizeTeamView } from '@/lib/trade-tracker/summary';
import type { TeamView, TeamTrade } from '@/lib/trade-tracker/team-view';
import type { ReceivedAsset } from '@/lib/trade-tracker/resolve';

const draftedPick: ReceivedAsset = {
  kind: 'pick', season: '2024', round: 2, originalRoster: 3, label: '2024 2nd',
  originalOwnerName: null,
  outcome: { status: 'drafted', playerName: 'P', position: 'WR', team: 'CIN', round: 2, pickNo: 15 },
};
const pendingPick: ReceivedAsset = {
  kind: 'pick', season: '2026', round: 1, originalRoster: 4, label: '2026 1st',
  originalOwnerName: null, outcome: { status: 'pending' },
};
const flippedPick: ReceivedAsset = {
  kind: 'pick', season: '2025', round: 3, originalRoster: 5, label: '2025 3rd',
  originalOwnerName: null, outcome: { status: 'drafted', playerName: 'Q', position: 'LB', team: 'SF', round: 3, pickNo: 30 },
};
const player: ReceivedAsset = { kind: 'player', playerName: 'A', position: 'LB', team: 'SF' };

function trade(id: string, at: number, partnerName: string, receives: ReceivedAsset[], tradedAway: ReceivedAsset[] = []): TeamTrade {
  return {
    tradeId: id, season: '2024', createdAt: at,
    counterparties: [{ rosterId: 9, name: partnerName }],
    receives, tradedAway,
  };
}

describe('summarizeTeamView', () => {
  it('counts trades, players, picks, outcomes, flips, and top partner', () => {
    const view: TeamView = {
      leagueName: 'L', teamName: 'T',
      trades: [
        trade('t1', 100, 'Bravo', [player, draftedPick]),
        trade('t2', 200, 'Bravo', [flippedPick]),
        trade('t3', 300, 'Charlie', [pendingPick], [flippedPick]),
      ],
      // flippedPick received in t2 was traded away again in t3
      chainLinks: [{ assetKey: '2025:3:5', fromTradeId: 't2', toTradeId: 't3' }],
    };
    const s = summarizeTeamView(view);
    expect(s.tradeCount).toBe(3);
    expect(s.playersAcquired).toBe(1);
    expect(s.picksAcquired).toBe(3);
    expect(s.picksFlipped).toBe(1);
    expect(s.picksDrafted).toBe(1); // flipped pick's drafted outcome not counted
    expect(s.picksPending).toBe(1);
    expect(s.topPartner).toEqual({ name: 'Bravo', trades: 2 });
  });

  it('returns null topPartner for a team with no trades', () => {
    const s = summarizeTeamView({ leagueName: 'L', teamName: 'T', trades: [], chainLinks: [] });
    expect(s.tradeCount).toBe(0);
    expect(s.topPartner).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/trade-tracker/summary.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/trade-tracker/summary.ts`:

```ts
import { pickKey } from "./resolve";
import type { TeamView } from "./team-view";

export interface TeamTradeStats {
  tradeCount: number;
  playersAcquired: number;
  picksAcquired: number;
  picksFlipped: number;
  picksDrafted: number;
  picksPending: number;
  topPartner: { name: string; trades: number } | null;
}

// Rolls a team's trade history into headline numbers. A received pick the team
// later traded away again ("flipped") is excluded from drafted/pending — its
// outcome belongs to whoever ended up holding it.
export function summarizeTeamView(view: TeamView): TeamTradeStats {
  const flipped = new Set(
    view.chainLinks.map((l) => `${l.fromTradeId}:${l.assetKey}`),
  );

  let playersAcquired = 0;
  let picksAcquired = 0;
  let picksDrafted = 0;
  let picksPending = 0;
  const partnerTrades = new Map<string, number>();

  for (const trade of view.trades) {
    for (const c of trade.counterparties) {
      partnerTrades.set(c.name, (partnerTrades.get(c.name) ?? 0) + 1);
    }
    for (const asset of trade.receives) {
      if (asset.kind === "player") playersAcquired++;
      if (asset.kind !== "pick") continue;
      picksAcquired++;
      const key = `${trade.tradeId}:${pickKey(asset.season, asset.round, asset.originalRoster)}`;
      if (flipped.has(key)) continue;
      if (asset.outcome.status === "drafted") picksDrafted++;
      if (asset.outcome.status === "pending") picksPending++;
    }
  }

  let topPartner: TeamTradeStats["topPartner"] = null;
  for (const [name, trades] of partnerTrades) {
    if (!topPartner || trades > topPartner.trades) topPartner = { name, trades };
  }

  return {
    tradeCount: view.trades.length,
    playersAcquired,
    picksAcquired,
    picksFlipped: view.chainLinks.length,
    picksDrafted,
    picksPending,
    topPartner,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/trade-tracker/summary.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/trade-tracker/summary.ts __tests__/trade-tracker/summary.test.ts
git commit -m "feat(trade-tracker): team trade summary stats"
```

---

### Task 4: Chain-key sets + arrow styling helpers

Two small pure modules: `chainKeys.ts` extracts the source/target key-set computation currently inlined in `TeamTradeCanvas` (the timeline needs it too); `arrowStyle.ts` assigns each pick chain a stable color and a human label.

**Files:**
- Create: `src/components/trade-tracker/chainKeys.ts`
- Create: `src/components/trade-tracker/arrowStyle.ts`
- Test: `__tests__/trade-tracker/chainKeys.test.ts`
- Test: `__tests__/trade-tracker/arrowStyle.test.ts`

**Interfaces:**
- Consumes: `PickChainLink` from `@/lib/trade-tracker/team-view`; `ordinal` from `@/lib/trade-tracker/resolve` (Task 1).
- Produces:
  ```ts
  // chainKeys.ts
  export function chainKeySets(chainLinks: PickChainLink[]): {
    sourceKeysByTrade: Map<string, Set<string>>;
    targetKeysByTrade: Map<string, Set<string>>;
  };
  // arrowStyle.ts
  export const CHAIN_COLORS: readonly string[];
  export function orderedAssetKeys(chainLinks: PickChainLink[]): string[];
  export function colorForAssetKey(assetKey: string, ordered: readonly string[]): string;
  export function labelForAssetKey(assetKey: string): string; // "2024:2:5" -> "2024 2nd"
  ```

- [ ] **Step 1: Write the failing tests**

Create `__tests__/trade-tracker/chainKeys.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { chainKeySets } from '@/components/trade-tracker/chainKeys';

describe('chainKeySets', () => {
  it('indexes asset keys by source and target trade', () => {
    const { sourceKeysByTrade, targetKeysByTrade } = chainKeySets([
      { assetKey: 'k1', fromTradeId: 't1', toTradeId: 't2' },
      { assetKey: 'k2', fromTradeId: 't1', toTradeId: 't3' },
    ]);
    expect(sourceKeysByTrade.get('t1')).toEqual(new Set(['k1', 'k2']));
    expect(targetKeysByTrade.get('t2')).toEqual(new Set(['k1']));
    expect(targetKeysByTrade.get('t3')).toEqual(new Set(['k2']));
    expect(sourceKeysByTrade.get('t2')).toBeUndefined();
  });
});
```

Create `__tests__/trade-tracker/arrowStyle.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  CHAIN_COLORS,
  colorForAssetKey,
  labelForAssetKey,
  orderedAssetKeys,
} from '@/components/trade-tracker/arrowStyle';

describe('arrowStyle', () => {
  it('derives a pick label from an asset key', () => {
    expect(labelForAssetKey('2024:2:5')).toBe('2024 2nd');
    expect(labelForAssetKey('2026:1:12')).toBe('2026 1st');
  });

  it('gives each distinct chain a color, stable across links of the same pick', () => {
    const links = [
      { assetKey: 'a', fromTradeId: 't1', toTradeId: 't2' },
      { assetKey: 'b', fromTradeId: 't2', toTradeId: 't3' },
      { assetKey: 'a', fromTradeId: 't2', toTradeId: 't4' }, // same pick flipped again
    ];
    const ordered = orderedAssetKeys(links);
    expect(ordered).toEqual(['a', 'b']);
    expect(colorForAssetKey('a', ordered)).toBe(CHAIN_COLORS[0]);
    expect(colorForAssetKey('b', ordered)).toBe(CHAIN_COLORS[1]);
  });

  it('cycles the palette when chains outnumber colors', () => {
    const ordered = Array.from({ length: CHAIN_COLORS.length + 1 }, (_, i) => `k${i}`);
    expect(colorForAssetKey(ordered[CHAIN_COLORS.length], ordered)).toBe(CHAIN_COLORS[0]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/trade-tracker/chainKeys.test.ts __tests__/trade-tracker/arrowStyle.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

Create `src/components/trade-tracker/chainKeys.ts`:

```ts
import type { PickChainLink } from "@/lib/trade-tracker/team-view";

// Indexes chain links by trade: which received picks a trade later re-traded
// (source) and which traded-away picks arrived via an earlier trade (target).
export function chainKeySets(chainLinks: PickChainLink[]): {
  sourceKeysByTrade: Map<string, Set<string>>;
  targetKeysByTrade: Map<string, Set<string>>;
} {
  const sourceKeysByTrade = new Map<string, Set<string>>();
  const targetKeysByTrade = new Map<string, Set<string>>();
  for (const link of chainLinks) {
    if (!sourceKeysByTrade.has(link.fromTradeId)) {
      sourceKeysByTrade.set(link.fromTradeId, new Set());
    }
    sourceKeysByTrade.get(link.fromTradeId)!.add(link.assetKey);
    if (!targetKeysByTrade.has(link.toTradeId)) {
      targetKeysByTrade.set(link.toTradeId, new Set());
    }
    targetKeysByTrade.get(link.toTradeId)!.add(link.assetKey);
  }
  return { sourceKeysByTrade, targetKeysByTrade };
}
```

Create `src/components/trade-tracker/arrowStyle.ts`:

```ts
import { ordinal } from "@/lib/trade-tracker/resolve";
import type { PickChainLink } from "@/lib/trade-tracker/team-view";

// Hues that read on both the light (gray-50) and dark (pitch-900) canvases.
export const CHAIN_COLORS: readonly string[] = [
  "#0ea5e9", // sky
  "#a855f7", // violet
  "#f59e0b", // amber
  "#10b981", // emerald
  "#f43f5e", // rose
  "#14b8a6", // teal
];

// Distinct asset keys in first-appearance order — one entry per pick chain.
export function orderedAssetKeys(chainLinks: PickChainLink[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const link of chainLinks) {
    if (seen.has(link.assetKey)) continue;
    seen.add(link.assetKey);
    ordered.push(link.assetKey);
  }
  return ordered;
}

export function colorForAssetKey(
  assetKey: string,
  ordered: readonly string[],
): string {
  const i = ordered.indexOf(assetKey);
  return CHAIN_COLORS[(i >= 0 ? i : 0) % CHAIN_COLORS.length];
}

// assetKey is pickKey(season, round, originalRoster) — "2024:2:5" → "2024 2nd".
export function labelForAssetKey(assetKey: string): string {
  const [season, round] = assetKey.split(":");
  return `${season} ${ordinal(Number(round))}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/trade-tracker/chainKeys.test.ts __tests__/trade-tracker/arrowStyle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/trade-tracker/chainKeys.ts src/components/trade-tracker/arrowStyle.ts __tests__/trade-tracker/chainKeys.test.ts __tests__/trade-tracker/arrowStyle.test.ts
git commit -m "feat(trade-tracker): chain key sets and arrow styling helpers"
```

---

### Task 5: Pack the chain layout (kill the blank rows)

`layoutTrades` currently allocates a fresh global row for every root and every branch (`nextRow++`), leaving huge empty bands. Switch to first-fit packing over an occupancy grid: a card takes the topmost free row in its column (continuations still try to stay on their feeder's row).

**Files:**
- Modify: `src/components/trade-tracker/tradeLayout.ts`
- Test: `__tests__/trade-tracker/tradeLayout.test.ts`

**Interfaces:**
- Produces: same signatures as today (`layoutTrades`, `layoutChainComponents`); only placement changes.

- [ ] **Step 1: Add failing packing tests**

Append to the `layoutTrades` describe block in `__tests__/trade-tracker/tradeLayout.test.ts`:

```ts
it('packs a branch into the topmost free row of its column', () => {
  // Two roots each with a chain, plus a branch off t1. Old layout put the
  // branch on a brand-new global row; packing should reuse row 1 (free in col 1).
  const trades = [
    trade('t1', 100), trade('t2', 200), trade('t3', 300),
    trade('r2', 150), trade('r2b', 250),
  ];
  const links = [link('t1', 't2'), link('t1', 't3'), link('r2', 'r2b')];
  const pos = layoutTrades(trades, links);
  expect(pos.get('t1')).toEqual({ row: 0, column: 0 });
  expect(pos.get('t2')).toEqual({ row: 0, column: 1 });
  expect(pos.get('t3')).toEqual({ row: 1, column: 1 }); // packed beside r2's row, not row 2
  expect(pos.get('r2')).toEqual({ row: 1, column: 0 });
});

it('never places two trades in the same cell', () => {
  const trades = [
    trade('a', 1), trade('b', 2), trade('c', 3), trade('d', 4), trade('e', 5),
  ];
  const links = [link('a', 'b'), link('a', 'c'), link('a', 'd'), link('d', 'e')];
  const pos = layoutTrades(trades, links);
  const cells = new Set(
    Array.from(pos.values()).map((p) => `${p.row}:${p.column}`),
  );
  expect(cells.size).toBe(trades.length);
});
```

Existing tests must keep passing unchanged — the simple branch/diamond/root cases produce identical positions under first-fit.

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run __tests__/trade-tracker/tradeLayout.test.ts`
Expected: the "packs a branch" test FAILS under the current `nextRow++` scheme (t3 lands on row 2); others pass.

- [ ] **Step 3: Implement first-fit packing**

In `src/components/trade-tracker/tradeLayout.ts`, replace the placement section of `layoutTrades` (keep the `column` memo and target sorting as-is) and update the top comment:

```ts
// Lays trades on a grid: column = longest chain-path from a root (so a diamond
// target lands right of every feeder). Rows are packed first-fit: a trade takes
// the topmost free row in its column, except a chain continuation first tries
// to stay on its feeder's row so straight chains read left-to-right.
```

```ts
  const pos = new Map<string, CellPosition>();
  const occupied = new Set<string>(); // "row:column"

  function firstFreeRow(col: number, startRow: number): number {
    let row = startRow;
    while (occupied.has(`${row}:${col}`)) row++;
    return row;
  }

  function place(id: string, preferredRow: number): void {
    if (pos.has(id)) return;
    const col = column(id);
    const row = firstFreeRow(col, preferredRow);
    pos.set(id, { row, column: col });
    occupied.add(`${row}:${col}`);
    let continued = false;
    for (const child of outEdges.get(id) ?? []) {
      if (pos.has(child)) continue;
      if (!continued) {
        place(child, row); // earliest unplaced target continues this row
        continued = true;
      } else {
        place(child, 0); // later targets pack into the topmost free row
      }
    }
  }

  const roots = trades
    .filter((t) => (inEdges.get(t.tradeId) ?? []).length === 0)
    .sort((a, b) => a.createdAt - b.createdAt);
  for (const root of roots) place(root.tradeId, 0);
  // Safety net for any trade a root traversal didn't reach.
  for (const t of trades) place(t.tradeId, 0);

  return pos;
```

(Remove the old `nextRow` counter and the old `place` implementation.)

- [ ] **Step 4: Run the full trade-tracker suite**

Run: `npx vitest run __tests__/trade-tracker/`
Expected: PASS — including all pre-existing layout tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/trade-tracker/tradeLayout.ts __tests__/trade-tracker/tradeLayout.test.ts
git commit -m "perf(trade-tracker): pack chain layout rows first-fit"
```

---

### Task 6: Rework TeamTradeCard (fluid width, linked counterparties, accents, jump links)

Card changes shared by both views:
- Width comes from the parent (`w-full`) instead of hardcoded `w-md shrink-0`.
- Header: counterparty names link to their team page (needs `leagueId`); date moves up beside the header; the redundant "YYYY season" line goes away.
- Columns get subtle left-edge accents (rose = traded away, emerald = receives); empty columns show "—" instead of "Nothing".
- Optional `chainJump`/`onJump` props render jump buttons on chained picks (used by the timeline; the canvas keeps its anchor spans).
- Optional `htmlId` so the timeline can scroll to a card.

**Files:**
- Modify: `src/components/trade-tracker/TeamTradeCard.tsx`
- Test: `__tests__/trade-tracker/TeamTradeCard.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface ChainJump { targetTradeId: string; label: string; }
  export type ChainJumpLookup = (args: {
    assetKey: string;
    side: "receives" | "tradedAway";
  }) => ChainJump | null;
  // New optional props on TeamTradeCard:
  //   leagueId?: string; htmlId?: string; className?: string;
  //   chainJump?: ChainJumpLookup; onJump?: (tradeId: string) => void;
  ```

- [ ] **Step 1: Update/write tests**

In `__tests__/trade-tracker/TeamTradeCard.test.tsx`:
- Fixtures: `counterparties: ['Bravo']` → `[{ rosterId: 7, name: 'Bravo' }]` (all fixtures).
- The header assertion `screen.getByText(/Trade w\/ Bravo/)` breaks (name is now its own element) — assert `screen.getByText('Bravo')` instead.
- Add new tests:

```tsx
it('links counterparties to their team page when leagueId is given', () => {
  render(
    <TeamTradeCard trade={trade} sourceKeys={new Set()} targetKeys={new Set()} leagueId="league1" />,
  );
  const link = screen.getByRole('link', { name: 'Bravo' });
  expect(link.getAttribute('href')).toBe('/trade-tracker/league/league1/team/7');
});

it('renders plain text counterparty without leagueId or rosterId', () => {
  const anon: TeamTrade = { ...trade, counterparties: [{ rosterId: null, name: 'Ghost' }] };
  render(<TeamTradeCard trade={anon} sourceKeys={new Set()} targetKeys={new Set()} leagueId="league1" />);
  expect(screen.queryByRole('link', { name: 'Ghost' })).toBeNull();
  expect(screen.getByText('Ghost')).toBeTruthy();
});

it('shows an em dash for an empty column', () => {
  const oneSided: TeamTrade = { ...trade, tradedAway: [] };
  render(<TeamTradeCard trade={oneSided} sourceKeys={new Set()} targetKeys={new Set()} />);
  expect(screen.getByText('—')).toBeTruthy();
});

it('renders a jump button for a flipped received pick and fires onJump', () => {
  const onJump = vi.fn();
  render(
    <TeamTradeCard
      trade={trade}
      sourceKeys={new Set(['2024:2:2'])}
      targetKeys={new Set()}
      chainJump={({ assetKey, side }) =>
        side === 'receives' && assetKey === '2024:2:2'
          ? { targetTradeId: 't9', label: 'traded again Mar 2024' }
          : null
      }
      onJump={onJump}
    />,
  );
  const btn = screen.getByRole('button', { name: /traded again Mar 2024/ });
  btn.click();
  expect(onJump).toHaveBeenCalledWith('t9');
});
```

(Import `vi` from vitest.)

- [ ] **Step 2: Run tests to verify new ones fail**

Run: `npx vitest run __tests__/trade-tracker/TeamTradeCard.test.tsx`
Expected: FAIL on the new assertions.

- [ ] **Step 3: Implement — full new `TeamTradeCard.tsx`**

```tsx
import Link from "next/link";
import type { ReceivedAsset } from "@/lib/trade-tracker/resolve";
import { pickKey } from "@/lib/trade-tracker/resolve";
import type { TeamTrade } from "@/lib/trade-tracker/team-view";
import PickOutcomeBadge from "./PickOutcomeBadge";

export interface ChainJump {
  targetTradeId: string;
  label: string;
}

export type ChainJumpLookup = (args: {
  assetKey: string;
  side: "receives" | "tradedAway";
}) => ChainJump | null;

function keyOf(asset: Extract<ReceivedAsset, { kind: "pick" }>): string {
  return pickKey(asset.season, asset.round, asset.originalRoster);
}

function AssetRow({
  asset,
  side,
  sourceKeys,
  targetKeys,
  tradeId,
  chainJump,
  onJump,
}: {
  asset: ReceivedAsset;
  side: "receives" | "tradedAway";
  sourceKeys: Set<string>;
  targetKeys: Set<string>;
  tradeId: string;
  chainJump?: ChainJumpLookup;
  onJump?: (tradeId: string) => void;
}) {
  if (asset.kind === "player") {
    return (
      <li className="leading-tight">
        <div
          className="truncate font-medium text-gray-900 dark:text-slate-100"
          title={asset.playerName}
        >
          {asset.playerName}
        </div>
        {(asset.position || asset.team) && (
          <div className="text-xs text-gray-500 dark:text-slate-400">
            {[asset.position, asset.team].filter(Boolean).join(" · ")}
          </div>
        )}
      </li>
    );
  }

  if (asset.kind === "faab") {
    return (
      <li className="leading-tight">
        <div className="font-medium text-amber-600/80 dark:text-amber-200/60">{asset.label}</div>
      </li>
    );
  }

  const key = keyOf(asset);
  const isSource = side === "receives" && sourceKeys.has(key);
  const isTarget = side === "tradedAway" && targetKeys.has(key);
  const anchor = isSource ? `src:${tradeId}:${key}` : isTarget ? `dst:${tradeId}:${key}` : undefined;
  const jump =
    chainJump && onJump && (isSource || isTarget)
      ? chainJump({ assetKey: key, side })
      : null;

  return (
    <li data-anchor={anchor} className="leading-tight">
      <div className="font-medium text-sky-600 dark:text-sky-300">{asset.label}</div>
      {asset.originalOwnerName && (
        <div
          className="truncate text-xs text-gray-500 dark:text-slate-400"
          title={asset.originalOwnerName}
        >
          ({asset.originalOwnerName})
        </div>
      )}
      <div className="mt-0.5">
        {isSource ? (
          jump && onJump ? (
            <button
              type="button"
              onClick={() => onJump(jump.targetTradeId)}
              className="text-sm text-sky-500 hover:underline dark:text-sky-400/80"
            >
              → {jump.label}
            </button>
          ) : (
            <span className="text-sm text-sky-500 dark:text-sky-400/80">→ traded pick</span>
          )
        ) : (
          <>
            {jump && onJump && (
              <button
                type="button"
                onClick={() => onJump(jump.targetTradeId)}
                className="block text-xs text-sky-500 hover:underline dark:text-sky-400/80"
              >
                ↩ {jump.label}
              </button>
            )}
            <PickOutcomeBadge asset={asset} />
          </>
        )}
      </div>
    </li>
  );
}

function Column({
  title,
  accent,
  assets,
  side,
  sourceKeys,
  targetKeys,
  tradeId,
  chainJump,
  onJump,
}: {
  title: string;
  accent: "away" | "receives";
  assets: ReceivedAsset[];
  side: "receives" | "tradedAway";
  sourceKeys: Set<string>;
  targetKeys: Set<string>;
  tradeId: string;
  chainJump?: ChainJumpLookup;
  onJump?: (tradeId: string) => void;
}) {
  const accentClass =
    accent === "away"
      ? "border-l-rose-300 dark:border-l-rose-400/40"
      : "border-l-emerald-300 dark:border-l-emerald-400/40";
  return (
    <div
      className={`rounded-lg border border-gray-200 border-l-2 bg-gray-50 p-4 dark:border-pitch-700 dark:bg-pitch-900/60 ${accentClass}`}
    >
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">
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
              tradeId={tradeId}
              chainJump={chainJump}
              onJump={onJump}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-400 dark:text-slate-500">—</p>
      )}
    </div>
  );
}

export default function TeamTradeCard({
  trade,
  sourceKeys,
  targetKeys,
  leagueId,
  htmlId,
  className,
  chainJump,
  onJump,
}: {
  trade: TeamTrade;
  sourceKeys: Set<string>;
  targetKeys: Set<string>;
  leagueId?: string;
  htmlId?: string;
  className?: string;
  chainJump?: ChainJumpLookup;
  onJump?: (tradeId: string) => void;
}) {
  const date = new Date(trade.createdAt);
  return (
    <article
      id={htmlId}
      className={`w-full rounded-xl border border-gray-200 bg-white p-5 dark:border-pitch-700 dark:bg-pitch-800/60 ${className ?? ""}`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-semibold text-gray-800 dark:text-slate-200">
          Trade w/{" "}
          {trade.counterparties.length === 0
            ? "Unknown"
            : trade.counterparties.map((c, i) => (
                <span key={`${c.rosterId ?? "x"}-${c.name}`}>
                  {i > 0 && ", "}
                  {leagueId && c.rosterId != null ? (
                    <Link
                      href={`/trade-tracker/league/${leagueId}/team/${c.rosterId}`}
                      className="hover:text-green-600 hover:underline dark:hover:text-green-400"
                    >
                      {c.name}
                    </Link>
                  ) : (
                    c.name
                  )}
                </span>
              ))}
        </span>
        <time
          dateTime={date.toISOString()}
          className="shrink-0 text-xs text-gray-500 dark:text-slate-400"
        >
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
          accent="away"
          assets={trade.tradedAway}
          side="tradedAway"
          sourceKeys={sourceKeys}
          targetKeys={targetKeys}
          tradeId={trade.tradeId}
          chainJump={chainJump}
          onJump={onJump}
        />
        <Column
          title="Receives"
          accent="receives"
          assets={trade.receives}
          side="receives"
          sourceKeys={sourceKeys}
          targetKeys={targetKeys}
          tradeId={trade.tradeId}
          chainJump={chainJump}
          onJump={onJump}
        />
      </div>
    </article>
  );
}
```

Note: the removed `season` line means nothing else in the card references `trade.season` — that's fine, `TeamTrade.season` stays (timeline groups by it).

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run __tests__/trade-tracker/TeamTradeCard.test.tsx && npm run typecheck`
Expected: PASS. (Canvas still compiles — it passes only the original required props.)

- [ ] **Step 5: Commit**

```bash
git add src/components/trade-tracker/TeamTradeCard.tsx __tests__/trade-tracker/TeamTradeCard.test.tsx
git commit -m "feat(trade-tracker): fluid trade card with linked counterparties, accents, jump links"
```

---

### Task 7: TradeTimeline component

Season-grouped, newest-first, responsive card list with chain jump links (smooth-scroll + flash highlight).

**Files:**
- Create: `src/components/trade-tracker/TradeTimeline.tsx`
- Test: `__tests__/trade-tracker/TradeTimeline.test.tsx`

**Interfaces:**
- Consumes: `TeamView` from `@/lib/trade-tracker/team-view`; `chainKeySets` (Task 4); `TeamTradeCard` with `chainJump`/`onJump`/`htmlId` (Task 6).
- Produces: `export default function TradeTimeline({ view, leagueId }: { view: TeamView; leagueId: string })`. Cards carry `id="trade-<tradeId>"`.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/trade-tracker/TradeTimeline.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import TradeTimeline from '@/components/trade-tracker/TradeTimeline';
import type { TeamView, TeamTrade } from '@/lib/trade-tracker/team-view';
import type { ReceivedAsset } from '@/lib/trade-tracker/resolve';

afterEach(cleanup);
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const pick: ReceivedAsset = {
  kind: 'pick', season: '2024', round: 2, originalRoster: 2,
  label: '2024 2nd', originalOwnerName: null, outcome: { status: 'pending' },
};

function trade(id: string, season: string, createdAt: number, extra: Partial<TeamTrade> = {}): TeamTrade {
  return {
    tradeId: id, season, createdAt,
    counterparties: [{ rosterId: 3, name: 'Bravo' }],
    tradedAway: [], receives: [], ...extra,
  };
}

const view: TeamView = {
  leagueName: 'L', teamName: 'T',
  trades: [
    trade('t1', '2023', 1000, { receives: [pick] }),
    trade('t2', '2024', 2000, { tradedAway: [pick] }),
  ],
  chainLinks: [{ assetKey: '2024:2:2', fromTradeId: 't1', toTradeId: 't2' }],
};

describe('TradeTimeline', () => {
  it('groups trades under season headings, newest season first', () => {
    render(<TradeTimeline view={view} leagueId="lg" />);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['2024 season', '2023 season']);
  });

  it('gives each card a stable DOM id', () => {
    const { container } = render(<TradeTimeline view={view} leagueId="lg" />);
    expect(container.querySelector('#trade-t1')).toBeTruthy();
    expect(container.querySelector('#trade-t2')).toBeTruthy();
  });

  it('jump link on a flipped pick scrolls to and flashes the destination card', () => {
    const { container } = render(<TradeTimeline view={view} leagueId="lg" />);
    fireEvent.click(screen.getByRole('button', { name: /traded again/ }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(container.querySelector('#trade-t2')!.className).toContain('ring-2');
  });

  it('links a later-traded-away pick back to where it was acquired', () => {
    render(<TradeTimeline view={view} leagueId="lg" />);
    expect(screen.getByRole('button', { name: /acquired/ })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/trade-tracker/TradeTimeline.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement — full `TradeTimeline.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TeamView } from "@/lib/trade-tracker/team-view";
import TeamTradeCard from "./TeamTradeCard";
import { chainKeySets } from "./chainKeys";

function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

export default function TradeTimeline({
  view,
  leagueId,
}: {
  view: TeamView;
  leagueId: string;
}) {
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const { sourceKeysByTrade, targetKeysByTrade } = useMemo(
    () => chainKeySets(view.chainLinks),
    [view.chainLinks],
  );

  // tradeId:assetKey -> the other end of the chain link, in each direction.
  const { forward, backward } = useMemo(() => {
    const forward = new Map<string, string>();
    const backward = new Map<string, string>();
    for (const l of view.chainLinks) {
      forward.set(`${l.fromTradeId}:${l.assetKey}`, l.toTradeId);
      backward.set(`${l.toTradeId}:${l.assetKey}`, l.fromTradeId);
    }
    return { forward, backward };
  }, [view.chainLinks]);

  const dateByTrade = useMemo(
    () => new Map(view.trades.map((t) => [t.tradeId, t.createdAt])),
    [view.trades],
  );

  const seasons = useMemo(() => {
    const bySeason = new Map<string, typeof view.trades>();
    for (const t of [...view.trades].sort((a, b) => b.createdAt - a.createdAt)) {
      const list = bySeason.get(t.season) ?? [];
      list.push(t);
      bySeason.set(t.season, list);
    }
    return Array.from(bySeason.entries()).sort(
      (a, b) => Number(b[0]) - Number(a[0]),
    );
  }, [view.trades]);

  function jumpTo(tradeId: string) {
    document
      .getElementById(`trade-${tradeId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(tradeId);
    flashTimer.current = setTimeout(() => setFlash(null), 1600);
  }

  return (
    <div className="space-y-8">
      {seasons.map(([season, trades]) => (
        <section key={season} className="space-y-3">
          <h3 className="sticky top-0 z-10 -mx-1 bg-gray-50/95 px-1 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 backdrop-blur dark:bg-pitch-900/95 dark:text-slate-400">
            {season} season
          </h3>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {trades.map((trade) => (
              <TeamTradeCard
                key={trade.tradeId}
                trade={trade}
                htmlId={`trade-${trade.tradeId}`}
                leagueId={leagueId}
                sourceKeys={sourceKeysByTrade.get(trade.tradeId) ?? new Set()}
                targetKeys={targetKeysByTrade.get(trade.tradeId) ?? new Set()}
                className={`transition-shadow ${
                  flash === trade.tradeId
                    ? "ring-2 ring-sky-400 dark:ring-sky-500"
                    : ""
                }`}
                onJump={jumpTo}
                chainJump={({ assetKey, side }) => {
                  const key = `${trade.tradeId}:${assetKey}`;
                  const target =
                    side === "receives" ? forward.get(key) : backward.get(key);
                  if (!target) return null;
                  const when = dateByTrade.get(target);
                  const verb = side === "receives" ? "traded again" : "acquired";
                  return {
                    targetTradeId: target,
                    label: when ? `${verb} ${shortDate(when)}` : verb,
                  };
                }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/trade-tracker/TradeTimeline.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/trade-tracker/TradeTimeline.tsx __tests__/trade-tracker/TradeTimeline.test.tsx
git commit -m "feat(trade-tracker): season-grouped trade timeline with chain jump links"
```

---

### Task 8: SummaryStrip + TeamTradeView toggle + page wiring

The page-level composition: stat strip on top, a Timeline/Flow segmented toggle (timeline default, persisted to localStorage), and the team page renders `TeamTradeView` instead of the canvas directly.

**IMPORTANT:** Load the `dataviz` skill before writing `SummaryStrip` — it governs stat tile design. Apply its guidance within the house palette (dark slate, existing card borders); if it conflicts with the classes sketched below, the skill + house style win.

**Files:**
- Create: `src/components/trade-tracker/SummaryStrip.tsx`
- Create: `src/components/trade-tracker/TeamTradeView.tsx`
- Modify: `src/app/trade-tracker/league/[leagueId]/team/[rosterId]/page.tsx`
- Test: `__tests__/trade-tracker/TeamTradeView.test.tsx`

**Interfaces:**
- Consumes: `summarizeTeamView`/`TeamTradeStats` (Task 3), `TradeTimeline` (Task 7), `TeamTradeCanvas` (Task 9 signature: gains optional `leagueId?: string` prop — pass it now, canvas accepts it in Task 9; to keep this task self-contained, add the prop pass-through only in Task 9 and render `<TeamTradeCanvas view={view} />` here).
- Produces:
  - `SummaryStrip({ stats }: { stats: TeamTradeStats })`
  - `TeamTradeView({ view, leagueId }: { view: TeamView; leagueId: string })` — localStorage key `"trade-tracker:view-mode"`, values `"timeline" | "flow"`.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/trade-tracker/TeamTradeView.test.tsx`:

```tsx
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import TeamTradeView from '@/components/trade-tracker/TeamTradeView';
import type { TeamView } from '@/lib/trade-tracker/team-view';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const view: TeamView = {
  leagueName: 'L', teamName: 'T',
  trades: [{
    tradeId: 't1', season: '2024', createdAt: 1000,
    counterparties: [{ rosterId: 2, name: 'Bravo' }],
    tradedAway: [], receives: [{ kind: 'player', playerName: 'P1', position: 'LB', team: 'SF' }],
  }],
  chainLinks: [],
};

describe('TeamTradeView', () => {
  it('defaults to the timeline and shows the summary strip', () => {
    render(<TeamTradeView view={view} leagueId="lg" />);
    expect(screen.getByRole('heading', { level: 3, name: /2024 season/i })).toBeTruthy();
    expect(screen.getByText('players acquired')).toBeTruthy();
  });

  it('switches to flow view and persists the choice', () => {
    render(<TeamTradeView view={view} leagueId="lg" />);
    fireEvent.click(screen.getByRole('button', { name: /flow/i }));
    // canvas mode: the copy-image button appears, season headings disappear
    expect(screen.getByRole('button', { name: /copy image/i })).toBeTruthy();
    expect(localStorage.getItem('trade-tracker:view-mode')).toBe('flow');
  });

  it('honors a persisted flow preference on mount', () => {
    localStorage.setItem('trade-tracker:view-mode', 'flow');
    render(<TeamTradeView view={view} leagueId="lg" />);
    expect(screen.getByRole('button', { name: /copy image/i })).toBeTruthy();
  });
});
```

(Note: `TeamTradeCanvas` uses `next-themes`' `useTheme` — if rendering it bare in jsdom throws, wrap renders in `<ThemeProvider>` from `next-themes` inside the test, mirroring how other component tests in this repo handle it; check `__tests__/profile/ProfileContext.test.tsx` for precedent. `ResizeObserver` may need a stub: `global.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} }`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/trade-tracker/TeamTradeView.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

**Load the `dataviz` skill now** (see task note), then create `src/components/trade-tracker/SummaryStrip.tsx`:

```tsx
import type { TeamTradeStats } from "@/lib/trade-tracker/summary";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-pitch-700 dark:bg-pitch-800/60">
      <div className="truncate text-lg font-bold tabular-nums text-gray-900 dark:text-slate-100" title={value}>
        {value}
      </div>
      <div className="text-xs text-gray-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

export default function SummaryStrip({ stats }: { stats: TeamTradeStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Stat value={String(stats.tradeCount)} label="trades" />
      <Stat value={String(stats.playersAcquired)} label="players acquired" />
      <Stat
        value={`${stats.picksAcquired} / ${stats.picksFlipped}`}
        label="picks acquired / re-traded"
      />
      <Stat
        value={`${stats.picksDrafted} · ${stats.picksPending}`}
        label="picks drafted · pending"
      />
      {stats.topPartner ? (
        <Stat
          value={stats.topPartner.name}
          label={`top partner (${stats.topPartner.trades} trades)`}
        />
      ) : (
        <Stat value="—" label="top partner" />
      )}
    </div>
  );
}
```

Create `src/components/trade-tracker/TeamTradeView.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { TeamView } from "@/lib/trade-tracker/team-view";
import { summarizeTeamView } from "@/lib/trade-tracker/summary";
import SummaryStrip from "./SummaryStrip";
import TeamTradeCanvas from "./TeamTradeCanvas";
import TradeTimeline from "./TradeTimeline";

const STORAGE_KEY = "trade-tracker:view-mode";
type Mode = "timeline" | "flow";

const MODES: { mode: Mode; label: string }[] = [
  { mode: "timeline", label: "Timeline" },
  { mode: "flow", label: "Pick-chain flow" },
];

export default function TeamTradeView({
  view,
  leagueId,
}: {
  view: TeamView;
  leagueId: string;
}) {
  const [mode, setMode] = useState<Mode>("timeline");
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "flow" || saved === "timeline") setMode(saved);
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  const stats = useMemo(() => summarizeTeamView(view), [view]);

  return (
    <div className="space-y-6">
      <SummaryStrip stats={stats} />

      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 dark:border-pitch-700 dark:bg-pitch-800">
        {MODES.map(({ mode: m, label }) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            aria-pressed={mode === m}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === m
                ? "bg-green-700 text-white"
                : "text-gray-600 hover:text-gray-900 dark:text-slate-300 dark:hover:text-slate-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "timeline" ? (
        <TradeTimeline view={view} leagueId={leagueId} />
      ) : (
        <TeamTradeCanvas view={view} />
      )}
    </div>
  );
}
```

Update `src/app/trade-tracker/league/[leagueId]/team/[rosterId]/page.tsx`:
- Replace the `TeamTradeCanvas` import with `import TeamTradeView from "@/components/trade-tracker/TeamTradeView";`
- Replace `<TeamTradeCanvas view={data} />` with `<TeamTradeView view={data} leagueId={leagueId} />`
- Simplify the subtitle: the strip now shows the trade count, so change the `<p>` under the `<h1>` to just `{data.leagueName}`.

- [ ] **Step 4: Run tests + typecheck + lint**

Run: `npx vitest run __tests__/trade-tracker/ && npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/trade-tracker/SummaryStrip.tsx src/components/trade-tracker/TeamTradeView.tsx src/app/trade-tracker/league/[leagueId]/team/[rosterId]/page.tsx __tests__/trade-tracker/TeamTradeView.test.tsx
git commit -m "feat(trade-tracker): summary strip and timeline/flow view toggle"
```

---

### Task 9: Canvas overhaul (compaction, chain colors + labels, hover highlight, scroll affordances)

Rework `TeamTradeCanvas`:
- Columns shrink 28rem → 24rem, `gap-x-16` → `gap-x-8`, `gap-y-8` → `gap-y-6` (gutter offsets shrink to match: ±12px exit/enter, still inside the 32px column gap).
- Arrows: one color per pick chain (`arrowStyle.ts`), pick label chip at each arrow's midpoint, per-color arrowhead markers.
- Hover a chain card → its whole component stays vivid, everything else dims.
- Track gets edge-fade gradients + "more →" chip when horizontally scrollable, plus drag-to-pan.
- The standalone "Other trades" section moves OUT of the horizontal track into a responsive grid (fixes clipped third column and mobile).
- Canvas keeps `chainKeys.ts` (Task 4) instead of its inline useMemo, and passes `leagueId` through to cards for counterparty links.

No new unit tests — jsdom has no layout engine, so arrow geometry/hover/scroll are covered by the Task 10 browser verification. Existing suite must stay green.

**Files:**
- Modify: `src/components/trade-tracker/TeamTradeCanvas.tsx`
- Modify: `src/components/trade-tracker/TeamTradeView.tsx` (pass `leagueId` to canvas)

**Interfaces:**
- Consumes: `chainKeySets`, `orderedAssetKeys`, `colorForAssetKey`, `labelForAssetKey`, `CHAIN_COLORS` (Task 4); reworked `TeamTradeCard` (Task 6).
- Produces: `TeamTradeCanvas({ view, leagueId }: { view: TeamView; leagueId?: string })`.

- [ ] **Step 1: Implement — full new `TeamTradeCanvas.tsx`**

```tsx
"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { toBlob } from "html-to-image";
import type { TeamView } from "@/lib/trade-tracker/team-view";
import TeamTradeCard from "./TeamTradeCard";
import { computeArrowPath, type GutterRoute } from "./arrowPath";
import {
  CHAIN_COLORS,
  colorForAssetKey,
  labelForAssetKey,
  orderedAssetKeys,
} from "./arrowStyle";
import { chainKeySets } from "./chainKeys";
import { layoutChainComponents, type CellPosition } from "./tradeLayout";

interface Arrow {
  d: string;
  color: string;
  label: string;
  mid: { x: number; y: number };
  component: number;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function TeamTradeCanvas({
  view,
  leagueId,
}: {
  view: TeamView;
  leagueId?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [hoveredComponent, setHoveredComponent] = useState<number | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [copyState, setCopyState] = useState<
    "idle" | "working" | "copied" | "downloaded" | "error"
  >("idle");
  const { resolvedTheme } = useTheme();

  async function handleCopy() {
    const node = contentRef.current;
    if (!node || copyState === "working") return;
    setCopyState("working");
    try {
      const width = node.scrollWidth;
      const height = node.scrollHeight;
      const maxDimension = 4000;
      const pixelRatio = Math.min(2, maxDimension / width, maxDimension / height);
      const captureBackground = resolvedTheme === "light" ? "#f9fafb" : "#0b1120";
      const blob = await toBlob(node, {
        backgroundColor: captureBackground,
        pixelRatio,
        width,
        height,
      });
      if (!blob) throw new Error("capture produced no image");

      const canClipboard =
        typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;
      if (canClipboard) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          setCopyState("copied");
          return;
        } catch {
          // Clipboard blocked/unsupported — fall back to a download.
        }
      }
      downloadBlob(blob, `${view.teamName.replace(/\s+/g, "-")}-trades.png`);
      setCopyState("downloaded");
    } catch {
      setCopyState("error");
    }
  }

  const copyLabel = {
    idle: "Copy image",
    working: "Capturing…",
    copied: "Copied to clipboard ✓",
    downloaded: "Image downloaded ✓",
    error: "Couldn't capture — try again",
  }[copyState];

  const { sourceKeysByTrade, targetKeysByTrade } = useMemo(
    () => chainKeySets(view.chainLinks),
    [view.chainLinks],
  );

  const orderedKeys = useMemo(
    () => orderedAssetKeys(view.chainLinks),
    [view.chainLinks],
  );

  const { chainTrades, standaloneTrades } = useMemo(() => {
    const linked = new Set<string>();
    for (const link of view.chainLinks) {
      linked.add(link.fromTradeId);
      linked.add(link.toTradeId);
    }
    return {
      chainTrades: view.trades.filter((t) => linked.has(t.tradeId)),
      standaloneTrades: view.trades.filter((t) => !linked.has(t.tradeId)),
    };
  }, [view.trades, view.chainLinks]);

  const { components, positionByTrade, componentByTrade } = useMemo(() => {
    const components = layoutChainComponents(chainTrades, view.chainLinks);
    const positionByTrade = new Map<string, CellPosition>();
    const componentByTrade = new Map<string, number>();
    components.forEach((c, ci) => {
      for (const [id, pos] of c.positions) {
        positionByTrade.set(id, pos);
        componentByTrade.set(id, ci);
      }
    });
    return { components, positionByTrade, componentByTrade };
  }, [chainTrades, view.chainLinks]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const recompute = () => {
      const origin = track.getBoundingClientRect();
      const toContentX = (x: number) => x - origin.left + track.scrollLeft;
      const toContentY = (y: number) => y - origin.top + track.scrollTop;
      const next: Arrow[] = [];
      for (const link of view.chainLinks) {
        const src = track.querySelector(
          `[data-anchor="src:${link.fromTradeId}:${link.assetKey}"]`,
        );
        const dst = track.querySelector(
          `[data-anchor="dst:${link.toTradeId}:${link.assetKey}"]`,
        );
        if (!src || !dst) continue;
        const s = src.getBoundingClientRect();
        const d = dst.getBoundingClientRect();
        const from = {
          x: toContentX(s.right),
          y: toContentY(s.top + s.height / 2),
        };
        const to = {
          x: toContentX(d.left),
          y: toContentY(d.top + d.height / 2),
        };

        const fp = positionByTrade.get(link.fromTradeId);
        const tp = positionByTrade.get(link.toTradeId);
        const straight =
          fp && tp && fp.row === tp.row && tp.column === fp.column + 1;

        let route: GutterRoute | undefined;
        if (!straight) {
          const srcCard = track.querySelector(`[data-trade="${link.fromTradeId}"]`);
          const tgtCard = track.querySelector(`[data-trade="${link.toTradeId}"]`);
          if (srcCard && tgtCard) {
            const sc = srcCard.getBoundingClientRect();
            const tc = tgtCard.getBoundingClientRect();
            route = {
              exitX: toContentX(sc.right) + 12,
              enterX: toContentX(tc.left) - 12,
              gutterY: toContentY(tc.top) - 12,
            };
          }
        }

        next.push({
          d: computeArrowPath(from, to, route),
          color: colorForAssetKey(link.assetKey, orderedKeys),
          label: labelForAssetKey(link.assetKey),
          mid: route
            ? { x: (route.exitX + route.enterX) / 2, y: route.gutterY }
            : { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
          component: componentByTrade.get(link.fromTradeId) ?? -1,
        });
      }
      setArrows(next);
      setEdges({
        left: track.scrollLeft > 8,
        right: track.scrollLeft + track.clientWidth < track.scrollWidth - 8,
      });
    };

    recompute();
    const onScroll = () =>
      setEdges({
        left: track.scrollLeft > 8,
        right: track.scrollLeft + track.clientWidth < track.scrollWidth - 8,
      });
    const ro = new ResizeObserver(recompute);
    ro.observe(track);
    track.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      track.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", recompute);
    };
  }, [view, positionByTrade, componentByTrade, orderedKeys]);

  // Drag-to-pan the chain track (ignore clicks on links/buttons).
  function onPointerDown(e: React.PointerEvent) {
    const track = trackRef.current;
    if (!track || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("a,button")) return;
    const startX = e.clientX;
    const startLeft = track.scrollLeft;
    const onMove = (ev: PointerEvent) => {
      track.scrollLeft = startLeft - (ev.clientX - startX);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const dimmed = (ci: number) =>
    hoveredComponent != null && hoveredComponent !== ci;

  return (
    <div className="space-y-4">
      {components.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={copyState === "working"}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-green-600/50 disabled:opacity-60 dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-200 dark:hover:border-green-600/50"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {copyLabel}
          </button>
          <span className="text-xs text-gray-400 dark:text-slate-500">
            Copies the pick-chain flow as an image to paste anywhere.
          </span>
        </div>
      )}

      {components.length > 0 && (
        <div className="relative">
          <div
            ref={trackRef}
            onPointerDown={onPointerDown}
            className="relative cursor-grab overflow-x-auto pb-4 active:cursor-grabbing"
          >
            <div ref={contentRef} className="relative w-max space-y-8">
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                style={{ overflow: "visible" }}
              >
                <defs>
                  {CHAIN_COLORS.map((color, i) => (
                    <marker
                      key={color}
                      id={`trade-arrowhead-${i}`}
                      markerWidth="8"
                      markerHeight="8"
                      refX="6"
                      refY="3"
                      orient="auto"
                    >
                      <path d="M0,0 L6,3 L0,6 Z" fill={color} />
                    </marker>
                  ))}
                </defs>
                {arrows.map((a, i) => (
                  <path
                    key={i}
                    d={a.d}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={hoveredComponent === a.component ? 2.5 : 2}
                    opacity={dimmed(a.component) ? 0.2 : 1}
                    className="transition-opacity"
                    markerEnd={`url(#trade-arrowhead-${CHAIN_COLORS.indexOf(a.color)})`}
                  />
                ))}
              </svg>

              {arrows.map((a, i) => (
                <span
                  key={i}
                  className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border bg-gray-50 px-1.5 text-[10px] font-semibold leading-4 transition-opacity dark:bg-pitch-900 ${
                    dimmed(a.component) ? "opacity-20" : ""
                  }`}
                  style={{
                    left: a.mid.x,
                    top: a.mid.y,
                    color: a.color,
                    borderColor: `${a.color}55`,
                    margin: 0,
                  }}
                >
                  {a.label}
                </span>
              ))}

              <section className="space-y-6">
                {standaloneTrades.length > 0 && (
                  <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">
                    Pick chains
                  </h3>
                )}
                {components.map((component, ci) => (
                  <div
                    key={ci}
                    className="grid w-max items-start gap-x-8 gap-y-6"
                    style={{
                      gridTemplateColumns: `repeat(${component.columnCount}, 24rem)`,
                      gridAutoRows: "min-content",
                    }}
                  >
                    {component.trades.map((trade) => {
                      const cell = component.positions.get(trade.tradeId);
                      return (
                        <div
                          key={trade.tradeId}
                          data-trade={trade.tradeId}
                          onMouseEnter={() => setHoveredComponent(ci)}
                          onMouseLeave={() => setHoveredComponent(null)}
                          className={`transition-opacity ${
                            dimmed(ci) ? "opacity-40" : ""
                          }`}
                          style={{
                            gridColumn: (cell?.column ?? 0) + 1,
                            gridRow: (cell?.row ?? 0) + 1,
                          }}
                        >
                          <TeamTradeCard
                            trade={trade}
                            leagueId={leagueId}
                            sourceKeys={sourceKeysByTrade.get(trade.tradeId) ?? new Set()}
                            targetKeys={targetKeysByTrade.get(trade.tradeId) ?? new Set()}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </section>
            </div>
          </div>

          {edges.right && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex w-20 items-center justify-end bg-gradient-to-l from-gray-50 to-transparent dark:from-pitch-900">
              <span className="mr-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500 shadow-sm dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-400">
                more →
              </span>
            </div>
          )}
          {edges.left && (
            <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-gray-50 to-transparent dark:from-pitch-900" />
          )}
        </div>
      )}

      {standaloneTrades.length > 0 && (
        <section className="space-y-2">
          {components.length > 0 && (
            <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">
              Other trades
            </h3>
          )}
          <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {standaloneTrades.map((trade) => (
              <TeamTradeCard
                key={trade.tradeId}
                trade={trade}
                leagueId={leagueId}
                sourceKeys={new Set()}
                targetKeys={new Set()}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

Implementation notes:
- The arrow-label `<span>`s live inside `contentRef` (so Copy image captures them) but must not affect the `space-y-8` flow — they're `absolute` with `margin: 0` to defeat the `space-y` margin selector.
- `-translate-y-1/2` centers the label on the gutter lane; for straight arrows it sits mid-bezier.
- Check `tailwind.config`/`globals.css` for the exact dark page background token — if the page background is not `gray-50`/`pitch-900`, adjust the gradient/chip/label classes to match.

In `TeamTradeView.tsx`, change the flow branch to `<TeamTradeCanvas view={view} leagueId={leagueId} />`.

- [ ] **Step 2: Full suite + typecheck + lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/trade-tracker/TeamTradeCanvas.tsx src/components/trade-tracker/TeamTradeView.tsx
git commit -m "feat(trade-tracker): compact color-coded flow canvas with hover highlight and scroll affordances"
```

---

### Task 10: End-to-end browser verification + polish pass

Use the `verify` skill mindset: drive the real app, look at the result.

- [ ] **Step 1: Run the app from the branch**

The user runs a dev server on port 3000 from `main`. Run this branch's server on **port 3001**: `PORT=3001 npm run dev` (background). Wait for ready.

- [ ] **Step 2: Walk the flow in the browser (Claude-in-Chrome)**

Visit `http://localhost:3001/trade-tracker/league/1048426134855081984/team/6` (Emotional Hedge, 51 trades — the stress case) and verify, with screenshots:

1. Summary strip renders sane numbers (51 trades; partner name truncates, not overflows).
2. Timeline is the default: season headers 2026→2023, sticky while scrolling; two-column card grid; no horizontal page scroll.
3. Click a "→ traded again …" jump button: page smooth-scrolls and the target card flashes a sky ring. Click its "↩ acquired …" to come back.
4. Counterparty names in card headers navigate to that team's page.
5. Toggle to Pick-chain flow: canvas renders; total content width and height are visibly smaller than the old ~3000×7450 (spot-check `scrollWidth` via JS); arrows have distinct colors with pick-label chips; hovering a chain card dims other components; right-edge fade + "more →" chip appears, disappears at full right scroll; drag-to-pan works; "Other trades" wraps responsively below with no clipping.
6. Empty columns show "—"; column accents visible in both themes (flip the theme toggle, screenshot both).
7. Reload the page — flow choice persisted; switch back to Timeline, reload, persisted.
8. Check a low-trade team (Tig 'Ol Griddies, 7 trades) — no chains edge case: flow view shows only "Other trades" (no copy button if no chains), timeline fine.

Fix anything broken; small visual nits (spacing, label overlap on short arrows) get fixed here and amended into a final polish commit.

- [ ] **Step 3: Full local gate**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all PASS (build needs network for Sleeper only at runtime, not build — per CLAUDE.md standings is force-dynamic).

- [ ] **Step 4: Commit any polish, then finish the branch**

```bash
git add -A && git commit -m "polish(trade-tracker): visual fixes from browser verification"  # only if changes exist
```

Then use superpowers:finishing-a-development-branch (offer PR per the user's PR-granularity preference).

---

## Self-Review Notes

- **Spec coverage:** timeline default + toggle (Tasks 7, 8), canvas compaction (5, 9), hover highlight (9), per-chain colors + labels (4, 9), summary strip (3, 8), scroll affordances (9), polish items — counterparty links (2, 6), trimmed names (1), date-only header (6), "—" placeholder (6), column tints (6), responsive standalone grid / mobile (7, 9). All seven recommendations have tasks.
- **Type consistency:** `Counterparty { rosterId: number | null; name: string }` used in Tasks 2, 3 (tests), 6; `ChainJumpLookup` produced in 6, consumed in 7; `chainKeySets` produced in 4, consumed in 7 and 9; `ordinal` exported in 1, consumed in 4. `TeamTradeCanvas` gains `leagueId` in Task 9 only; Task 8 renders it without the prop (optional, no break).
- **Known risk:** `TeamTradeView` test renders the canvas in jsdom (needs `ResizeObserver` stub and possibly a `next-themes` provider) — noted in Task 8 Step 1.
