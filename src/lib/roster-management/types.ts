// Shapes returned by the public Sleeper API. Only fields this tool uses are typed.

export type SleeperLeague = {
  name: string;
  roster_positions: string[];
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
};

export type SleeperUser = {
  user_id: string;
  display_name: string;
};
