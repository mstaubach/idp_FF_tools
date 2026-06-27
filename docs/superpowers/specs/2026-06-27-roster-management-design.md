# Roster Management: Team Depth Chart

**Date:** 2026-06-27
**Status:** Approved

## Goal

Replace the placeholder Injury Tracker with a Roster Management tool that renders a positional depth chart for any team in a Sleeper IDP dynasty league. The user enters a league ID, picks their team, and sees all roster players organized by position (columns) and roster designation (rows: Starting, Bench, Taxi, IR). Read-only in this iteration; interactive labeling (Stash, Trade Away, Cut) is a noted future scope.

---

## Route Structure & Navigation

**New route:** `/roster-management` (replaces `/injury-tracker`)

```
/roster-management                       → League ID entry form
/roster-management/[leagueId]            → Team picker
/roster-management/[leagueId]/[rosterId] → Depth chart
```

**Navigation changes:**
- Delete `src/app/injury-tracker/` entirely
- Update `src/app/page.tsx` — replace Injury Tracker card with Roster Management (new title, description, href, icon)
- Update `src/app/(components)/NavBar` — swap injury-tracker link for roster-management

**File tree:**

```
src/
  app/
    roster-management/
      page.tsx                        ← league ID entry form
      [leagueId]/
        page.tsx                      ← team picker
        [rosterId]/
          page.tsx                    ← depth chart page
  lib/
    roster-management/
      sleeper.ts                      ← own Sleeper API client (not shared)
      types.ts                        ← Sleeper response shapes for this tool
      depth-chart.ts                  ← pure grid-building logic
  components/
    roster-management/
      DepthChartTable.tsx             ← table UI component
```

All code lives in its own namespace (`lib/roster-management`, `components/roster-management`) and does not share clients or types with idp-checker or trade-tracker.

---

## Data Layer

### Sleeper API Endpoints

| Endpoint | Purpose | Cache TTL |
|---|---|---|
| `GET /league/{leagueId}` | League info + `roster_positions` | 5 min (`next: { revalidate: 300 }`) |
| `GET /league/{leagueId}/rosters` | All rosters — starters, bench, taxi, reserve | 5 min |
| `GET /league/{leagueId}/users` | Owner display names for team picker | 5 min |
| `GET /players/nfl` | Full player DB — maps player IDs → names + positions | 1 hour (`unstable_cache`) |

**Caching strategy:** The three league endpoints use plain `fetch` with `next: { revalidate: 300 }`, matching the trade-tracker pattern. The `/players/nfl` endpoint (~300KB, rarely changes) uses `unstable_cache` with a 1-hour TTL, matching the idp-checker pattern. All fetching happens in server components — no API route handlers needed.

### Key Types (`src/lib/roster-management/types.ts`)

```ts
type SleeperLeague = {
  roster_positions: string[]  // e.g. ["QB","RB","WR","FLEX","BN","TAXI","IDP_FLEX",...]
}

type SleeperRoster = {
  roster_id: number
  owner_id: string
  starters: string[]   // player IDs in starting slots
  players: string[]    // all player IDs on roster (includes starters)
  taxi: string[] | null
  reserve: string[] | null
}

type SleeperPlayer = {
  player_id: string
  first_name: string
  last_name: string
  position: string   // "QB", "RB", "WR", "TE", "K", "DL", "LB", "DB", etc.
  team: string | null
}

type SleeperUser = {
  user_id: string
  display_name: string
}
```

### Position Columns

Derived from `league.roster_positions`: filter down to base player positions only (QB, RB, WR, TE, K, DL, LB, DB, etc.), deduplicate, and preserve the league-defined order. Slot-only types (`BN`, `FLEX`, `IDP_FLEX`, `DEF`, `TAXI`) are excluded — columns represent player positions, not slot types. K is kept as a column since it is a real player position.

---

## Depth Chart Logic (`src/lib/roster-management/depth-chart.ts`)

### Core Function

```ts
buildDepthChart(
  roster: SleeperRoster,
  players: Record<string, SleeperPlayer>,
  leaguePositions: string[]
): DepthChartGrid
```

### Roster Designations

| Label | Source |
|---|---|
| Starting | Player ID appears in `roster.starters[]` |
| Bench | In `roster.players[]`, not in starters, taxi, or reserve |
| Taxi | In `roster.taxi[]` |
| IR | In `roster.reserve[]` |

Sections with no players are omitted from the output.

### Grid Shape

For each designation × position intersection, collect the matching players. The number of rows in a designation group equals the maximum player count at any single position within that group. Cells with no player at that rank are `null`.

Example: If Starting has 3 RBs and 2 QBs, the Starting section has 3 rows — the third row has a null QB cell.

### Player Display Name

Show last name only. If two players on the same roster share a last name, prefix both with their first initial (`T. Williams`, `G. Williams`). This disambiguation is computed once when building the grid.

### Output Shape

```ts
type DepthChartGrid = {
  positions: string[]           // column headers in league order
  sections: DepthChartSection[]
}

type DepthChartSection = {
  label: "Starting" | "Bench" | "Taxi" | "IR"
  rows: (string | null)[][]    // [rowIndex][positionIndex] → display name or null
}
```

---

## UI Components

### Entry Page (`/roster-management/page.tsx`)

Server component. Identical pattern to trade-tracker's entry form: labeled text input for league ID, server action that redirects to `/roster-management/[leagueId]` on valid input. Matches existing `h1` + description + input + button layout.

### Team Picker (`/roster-management/[leagueId]/page.tsx`)

Server component. Fetches rosters and users, joins by `owner_id`, renders a list of clickable team cards showing owner display name. Each card links to `/roster-management/[leagueId]/[rosterId]`. Uses existing card styling (rounded border, hover state).

### Depth Chart Page (`/roster-management/[leagueId]/[rosterId]/page.tsx`)

Server component. Fetches all four data sources, calls `buildDepthChart()`, passes the `DepthChartGrid` to `<DepthChartTable>`. Displays the team owner's display name as the page `h1`.

### DepthChartTable (`src/components/roster-management/DepthChartTable.tsx`)

Client component (`"use client"`) for horizontal scroll handling on mobile. Renders the grid as an HTML `<table>`:

- **Header row:** position columns with green header styling
- **Row label column:** bold designation label (Starting, Bench, Taxi, IR) — repeats on every row within its group
- **Section gaps:** visible separator between designation groups (Starting → Bench → Taxi → IR)
- **Cells:** plain text (player last name) or empty — no color coding
- **Horizontal scroll** on mobile via `overflow-x-auto` wrapper

Palette: existing dark slate + green accent. No new colors introduced.

---

## Future Scope (Not In This Iteration)

- **Interactive labeling:** Allow users to drag or assign players to custom rows (Stash, Trade Away, Cut) with color coding (yellow = Stash, red = Trade Away/Cut, blue = PUP)
- **Persistence:** LocalStorage or backend to save custom labels between sessions
- **Injury status overlay:** Color cells by NFL injury designation (questionable = yellow, out = red) from Sleeper player data
