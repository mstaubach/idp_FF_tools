import { buildLeagueTrades, pickKey } from "./resolve";
import type { LeagueTrades, ReceivedAsset, TeamMeta } from "./resolve";

export interface TeamSummary extends TeamMeta {
  tradeCount: number;
}

export interface LeagueTeams {
  leagueName: string;
  teams: TeamSummary[];
}

export interface TeamTrade {
  tradeId: string;
  season: string;
  createdAt: number;
  counterparties: string[];
  tradedAway: ReceivedAsset[];
  receives: ReceivedAsset[];
}

// A draft pick this team received in one trade and traded away in a later one.
export interface PickChainLink {
  assetKey: string;
  fromTradeId: string;
  toTradeId: string;
}

export interface TeamView {
  leagueName: string;
  teamName: string;
  trades: TeamTrade[];
  chainLinks: PickChainLink[];
}

function assetKeyOf(asset: ReceivedAsset): string | null {
  return asset.kind === "pick"
    ? pickKey(asset.season, asset.round, asset.originalRoster)
    : null;
}

export function deriveLeagueTeams(lt: LeagueTrades): LeagueTeams {
  const counts = new Map<number, number>();
  for (const trade of lt.trades) {
    const involved = new Set<number>();
    for (const f of trade.flows) {
      if (f.fromRosterId != null) involved.add(f.fromRosterId);
      involved.add(f.toRosterId);
    }
    for (const rid of involved) counts.set(rid, (counts.get(rid) ?? 0) + 1);
  }
  return {
    leagueName: lt.leagueName,
    teams: lt.teams.map((t) => ({ ...t, tradeCount: counts.get(t.rosterId) ?? 0 })),
  };
}

export function deriveTeamView(
  lt: LeagueTrades,
  rosterId: number,
): TeamView | null {
  const meta = lt.teams.find((t) => t.rosterId === rosterId);
  if (!meta) return null;

  const trades: TeamTrade[] = lt.trades
    .filter((tv) =>
      tv.flows.some((f) => f.fromRosterId === rosterId || f.toRosterId === rosterId),
    )
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((tv) => {
      const receives: ReceivedAsset[] = [];
      const tradedAway: ReceivedAsset[] = [];
      const counterparties = new Set<string>();
      for (const f of tv.flows) {
        if (f.toRosterId === rosterId) {
          receives.push(f.asset);
          if (f.fromTeamName) counterparties.add(f.fromTeamName);
        }
        if (f.fromRosterId === rosterId) {
          tradedAway.push(f.asset);
          counterparties.add(f.toTeamName);
        }
      }
      return {
        tradeId: tv.id,
        season: tv.season,
        createdAt: tv.createdAt,
        counterparties: Array.from(counterparties),
        tradedAway,
        receives,
      };
    });

  // Index where the team later traded each pick away.
  const tradedAwayByKey = new Map<string, { tradeId: string; createdAt: number }[]>();
  for (const t of trades) {
    for (const asset of t.tradedAway) {
      const key = assetKeyOf(asset);
      if (!key) continue;
      const list = tradedAwayByKey.get(key) ?? [];
      list.push({ tradeId: t.tradeId, createdAt: t.createdAt });
      tradedAwayByKey.set(key, list);
    }
  }

  const chainLinks: PickChainLink[] = [];
  for (const t of trades) {
    for (const asset of t.receives) {
      const key = assetKeyOf(asset);
      if (!key) continue;
      const later = (tradedAwayByKey.get(key) ?? [])
        .filter((x) => x.createdAt > t.createdAt)
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      if (later) {
        chainLinks.push({ assetKey: key, fromTradeId: t.tradeId, toTradeId: later.tradeId });
      }
    }
  }

  return { leagueName: lt.leagueName, teamName: meta.teamName, trades, chainLinks };
}

export async function listLeagueTeams(
  leagueId: string,
): Promise<LeagueTeams | null> {
  const lt = await buildLeagueTrades(leagueId);
  return lt ? deriveLeagueTeams(lt) : null;
}

export async function buildTeamView(
  leagueId: string,
  rosterId: number,
): Promise<TeamView | null> {
  const lt = await buildLeagueTrades(leagueId);
  return lt ? deriveTeamView(lt, rosterId) : null;
}
