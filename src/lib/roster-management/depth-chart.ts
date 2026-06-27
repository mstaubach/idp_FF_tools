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

export type DepthChartSection = {
  label: "Starting" | "Bench" | "Taxi" | "IR";
  rows: (string | null)[][];
};

export type DepthChartGrid = {
  positions: string[];
  sections: DepthChartSection[];
};

function buildDisplayNames(
  playerIds: string[],
  players: Record<string, SleeperPlayer>,
): Map<string, string> {
  const lastNameCounts = new Map<string, number>();
  for (const id of playerIds) {
    const lastName = players[id]?.last_name;
    if (!lastName) continue;
    lastNameCounts.set(lastName, (lastNameCounts.get(lastName) ?? 0) + 1);
  }

  const result = new Map<string, string>();
  for (const id of playerIds) {
    const p = players[id];
    if (!p?.last_name) continue;
    const ambiguous = (lastNameCounts.get(p.last_name) ?? 0) > 1;
    result.set(
      id,
      ambiguous && p.first_name
        ? `${p.first_name[0]}. ${p.last_name}`
        : p.last_name,
    );
  }
  return result;
}

function buildSection(
  label: DepthChartSection["label"],
  playerIds: string[],
  positions: string[],
  players: Record<string, SleeperPlayer>,
  displayNames: Map<string, string>,
): DepthChartSection | null {
  // Discard empty Sleeper sentinel ("0") and unknown player IDs.
  const valid = playerIds.filter((id) => id !== "0" && players[id]);
  if (valid.length === 0) return null;

  const byPosition = new Map<string, string[]>();
  for (const id of valid) {
    const pos = normalizePosition(players[id].position ?? null);
    if (!pos || !positions.includes(pos)) continue;
    const group = byPosition.get(pos) ?? [];
    group.push(id);
    byPosition.set(pos, group);
  }

  const maxRows = Math.max(
    0,
    ...positions.map((p) => byPosition.get(p)?.length ?? 0),
  );
  if (maxRows === 0) return null;

  const rows: (string | null)[][] = Array.from({ length: maxRows }, (_, r) =>
    positions.map((pos) => {
      const id = byPosition.get(pos)?.[r];
      return id !== undefined ? (displayNames.get(id) ?? null) : null;
    }),
  );

  return { label, rows };
}

export function buildDepthChart(
  roster: SleeperRoster,
  players: Record<string, SleeperPlayer>,
  positions: string[],
): DepthChartGrid {
  const taxiSet = new Set(roster.taxi ?? []);
  const reserveSet = new Set(roster.reserve ?? []);
  const starterSet = new Set(roster.starters);

  const bench = roster.players.filter(
    (id) => !starterSet.has(id) && !taxiSet.has(id) && !reserveSet.has(id),
  );

  // Compute display names across all players on the roster so disambiguation
  // is consistent regardless of which section a player appears in.
  // Deduplicate because roster.players already includes taxi/reserve members.
  const allIds = [...new Set([...roster.players, ...(roster.taxi ?? []), ...(roster.reserve ?? [])])];
  const displayNames = buildDisplayNames(allIds, players);

  const sections: DepthChartSection[] = [];

  const starting = buildSection("Starting", roster.starters, positions, players, displayNames);
  if (starting) sections.push(starting);

  const benchSection = buildSection("Bench", bench, positions, players, displayNames);
  if (benchSection) sections.push(benchSection);

  const taxiSection = buildSection("Taxi", roster.taxi ?? [], positions, players, displayNames);
  if (taxiSection) sections.push(taxiSection);

  const irSection = buildSection("IR", roster.reserve ?? [], positions, players, displayNames);
  if (irSection) sections.push(irSection);

  return { positions, sections };
}
