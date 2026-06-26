import type {
  BracketMatch,
  ChampionEntry,
  LeagueHistory,
  ManagerRecord,
  Roster,
  SeasonInput,
  SeasonRow,
  SeasonStandings,
  SleeperUser,
} from "./types";

// A manager's team name: prefer their custom team_name, fall back to the
// Sleeper display_name, then a neutral placeholder.
export function teamNameFor(user: SleeperUser | undefined): string {
  return user?.metadata?.team_name || user?.display_name || "Unknown team";
}

// The champion is the owner of the roster that won the p===1 (championship)
// match. Returns null if there is no such match, no decided winner, or the
// winning roster has no owner.
export function championOwnerId(
  bracket: BracketMatch[],
  rosters: Roster[],
): string | null {
  const final = bracket.find((m) => m.p === 1);
  if (!final || final.w == null) return null;
  const winner = rosters.find((r) => r.roster_id === final.w);
  return winner?.owner_id ?? null;
}

function winPct(wins: number, losses: number, ties: number): number {
  const games = wins + losses + ties;
  if (games === 0) return 0;
  return (wins + 0.5 * ties) / games;
}

export function buildSeasonStandings(input: SeasonInput): SeasonStandings {
  const usersById = new Map(input.users.map((u) => [u.user_id, u]));

  const rows: SeasonRow[] = input.rosters
    .filter((r) => r.owner_id != null)
    .map((r) => ({
      ownerId: r.owner_id as string,
      teamName: teamNameFor(usersById.get(r.owner_id as string)),
      wins: r.settings.wins,
      losses: r.settings.losses,
      ties: r.settings.ties,
      rank: 0,
    }));

  // Wins desc, then losses asc, then points-for desc as a final tiebreak.
  const fptsByOwner = new Map(
    input.rosters
      .filter((r) => r.owner_id != null)
      .map((r) => [r.owner_id as string, r.settings.fpts ?? 0]),
  );
  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return (fptsByOwner.get(b.ownerId) ?? 0) - (fptsByOwner.get(a.ownerId) ?? 0);
  });
  rows.forEach((row, i) => {
    row.rank = i + 1;
  });

  return {
    season: input.league.season,
    leagueId: input.league.league_id,
    championOwnerId: championOwnerId(input.bracket, input.rosters),
    rows,
  };
}

// `seasons` is passed newest-first. Members of the newest season are flagged
// isCurrentMember; all owners ever seen retain their summed totals.
export function buildLeagueHistory(seasons: SeasonInput[]): LeagueHistory {
  const seasonStandings = seasons.map(buildSeasonStandings);

  const currentOwners = new Set<string>(
    seasons[0]?.rosters
      .map((r) => r.owner_id)
      .filter((id): id is string => id != null) ?? [],
  );

  // Accumulate per-owner totals. Newest-first iteration means the first time we
  // see an owner is their most recent team name.
  const byOwner = new Map<string, ManagerRecord>();
  for (const season of seasonStandings) {
    for (const row of season.rows) {
      let record = byOwner.get(row.ownerId);
      if (!record) {
        record = {
          ownerId: row.ownerId,
          displayName: row.teamName,
          wins: 0,
          losses: 0,
          ties: 0,
          championships: 0,
          winPct: 0,
          isCurrentMember: currentOwners.has(row.ownerId),
        };
        byOwner.set(row.ownerId, record);
      }
      record.wins += row.wins;
      record.losses += row.losses;
      record.ties += row.ties;
    }
    if (season.championOwnerId) {
      const champ = byOwner.get(season.championOwnerId);
      if (champ) champ.championships += 1;
    }
  }

  const allTime = [...byOwner.values()];
  for (const record of allTime) {
    record.winPct = winPct(record.wins, record.losses, record.ties);
  }
  // All-time table: most wins first, then championships, then win%.
  allTime.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.championships !== a.championships)
      return b.championships - a.championships;
    return b.winPct - a.winPct;
  });

  const champions: ChampionEntry[] = seasonStandings
    .filter((s) => s.championOwnerId)
    .map((s) => {
      const ownerId = s.championOwnerId as string;
      const row = s.rows.find((r) => r.ownerId === ownerId);
      return { season: s.season, ownerId, teamName: row?.teamName ?? "Unknown team" };
    });

  return { allTime, seasons: seasonStandings, champions };
}
