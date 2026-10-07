// Shapes returned by the public Sleeper API. Only fields this tool uses are typed.

export type SleeperLeague = {
  name: string;
  season: string;
  status: string; // "pre_draft" | "drafting" | "in_season" | "complete"
  roster_positions: string[];
  settings: {
    taxi_slots?: number;
    reserve_slots?: number;
    draft_rounds?: number;
  };
};

// A future pick that has changed hands. All three IDs are roster IDs;
// roster_id is the team the pick originally belonged to.
export type SleeperTradedPick = {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
};

export type SleeperRoster = {
  roster_id: number;
  owner_id: string | null;
  starters: string[];
  players: string[];
  taxi: string[] | null;
  reserve: string[] | null;
};

export type SleeperPlayer = {
  player_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  fantasy_positions?: string[] | null;
};

export type SleeperUser = {
  user_id: string;
  display_name: string;
};
