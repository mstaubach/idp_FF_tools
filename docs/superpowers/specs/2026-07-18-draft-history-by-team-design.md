# Draft History — By-Team View — Design

**Date:** 2026-07-18
**Status:** Approved

## Purpose

Extend the Draft History tool with a second way to browse: instead of one board
per season, view every rookie-draft pick a single franchise has ever made in
one flat table. A "By Season / By Team" toggle on the existing
`/draft-history/league/[leagueId]` page switches between the two views — all
data is already loaded, so switching is instant. No new route, no new
fetching.

## Scope decisions

- **A team's history = picks the team made.** Every player the franchise
  actually selected, across all rookie drafts — including picks acquired via
  trade, which keep the amber "via Team X" note. Picks the team traded away
  do not appear under them.
- **Franchises are keyed by `roster_id`**, which persists across a Sleeper
  dynasty chain (trade-tracker's `resolve.ts` already relies on this). Team
  names can change season to season, so grouping by display name is not
  reliable.
- **Layout: one flat table** with columns Season · Pick · Player · Pos · Via,
  newest season first, then pick number ascending within a season.
- Rows are plain text, not clickable — the cross-season slot-history modal
  remains a season-board feature.

## Data model — `src/lib/draft-history/board.ts`

### `BoardCell` gains stable identifiers

```
drafterRosterId: number
originalOwnerRosterId: number | null   // null when slot_to_roster_id lacks the slot
```

`buildDraftHistory` already has both roster IDs in hand when building each
cell (`p.roster_id` and `slotToRoster[String(p.draft_slot)]`) — this carries
them through. Existing name fields and the `isTraded` rule are unchanged.

### New helper: `buildTeamDirectory`

```
export interface TeamEntry { rosterId: number; name: string }
export function buildTeamDirectory(inputs: SeasonInput[]): TeamEntry[]
```

- Collects every `roster_id` seen across all seasons' rosters.
- Names each franchise by its **newest season's** name, using the same
  fallback chain as `rosterNames`: `metadata.team_name` → `display_name` →
  `"Roster <roster_id>"`.
- A franchise present only in older seasons (league contraction) still gets
  an entry, named from the newest season it appears in.
- Returned sorted alphabetically by name (for the team selector).

### `slotLabel` moves to `board.ts`

The `slotLabel(round, slot)` helper (formats `2.05`) currently lives private
in `SlotHistoryModal.tsx`. Move it to `board.ts` as an export so both the
modal and the team table format picks identically.

## UI — `src/components/draft-history/DraftBoardView.tsx`

- New prop: `teams: TeamEntry[]`.
- New state: `view: "season" | "team"` (default `"season"`) and `teamIdx`.
- A **By Season / By Team** toggle renders above the existing tab row,
  styled like the season tabs (amber-400 active pill).
- **Season view:** renders exactly as today (tabs, board table, slot-history
  modal).
- **Team view:** the season tabs are replaced by one pill per franchise
  (same style). Below, a flat table: Season · Pick · Player · Pos · Via.
  - Rows derived client-side: flatMap all boards' cells where
    `cell.drafterRosterId === teams[teamIdx].rosterId`, sorted season
    descending, then `pickNo` ascending.
  - Pick column uses `slotLabel` (`2.05`).
  - Pos column shows position plus NFL team (e.g. `LB · NYG`) matching the
    board cells' badge style.
  - Via column shows the amber `via <originalOwnerTeamName>` note when
    `isTraded`, an em-dash otherwise.
  - A team with zero picks shows an empty-state line ("No rookie picks
    yet.").
  - Table lives in an `overflow-x-auto` container; dark slate palette,
    house style.

## Page — `src/app/draft-history/league/[leagueId]/page.tsx`

Compute `teams = buildTeamDirectory(seasonInputs)` alongside
`buildDraftHistory` (inside the existing narrow try block) and pass
`teams={teams}` to `<DraftBoardView>`. No other changes.

## Error handling

No new failure modes: the view is a pure client-side re-projection of data
the page already loads. Existing error cards (league not found, couldn't
load, no rookie drafts) are untouched.

## Testing

Extend `__tests__/draft-history/lib/board.test.ts`:

- Cells carry the correct `drafterRosterId` and `originalOwnerRosterId`;
  `originalOwnerRosterId` is `null` when `slot_to_roster_id` lacks the slot.
- `buildTeamDirectory` names a renamed franchise by its newest-season name.
- `buildTeamDirectory` includes a franchise that only appears in an older
  season.
- Fallback naming (`display_name`, `"Roster <id>"`) applies.
- Result is sorted alphabetically by name.

Extend `__tests__/draft-history/DraftBoardView.test.tsx`:

- Toggling to team view and selecting a team shows exactly that team's picks
  across seasons, including a trade-acquired pick with its via-note.
- Toggling back to season view restores the board table.

CI runs lint + build only, so run `npm test` and `npm run typecheck` locally
before pushing.
