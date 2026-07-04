import { SavedLeague } from './types';

export type SleeperUser = {
  user_id: string;
  username: string;
  display_name: string;
};

export async function lookupSleeperUser(username: string): Promise<SleeperUser> {
  const res = await fetch(
    `https://api.sleeper.app/v1/user/${encodeURIComponent(username)}`
  );
  if (!res.ok) throw new Error('User not found');
  const data = await res.json();
  if (!data || !data.user_id) throw new Error('User not found');
  return data as SleeperUser;
}

export async function fetchUserLeagues(
  userId: string,
  season: string
): Promise<SavedLeague[]> {
  // userId normally comes from Sleeper's own lookup response, but encode it
  // anyway so an unexpected value can't add path segments to the request URL.
  const res = await fetch(
    `https://api.sleeper.app/v1/user/${encodeURIComponent(userId)}/leagues/nfl/${season}`
  );
  if (!res.ok) throw new Error('Failed to fetch leagues');
  const data = await res.json();
  return (data ?? []).map((l: { league_id: string; name: string }) => ({
    leagueId: l.league_id,
    name: l.name,
  }));
}

// Dynasty leagues often roll over to next season's league_id well before the
// NFL season kicks off, so guessing the season from the calendar month is
// unreliable. Ask Sleeper for the current calendar year's leagues first, and
// only fall back to last year's if that comes back empty (offseason, before
// the user's leagues have rolled over yet).
export async function fetchCurrentSeasonLeagues(
  userId: string
): Promise<{ season: string; leagues: SavedLeague[] }> {
  const thisYear = String(new Date().getFullYear());
  const current = await fetchUserLeagues(userId, thisYear);
  if (current.length > 0) return { season: thisYear, leagues: current };

  const lastYear = String(Number(thisYear) - 1);
  const previous = await fetchUserLeagues(userId, lastYear);
  return { season: lastYear, leagues: previous };
}
