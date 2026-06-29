# Taxi Filler

**Date:** 2026-06-29
**Status:** Approved

## Goal

Add a Taxi Filler tool that surfaces waiver-wire players eligible for a league's taxi squad — rookies and players with limited NFL experience — ranked by Sleeper's `search_rank` so dynasty managers can quickly identify stash targets for the upcoming season. Eligibility respects the league's own taxi years setting (`league.settings.taxi_years`), and visible positions are derived from the league's roster configuration.

---

## Routes & Navigation

```
/taxi-filler                   → league ID entry form
/taxi-filler/[leagueId]        → results page (position tabs + player table)
```

**NavBar:** Add "Taxi Filler" to the Tools dropdown alongside Waiver Check and Roster Management.

**File tree:**

```
src/
  app/
    taxi-filler/
      page.tsx                  ← league ID entry form (server component)
      [leagueId]/
        page.tsx                ← results page (server component)
  lib/
    taxi-filler/
      sleeper.ts                ← own Sleeper client (not shared with other tools)
      types.ts                  ← Sleeper response shapes for this tool
      filter.ts                 ← pure logic: eligibility filtering + sorting
  components/
    taxi-filler/
      TaxiFillerTable.tsx       ← position tabs + player table (client component)
```

All code lives in its own namespace and does not share clients or types with other tools.

---

## Data Layer

### Sleeper API Endpoints

| Endpoint | Purpose | Cache |
|---|---|---|
| `GET /league/{leagueId}` | League name, `roster_positions`, `settings.taxi_years` | 5 min (`next: { revalidate: 300 }`) |
| `GET /league/{leagueId}/rosters` | All rostered player IDs — to compute waiver wire | 5 min |
| `GET /players/nfl` | Name, position, team, `years_exp`, `age`, `search_rank` per player | 1h (`unstable_cache`) |

No projection endpoint is needed. `search_rank` lives directly on each player record.

**Caching strategy:** League endpoints use `next: { revalidate: 300 }`, matching the trade-tracker / roster-management pattern. `/players/nfl` uses `unstable_cache` with a 1-hour TTL (same as roster-management). All fetching happens in server components — no API route handlers needed.

### Key Types (`src/lib/taxi-filler/types.ts`)

```ts
type SleeperLeague = {
  name: string;
  roster_positions: string[];
  settings: {
    taxi_years?: number; // how many years of experience qualify for taxi; defaults to 1
  };
};

type SleeperRoster = {
  roster_id: number;
  players: string[] | null;
  taxi: string[] | null;
  reserve: string[] | null;
};

type SleeperPlayer = {
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

// Output shape from buildTaxiCandidates
type TaxiCandidate = {
  playerId: string;
  name: string;
  position: string;
  team: string | null;
  age: number | null;
  yearsExp: number;
  searchRank: number | null;
};
```

### Position Columns

Derived from `league.roster_positions` the same way Roster Management does: filter out slot-only types (`BN`, `FLEX`, `IDP_FLEX`, `REC_FLEX`, `SUPER_FLEX`, `DEF`, `TAXI`, `IR`), deduplicate, preserve league-defined order. These become both the position filter tabs and the eligibility filter for players.

---

## Core Logic (`src/lib/taxi-filler/filter.ts`)

### `buildTaxiCandidates`

```ts
buildTaxiCandidates(
  rosters: SleeperRoster[],
  players: Record<string, SleeperPlayer>,
  leaguePositions: string[],
  taxiYears: number,
): TaxiCandidate[]
```

Steps:
1. Build a `Set<string>` of all rostered player IDs — union of every roster's `players`, `taxi`, and `reserve` arrays (filter out Sleeper's `"0"` sentinel).
2. Filter `players` to those **not** in that set (on the waiver wire).
3. Filter to `years_exp < taxiYears` — eligibility window respects the league's setting. Sleeper's `taxi_years=1` means only season-1 players (`years_exp=0`) qualify; `taxi_years=2` adds season-2 players (`years_exp=1`). Verify exact semantics against the Sleeper API during implementation and adjust if needed.
4. Filter to players whose position (after normalization via the same `POSITION_MAP` as Roster Management — e.g., `DE`/`DT` → `DL`, `CB`/`S` → `DB`) appears in `leaguePositions`.
5. Filter to `active` players only.
6. Sort by `search_rank` ascending; players with `null` rank sort last.
7. Return `TaxiCandidate[]`.

`taxiYears` is `league.settings.taxi_years ?? 1`.

---

## UI

### Entry Page (`/taxi-filler/page.tsx`)

Server component. Same pattern as Roster Management: `h1` "Taxi Filler", short description explaining the tool, labeled text input for Sleeper league ID, server action that redirects to `/taxi-filler/[leagueId]` on valid input. Error state if the ID is invalid.

### Results Page (`/taxi-filler/[leagueId]/page.tsx`)

Server component. Fetches all three data sources in parallel, calls `buildTaxiCandidates`, passes `TaxiCandidate[]` and the derived `leaguePositions` to `<TaxiFillerTable>`.

Header:
- `h1`: league name
- Subtitle: dynamic based on `taxiYears` — "Showing rookies available on waivers" when `taxiYears === 1`, otherwise "Showing rookies + players with up to N years of experience available on waivers"
- Back link: "← Try another league"

Empty state: if no candidates are found, show a message explaining why (e.g., "No eligible players found on the waiver wire for this league's taxi settings").

### TaxiFillerTable (`src/components/taxi-filler/TaxiFillerTable.tsx`)

Client component. Receives `candidates: TaxiCandidate[]` and `positions: string[]`.

**Position tabs:** "All" tab always first, then one tab per distinct position present in the candidate list (in league-defined order). Active tab highlighted with green. Clicking a tab filters the visible rows client-side.

**Player table:**

| Rank | Name | Position | Team | Age | Exp |
|---|---|---|---|---|---|
| 42 | Jalen McMillan | WR | TB | 23 | Rookie |
| 87 | Evan Engram | TE | JAX | 30 | 1 yr |

- **Rank**: `search_rank` value; "—" if null.
- **Exp**: display as "Rookie" for `yearsExp === 0`, "1 yr", "2 yrs", etc. for others.
- **Rookies**: subtle visual distinction — faint green left border on the row — to distinguish from 1-year veterans at a glance.
- Horizontal scroll on mobile via `overflow-x-auto` wrapper.
- Palette: existing green/slate, no new colors.

---

## Error Handling

- Invalid / unknown league ID → "No Sleeper league matched…" message with a back link, same pattern as Roster Management.
- Players with no `search_rank` → sorted to the bottom; Rank column shows "—".
- League with `taxi_years` unset → default to 1 (rookies only).
- Empty candidate list → explicit "No eligible players found" message rather than an empty table.

---

## Future Scope (Not In This Iteration)

- **Third-party dynasty rankings** (KeepTradeCut, FantasyCalc) as an alternative sort column.
- **Per-team view**: show which of these candidates would best fill gaps on a specific team's taxi squad.
- **Interactive labels**: mark candidates as "Target", "Monitor", "Pass" and persist via localStorage.
