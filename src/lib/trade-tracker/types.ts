// Shapes returned by the public Sleeper API (https://docs.sleeper.com).
// Only the fields this app uses are typed.

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

// A draft pick as it appears inside a trade transaction.
export interface TradedDraftPick {
  season: string;
  round: number;
  // roster_id is the ORIGINAL owner of the pick (the draft slot it represents).
  roster_id: number;
  // The roster that gave the pick up in this trade.
  previous_owner_id: number;
  // The roster that received the pick in this trade.
  owner_id: number;
}

export interface Transaction {
  transaction_id: string;
  type: "trade" | "free_agent" | "waiver" | "commissioner" | string;
  status: string;
  created: number;
  roster_ids: number[];
  // player_id -> roster_id that received the player
  adds: Record<string, number> | null;
  // player_id -> roster_id that dropped the player
  drops: Record<string, number> | null;
  draft_picks: TradedDraftPick[];
  // FAAB (waiver budget) moved in this trade. sender/receiver are roster_ids,
  // amount is the dollar figure. Absent on trades with no FAAB component.
  waiver_budget?: WaiverBudgetTransfer[] | null;
}

// A FAAB transfer inside a trade transaction.
export interface WaiverBudgetTransfer {
  sender: number;
  receiver: number;
  amount: number;
}

export interface Draft {
  draft_id: string;
  season: string;
  league_id: string;
  status: string;
  // draft slot (as string) -> roster_id of the franchise that owns that slot
  slot_to_roster_id: Record<string, number>;
}

// A completed pick from /draft/{id}/picks
export interface DraftPickResult {
  round: number;
  pick_no: number;
  draft_slot: number;
  player_id: string;
  picked_by: string; // user_id who actually made the selection
  roster_id: number;
  metadata: {
    first_name?: string;
    last_name?: string;
    position?: string;
    team?: string;
  };
}

export interface SleeperPlayer {
  player_id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  position?: string;
  team?: string;
}
