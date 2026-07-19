/**
 * Plan / entitlement model. This is the seam where paid access plugs in
 * later: a payment provider webhook flips `users.plan`, and feature gates
 * everywhere else ask `canAccess(plan, feature)`.
 */

export const PLANS = ["free", "pro"] as const;
export type Plan = (typeof PLANS)[number];

/** Features that can be gated by plan. Add new gated features here. */
export type Feature = "profile-sync" | "premium-tools";

const FEATURE_MIN_PLAN: Record<Feature, Plan> = {
  "profile-sync": "free",
  "premium-tools": "pro",
};

const PLAN_RANK: Record<Plan, number> = { free: 0, pro: 1 };

export function isPlan(value: unknown): value is Plan {
  return typeof value === "string" && (PLANS as readonly string[]).includes(value);
}

export function planAtLeast(plan: Plan, required: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[required];
}

export function canAccess(plan: Plan, feature: Feature): boolean {
  return planAtLeast(plan, FEATURE_MIN_PLAN[feature]);
}
