import type { SleeperPlayer, SleeperRoster, TaxiCandidate } from "./types";

const SLOT_ONLY = new Set([
  "BN", "FLEX", "IDP_FLEX", "REC_FLEX", "SUPER_FLEX", "DEF", "TAXI", "IR",
]);

const POSITION_MAP: Record<string, string> = {
  DE: "DL", DT: "DL", NT: "DL",
  CB: "DB", S: "DB", SS: "DB", FS: "DB",
  OLB: "LB", ILB: "LB", MLB: "LB",
};

function normalizePosition(position: string): string {
  return POSITION_MAP[position] ?? position;
}

export function deriveEligiblePositions(rosterPositions: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const pos of rosterPositions) {
    if (!SLOT_ONLY.has(pos) && !seen.has(pos)) {
      seen.add(pos);
      result.push(pos);
    }
  }
  return result;
}

export function buildTaxiCandidates(
  rosters: SleeperRoster[],
  players: Record<string, SleeperPlayer>,
  leaguePositions: string[],
  taxiYears: number,
): TaxiCandidate[] {
  // Build the set of all rostered player IDs across every roster.
  // NOTE: taxiYears semantics — Sleeper's taxi_years=1 means only season-1
  // players (years_exp=0) qualify; taxi_years=2 adds season-2 (years_exp=1).
  // Filter is years_exp < taxiYears.
  const rostered = new Set<string>();
  for (const roster of rosters) {
    for (const id of [
      ...(roster.players ?? []),
      ...(roster.taxi ?? []),
      ...(roster.reserve ?? []),
    ]) {
      if (id && id !== "0") rostered.add(id);
    }
  }

  const leaguePositionSet = new Set(leaguePositions);

  return Object.values(players)
    .filter((p) => {
      // getPlayers() already drops inactive players during slimming; this guard keeps
      // buildTaxiCandidates correct when called directly in tests with unslimmed data.
      if (!p.active) return false;
      if (rostered.has(p.player_id)) return false;
      if ((p.years_exp ?? Infinity) >= taxiYears) return false;
      const normalized = p.position ? normalizePosition(p.position) : null;
      if (!normalized || !leaguePositionSet.has(normalized)) return false;
      return true;
    })
    .map((p) => ({
      playerId: p.player_id,
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown",
      // p.position is non-null: filter above requires normalizePosition(p.position) to be in leaguePositionSet
      position: normalizePosition(p.position!),
      team: p.team ?? null,
      age: p.age ?? null,
      yearsExp: p.years_exp ?? 0,
      searchRank: p.search_rank ?? null,
    }))
    .sort((a, b) => {
      if (a.searchRank === null && b.searchRank === null) return 0;
      if (a.searchRank === null) return 1;
      if (b.searchRank === null) return -1;
      return a.searchRank - b.searchRank;
    });
}
