import { describe, it, expect } from "vitest";
import { parseTargets, setTarget, targetStatus, totalTarget } from "@/lib/roster-management/targets";

// ── targetStatus ───────────────────────────────────────────────────────────

describe("targetStatus", () => {
  it("is met when the count reaches the target", () => {
    expect(targetStatus(3, 3)).toBe("met");
  });

  it("is met when the count is over the target", () => {
    expect(targetStatus(4, 3)).toBe("met");
  });

  it("is short when the count is below the target", () => {
    expect(targetStatus(2, 3)).toBe("short");
  });

  it("is null when no target is set", () => {
    expect(targetStatus(2, undefined)).toBeNull();
  });
});

// ── setTarget ──────────────────────────────────────────────────────────────

describe("setTarget", () => {
  it("sets a target from the input's text", () => {
    expect(setTarget({}, "QB", "3")).toEqual({ QB: 3 });
  });

  it("allows a target of zero", () => {
    expect(setTarget({ QB: 3 }, "QB", "0")).toEqual({ QB: 0 });
  });

  it("clears the target when the input is emptied", () => {
    expect(setTarget({ QB: 3, LB: 5 }, "QB", "")).toEqual({ LB: 5 });
  });

  it("ignores negative or fractional input", () => {
    const targets = { QB: 3 };
    expect(setTarget(targets, "QB", "-1")).toBe(targets);
    expect(setTarget(targets, "QB", "2.5")).toBe(targets);
  });
});

// ── parseTargets ───────────────────────────────────────────────────────────

describe("parseTargets", () => {
  it("reads stored targets", () => {
    expect(parseTargets(JSON.stringify({ QB: 3, LB: 5 }))).toEqual({ QB: 3, LB: 5 });
  });

  it("returns no targets when nothing is stored", () => {
    expect(parseTargets(null)).toEqual({});
  });

  it("returns no targets for malformed JSON or a non-object", () => {
    expect(parseTargets("{not json")).toEqual({});
    expect(parseTargets("[3, 5]")).toEqual({});
  });

  it("drops entries that aren't non-negative whole numbers", () => {
    expect(parseTargets(JSON.stringify({ QB: 3, RB: -1, WR: 2.5, TE: "2", DL: 0 }))).toEqual({ QB: 3, DL: 0 });
  });
});

// ── totalTarget ────────────────────────────────────────────────────────────

describe("totalTarget", () => {
  it("sums the targets against the Starting + Bench slots", () => {
    expect(totalTarget({ QB: 3, LB: 6 }, ["QB", "RB", "LB"], 32)).toEqual({ used: 9, total: 32 });
  });

  it("is null when no targets are set", () => {
    expect(totalTarget({}, ["QB"], 32)).toBeNull();
  });

  it("ignores stored targets for columns the league doesn't have", () => {
    expect(totalTarget({ QB: 2, K: 1 }, ["QB"], 32)).toEqual({ used: 2, total: 32 });
    expect(totalTarget({ K: 1 }, ["QB"], 32)).toBeNull();
  });
});
