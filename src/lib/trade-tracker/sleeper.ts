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

// A user's leagues for one NFL season. Used to walk the dynasty chain forward,
// since Sleeper leagues only point backward (previous_league_id), not forward.
export async function getUserLeagues(
  userId: string,
  season: string,
): Promise<League[]> {
  return (
    (await getJson<League[]>(`/user/${userId}/leagues/nfl/${season}`, 60 * 60)) ??
    []
  );
}

// Find the most recent league in the dynasty, starting from any season's
// league. Sleeper has no successor pointer, so for each following season we
// look through a current member's leagues for one whose previous_league_id
// points back at the league we're holding. Stops when no successor exists.
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

// Capture trades and drafts from every season this dynasty has existed,
// regardless of which season's league id was entered: walk forward to the
// newest league, then walk the previous_league_id chain backward. Newest first.
export async function getLeagueChain(leagueId: string): Promise<League[]> {
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
