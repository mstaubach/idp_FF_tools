import {
  getDraft,
  getDraftPicks,
  getDrafts,
  getLeagueChain,
  getPlayers,
  getRosters,
  getTransactions,
  getUsers,
} from "./sleeper";
import type {
  Draft,
  DraftPickResult,
  League,
  SleeperPlayer,
  TradedDraftPick,
  Transaction,
} from "./types";

export interface DraftedPlayer {
  status: "drafted";
  playerName: string;
  position: string | null;
  team: string | null;
  round: number;
  pickNo: number;
}

export interface PendingPick {
  // The draft for this pick's season has not happened (or isn't started) yet.
  status: "pending";
}

export interface UnknownPick {
  // We have the draft but couldn't match this slot to a selection.
  status: "unknown";
}

export type PickOutcome = DraftedPlayer | PendingPick | UnknownPick;

export type ReceivedAsset =
  | {
      kind: "player";
      playerName: string;
      position: string | null;
      team: string | null;
    }
  | {
      kind: "pick";
      season: string;
      round: number;
      originalRoster: number;
      // Short label without the owner, e.g. "2024 2nd" — the owner is carried
      // separately so the UI can put it on its own line.
      label: string;
      originalOwnerName: string | null;
      outcome: PickOutcome;
    };

export interface TradeSide {
  rosterId: number;
  teamName: string;
  received: ReceivedAsset[];
}

// A single asset moving from one roster to another within a trade. Drives the
// Sankey visual (giver -> asset -> outcome).
export interface TradeFlow {
  fromRosterId: number | null;
  fromTeamName: string | null;
  toRosterId: number;
  toTeamName: string;
  asset: ReceivedAsset;
}

export interface TradeView {
  id: string;
  leagueId: string;
  season: string;
  createdAt: number;
  sides: TradeSide[];
  flows: TradeFlow[];
}

export interface TeamMeta {
  rosterId: number;
  teamName: string;
  ownerName: string;
}

export interface LeagueTrades {
  leagueName: string;
  seasons: string[];
  teams: TeamMeta[];
  trades: TradeView[];
}

export function pickKey(
  season: string,
  round: number,
  originalRoster: number,
): string {
  return `${season}:${round}:${originalRoster}`;
}

const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
function ordinal(round: number): string {
  return ORDINALS[round] ?? `${round}th`;
}

function playerName(p: SleeperPlayer | undefined, fallbackId: string): string {
  if (!p) return fallbackId;
  if (p.full_name) return p.full_name;
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
  return name || fallbackId;
}

// Index every completed draft selection by pickKey(season, round, originalRoster).
// The original roster is derived from the draft slot, so a pick that changed
// hands still maps back to the franchise whose slot it was.
function indexDraftPicks(
  draft: Draft,
  picks: DraftPickResult[],
  into: Map<string, DraftPickResult>,
): void {
  for (const pick of picks) {
    const originalRoster = draft.slot_to_roster_id?.[String(pick.draft_slot)];
    if (originalRoster == null) continue;
    into.set(pickKey(draft.season, pick.round, originalRoster), pick);
  }
}

function resolvePick(
  season: string,
  round: number,
  originalRoster: number,
  draftIndex: Map<string, DraftPickResult>,
  seasonsWithDraft: Set<string>,
  players: Record<string, SleeperPlayer>,
): PickOutcome {
  const match = draftIndex.get(pickKey(season, round, originalRoster));
  if (match) {
    const metaName = [match.metadata?.first_name, match.metadata?.last_name]
      .filter(Boolean)
      .join(" ");
    return {
      status: "drafted",
      playerName: metaName || playerName(players[match.player_id], match.player_id),
      position: match.metadata?.position || players[match.player_id]?.position || null,
      team: match.metadata?.team || players[match.player_id]?.team || null,
      round: match.round,
      pickNo: match.pick_no,
    };
  }
  // No selection found. If that season's draft hasn't happened, it's pending;
  // otherwise the draft exists but we couldn't match the slot.
  return seasonsWithDraft.has(season)
    ? { status: "unknown" }
    : { status: "pending" };
}

function buildFlows(
  tx: Transaction,
  names: Map<number, string>,
  players: Record<string, SleeperPlayer>,
  draftIndex: Map<string, DraftPickResult>,
  seasonsWithDraft: Set<string>,
): TradeFlow[] {
  const flows: TradeFlow[] = [];

  // Players: `adds` gives the receiver, `drops` gives the giver.
  if (tx.adds) {
    for (const [playerId, toRoster] of Object.entries(tx.adds)) {
      const p = players[playerId];
      const fromRoster = tx.drops?.[playerId] ?? null;
      flows.push({
        fromRosterId: fromRoster,
        fromTeamName: fromRoster != null ? names.get(fromRoster) ?? null : null,
        toRosterId: toRoster,
        toTeamName: names.get(toRoster) ?? `Roster ${toRoster}`,
        asset: {
          kind: "player",
          playerName: playerName(p, playerId),
          position: p?.position || null,
          team: p?.team || null,
        },
      });
    }
  }

  // Picks: previous_owner_id is the giver, owner_id is the receiver.
  for (const pick of tx.draft_picks) {
    flows.push({
      fromRosterId: pick.previous_owner_id,
      fromTeamName: names.get(pick.previous_owner_id) ?? null,
      toRosterId: pick.owner_id,
      toTeamName: names.get(pick.owner_id) ?? `Roster ${pick.owner_id}`,
      asset: buildPickAsset(pick, names, draftIndex, seasonsWithDraft, players),
    });
  }

  return flows;
}

function buildTradeView(
  tx: Transaction,
  league: League,
  names: Map<number, string>,
  players: Record<string, SleeperPlayer>,
  draftIndex: Map<string, DraftPickResult>,
  seasonsWithDraft: Set<string>,
): TradeView {
  const flows = buildFlows(tx, names, players, draftIndex, seasonsWithDraft);

  // Derive each side's "received" list from the flows (single source of truth).
  const sides: TradeSide[] = tx.roster_ids.map((rosterId) => ({
    rosterId,
    teamName: names.get(rosterId) ?? `Roster ${rosterId}`,
    received: flows
      .filter((f) => f.toRosterId === rosterId)
      .map((f) => f.asset),
  }));

  return {
    id: tx.transaction_id,
    leagueId: league.league_id,
    season: league.season,
    createdAt: tx.created,
    sides,
    flows,
  };
}

function buildPickAsset(
  pick: TradedDraftPick,
  names: Map<number, string>,
  draftIndex: Map<string, DraftPickResult>,
  seasonsWithDraft: Set<string>,
  players: Record<string, SleeperPlayer>,
): ReceivedAsset {
  const origOwner = names.get(pick.roster_id);
  const label = `${pick.season} ${ordinal(pick.round)}`;
  return {
    kind: "pick",
    season: pick.season,
    round: pick.round,
    originalRoster: pick.roster_id,
    label,
    originalOwnerName: origOwner ?? null,
    outcome: resolvePick(
      pick.season,
      pick.round,
      pick.roster_id,
      draftIndex,
      seasonsWithDraft,
      players,
    ),
  };
}

export async function buildLeagueTrades(
  leagueId: string,
): Promise<LeagueTrades | null> {
  const chain = await getLeagueChain(leagueId);
  if (chain.length === 0) return null;

  const players = await getPlayers();

  // Completed draft selections across every season in the chain. Built before
  // any trades are processed so picks resolve regardless of season ordering.
  const draftIndex = new Map<string, DraftPickResult>();
  const seasonsWithDraft = new Set<string>();
  // roster -> team name, per league (roster_ids are league-scoped).
  const rosterNamesByLeague = new Map<string, Map<number, string>>();

  const perLeague = await Promise.all(
    chain.map(async (league) => {
      const [users, rosters, transactions, drafts] = await Promise.all([
        getUsers(league.league_id),
        getRosters(league.league_id),
        getTransactions(league.league_id),
        getDrafts(league.league_id),
      ]);
      const draftPicks = await Promise.all(
        // The drafts list omits slot_to_roster_id, so fetch each full draft to
        // get the slot->roster mapping picks are indexed by. Fall back to the
        // list entry if the detail fetch fails so season info isn't lost.
        drafts.map(async (d) => {
          const [full, picks] = await Promise.all([
            getDraft(d.draft_id),
            getDraftPicks(d.draft_id),
          ]);
          return { draft: full ?? d, picks };
        }),
      );
      return { league, users, rosters, transactions, draftPicks };
    }),
  );

  // First pass: index every draft and build name maps.
  for (const { league, users, rosters, draftPicks } of perLeague) {
    const userById = new Map(users.map((u) => [u.user_id, u]));
    const names = new Map<number, string>();
    for (const roster of rosters) {
      const user = roster.owner_id ? userById.get(roster.owner_id) : undefined;
      names.set(
        roster.roster_id,
        user?.metadata?.team_name || user?.display_name || `Roster ${roster.roster_id}`,
      );
    }
    rosterNamesByLeague.set(league.league_id, names);

    for (const { draft, picks } of draftPicks) {
      if (picks.length > 0) seasonsWithDraft.add(draft.season);
      indexDraftPicks(draft, picks, draftIndex);
    }
  }

  // Second pass: build resolved trade views.
  const trades: TradeView[] = [];
  for (const { league, transactions } of perLeague) {
    const names = rosterNamesByLeague.get(league.league_id)!;
    for (const tx of transactions) {
      if (tx.type !== "trade" || tx.status !== "complete") continue;
      trades.push(
        buildTradeView(tx, league, names, players, draftIndex, seasonsWithDraft),
      );
    }
  }

  trades.sort((a, b) => b.createdAt - a.createdAt);

  const seasons = Array.from(new Set(chain.map((l) => l.season))).sort(
    (a, b) => Number(b) - Number(a),
  );

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

  return { leagueName: chain[0].name, seasons, teams, trades };
}
