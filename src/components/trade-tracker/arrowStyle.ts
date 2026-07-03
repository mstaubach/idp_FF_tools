import { ordinal } from "@/lib/trade-tracker/resolve";
import type { PickChainLink } from "@/lib/trade-tracker/team-view";

// Hues that read on both the light (gray-50) and dark (pitch-900) canvases.
export const CHAIN_COLORS: readonly string[] = [
  "#0ea5e9", // sky
  "#a855f7", // violet
  "#f59e0b", // amber
  "#10b981", // emerald
  "#f43f5e", // rose
  "#14b8a6", // teal
];

// Distinct asset keys in first-appearance order — one entry per pick chain.
export function orderedAssetKeys(chainLinks: PickChainLink[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const link of chainLinks) {
    if (seen.has(link.assetKey)) continue;
    seen.add(link.assetKey);
    ordered.push(link.assetKey);
  }
  return ordered;
}

export function colorForAssetKey(
  assetKey: string,
  ordered: readonly string[],
): string {
  const i = ordered.indexOf(assetKey);
  return CHAIN_COLORS[(i >= 0 ? i : 0) % CHAIN_COLORS.length];
}

// assetKey is pickKey(season, round, originalRoster) — "2024:2:5" → "2024 2nd".
export function labelForAssetKey(assetKey: string): string {
  const [season, round] = assetKey.split(":");
  return `${season} ${ordinal(Number(round))}`;
}
