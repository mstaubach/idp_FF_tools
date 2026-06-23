import type {
  Draft,
  DraftPickResult,
  League,
  Roster,
  SleeperPlayer,
  SleeperUser,
  Transaction,
} from "./types";

const BASE = "https://api.sleeper.app/v1";

// Sleeper records transactions per "leg" (week). 18 weeks plus an off-season
// bucket (0) comfortably covers a full season of trades.
const MAX_WEEKS = 18;

class SleeperError extends Error {}

async function getJson<T>(
  path: string,
  revalidateSeconds: number,
): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, {
    next: { revalidate: revalidateSeconds },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new SleeperError(`Sleeper request failed (${res.status}): ${path}`);
  }
  return (await res.json()) as T;
}

export async function getLeague(leagueId: string): Promise<League | null> {
  return getJson<League>(`/league/${leagueId}`, 60 * 60);
}

// Walk the previous_league_id chain so we capture trades and drafts from every
// season this dynasty/keeper league has existed. Newest league first.
export async function getLeagueChain(leagueId: string): Promise<League[]> {
  const chain: League[] = [];
  let current: string | null = leagueId;
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

export async function getUsers(leagueId: string): Promise<SleeperUser[]> {
  return (await getJson<SleeperUser[]>(`/league/${leagueId}/users`, 60 * 60)) ?? [];
}

export async function getRosters(leagueId: string): Promise<Roster[]> {
  return (await getJson<Roster[]>(`/league/${leagueId}/rosters`, 60 * 60)) ?? [];
}

export async function getTransactions(
  leagueId: string,
): Promise<Transaction[]> {
  const weeks = Array.from({ length: MAX_WEEKS + 1 }, (_, i) => i); // 0..18
  const results = await Promise.all(
    weeks.map((week) =>
      getJson<Transaction[]>(
        `/league/${leagueId}/transactions/${week}`,
        60 * 5,
      ),
    ),
  );
  return results.flatMap((r) => r ?? []);
}

export async function getDrafts(leagueId: string): Promise<Draft[]> {
  return (await getJson<Draft[]>(`/league/${leagueId}/drafts`, 60 * 60)) ?? [];
}

// The /league/{id}/drafts list endpoint omits slot_to_roster_id; only the
// single-draft endpoint includes it. We need it to map draft slots back to the
// franchise that originally owned each pick.
export async function getDraft(draftId: string): Promise<Draft | null> {
  return getJson<Draft>(`/draft/${draftId}`, 60 * 60);
}

export async function getDraftPicks(
  draftId: string,
): Promise<DraftPickResult[]> {
  return (
    (await getJson<DraftPickResult[]>(`/draft/${draftId}/picks`, 60 * 30)) ?? []
  );
}

// The full NFL player map is large (~5MB) but rarely changes; cache it hard.
// Used to resolve player_ids on the non-pick side of trades into names.
export async function getPlayers(): Promise<Record<string, SleeperPlayer>> {
  return (
    (await getJson<Record<string, SleeperPlayer>>(
      `/players/nfl`,
      60 * 60 * 24,
    )) ?? {}
  );
}
