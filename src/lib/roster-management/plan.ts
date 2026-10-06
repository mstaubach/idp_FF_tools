import { canPlace, type DepthChartSection } from "./depth-chart";

export type PlanSection = DepthChartSection["label"];

const PLAN_SECTIONS: readonly PlanSection[] = ["Starting", "Bench", "Taxi", "IR"];

// A what-if layer over the live Sleeper roster, kept per roster in the
// browser. Only differences from Sleeper are stored, keyed by player ID.
export type RosterPlan = {
  positions: Record<string, string>; // column the player is shown in
  sections: Record<string, PlanSection>; // section the player is moved to
  cut: string[]; // players planned for release, hidden from the chart
};

export const EMPTY_PLAN: RosterPlan = { positions: {}, sections: {}, cut: [] };

export function isPlanEmpty(plan: RosterPlan): boolean {
  return (
    Object.keys(plan.positions).length === 0 &&
    Object.keys(plan.sections).length === 0 &&
    plan.cut.length === 0
  );
}

export type DragSource = {
  playerId: string;
  eligiblePositions: readonly string[];
  section: PlanSection;
  position: string;
};

export type DropTarget = { section: PlanSection; position: string };

// Returns the updated plan, or null when the drop is invalid or a no-op.
export function applyDrop(plan: RosterPlan, drag: DragSource, target: DropTarget): RosterPlan | null {
  if (!canPlace(drag.eligiblePositions, target.section, target.position)) return null;
  if (drag.section === target.section && drag.position === target.position) return null;
  return {
    ...plan,
    positions: { ...plan.positions, [drag.playerId]: target.position },
    sections: { ...plan.sections, [drag.playerId]: target.section },
  };
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
    };
  }
  return { ...EMPTY_PLAN, positions: stringEntries(tryParse(legacyOverrides)) };
}
