import type { PickChainLink } from "@/lib/trade-tracker/team-view";

// Indexes chain links by trade: which received picks a trade later re-traded
// (source) and which traded-away picks arrived via an earlier trade (target).
export function chainKeySets(chainLinks: PickChainLink[]): {
  sourceKeysByTrade: Map<string, Set<string>>;
  targetKeysByTrade: Map<string, Set<string>>;
} {
  const sourceKeysByTrade = new Map<string, Set<string>>();
  const targetKeysByTrade = new Map<string, Set<string>>();
  for (const link of chainLinks) {
    if (!sourceKeysByTrade.has(link.fromTradeId)) {
      sourceKeysByTrade.set(link.fromTradeId, new Set());
    }
    sourceKeysByTrade.get(link.fromTradeId)!.add(link.assetKey);
    if (!targetKeysByTrade.has(link.toTradeId)) {
      targetKeysByTrade.set(link.toTradeId, new Set());
    }
    targetKeysByTrade.get(link.toTradeId)!.add(link.assetKey);
  }
  return { sourceKeysByTrade, targetKeysByTrade };
}
