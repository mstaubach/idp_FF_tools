import { SavedLeague } from './types';

export type SleeperUser = {
  user_id: string;
  username: string;
  display_name: string;
};

export const CURRENT_SEASON = '2025';

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
  const res = await fetch(
    `https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${season}`
  );
  if (!res.ok) throw new Error('Failed to fetch leagues');
  const data = await res.json();
  return (data ?? []).map((l: { league_id: string; name: string }) => ({
    leagueId: l.league_id,
    name: l.name,
  }));
}
