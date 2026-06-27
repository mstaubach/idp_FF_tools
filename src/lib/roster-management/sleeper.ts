import { unstable_cache } from "next/cache";
import type {
  SleeperLeague,
  SleeperPlayer,
  SleeperRoster,
  SleeperUser,
} from "./types";

const BASE = "https://api.sleeper.app/v1";

class SleeperError extends Error {}

async function getJson<T>(
  path: string,
  revalidate: number,
): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate } });
  if (res.status === 404) return null;
  if (!res.ok) throw new SleeperError(`Sleeper ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export async function getLeague(
  leagueId: string,
): Promise<SleeperLeague | null> {
  return getJson<SleeperLeague>(`/league/${leagueId}`, 300);
}

export async function getRosters(leagueId: string): Promise<SleeperRoster[]> {
  return (
    (await getJson<SleeperRoster[]>(`/league/${leagueId}/rosters`, 300)) ?? []
  );
}

export async function getUsers(leagueId: string): Promise<SleeperUser[]> {
  return (
    (await getJson<SleeperUser[]>(`/league/${leagueId}/users`, 300)) ?? []
  );
}

async function _fetchPlayersRaw(): Promise<Record<string, SleeperPlayer>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${BASE}/players/nfl`, { signal: controller.signal });
    if (!res.ok) throw new SleeperError(`Sleeper ${res.status}: /players/nfl`);
    return res.json() as Promise<Record<string, SleeperPlayer>>;
  } finally {
    clearTimeout(timeout);
  }
}

export const getPlayers = unstable_cache(
  _fetchPlayersRaw,
  ["roster-management-players"],
  { revalidate: 3600 },
);
