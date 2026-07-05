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

function buildDisplayNames(
  playerIds: string[],
  players: Record<string, SleeperPlayer>,
): Map<string, string> {
  const result = new Map<string, string>();
  for (const id of playerIds) {
    const p = players[id];
    if (!p?.last_name) continue;
    result.set(id, p.first_name ? `${p.first_name} ${p.last_name}` : p.last_name);
  }
  return result;
}

function buildSection(
  label: DepthChartSection["label"],
  playerIds: string[],
  positions: string[],
  players: Record<string, SleeperPlayer>,
  displayNames: Map<string, string>,
  overrides: Record<string, string>,
): DepthChartSection | null {
  // Discard empty Sleeper sentinel ("0") and unknown player IDs.
  const valid = playerIds.filter((id) => id !== "0" && players[id]);
  if (valid.length === 0) return null;

  const byPosition = new Map<string, string[]>();
  for (const id of valid) {
    const player = players[id];
    const eligiblePositions = derivePlayerEligiblePositions(player, positions);
    if (eligiblePositions.length === 0) continue;

    const defaultPos = normalizePosition(player.position ?? null);
    const overridePos = overrides[id];
    const assignedPos =
      overridePos && eligiblePositions.includes(overridePos)
        ? overridePos
        : defaultPos && eligiblePositions.includes(defaultPos)
          ? defaultPos
          : eligiblePositions[0];

    const group = byPosition.get(assignedPos) ?? [];
    group.push(id);
    byPosition.set(assignedPos, group);
  }

  const maxRows = Math.max(
    0,
    ...positions.map((p) => byPosition.get(p)?.length ?? 0),
  );
  if (maxRows === 0) return null;

  const rows: (DepthChartCell | null)[][] = Array.from({ length: maxRows }, (_, r) =>
    positions.map((pos) => {
      const id = byPosition.get(pos)?.[r];
      if (id === undefined) return null;
      return {
        playerId: id,
        displayName: displayNames.get(id) ?? "",
        eligiblePositions: derivePlayerEligiblePositions(players[id], positions),
      };
    }),
  );

  return { label, rows };
}

export function buildDepthChart(
  roster: SleeperRoster,
  players: Record<string, SleeperPlayer>,
  positions: string[],
  overrides: Record<string, string> = {},
): DepthChartGrid {
  const bench = deriveBenchIds(roster);

  // Build the full-name lookup once across every section's players.
  // Deduplicate because roster.players already includes taxi/reserve members.
  const allIds = [...new Set([...roster.players, ...(roster.taxi ?? []), ...(roster.reserve ?? [])])];
  const displayNames = buildDisplayNames(allIds, players);

  const sections: DepthChartSection[] = [];

  const starting = buildSection("Starting", roster.starters, positions, players, displayNames, overrides);
  if (starting) sections.push(starting);

  const benchSection = buildSection("Bench", bench, positions, players, displayNames, overrides);
  if (benchSection) sections.push(benchSection);

  const taxiSection = buildSection("Taxi", roster.taxi ?? [], positions, players, displayNames, overrides);
  if (taxiSection) sections.push(taxiSection);

  const irSection = buildSection("IR", roster.reserve ?? [], positions, players, displayNames, overrides);
  if (irSection) sections.push(irSection);

  return { positions, sections };
}
