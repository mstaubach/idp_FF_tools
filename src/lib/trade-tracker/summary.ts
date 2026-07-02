import { pickKey } from "./resolve";
import type { TeamView } from "./team-view";

export interface TeamTradeStats {
  tradeCount: number;
  playersAcquired: number;
  picksAcquired: number;
  picksFlipped: number;
  picksDrafted: number;
  picksPending: number;
  topPartner: { name: string; trades: number } | null;
}

// Rolls a team's trade history into headline numbers. A received pick the team
// later traded away again ("flipped") is excluded from drafted/pending — its
// outcome belongs to whoever ended up holding it.
export function summarizeTeamView(view: TeamView): TeamTradeStats {
  const flipped = new Set(
    view.chainLinks.map((l) => `${l.fromTradeId}:${l.assetKey}`),
  );

  let playersAcquired = 0;
  let picksAcquired = 0;
  let picksDrafted = 0;
  let picksPending = 0;
  const partnerTrades = new Map<string, number>();

  for (const trade of view.trades) {
    for (const c of trade.counterparties) {
      partnerTrades.set(c.name, (partnerTrades.get(c.name) ?? 0) + 1);
    }
    for (const asset of trade.receives) {
      if (asset.kind === "player") playersAcquired++;
      if (asset.kind !== "pick") continue;
      picksAcquired++;
      const key = `${trade.tradeId}:${pickKey(asset.season, asset.round, asset.originalRoster)}`;
      if (flipped.has(key)) continue;
      if (asset.outcome.status === "drafted") picksDrafted++;
      if (asset.outcome.status === "pending") picksPending++;
    }
  }

  let topPartner: TeamTradeStats["topPartner"] = null;
  for (const [name, trades] of partnerTrades) {
    if (!topPartner || trades > topPartner.trades) topPartner = { name, trades };
  }

  return {
    tradeCount: view.trades.length,
    playersAcquired,
    picksAcquired,
    picksFlipped: view.chainLinks.length,
    picksDrafted,
    picksPending,
    topPartner,
  };
}
