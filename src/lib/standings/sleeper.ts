import { buildLeagueHistory } from "./history";
import type {
  BracketMatch,
  League,
  LeagueHistory,
  Roster,
  SeasonInput,
  SleeperUser,
} from "./types";

const BASE = "https://api.sleeper.app/v1";

// Historical seasons rarely change; the current season's records move weekly.
const TTL_LONG = 60 * 60; // 1h — league metadata, past seasons
const TTL_SHORT = 60 * 5; // 5m — current-season rosters

async function getJson<T>(
  path: string,
  revalidateSeconds: number,
): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      next: { revalidate: revalidateSeconds },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function getLeague(leagueId: string): Promise<League | null> {
  return getJson<League>(`/league/${leagueId}`, TTL_LONG);
}

async function getUsers(leagueId: string): Promise<SleeperUser[]> {
  return (await getJson<SleeperUser[]>(`/league/${leagueId}/users`, TTL_LONG)) ?? [];
}

async function getUserLeagues(userId: string, season: string): Promise<League[]> {
  return (
    (await getJson<League[]>(`/user/${userId}/leagues/nfl/${season}`, TTL_LONG)) ??
    []
  );
}

// Sleeper leagues only point backward. To find the newest season, for each
// following season look through a current member's leagues for one whose
// previous_league_id points back at the league we're holding.
async function getNewestLeague(start: League): Promise<League> {
  let head = start;
  for (let guard = 0; guard < 20; guard++) {
    const nextSeason = String(Number(head.season) + 1);
    const members = await getUsers(head.league_id);
    let successor: League | null = null;
    for (const member of members) {
      const leagues = await getUserLeagues(member.user_id, nextSeason);
      successor =
        leagues.find((l) => l.previous_league_id === head.league_id) ?? null;
      if (successor) break;
    }
    if (!successor) break;
    head = successor;
  }
  return head;
}

// Every season this dynasty has existed, newest-first, regardless of which
// season's id was entered.
async function getLeagueChain(leagueId: string): Promise<League[]> {
  const start = await getLeague(leagueId);
  if (!start) return [];
  const newest = await getNewestLeague(start);

  const chain: League[] = [];
  let current: string | null = newest.league_id;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const league = await getLeague(current);
    if (!league) break;
    chain.push(league);
    current = league.previous_league_id;
  }
  return chain;
}

export async function getLeagueName(leagueId: string): Promise<string | null> {
  const league = await getLeague(leagueId);
  return league?.name ?? null;
}

export async function loadLeagueHistory(
  leagueId: string,
): Promise<LeagueHistory | null> {
  const chain = await getLeagueChain(leagueId); // newest-first
  if (chain.length === 0) return null;

  const newestId = chain[0]?.league_id;
  const seasons = await Promise.all(
    chain.map(async (league): Promise<SeasonInput | null> => {
      const ttl = league.league_id === newestId ? TTL_SHORT : TTL_LONG;
      const [rosters, users, bracket] = await Promise.all([
        getJson<Roster[]>(`/league/${league.league_id}/rosters`, ttl),
        getJson<SleeperUser[]>(`/league/${league.league_id}/users`, TTL_LONG),
        getJson<BracketMatch[]>(
          `/league/${league.league_id}/winners_bracket`,
          ttl,
        ),
      ]);
      // A season with no roster data can't contribute — skip it.
      if (!rosters || rosters.length === 0) return null;
      return { league, rosters, users: users ?? [], bracket: bracket ?? [] };
    }),
  );

  const usable = seasons.filter((s): s is SeasonInput => s !== null);
  if (usable.length === 0) return null;
  return buildLeagueHistory(usable);
}
