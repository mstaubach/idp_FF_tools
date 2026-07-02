import { SavedLeague } from './types';

export type SleeperUser = {
  user_id: string;
  username: string;
  display_name: string;
};

export function currentNflSeason(): string {
  const now = new Date();
  // NFL season year = current calendar year if month >= August (season starts in September),
  // otherwise previous year (Jan–Aug are still in the prior season)
  return String(now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1);
}

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
