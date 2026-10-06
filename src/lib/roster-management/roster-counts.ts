import type { SleeperLeague, SleeperPlayer, SleeperRoster } from "./types";
import { deriveBenchIds, starterSlotTypes } from "./depth-chart";
import type { PlanSection } from "./plan";

export type SlotCount = { used: number; total: number };

export type RosterCounts = {
  starting: SlotCount;
  bench: SlotCount;
  taxi: SlotCount;
  ir: SlotCount;
};

function countValid(ids: string[], players: Record<string, SleeperPlayer>): number {
  return ids.filter((id) => id !== "0" && players[id]).length;
}

export function computeRosterCounts(
  roster: SleeperRoster,
  players: Record<string, SleeperPlayer>,
  rosterPositions: string[],
  settings: SleeperLeague["settings"],
): RosterCounts {
  const bench = deriveBenchIds(roster);
  const benchTotal = rosterPositions.filter((p) => p === "BN").length;

  return {
    starting: { used: countValid(roster.starters, players), total: roster.starters.length },
    bench: { used: countValid(bench, players), total: benchTotal },
    taxi: { used: countValid(roster.taxi ?? [], players), total: settings.taxi_slots ?? 0 },
    ir: { used: countValid(roster.reserve ?? [], players), total: settings.reserve_slots ?? 0 },
  };
}

// How many slots the league allows in each section.
export function sectionSlotTotals(
  rosterPositions: string[],
  settings: SleeperLeague["settings"],
): Record<PlanSection, number> {
  return {
    Starting: starterSlotTypes(rosterPositions).length,
    Bench: rosterPositions.filter((p) => p === "BN").length,
    Taxi: settings.taxi_slots ?? 0,
    IR: settings.reserve_slots ?? 0,
  };
}
