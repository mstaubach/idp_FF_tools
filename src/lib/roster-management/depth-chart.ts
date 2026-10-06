import type { PlanSection, RosterPlan } from "./plan";
import type { SleeperPlayer, SleeperRoster } from "./types";

// Entries in roster_positions that represent slot types, not player positions.
const SLOT_ONLY = new Set([
  "BN", "FLEX", "IDP_FLEX", "REC_FLEX", "SUPER_FLEX", "DEF", "TAXI", "IR",
]);

// Sleeper sometimes stores granular positions (DE, DT, CB, S, OLB, MLB).
// Map these to the grouped columns used in dynasty depth charts.
const POSITION_MAP: Record<string, string> = {
  DE: "DL", DT: "DL", NT: "DL",
  CB: "DB", S: "DB", SS: "DB", FS: "DB",
  OLB: "LB", ILB: "LB", MLB: "LB",
};

// Sleeper's WR/RB flex slot. Unlike the other flex slot types it gets its own
// column, which only starters can occupy.
export const FLEX_COLUMN = "WRRB_FLEX";
const FLEX_ELIGIBLE = new Set(["WR", "RB"]);

const COLUMN_LABELS: Record<string, string> = { [FLEX_COLUMN]: "Flex" };

export function columnLabel(position: string): string {
  return COLUMN_LABELS[position] ?? position;
}

export function derivePositionColumns(rosterPositions: string[]): string[] {
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

export function normalizePosition(position: string | null): string | null {
  if (!position) return null;
  return POSITION_MAP[position] ?? position;
}

// The set of grouped columns a player could reasonably sit in, derived from
// Sleeper's fantasy_positions (falling back to the single `position` field).
// Used both to pick a default column and to constrain drag-and-drop targets.
export function derivePlayerEligiblePositions(
  player: SleeperPlayer,
  positions: string[],
): string[] {
  const raw =
    player.fantasy_positions && player.fantasy_positions.length > 0
      ? player.fantasy_positions
      : player.position
        ? [player.position]
        : [];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const pos of raw) {
    const normalized = normalizePosition(pos);
    if (normalized && positions.includes(normalized) && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  // Flex goes last so it's never picked as a fallback default column.
  if (positions.includes(FLEX_COLUMN) && result.some((p) => FLEX_ELIGIBLE.has(p))) {
    result.push(FLEX_COLUMN);
  }
  return result;
}

export function deriveBenchIds(roster: SleeperRoster): string[] {
  const taxiSet = new Set(roster.taxi ?? []);
  const reserveSet = new Set(roster.reserve ?? []);
  const starterSet = new Set(roster.starters);
  return roster.players.filter(
    (id) => !starterSet.has(id) && !taxiSet.has(id) && !reserveSet.has(id),
  );
}

export type DepthChartCell = {
  playerId: string;
  displayName: string;
  eligiblePositions: string[];
};

export type DepthChartSection = {
  label: "Starting" | "Bench" | "Taxi" | "IR";
  rows: (DepthChartCell | null)[][];
};

export type DepthChartGrid = {
  positions: string[];
  sections: DepthChartSection[];
};

export function playerDisplayName(player: SleeperPlayer | undefined): string {
  if (!player?.last_name) return "";
  return player.first_name ? `${player.first_name} ${player.last_name}` : player.last_name;
}

const NON_STARTER_SLOTS = new Set(["BN", "TAXI", "IR"]);

// The starting lineup's slot types, in the order Sleeper fills roster.starters.
export function starterSlotTypes(rosterPositions: string[]): string[] {
  return rosterPositions.filter((p) => !NON_STARTER_SLOTS.has(p));
}

// Player ID -> slot type for each filled starter slot.
function deriveStarterSlots(roster: SleeperRoster, rosterPositions: string[]): Map<string, string> {
  const slots = starterSlotTypes(rosterPositions);
  const result = new Map<string, string>();
  roster.starters.forEach((id, i) => {
    if (id !== "0" && slots[i]) result.set(id, slots[i]);
  });
  return result;
}

// Whether a player with these eligible columns may sit in `position` within
// `section`. Flex is a starting slot, so it's only valid in Starting.
export function canPlace(
  eligiblePositions: readonly string[],
  section: PlanSection,
  position: string,
): boolean {
  if (position === FLEX_COLUMN && section !== "Starting") return false;
  return eligiblePositions.includes(position);
}

function buildSection(
  label: PlanSection,
  playerIds: string[],
  positions: string[],
  players: Record<string, SleeperPlayer>,
  planPositions: Record<string, string>,
  starterSlots: Map<string, string>,
  showEmpty: boolean,
): DepthChartSection | null {
  const byPosition = new Map<string, string[]>();
  for (const id of playerIds) {
    const player = players[id];
    const eligiblePositions = derivePlayerEligiblePositions(player, positions);
    const placeable = eligiblePositions.filter((pos) => canPlace(eligiblePositions, label, pos));
    if (placeable.length === 0) continue;

    const slotPos = label === "Starting" ? starterSlots.get(id) : undefined;
    const defaultPos =
      slotPos === FLEX_COLUMN ? slotPos : normalizePosition(player.position ?? null);
    const planPos = planPositions[id];
    const assignedPos =
      planPos && placeable.includes(planPos)
        ? planPos
        : defaultPos && placeable.includes(defaultPos)
          ? defaultPos
          : placeable[0];

    const group = byPosition.get(assignedPos) ?? [];
    group.push(id);
    byPosition.set(assignedPos, group);
  }

  const maxRows = Math.max(
    0,
    ...positions.map((p) => byPosition.get(p)?.length ?? 0),
  );
  // An empty row keeps the section on screen as a drop target.
  if (maxRows === 0 && !showEmpty) return null;

  const rows: (DepthChartCell | null)[][] = Array.from({ length: Math.max(maxRows, 1) }, (_, r) =>
    positions.map((pos) => {
      const id = byPosition.get(pos)?.[r];
      if (id === undefined) return null;
      return {
        playerId: id,
        displayName: playerDisplayName(players[id]),
        eligiblePositions: derivePlayerEligiblePositions(players[id], positions),
      };
    }),
  );

  return { label, rows };
}

// Local stand-in for plan.ts's EMPTY_PLAN: plan.ts imports this module, so
// only types flow the other way.
const NO_PLAN: RosterPlan = { positions: {}, sections: {}, cut: [] };

export type BuildDepthChartOptions = {
  rosterPositions?: string[]; // league roster_positions, used to find the flex starter
  plan?: RosterPlan;
  showEmpty?: PlanSection[]; // sections to render even with no players
};

export function buildDepthChart(
  roster: SleeperRoster,
  players: Record<string, SleeperPlayer>,
  positions: string[],
  { rosterPositions = [], plan = NO_PLAN, showEmpty = [] }: BuildDepthChartOptions = {},
): DepthChartGrid {
  const starterSlots = deriveStarterSlots(roster, rosterPositions);
  const cut = new Set(plan.cut);

  // Sleeper's sections first, then apply the plan's moves. Iterating in
  // section order means a player moved into a section lands after the
  // players already there.
  const sleeperSections: Array<[PlanSection, string[]]> = [
    ["Starting", roster.starters],
    ["Bench", deriveBenchIds(roster)],
    ["Taxi", roster.taxi ?? []],
    ["IR", roster.reserve ?? []],
  ];
  const idsBySection = new Map<PlanSection, string[]>(
    sleeperSections.map(([label]) => [label, []]),
  );
  for (const [label, ids] of sleeperSections) {
    for (const id of ids) {
      // Discard empty Sleeper sentinel ("0"), unknown player IDs, and cuts.
      if (id === "0" || !players[id] || cut.has(id)) continue;
      idsBySection.get(plan.sections[id] ?? label)!.push(id);
    }
  }

  const sections: DepthChartSection[] = [];
  for (const [label] of sleeperSections) {
    const section = buildSection(
      label,
      idsBySection.get(label)!,
      positions,
      players,
      plan.positions,
      starterSlots,
      showEmpty.includes(label),
    );
    if (section) sections.push(section);
  }

  return { positions, sections };
}

// Players per column across the Starting and Bench sections (taxi and IR are
// excluded). Counted from the built grid so drag-and-drop corrections apply.
export function countActiveByPosition(grid: DepthChartGrid): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(grid.positions.map((p) => [p, 0]));
  for (const section of grid.sections) {
    if (section.label !== "Starting" && section.label !== "Bench") continue;
    for (const row of section.rows) {
      row.forEach((cell, ci) => {
        if (cell) counts[grid.positions[ci]] += 1;
      });
    }
  }
  return counts;
}
