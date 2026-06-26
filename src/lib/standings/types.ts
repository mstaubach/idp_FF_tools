// Sleeper API response shapes this tool consumes (only fields used are typed),
// plus the standings tool's own output shapes. Intentionally separate from the
// trade-tracker and idp-checker type modules — do not share or merge.

export interface League {
  league_id: string;
  name: string;
  season: string;
  previous_league_id: string | null;
  total_rosters: number;
  status?: string;
}

export interface RosterSettings {
  wins: number;
  losses: number;
  ties: number;
  fpts?: number;
}

export interface Roster {
  roster_id: number;
  owner_id: string | null;
  settings: RosterSettings;
}

export interface SleeperUser {
  user_id: string;
  display_name: string;
  metadata?: { team_name?: string };
}

// One match in /league/{id}/winners_bracket. The championship game is p === 1;
// `w` is the winning roster_id.
export interface BracketMatch {
  r: number;
  m: number;
  t1: number | null;
  t2: number | null;
  w: number | null;
  l: number | null;
  p?: number;
}

// Raw per-season data handed to the pure builder.
export interface SeasonInput {
  league: League;
  rosters: Roster[];
  users: SleeperUser[];
  bracket: BracketMatch[];
}

export interface SeasonRow {
  ownerId: string;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  rank: number;
}

export interface SeasonStandings {
  season: string;
  leagueId: string;
  championOwnerId: string | null;
  rows: SeasonRow[];
}

export interface ManagerRecord {
  ownerId: string;
  displayName: string;
  wins: number;
  losses: number;
  ties: number;
  championships: number;
  winPct: number;
  isCurrentMember: boolean;
}

export interface ChampionEntry {
  season: string;
  ownerId: string;
  teamName: string;
}

export interface LeagueHistory {
  allTime: ManagerRecord[];
  seasons: SeasonStandings[];
  champions: ChampionEntry[];
}
