import type {
  Draft,
  DraftPickResult,
  League,
  Roster,
  SleeperUser,
} from "./types";

// One season's worth of raw Sleeper data, ready to be turned into a board.
export interface SeasonInput {
  league: League;
  draft: Draft;
  picks: DraftPickResult[];
  users: SleeperUser[];
  rosters: Roster[];
}

export interface BoardCell {
  round: number;
  slot: number;
  pickNo: number;
  playerName: string;
  position: string | null;
  nflTeam: string | null;
  drafterTeamName: string;
  // The franchise that originally owned this draft slot (slot_to_roster_id).
  originalOwnerTeamName: string;
  isTraded: boolean;
}

export interface SeasonBoard {
  season: string;
  rounds: number;
  slots: number;
  // Team name owning each slot column this season; index 0 = slot 1.
  slotOwners: string[];
  cells: BoardCell[];
}

// The oldest season in a dynasty chain is the startup draft; every later
// season's draft is a rookie draft. Chain arrives newest-first.
export function rookieLeagues(chain: League[]): League[] {
  return chain.slice(0, -1);
}

function cleanName(name: string | null | undefined): string {
  return name?.trim() ?? "";
}

function rosterNames(
  users: SleeperUser[],
  rosters: Roster[],
): Map<number, string> {
  const userById = new Map(users.map((u) => [u.user_id, u]));
  const names = new Map<number, string>();
  for (const roster of rosters) {
    const user = roster.owner_id ? userById.get(roster.owner_id) : undefined;
    names.set(
      roster.roster_id,
      cleanName(user?.metadata?.team_name) ||
        cleanName(user?.display_name) ||
        `Roster ${roster.roster_id}`,
    );
  }
  return names;
}

export function buildDraftHistory(inputs: SeasonInput[]): SeasonBoard[] {
  const boards: SeasonBoard[] = [];

  for (const { league, draft, picks, users, rosters } of inputs) {
    if (picks.length === 0) continue;

    const names = rosterNames(users, rosters);
    const slotToRoster = draft.slot_to_roster_id ?? {};
    const nameOf = (rosterId: number | undefined) =>
      rosterId != null ? names.get(rosterId) ?? `Roster ${rosterId}` : "Unknown";

    const slots = league.total_rosters || Object.keys(slotToRoster).length;
    const rounds =
      draft.settings?.rounds ?? Math.max(...picks.map((p) => p.round));

    const slotOwners = Array.from({ length: slots }, (_, i) =>
      nameOf(slotToRoster[String(i + 1)]),
    );

    const cells: BoardCell[] = picks.map((p) => {
      const originalRoster = slotToRoster[String(p.draft_slot)];
      const first = p.metadata.first_name ?? "";
      const last = p.metadata.last_name ?? "";
      return {
        round: p.round,
        slot: p.draft_slot,
        pickNo: p.pick_no,
        playerName: `${first} ${last}`.trim() || p.player_id,
        position: p.metadata.position ?? null,
        nflTeam: p.metadata.team ?? null,
        drafterTeamName: nameOf(p.roster_id),
        originalOwnerTeamName: nameOf(originalRoster),
        isTraded: originalRoster != null && originalRoster !== p.roster_id,
      };
    });

    boards.push({ season: draft.season, rounds, slots, slotOwners, cells });
  }

  boards.sort((a, b) => Number(b.season) - Number(a.season));
  return boards;
}
