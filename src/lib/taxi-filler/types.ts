export type SleeperLeague = {
  name: string;
  roster_positions: string[];
  settings: {
    taxi_years?: number;
  };
};

export type SleeperRoster = {
  roster_id: number;
  players: string[] | null;
  taxi: string[] | null;
  reserve: string[] | null;
};

export type SleeperPlayer = {
  player_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  team: string | null;
  age: number | null;
  years_exp: number | null;
  search_rank: number | null;
  active: boolean;
};

export type TaxiCandidate = {
  playerId: string;
  name: string;
  position: string;
  team: string | null;
  age: number | null;
  yearsExp: number;
  searchRank: number | null;
};
