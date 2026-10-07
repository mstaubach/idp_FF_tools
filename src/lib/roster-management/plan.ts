import type { DepthChartSection } from "./depth-chart";

export type PlanSection = DepthChartSection["label"];

const PLAN_SECTIONS: readonly PlanSection[] = ["Starting", "Bench", "Taxi", "IR"];

export type PickPlacement = { section: PlanSection; position: string };

// A what-if layer over the live Sleeper roster, kept per roster in the
// browser. Only differences from Sleeper are stored, keyed by player ID;
// draft picks are keyed by pick ID (see picks.ts).
export type RosterPlan = {
  positions: Record<string, string>; // column the player is shown in
  sections: Record<string, PlanSection>; // section the player is moved to
  cut: string[]; // players planned for release, hidden from the chart
  picks: Record<string, PickPlacement>; // picks placed as future rookies
};

export const EMPTY_PLAN: RosterPlan = { positions: {}, sections: {}, cut: [], picks: {} };

export function isPlanEmpty(plan: RosterPlan): boolean {
  return (
    Object.keys(plan.positions).length === 0 &&
    Object.keys(plan.sections).length === 0 &&
    plan.cut.length === 0 &&
    Object.keys(plan.picks).length === 0
  );
}

export type DragSource = {
  kind: "player" | "pick";
  id: string;
  eligiblePositions: readonly string[];
  // Null for a pick dragged out of the side panel.
  section: PlanSection | null;
  position: string | null;
};

export type DropTarget = { section: PlanSection; position: string };

// Returns the updated plan, or null when the drop is invalid or a no-op.
export function applyDrop(plan: RosterPlan, drag: DragSource, target: DropTarget): RosterPlan | null {
  if (!drag.eligiblePositions.includes(target.position)) return null;
  if (drag.section === target.section && drag.position === target.position) return null;
  if (drag.kind === "pick") {
    return { ...plan, picks: { ...plan.picks, [drag.id]: { ...target } } };
  }
  return {
    ...plan,
    positions: { ...plan.positions, [drag.id]: target.position },
    sections: { ...plan.sections, [drag.id]: target.section },
  };
}

export function unplacePick(plan: RosterPlan, pickId: string): RosterPlan {
  if (!(pickId in plan.picks)) return plan;
  const picks = { ...plan.picks };
  delete picks[pickId];
  return { ...plan, picks };
}

export function cutPlayer(plan: RosterPlan, playerId: string): RosterPlan {
  if (plan.cut.includes(playerId)) return plan;
  return { ...plan, cut: [...plan.cut, playerId] };
}

export function restorePlayer(plan: RosterPlan, playerId: string): RosterPlan {
  return { ...plan, cut: plan.cut.filter((id) => id !== playerId) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringEntries(value: unknown, allowed?: readonly string[]): Record<string, string> {
  if (!isRecord(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, v] of Object.entries(value)) {
    if (typeof v === "string" && (!allowed || allowed.includes(v))) result[key] = v;
  }
  return result;
}

function pickPlacements(value: unknown): Record<string, PickPlacement> {
  if (!isRecord(value)) return {};
  const result: Record<string, PickPlacement> = {};
  for (const [key, v] of Object.entries(value)) {
    if (
      isRecord(v) &&
      typeof v.position === "string" &&
      PLAN_SECTIONS.includes(v.section as PlanSection)
    ) {
      result[key] = { section: v.section as PlanSection, position: v.position };
    }
  }
  return result;
}

function tryParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Reads a stored plan defensively (storage is user-editable). Before plans
// existed, only column corrections were saved; those seed `positions` so they
// survive the upgrade.
export function parsePlan(raw: string | null, legacyOverrides: string | null): RosterPlan {
  const stored = tryParse(raw);
  if (isRecord(stored)) {
    return {
      positions: stringEntries(stored.positions),
      sections: stringEntries(stored.sections, PLAN_SECTIONS) as Record<string, PlanSection>,
      cut: Array.isArray(stored.cut) ? stored.cut.filter((id): id is string => typeof id === "string") : [],
      picks: pickPlacements(stored.picks),
    };
  }
  return { ...EMPTY_PLAN, positions: stringEntries(tryParse(legacyOverrides)) };
}
