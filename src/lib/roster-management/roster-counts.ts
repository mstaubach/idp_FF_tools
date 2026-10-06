import type { SleeperLeague } from "./types";
import { starterSlotTypes, type DepthChartGrid } from "./depth-chart";
import type { PlanSection } from "./plan";

export type SlotCount = { used: number; total: number };

export type RosterCounts = {
  starting: SlotCount;
  bench: SlotCount;
  taxi: SlotCount;
  ir: SlotCount;
};

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

// Players per section are counted from the built grid, so planned moves and
// cuts are reflected.
export function computeRosterCounts(
  grid: DepthChartGrid,
  totals: Record<PlanSection, number>,
): RosterCounts {
  const used = (label: PlanSection) =>
    grid.sections
      .filter((s) => s.label === label)
      .flatMap((s) => s.rows.flat())
      .filter(Boolean).length;
  const count = (label: PlanSection): SlotCount => ({ used: used(label), total: totals[label] });

  return {
    starting: count("Starting"),
    bench: count("Bench"),
    taxi: count("Taxi"),
    ir: count("IR"),
  };
}
