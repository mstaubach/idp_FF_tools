# Draft History — Design

**Date:** 2026-07-16
**Status:** Approved

## Purpose

A new tool under the "League History" nav dropdown that shows which teams drafted
which players at each draft slot, across every rookie draft in a Sleeper dynasty
league's history. The main view is a per-season draft board; clicking any slot
(e.g., 2.05) shows that pick's history across all seasons.

## Scope decisions

- **Rookie drafts only.** The oldest season in the dynasty chain is treated as
  the startup season and excluded from the boards.
- **Slot history is keyed by round + slot** (e.g., 2.05), not by slot column.
- **Traded picks** show the team that actually made the pick plus a
  "via Team X" note when the slot originally belonged to another franchise.
- Follows the repo's per-tool namespace convention: this tool gets its own
  Sleeper client, types, lib, and components. Nothing is shared with
  trade-tracker or idp-checker.

## Architecture

### Data layer — `src/lib/draft-history/`

**`types.ts`** — only the Sleeper API shapes this tool consumes:

- `League` — `league_id`, `name`, `season`, `previous_league_id`, `draft_id`,
  `total_rosters`
- `SleeperUser` — `user_id`, `display_name`, `metadata.team_name`
- `Roster` — `roster_id`, `owner_id`
- `Draft` — `draft_id`, `season`, `league_id`, `status`,
  `slot_to_roster_id` (slot → roster_id of the franchise that owns that slot),
  `settings.rounds`
- `DraftPickResult` — `round`, `pick_no`, `draft_slot`, `player_id`,
  `roster_id`, `metadata` (`first_name`, `last_name`, `position`, `team`)

**`sleeper.ts`** — independent client in the trade-tracker caching style:
plain `fetch` with `next: { revalidate }` per-call TTLs and a `getJson` helper
that returns `null` on 404 and throws on other failures.

- `getLeague(leagueId)` — 1h TTL, validates the ID first
- `getUserLeagues(userId, season)` — 1h TTL, used to walk the chain forward
- `getLeagueChain(leagueId)` — walk forward to the newest league (Sleeper has
  no successor pointer, so check each member's next-season leagues for one
  whose `previous_league_id` points back), then walk backward via
  `previous_league_id`. Returns newest first.
- `getUsers(leagueId)`, `getRosters(leagueId)` — 1h TTL
- `getDrafts(leagueId)` — 1h TTL (list endpoint; omits `slot_to_roster_id`)
- `getDraft(draftId)` — 1h TTL (single-draft endpoint; includes
  `slot_to_roster_id`)
- `getDraftPicks(draftId)` — 30m TTL

No `/players/nfl` fetch: pick `metadata` already carries player name, position,
and NFL team, so this tool never touches the 16MB players blob.

### Board model — `src/lib/draft-history/board.ts` (pure logic, unit-tested)

```
buildDraftHistory(input: SeasonInput[]): SeasonBoard[]
```

`SeasonInput` bundles one season's `league`, `draft` (detail, with
`slot_to_roster_id`), `picks`, `users`, and `rosters`. The startup exclusion
rule lives in `board.ts` as an exported `rookieLeagues(chain)` helper that
drops the oldest season; the page calls it before fetching per-season data.
`buildDraftHistory` itself just transforms what it's given.

Each `SeasonBoard`:

```
{
  season: string
  rounds: number            // from draft settings, fallback to max round seen
  slots: number             // from total_rosters, falling back to slot_to_roster_id size
  slotOwners: string[]      // team name owning each slot column this season
  cells: BoardCell[]
}
```

Each `BoardCell`:

```
{
  round: number
  slot: number
  pickNo: number
  playerName: string        // "first last" from pick metadata
  position: string | null
  nflTeam: string | null
  drafterTeamName: string   // roster that made the pick
  originalOwnerTeamName: string  // from slot_to_roster_id
  isTraded: boolean         // drafting roster !== slot's original roster
}
```

Team-name resolution: roster_id → `Roster.owner_id` → user's
`metadata.team_name`, falling back to `display_name`, falling back to
`"Team <roster_id>"` for orphaned rosters.

Seasons whose draft has zero picks produce no `SeasonBoard` (no tab renders).
Cross-season slot history is derived client-side by filtering all boards'
cells for a given round + slot — no separate server data structure.

### Routes — `src/app/draft-history/`

- **`page.tsx`** — landing page mirroring trade-tracker's: if the
  active-league cookie (`ACTIVE_LEAGUE_COOKIE` from `@/lib/profile/active-league`)
  holds a valid ID and no `?picker=1`, redirect to
  `/draft-history/league/<id>`. Otherwise render intro copy + league-ID form
  (server action extracts the first 6+ digit run, so pasted Sleeper URLs work;
  invalid input redirects back with `?error=1&picker=1`).
- **`league/[leagueId]/page.tsx`** — server component, `export const
  revalidate = 300`. Flow: `getLeagueChain` → drop the oldest season → for each
  remaining season fetch draft detail, picks, users, rosters (parallel per
  season) → `buildDraftHistory` → render `<DraftBoardView>`.
- **`league/[leagueId]/loading.tsx`** — skeleton, matching trade-tracker's
  pattern.

### UI — `src/components/draft-history/`

- **`DraftBoardView.tsx`** (client) — season tabs, newest selected by default.
  Board is a table: rows = rounds, columns = slots. Column headers show slot
  number + the team owning that slot this season. Cells show player name,
  position badge, NFL team, and a small "via Team X" note when `isTraded`.
  The table lives in an `overflow-x-auto` container for mobile. Dark slate
  palette, Tailwind, house style.
- **`SlotHistoryModal.tsx`** (client) — opens on cell click. Title
  "Pick 2.05 through the years"; one row per season showing player
  (position/NFL team), drafting team, and via-note. Closes on backdrop click
  or Escape.
- **`Message.tsx`** — namespaced copy of trade-tracker's error card.

### Navigation

Add `{ href: "/draft-history", label: "Draft History" }` to the
"League History" dropdown in `src/app/(components)/NavBar.jsx`.

## Error handling

- Invalid or unknown league ID → "League not found" card with the ID echoed.
- Sleeper request failure → "Couldn't load this league" card.
- Chain contains only one season → "No rookie drafts yet — this league is
  still in its startup season."
- A season whose draft exists but has no picks yet → silently omitted from
  tabs (covered by the zero-picks rule above).

## Testing

Vitest unit tests at `__tests__/draft-history/lib/board.test.ts`:

- Startup-season exclusion produces boards only for later seasons.
- Traded pick: drafting roster differs from `slot_to_roster_id` origin →
  `isTraded: true` and correct `originalOwnerTeamName`.
- Non-traded pick → `isTraded: false`.
- Team-name fallback chain: `metadata.team_name` → `display_name` →
  `"Team <roster_id>"`.
- Draft with zero picks yields no `SeasonBoard`.
- Slot-owner column mapping from `slot_to_roster_id`.

CI runs lint + build only, so run `npm test` and `npm run typecheck` locally
before pushing.
