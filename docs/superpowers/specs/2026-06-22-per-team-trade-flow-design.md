# Per-Team Trade Flow Canvas — Design

**Date:** 2026-06-22
**Status:** Approved (pending spec review)
**Branch:** `feature/trade-tracker-enhancements`

## Summary

Re-orient the Trade Tracker from a league-wide flat list of trades into a
**per-team** view. For a selected team, render that team's trades as
"Trade w/ X" cards on a horizontal, time-ordered canvas, and draw arrows that
trace a single draft pick across two of the team's trades — the pick the team
*received* in an earlier trade and later *traded away* in a subsequent one.

This replaces the current league-wide trade list (per-trade Sankey cards) as the
primary view.

## Motivation

The current view answers "what trades happened in this league?" The new view
answers "what did *this team* do, and how did the assets they acquired move on?"
Because a team can only trade a pick away *after* acquiring it, an asset's
journey through a single franchise is a directed, forward-in-time chain — which
maps naturally onto a left-to-right flow chart.

## Reference sketch

```
User Name
─────────────────────────────────────────────────────────────
 ┌─ Trade w/ UserName1 ─┐            ┌─ Trade w/ UserName2 ─┐
 │ Traded Away | Receives│           │ Traded Away | Receives│
 │ Player1     | 2nd Rd ─┼──────────▶│ 2nd Rd      | Player3 │
 │             | 4th Rd  │           └───────────────────────┘
 │             | (drafted Player2)   (time →, arrows go forward)
 └───────────────────────┘
```

The 2nd-round pick received in the trade with UserName1 is the same pick traded
away in the trade with UserName2 — shown by the arrow. The 4th-round pick was
kept and used to draft Player2 — shown as a terminal outcome, no arrow.

## Scope decisions (locked)

- **Entry model:** Team picker → per-team page. The league page becomes a list
  of teams; each links to its own per-team page.
- **Chainable assets:** Draft picks only. Players received-then-traded render
  normally but get no arrow. (Picks have stable identity; player chaining is
  rarer and deferred.)
- **Layout fidelity:** Connected flow canvas with real drawn SVG arrows (not
  badges or a timeline reframe).
- **Arrangement:** Single oldest→newest horizontal track, horizontal scroll on
  overflow, static (no drag/pan/zoom). Arrows always point rightward.

Out of scope for this iteration: player asset chaining, draggable/pannable
canvas, zoom, persisted layout, multi-pick lineage summaries.

## Architecture

### Routing

| Route | Before | After |
| --- | --- | --- |
| `/trade-tracker/league/[leagueId]` | Flat list of all league trades | **Team picker**: list of rosters (team name, owner, trade count) linking to each team page |
| `/trade-tracker/league/[leagueId]/team/[rosterId]` | — (new) | **Per-team canvas** (the sketch) |

### Data layer — `src/lib/trade-tracker/team-view.ts` (new)

Built on top of the existing `buildLeagueTrades(leagueId)` output. No new
Sleeper fetching or pick-resolution logic — it reuses `TradeView.flows`, which
already carry `fromRosterId` / `toRosterId` per asset and resolved pick
identity/outcome.

Exposed functions:

- `listLeagueTeams(leagueId): Promise<LeagueTeams | null>`
  Returns `{ leagueName, teams: TeamSummary[] }` where
  `TeamSummary = { rosterId, teamName, ownerName, tradeCount }`. Drives the
  picker. `null` when the league is not found (mirrors `buildLeagueTrades`).

- `buildTeamView(leagueId, rosterId): Promise<TeamView | null>`
  Returns the focal team's data, or `null` if the league/roster is not found.

```ts
interface TeamTrade {
  tradeId: string;
  season: string;
  createdAt: number;
  counterparties: string[];   // other teams in this trade (from flows touching focal roster)
  tradedAway: ReceivedAsset[]; // flows OUT of focal roster
  receives: ReceivedAsset[];   // flows INTO focal roster
}

// Links a received pick in one trade to where the team traded it away later.
interface PickChainLink {
  assetKey: string;   // `${season}:${round}:${originalRoster}` (existing pick identity)
  fromTradeId: string; // trade where the team RECEIVED the pick (source anchor)
  toTradeId: string;   // later trade where the team TRADED IT AWAY (target anchor)
}

interface TeamView {
  leagueName: string;
  teamName: string;
  trades: TeamTrade[];        // chronological, oldest → newest
  chainLinks: PickChainLink[];
}
```

Derivation:

1. From `buildLeagueTrades`, take every `TradeView` whose `flows` include the
   focal `rosterId` as `fromRosterId` or `toRosterId`.
2. For each, split that team's flows into `receives` (focal is `toRosterId`)
   and `tradedAway` (focal is `fromRosterId`); collect `counterparties` from the
   opposite endpoints of those flows.
3. Sort trades by `createdAt` ascending.
4. Build `chainLinks`: index the team's *traded-away* pick assets by
   `assetKey`. For each *received* pick asset, if a traded-away pick with the
   same key exists in a strictly later trade, emit a `PickChainLink`. (A pick is
   identified by season+round+original owner; the focal team is the holder in
   between, so a received-then-given pair is unambiguous.)
5. A received pick with no matching later trade-away keeps its terminal outcome
   (`drafted` / `pending` / `unknown`) for badge rendering.

`assetKey` is exposed as a small helper shared with `resolve.ts` so the index
and the picks agree on identity. (Add an exported `pickKey(season, round,
originalRoster)` to `resolve.ts` or a shared module; both sites use it.)

### Components

- **Team picker** (`src/app/trade-tracker/league/[leagueId]/page.tsx`, rewritten)
  Server component. Renders `listLeagueTeams` results as a list/grid of links.
  Empty/error states reuse the existing `Message` component pattern.

- **`TeamTradeCanvas`** (`src/components/trade-tracker/TeamTradeCanvas.tsx`, new,
  client component) — the core.
  - Lays out `trades` left→right in a single horizontal track; the track is the
    scroll/overflow container.
  - Renders an absolutely-positioned SVG overlay sized to the track's full
    scroll dimensions.
  - Each chainable pick row carries a stable `data-anchor` attribute derived
    from `assetKey` plus a role (`source` on the Receives row, `target` on the
    Traded Away row). For each `PickChainLink`, after layout a `useLayoutEffect`
    measures the source and target anchor rects relative to the track and draws
    a curved path from the right edge of the source row to the left edge of the
    target row.
  - Recompute arrow geometry on: initial layout, `ResizeObserver` firing on the
    track, and window resize. Arrows are purely presentational and
    `pointer-events: none`.
  - Degrades safely: if an anchor can't be measured, that link is skipped rather
    than throwing.

- **`TeamTradeCard`** (`src/components/trade-tracker/TeamTradeCard.tsx`, new)
  Two-column **Traded Away | Receives** card with a "Trade w/ {counterparties}"
  header and season/date. Reuses existing row styling. Pick rows:
  - Received pick **not** re-traded → terminal `PickOutcomeBadge` (reuse from
    the deleted `TradeCard`, lifted into this component or a small shared
    `PickOutcomeBadge.tsx`).
  - Received pick that **was** re-traded → a subtle "→ traded on" marker at the
    anchor instead of an outcome badge (the outcome lives downstream).
  - Player rows render name + position/team, no badge, no anchor.

### Removals

`TradeCard.tsx`, `TradeSankey.tsx`, and `src/lib/trade-tracker/sankey.ts` become
unused once the league page is rewritten (verified: their only consumers are
each other and the league page). Delete all three. The `PickOutcomeBadge` logic
currently inside `TradeCard.tsx` is preserved by moving it into the new
component(s). `TradeFlow` / `TradeView` / `ReceivedAsset` types stay in
`resolve.ts` (still used by the data layer).

## Data flow

```
buildLeagueTrades(leagueId)            [existing — Sleeper fetch + resolve]
        │  TradeView[] (sides, flows)
        ▼
team-view.ts
  ├─ listLeagueTeams ─────────────▶ Team picker page (server)
  └─ buildTeamView(rosterId) ─────▶ Per-team page (server)
                                         │ TeamView
                                         ▼
                                   TeamTradeCanvas (client)
                                     ├─ TeamTradeCard ×N  (track, left→right)
                                     └─ SVG arrow overlay  (chainLinks)
```

## Edge cases

- **Team's own originated pick traded away:** a traded-away pick whose source is
  the team itself has no incoming `receives`, so no source anchor and no arrow —
  correct.
- **Multi-team (3+) trades:** the focal team's `receives`/`tradedAway` are still
  well-defined from flows; `counterparties` may list 2+ names ("Trade w/ X, Y").
- **Pick received and never moved:** terminal outcome badge, no arrow.
- **Pick received, draft already happened, slot unmatched:** `unknown` badge
  (existing behavior; unaffected by the recent slot_to_roster_id fix).
- **Team with zero trades:** picker shows trade count 0; team page renders an
  empty state.
- **Long histories (many trades):** horizontal scroll; no pagination in v1.
- **Same pick appearing as received then traded in adjacent trades:** ordering
  by `createdAt` keeps source strictly left of target; ties broken by stable
  sort (insertion order from `buildLeagueTrades`, already newest-first reversed).

## Testing

TDD on the data layer (`__tests__/trade-tracker/team-view.test.ts`), mocking the
Sleeper client as in the existing `resolve.test.ts`:

- Per-team derivation: receives vs. tradedAway split for the focal roster.
- Chronological ordering of `trades`.
- `chainLinks`: a pick received in trade A and traded away in later trade B
  produces exactly one link A→B.
- Terminal fallback: a received pick never re-traded yields no link and keeps
  its outcome.
- Originated pick traded away: no incoming link.
- Multi-team trade: counterparties and per-side assets resolved correctly.
- `listLeagueTeams`: trade counts per roster, `null` on missing league.

The `TeamTradeCanvas` SVG/measurement layer is kept thin and verified manually
against a live league (e.g. `1048426134855081984`); the testable logic lives in
`team-view.ts`.

## Verification

- `npm test` (new + existing suites green), `npm run typecheck`, `npm run lint`.
- Manual: load a real league, pick a team with a known received-then-traded
  pick, confirm the arrow connects the correct two cards and terminal picks show
  the right badge.
