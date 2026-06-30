export type SavedLeague = {
  leagueId: string;
  name: string;
};

export type Profile = {
  sleeperUsername: string;
  sleeperUserId: string;
  leagues: SavedLeague[];
  primaryLeagueId: string;
};
