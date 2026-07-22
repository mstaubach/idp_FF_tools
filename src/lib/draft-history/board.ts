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
  drafterRosterId: number;
  drafterTeamName: string;
  // The franchise that originally owned this draft slot (slot_to_roster_id).
  // Roster ids persist across a dynasty chain; names may change per season.
  originalOwnerRosterId: number | null;
  originalOwnerTeamName: string;
  isTraded: boolean;
}

export interface SeasonBoard {
  season: string;
  rounds: number;
  slots: number;
  // Team name owning each slot column this season; index 0 = slot 1.
  slotOwners: string[];
  // Roster id owning each slot column this season, parallel to slotOwners;
  // null when slot_to_roster_id lacks the slot. Stable across a dynasty
  // chain, unlike slotOwners' names.
  slotOwnerRosterIds: (number | null)[];
  cells: BoardCell[];
}

// Sleeper's draft pool values (Draft.settings.player_type).
const POOL_ROOKIES_ONLY = 1;
const POOL_VETERANS_ONLY = 2;

// Split the drafts of a dynasty chain into startup and rookie drafts.
//
// The season a draft belongs to is not enough on its own: many startups run a
// veterans-only initial draft AND that year's rookie draft in the same season,
// so "oldest season = startup" would hide a real rookie draft. Resolution
// order, most to least trustworthy:
//
//   1. player_type states the pool outright (rookies-only / veterans-only).
//   2. Otherwise the longest draft of the chain's oldest season is the
//      startup — a startup fills whole rosters, a rookie draft a few rounds.
//
// Anything not identified as the startup is treated as a rookie draft.
export function selectRookieDrafts(inputs: SeasonInput[]): SeasonInput[] {
  if (inputs.length === 0) return [];

  const poolOf = (i: SeasonInput) => i.draft.settings?.player_type;
  const roundsOf = (i: SeasonInput) =>
    i.draft.settings?.rounds ??
    (i.picks.length > 0 ? Math.max(...i.picks.map((p) => p.round)) : 0);

  // Drafts whose pool is stated need no guessing.
  const undecided = inputs.filter((i) => {
    const pool = poolOf(i);
    return pool !== POOL_ROOKIES_ONLY && pool !== POOL_VETERANS_ONLY;
  });

  // Among the undecided, only the oldest season can hold the startup, and only
  // if no draft has already declared itself the veterans-only startup.
  let startup: SeasonInput | null = null;
  if (undecided.length > 0 && !inputs.some((i) => poolOf(i) === POOL_VETERANS_ONLY)) {
    const oldest = Math.min(...inputs.map((i) => Number(i.league.season)));
    for (const input of undecided) {
      if (Number(input.league.season) !== oldest) continue;
      if (!startup || roundsOf(input) > roundsOf(startup)) startup = input;
    }
  }

  return inputs.filter(
    (i) => i !== startup && poolOf(i) !== POOL_VETERANS_ONLY,
  );
}

// Formats a round + slot as the conventional pick label, e.g. 2.05.
export function slotLabel(round: number, slot: number): string {
  return `${round}.${String(slot).padStart(2, "0")}`;
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

export interface TeamEntry {
  rosterId: number;
  name: string;
}

// Every franchise seen across the given seasons, named by its newest season's
// name (roster ids are stable across a dynasty chain; names may change).
// Sorted alphabetically for display in a team selector.
export function buildTeamDirectory(inputs: SeasonInput[]): TeamEntry[] {
  const newestFirst = [...inputs].sort(
    (a, b) => Number(b.league.season) - Number(a.league.season),
  );
  const names = new Map<number, string>();
  for (const { users, rosters } of newestFirst) {
    for (const [rosterId, name] of rosterNames(users, rosters)) {
      if (!names.has(rosterId)) names.set(rosterId, name);
    }
  }
  return [...names.entries()]
    .map(([rosterId, name]) => ({ rosterId, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
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
    const slotOwnerRosterIds = Array.from(
      { length: slots },
      (_, i) => slotToRoster[String(i + 1)] ?? null,
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
        drafterRosterId: p.roster_id,
        drafterTeamName: nameOf(p.roster_id),
        originalOwnerRosterId: originalRoster ?? null,
        originalOwnerTeamName: nameOf(originalRoster),
        isTraded: originalRoster != null && originalRoster !== p.roster_id,
      };
    });

    boards.push({
      season: draft.season,
      rounds,
      slots,
      slotOwners,
      slotOwnerRosterIds,
      cells,
    });
  }

  boards.sort((a, b) => Number(b.season) - Number(a.season));
  return boards;
}
