import {
  PlayerResult,
  SleeperRoster,
  SleeperUser,
  SleeperLeague,
  WaiverInfo,
  CheckAvailabilityResponse,
} from './types';

function getAllRosteredPlayerIds(roster: SleeperRoster): string[] {
  return [
    ...(roster.players || []),
    ...(roster.reserve || []),
    ...(roster.taxi || []),
  ];
}

function getTeamName(userId: string, users: SleeperUser[]): string {
  const user = users.find(u => u.user_id === userId);
  if (!user) return `Team ${userId}`;
  return user.metadata?.team_name || user.display_name;
}

function buildWaiverInfo(
  league: SleeperLeague,
  rosters: SleeperRoster[],
  users: SleeperUser[]
): WaiverInfo {
  const waiverType = league.settings.waiver_type;

  if (waiverType === 2) {
    // FAAB
    const budget = league.settings.waiver_budget || 100;
    const faabBudgets = rosters.map(r => ({
      teamName: getTeamName(r.owner_id, users),
      remaining: budget - (r.settings?.waiver_budget_used ?? 0),
    }));
    return { type: 'faab', faabBudgets, waiverOrder: null };
  }

  // Rolling waivers (type 0 or 1)
  const sorted = [...rosters].sort((a, b) => {
    const aOrder = a.waiver_position ?? 99;
    const bOrder = b.waiver_position ?? 99;
    return aOrder - bOrder;
  });

  const waiverOrder = sorted.map((r, i) => ({
    priority: i + 1,
    teamName: getTeamName(r.owner_id, users),
  }));

  return { type: 'rolling', faabBudgets: null, waiverOrder };
}

export function buildAvailabilityResults(
  matchedPlayers: PlayerResult[],
  rosters: SleeperRoster[],
  users: SleeperUser[],
  league: SleeperLeague
): Omit<CheckAvailabilityResponse, 'unmatchedPlayers'> {
  // Build a map: player_id -> { rosterId, ownerId }
  const rosterMap = new Map<string, { rosterId: number; ownerId: string }>();
  for (const roster of rosters) {
    for (const playerId of getAllRosteredPlayerIds(roster)) {
      rosterMap.set(playerId, { rosterId: roster.roster_id, ownerId: roster.owner_id });
    }
  }

  const results: PlayerResult[] = matchedPlayers.map(player => {
    if (!player.matchedPlayer) return player;

    const rosterEntry = rosterMap.get(player.matchedPlayer.id);
    if (rosterEntry) {
      return {
        ...player,
        available: false,
        rosteredBy: {
          rosterId: rosterEntry.rosterId,
          teamName: getTeamName(rosterEntry.ownerId, users),
          ownerName: users.find(u => u.user_id === rosterEntry.ownerId)?.display_name || 'Unknown',
        },
      };
    }

    return { ...player, available: true, rosteredBy: null };
  });

  const waiverInfo = buildWaiverInfo(league, rosters, users);

  return { results, waiverInfo };
}
