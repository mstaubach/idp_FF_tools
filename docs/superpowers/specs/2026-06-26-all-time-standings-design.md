# All-Time Standings — Design

**Date:** 2026-06-26
**Branch:** `feat/all-time-standings`

## Problem

The standings page currently shows only the **current season's** raw roster data —
`roster_id`, wins, losses, ties — pulled live from `/league/{id}/rosters`. It does
not even resolve team names, and it has no concept of league history.

We want the standings page to become a **running tally of the dynasty's entire
existence**: total wins, losses, and championships for each manager, with the
ability to drill down into any individual season. The highlight of the page is the
all-time tally; a per-year champions strip and a per-season standings view sit
alongside it.

## Goals

- Show **all-time** win/loss/tie records and championship counts per manager,
  summed across every season the dynasty has existed.
- Show a **champions-by-year** strip (the trophy case).
- Let the user **drill down** into any single season's final standings via a year
  selector.
- Keep the build network-free (no Sleeper calls at build time).

## Non-Goals (YAGNI)

- Playoff game-by-game records (regular-season W/L only; championships capture
  postseason success).
- Runner-up / podium / playoff-appearance tracking.
- Auth, persistence, or any write operations.
- Sharing/merging the standings Sleeper client with trade-tracker or idp-checker
  (the per-tool clients stay intentionally separate, per `CLAUDE.md`).

## Key Decisions

- **Team identity = Sleeper owner (`user_id`).** `roster_id` and team display names
  change across seasons, but the owner is stable. All-time records are keyed by
  `owner_id` so a manager's history follows them even if they rename their team.
  Managers who have **left** the league are still shown with their historical
  totals; managers in the most recent season are flagged `isCurrentMember`.
- **Win/loss scope = regular season only.** Each season's Sleeper roster record
  (`settings.wins/losses/ties`) is summed. Postseason success is represented by
  championships, tracked separately.
- **Champion = winner of the championship game.** Determined from
  `/league/{id}/winners_bracket`: the `w` (winner roster_id) of the match where
  `p === 1`. Only **completed** seasons produce a champion; an in-progress season
  (no decided final) shows none. The winning `roster_id` is mapped to its
  `owner_id` for that season so the championship is credited to the right manager.

## Architecture

A new, self-contained **`src/lib/standings/`** namespace, mirroring the codebase's
per-tool layering. The two existing Sleeper clients are not touched or shared.

### `src/lib/standings/types.ts`

Sleeper response shapes this tool consumes plus the tool's own output types:

- Sleeper shapes: `League`, `Roster`, `SleeperUser`, `BracketMatch`.
- Output shapes:
  - `ManagerRecord` — `{ ownerId, displayName, wins, losses, ties, championships,
    winPct, isCurrentMember }`. All-time, summed across seasons. `displayName`
    comes from the manager's most recent team name.
  - `SeasonStandings` — `{ season, leagueId, championOwnerId, rows: SeasonRow[] }`
    where `SeasonRow` = `{ ownerId, teamName, wins, losses, ties, rank }`.
  - `LeagueHistory` — `{ allTime: ManagerRecord[]; seasons: SeasonStandings[];
    champions: ChampionEntry[] }` where `ChampionEntry` =
    `{ season, ownerId, teamName }`.

### `src/lib/standings/sleeper.ts`

The network layer. Plain `fetch` with per-call `next: { revalidate }` TTLs (same
strategy as trade-tracker — historical data revalidates slowly, current season
faster). A shared `getJson` helper returns `null` on 404.

- `getLeagueChain(leagueId)` — walk forward to the newest league, then back through
  `previous_league_id`, gathering every season. Mirrors trade-tracker's proven
  `getNewestLeague` + backward-walk approach (re-implemented in this namespace, not
  imported).
- `getRosters(leagueId)`, `getUsers(leagueId)`, `getWinnersBracket(leagueId)` —
  per-season raw fetches.
- TTLs: historical/league data `revalidate: 3600` (1h); current-season rosters
  `revalidate: 300` (5m).

### `src/lib/standings/history.ts`

**Pure aggregation logic — the tested heart of the tool.** No network. Given the
raw per-season data (rosters, users, winners_bracket for each league in the chain),
it builds the `LeagueHistory`:

1. For each season, build `SeasonStandings`: map rosters → rows (resolve `owner_id`
   → team name via users), sort by wins desc (ties broken by losses asc), assign
   `rank`, and determine `championOwnerId` from the bracket.
2. Aggregate across seasons into `ManagerRecord[]` keyed by `owner_id`: sum
   W/L/T, count championships, compute `winPct`, set `displayName` from the most
   recent season's team name, and flag `isCurrentMember` if present in the newest
   season.
3. Build the `champions` list from each completed season's champion.

A thin orchestrator (e.g. `buildLeagueHistory(leagueId)` in `sleeper.ts` or a small
`index.ts`) fetches the chain + per-season data and hands it to the pure builder.

### `src/app/standings/[leagueId]/page.tsx` (server component)

Computes the full `LeagueHistory` server-side and passes it to the UI. Stays
**dynamic** (`export const dynamic`) so the build never makes network calls, but
relies on the client's `revalidate` TTLs to avoid redundant live fetches.

### UI components (`src/app/(components)/` or `src/components/standings/`)

Three stacked pieces, newest-first ordering where applicable:

1. **Champions strip** — compact banner listing each completed season and its
   champion (`2025 — Team Name 🏆`). Server-rendered.
2. **All-time standings table** (the highlight) — sorted by wins. Columns: Manager,
   W, L, T, Championships (e.g. `🏆×2`), Win%. Departed managers listed but subtly
   marked.
3. **Year selector + season table** — a small **client component** holding the
   active-year state. A row of year buttons (plus an "All-time" default) toggles the
   lower table between the all-time view and a selected season's final standings
   (rank, team, W/L/T, champion row highlighted).

The existing `StandingsTable.jsx` (which only renders raw `roster_id`s) is rebuilt /
replaced as part of this work.

## Data Flow

```
leagueId
  → getLeagueChain          (every season's League, newest-first)
  → per season: getRosters + getUsers + getWinnersBracket   (parallel)
  → buildLeagueHistory (pure)
      → SeasonStandings[]  (ranked rows + champion per season)
      → ManagerRecord[]    (all-time totals keyed by owner_id)
      → ChampionEntry[]    (trophy case)
  → page renders: Champions strip + All-time table + Year selector/season table
```

## Error Handling

- `getJson` returns `null` on 404; per-season fetches that fail are **skipped**
  rather than breaking the whole page (a missing bracket → that season simply has no
  champion; a missing roster set → that season is omitted from history).
- If the league itself cannot be resolved (empty chain), the page shows the existing
  "Standings are temporarily unavailable" message.
- The chain walk is guarded against cycles (`seen` set) and runaway loops (iteration
  cap), matching trade-tracker.

## Testing

- `__tests__/standings/lib/history.test.ts` — unit tests for the pure builder
  (mirrors the `src/lib` path per convention). Cases:
  - Summing W/L/T across multiple seasons for one owner.
  - Crediting a championship to the correct owner (roster_id → owner_id mapping).
  - Counting multiple championships for a repeat winner.
  - Departed manager retains historical totals; `isCurrentMember` false.
  - Current manager flagged `isCurrentMember` true.
  - In-progress season (undecided bracket) yields no champion.
  - Tie handling and ranking/sort order.
- The Sleeper client (`sleeper.ts`) is network glue and is not unit-tested,
  consistent with how trade-tracker's client is treated.
- Run `npm test` and `npm run typecheck` locally before pushing (CI does not run
  the test suite).
