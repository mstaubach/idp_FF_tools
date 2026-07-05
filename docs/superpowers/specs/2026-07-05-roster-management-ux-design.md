# Roster Management: Slot Counts, Position Correction, Full Names

**Date:** 2026-07-05
**Status:** Approved (defaults chosen by assistant judgment after no user response to design questions within session — see Open Decisions below)

## Goal

Three UX improvements to the existing depth chart tool (`/roster-management/[leagueId]/[rosterId]`), requested together:

1. Show used/total counts for Starting, Bench, Taxi, and IR (e.g. `Taxi 6/8`).
2. Let the user drag a player between position columns to fix cases where Sleeper's granular position (e.g. a player eligible at both `LB` and `DL`) puts them in the "wrong" column for how this league actually uses them.
3. Show full player names instead of last-name-only.

This is a read-only tool with no backend — corrections in (2) are a client-side display override, not a write back to Sleeper.

## Open Decisions Made By Assistant

The user did not respond to two clarifying questions before this spec was written (persistence model, DnD library choice). The defaults below were chosen as the lower-risk, more conventional option and should be treated as **provisional** until the user reviews this spec:

- **Persistence:** corrections persist in `localStorage`, scoped per `leagueId:rosterId`. Alternative: session-only (in-memory), discussed but not chosen.
- **DnD library:** `@dnd-kit/core` (new dependency). Alternative: native HTML5 drag-and-drop (zero-dependency, less polished), discussed but not chosen.

---

## 1. Slot Usage Counts

### Data

`SleeperLeague` gains the `settings` fields Sleeper already returns (no new fetch needed — `getLeague` already pulls the full league object, just needs typing):

```ts
type SleeperLeague = {
  name: string;
  roster_positions: string[];
  settings: {
    taxi_slots?: number;
    reserve_slots?: number;
  };
};
```

### New file: `src/lib/roster-management/roster-counts.ts`

```ts
type SlotCount = { used: number; total: number };

type RosterCounts = {
  starting: SlotCount;
  bench: SlotCount;
  taxi: SlotCount;
  ir: SlotCount;
};

function computeRosterCounts(
  roster: SleeperRoster,
  rosterPositions: string[],
  settings: SleeperLeague["settings"],
): RosterCounts
```

Math:

| Section | `used` | `total` |
|---|---|---|
| Starting | non-empty (`!== "0"`) entries in `roster.starters` | `roster.starters.length` |
| Bench | players in `roster.players` not in starters/taxi/reserve (same set `buildDepthChart` already derives), excluding unknown/`"0"` ids | count of `"BN"` entries in `roster_positions` |
| Taxi | valid entries in `roster.taxi` | `settings.taxi_slots ?? 0` |
| IR | valid entries in `roster.reserve` | `settings.reserve_slots ?? 0` |

If a section's `total` is 0 (league doesn't use taxi/IR), the UI hides that badge — consistent with how the existing table already omits empty sections.

### UI: `RosterCountsSummary`

New presentational component (`src/components/roster-management/RosterCountsSummary.tsx`), no interactivity required. Renders one badge per non-zero-total section, e.g.:

```
Starting 9/9    Bench 6/8    Taxi 3/4    IR 1/2
```

Rendered above `DepthChartTable` on the depth chart page.

---

## 2. Drag-and-Drop Position Correction

### Data

`SleeperPlayer` gains `fantasy_positions`:

```ts
type SleeperPlayer = {
  player_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  fantasy_positions: string[] | null;
};
```

`sleeper.ts`'s `_fetchPlayersRaw` slims this field through the same way it already does for `first_name`/`last_name`/`position`.

### Grid cell shape change

Cells in `DepthChartSection.rows` change from `string | null` to `DepthChartCell | null`:

```ts
type DepthChartCell = {
  playerId: string;
  displayName: string;
  eligiblePositions: string[]; // normalized columns this player could sit in
};
```

`eligiblePositions` = each entry of `player.fantasy_positions` run through `normalizePosition`, deduplicated, filtered to the league's derived `positions` list. Falls back to `[normalizePosition(player.position)]` if `fantasy_positions` is empty/missing. A cell is draggable only when `eligiblePositions.length > 1`.

### Overrides

`buildDepthChart` gains a 4th, optional parameter:

```ts
buildDepthChart(
  roster: SleeperRoster,
  players: Record<string, SleeperPlayer>,
  positions: string[],
  overrides?: Record<string, string>, // playerId -> chosen column
): DepthChartGrid
```

When grouping a player into a column, `buildSection` uses `overrides[playerId]` instead of the default (`normalizePosition(player.position)`) **only if** that override value is in both `positions` and the player's `eligiblePositions` — otherwise it falls back to the default. Because columns are already rebuilt from scratch on every call, "moving" a player between columns is just changing which column key their id is grouped under; no special-case row/rank logic is needed — the existing max-rows/padding logic handles the resulting shape.

This keeps `buildDepthChart` pure and fully unit-testable; no DOM or DnD library concerns leak into `depth-chart.ts`.

### Component changes

`DepthChartTable.tsx` becomes a client component (`"use client"`) using `@dnd-kit/core`:

- Wraps the table in `DndContext` with `PointerSensor` + `TouchSensor` (small activation distance to avoid hijacking taps/navigation).
- Draggable cells: rendered as a chip with a drag affordance (cursor + subtle grip styling) only when `eligiblePositions.length > 1`. Non-draggable cells render as today (plain text).
- Droppable targets: every cell position within the **same section** whose column is in the dragged player's `eligiblePositions`. Dropping outside a valid target, or onto a different section, is a no-op (dnd-kit snaps back). This only corrects the position column — it never moves a player between Starting/Bench/Taxi/IR, since that reflects real roster state this tool can't write back to Sleeper.
- On a valid drop: update local `overrides` state, persist to `localStorage["roster-mgmt:overrides:{leagueId}:{rosterId}"]`, recompute the grid via `buildDepthChart(roster, players, positions, overrides)`.
- `localStorage` is read in a `useEffect` (not the `useState` initializer) to avoid SSR/hydration mismatches, and all reads/writes are wrapped in `try/catch` (private-browsing storage can throw).
- A small "Reset corrections" control appears when `overrides` is non-empty; clears both state and the `localStorage` entry.

### Page wiring

`src/app/roster-management/[leagueId]/[rosterId]/page.tsx` slims the full ~10k-entry player map down to just this roster's players (`roster.players ∪ taxi ∪ reserve`) before passing it to the client component, keeping the client payload small (a couple dozen entries, not the whole league DB).

### New dependency

`@dnd-kit/core` added to `package.json` dependencies.

---

## 3. Full Player Names

`buildDisplayNames` in `depth-chart.ts` is simplified: every player renders as `"${first_name} ${last_name}".trim()`. The existing last-name-only + duplicate-last-name first-initial abbreviation logic is removed entirely — full names naturally disambiguate common surnames, so the special-casing is no longer needed.

---

## Testing

- `__tests__/roster-management/lib/depth-chart.test.ts`: update all existing assertions for the new `DepthChartCell` shape; add cases for:
  - `eligiblePositions` derivation from `fantasy_positions` (including the fallback-to-`position` case).
  - `overrides` moving a player to a valid alternate column.
  - `overrides` being ignored when the target isn't in the player's `eligiblePositions` or the league's `positions`.
  - Full-name rendering (replacing the old ambiguous-last-name test).
- New `__tests__/roster-management/lib/roster-counts.test.ts`: used/total math for all four sections, including the zero-total (taxi/IR disabled) case.
- The DnD interaction itself is not unit-tested — consistent with this repo's lib-only test coverage convention (component/interaction testing for drag-and-drop is heavy relative to the value here). Verified manually via `npm run dev` in-browser instead.

## Delivery

One branch off `main`, three commits (counts, drag-and-drop correction, full names), one PR. `npm run lint`, `npm run typecheck`, and `npm test` all green before pushing; `npm audit` run before opening the PR (per standing project convention).

## Future Scope (Not In This Iteration)

- Syncing corrections across devices/browsers (would require a backend; out of scope for this no-database tool).
- Extending drag-and-drop to reassign Starting/Bench/Taxi/IR status itself (would require write access to Sleeper, which this tool intentionally doesn't have).
