// Shapes returned by the public Sleeper API (https://docs.sleeper.com).
// Only the fields this tool uses are typed.

export interface League {
  league_id: string;
  name: string;
  season: string;
  previous_league_id: string | null;
  draft_id: string | null;
  total_rosters: number;
}

export interface SleeperUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata?: {
    team_name?: string;
  };
}

export interface Roster {
  roster_id: number;
  owner_id: string | null;
}

export interface Draft {
  draft_id: string;
  season: string;
  league_id: string;
  status: string;
  // draft slot (as string) -> roster_id of the franchise that owns that slot.
  // The /league/{id}/drafts list endpoint omits this; only /draft/{id} has it.
  slot_to_roster_id?: Record<string, number> | null;
  settings?: {
    rounds?: number;
    // Sleeper's draft pool: 0 = all players, 1 = rookies only, 2 = veterans
    // only. Startups that split the initial draft from the rookie draft set
    // this (2 for the startup, 1 for the rookie draft); leagues that don't
    // bother leave it 0, so it is a hint, not a guarantee.
    player_type?: number;
  };
}

// A completed pick from /draft/{id}/picks
export interface DraftPickResult {
  round: number;
  pick_no: number;
  draft_slot: number;
  player_id: string;
  roster_id: number;
  metadata: {
    first_name?: string;
    last_name?: string;
    position?: string;
    team?: string;
  };
}
