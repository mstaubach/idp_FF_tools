import type { SlotCount } from "./roster-counts";

// How many Starting + Bench players the owner wants at each position column,
// kept per roster in the browser alongside (but separate from) the plan.
export type PositionTargets = Record<string, number>;

export type TargetStatus = "met" | "short";

function isTargetValue(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function targetStatus(count: number, target: number | undefined): TargetStatus | null {
  if (target === undefined) return null;
  return count >= target ? "met" : "short";
}

// Applies the raw text of a target input. Emptying the input clears the
// target; anything that isn't a non-negative whole number is ignored.
export function setTarget(targets: PositionTargets, position: string, raw: string): PositionTargets {
  if (raw.trim() === "") {
    if (!(position in targets)) return targets;
    const next = { ...targets };
    delete next[position];
    return next;
  }
  const value = Number(raw);
  if (!isTargetValue(value)) return targets;
  return { ...targets, [position]: value };
}

// Reads stored targets defensively (storage is user-editable).
export function parseTargets(raw: string | null): PositionTargets {
  if (!raw) return {};
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return {};
  const result: PositionTargets = {};
  for (const [key, value] of Object.entries(stored)) {
    if (isTargetValue(value)) result[key] = value;
  }
  return result;
}

// Every Starting + Bench player against the sum of the targets, for the
// summary badge. Null until at least one target is set. Stored targets for
// columns the league no longer has are left out, since they aren't shown.
export function totalTarget(
  activeCounts: Record<string, number>,
  targets: PositionTargets,
): SlotCount | null {
  const values = Object.entries(targets)
    .filter(([pos]) => pos in activeCounts)
    .map(([, n]) => n);
  if (values.length === 0) return null;
  return {
    used: Object.values(activeCounts).reduce((sum, n) => sum + n, 0),
    total: values.reduce((sum, n) => sum + n, 0),
  };
}
