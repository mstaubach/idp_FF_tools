import { unstable_cache } from "next/cache";
import { isValidSleeperId } from "@/lib/sleeper-id";
import type { SleeperLeague, SleeperPlayer, SleeperRoster } from "./types";

const BASE = "https://api.sleeper.app/v1";

class SleeperError extends Error {}

async function getJson<T>(path: string, revalidate: number): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate } });
  if (res.status === 404) return null;
  if (!res.ok) throw new SleeperError(`Sleeper ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export async function getLeague(leagueId: string): Promise<SleeperLeague | null> {
  if (!isValidSleeperId(leagueId)) return null;
  return getJson<SleeperLeague>(`/league/${leagueId}`, 300);
}

export async function getRosters(leagueId: string): Promise<SleeperRoster[]> {
  if (!isValidSleeperId(leagueId)) return [];
  return (await getJson<SleeperRoster[]>(`/league/${leagueId}/rosters`, 300)) ?? [];
}

async function _fetchPlayersRaw(): Promise<Record<string, SleeperPlayer>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${BASE}/players/nfl`, { signal: controller.signal });
    if (!res.ok) throw new SleeperError(`Sleeper ${res.status}: /players/nfl`);
    const raw = (await res.json()) as Record<
      string,
      {
        first_name?: string | null;
        last_name?: string | null;
        position?: string | null;
        team?: string | null;
        age?: number | null;
        years_exp?: number | null;
        search_rank?: number | null;
        active?: boolean;
      }
    >;
    // Slim the payload — the full response is ~16MB, well over Next.js's
    // 2MB unstable_cache limit. Only keep fields this tool uses.
    const slim: Record<string, SleeperPlayer> = {};
    for (const [id, p] of Object.entries(raw)) {
      if (!p.active) continue;
      slim[id] = {
        player_id: id,
        first_name: p.first_name ?? null,
        last_name: p.last_name ?? null,
        position: p.position ?? null,
        team: p.team ?? null,
        age: p.age ?? null,
        years_exp: p.years_exp ?? null,
        search_rank: p.search_rank ?? null,
        active: true,
      };
    }
    return slim;
  } finally {
    clearTimeout(timeout);
  }
}

export const getPlayers = unstable_cache(
  _fetchPlayersRaw,
  ["taxi-filler-players"],
  { revalidate: 3600 },
);
