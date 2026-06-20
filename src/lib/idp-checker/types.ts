// Sleeper API types
export interface SleeperPlayer {
  player_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position: string | null;
  team: string | null;
  active: boolean;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players: string[] | null;
  starters: string[] | null;
  reserve: string[] | null;  // IR
  taxi: string[] | null;
  waiver_position?: number;  // rolling waiver priority
  settings?: {
    waiver_budget_used?: number;  // FAAB spent
  };
}

export interface SleeperUser {
  user_id: string;
  display_name: string;
  metadata?: {
    team_name?: string;
  };
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  settings: {
    waiver_type?: number;  // 0=rolling, 1=rolling(reverse standings), 2=FAAB
    waiver_budget?: number;
  };
}

// App types
export interface ParsedPlayer {
  name: string;
  position?: string;
  team?: string;
  rank?: number;
  tier?: number;
}

export interface PlayerResult {
  inputName: string;
  matchedPlayer: {
    id: string;
    name: string;
    position: string;
    team: string;
  } | null;
  matchConfidence: number;
  rank?: number;
  tier?: number;
  available: boolean;
  rosteredBy: {
    rosterId: number;
    teamName: string;
    ownerName: string;
  } | null;
}

export interface WaiverInfo {
  type: 'faab' | 'rolling' | 'unknown';
  faabBudgets: { teamName: string; remaining: number }[] | null;
  waiverOrder: { priority: number; teamName: string }[] | null;
}

export interface CheckAvailabilityRequest {
  players: ParsedPlayer[];
  leagueId: string;
}

export interface CheckAvailabilityResponse {
  results: PlayerResult[];
  waiverInfo: WaiverInfo;
  unmatchedPlayers: string[];
}

// IDP position groupings
export const IDP_POSITIONS = ['DE', 'DT', 'LB', 'CB', 'S', 'DB', 'DL', 'ILB', 'OLB', 'FS', 'SS', 'NT'] as const;

export const POSITION_GROUPS: Record<string, string[]> = {
  LB: ['LB', 'ILB', 'OLB'],
  DL: ['DL', 'DE', 'DT', 'NT'],
  DB: ['DB', 'CB', 'S', 'FS', 'SS'],
};

export function getPositionGroup(position: string): string {
  for (const [group, positions] of Object.entries(POSITION_GROUPS)) {
    if (positions.includes(position)) return group;
  }
  return position;
}
