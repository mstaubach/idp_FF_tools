import type { SleeperLeague, SleeperTradedPick } from "./types";

export type DraftPick = {
  id: string;
  season: string;
  round: number;
  originalRosterId: number; // the team the pick originally belonged to
};

export function pickId(season: string, round: number, originalRosterId: number): string {
  return `${season}:${round}:${originalRosterId}`;
}

export function pickLabel(pick: DraftPick): string {
  return `${pick.season} Rd ${pick.round}`;
}

// The rookie draft to plan for: the league's own season while its draft
// hasn't finished (after the offseason rollover), otherwise the next one.
export function nextDraftSeason(league: Pick<SleeperLeague, "season" | "status">): string {
  if (league.status === "pre_draft" || league.status === "drafting") return league.season;
  return String(Number(league.season) + 1);
}

// Every team starts with its own pick in each round; traded_picks records
// only the picks whose current owner differs (or once differed) from that.
export function deriveOwnedPicks({
  rosterId,
  rosterIds,
  tradedPicks,
  season,
  rounds,
}: {
  rosterId: number;
  rosterIds: number[];
  tradedPicks: SleeperTradedPick[];
  season: string;
  rounds: number;
}): DraftPick[] {
  const currentOwner = new Map<string, number>();
  for (const t of tradedPicks) {
    if (t.season === season) currentOwner.set(pickId(season, t.round, t.roster_id), t.owner_id);
  }

  // Own pick first within each round, then acquired picks by original team.
  const originals = [rosterId, ...[...rosterIds].filter((id) => id !== rosterId).sort((a, b) => a - b)];
  const result: DraftPick[] = [];
  for (let round = 1; round <= rounds; round++) {
    for (const original of originals) {
      const id = pickId(season, round, original);
      if ((currentOwner.get(id) ?? original) === rosterId) {
        result.push({ id, season, round, originalRosterId: original });
      }
    }
  }
  return result;
}
