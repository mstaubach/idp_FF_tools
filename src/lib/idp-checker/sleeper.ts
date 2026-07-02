import { unstable_cache } from 'next/cache';
import { SleeperPlayer, SleeperRoster, SleeperUser, SleeperLeague, IDP_POSITIONS } from './types';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';
const FETCH_TIMEOUT = 10_000;

const PLAYER_CACHE_TTL = 3600;   // 1 hour
const LEAGUE_CACHE_TTL = 300;    // 5 minutes

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Sleeper API error: ${res.status} from ${url}`);
    }
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

export async function _fetchPlayersRaw(): Promise<SleeperPlayer[]> {
  const res = await fetchWithTimeout(`${SLEEPER_BASE}/players/nfl`);
  const data: Record<string, SleeperPlayer> = await res.json();
  // Filtering alone leaves ~4300 raw player objects (~5MB serialized) — over
  // Next.js's 2MB unstable_cache limit, which silently skips caching and
  // re-downloads the ~16MB /players/nfl on every request. Slim each player to
  // the fields this tool reads so the cached value fits (~570KB).
  return Object.values(data)
    .filter(
      (p) => p.active && p.position && (IDP_POSITIONS as readonly string[]).includes(p.position)
    )
    .map((p) => ({
      player_id: p.player_id,
      full_name: p.full_name,
      first_name: p.first_name,
      last_name: p.last_name,
      position: p.position,
      team: p.team,
      active: p.active,
    }));
}

export async function _fetchRostersRaw(leagueId: string): Promise<SleeperRoster[]> {
  const res = await fetchWithTimeout(`${SLEEPER_BASE}/league/${leagueId}/rosters`);
  return res.json();
}

export async function _fetchUsersRaw(leagueId: string): Promise<SleeperUser[]> {
  const res = await fetchWithTimeout(`${SLEEPER_BASE}/league/${leagueId}/users`);
  return res.json();
}

export async function _fetchLeagueRaw(leagueId: string): Promise<SleeperLeague> {
  const res = await fetchWithTimeout(`${SLEEPER_BASE}/league/${leagueId}`);
  return res.json();
}

export const fetchPlayers = unstable_cache(
  _fetchPlayersRaw,
  ['sleeper-players'],
  { revalidate: PLAYER_CACHE_TTL }
);

export const fetchRosters = unstable_cache(
  _fetchRostersRaw,
  ['sleeper-rosters'],
  { revalidate: LEAGUE_CACHE_TTL }
);

export const fetchUsers = unstable_cache(
  _fetchUsersRaw,
  ['sleeper-users'],
  { revalidate: LEAGUE_CACHE_TTL }
);

export const fetchLeague = unstable_cache(
  _fetchLeagueRaw,
  ['sleeper-league'],
  { revalidate: LEAGUE_CACHE_TTL }
);
