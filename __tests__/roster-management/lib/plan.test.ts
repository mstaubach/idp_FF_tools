import { describe, it, expect } from "vitest";
import {
  EMPTY_PLAN,
  applyDrop,
  cutPlayer,
  isPlanEmpty,
  parsePlan,
  restorePlayer,
  unplacePick,
  type RosterPlan,
} from "@/lib/roster-management/plan";

const BONITTO = { kind: "player", id: "9", eligiblePositions: ["LB", "DL"], section: "Starting", position: "LB" } as const;
const ADAMS = { kind: "player", id: "3", eligiblePositions: ["WR", "WRRB_FLEX"], section: "Bench", position: "WR" } as const;
// A pick dragged from the side panel has no current section or column.
const PICK = { kind: "pick", id: "2027:1:1", eligiblePositions: ["QB", "WR", "WRRB_FLEX"], section: null, position: null } as const;

// ── applyDrop ──────────────────────────────────────────────────────────────

describe("applyDrop", () => {
  it("records the target section and column for the dragged player", () => {
    const next = applyDrop(EMPTY_PLAN, BONITTO, { section: "Taxi", position: "DL" });
    expect(next?.sections).toEqual({ "9": "Taxi" });
    expect(next?.positions).toEqual({ "9": "DL" });
  });

  it("rejects a column the player isn't eligible for", () => {
    expect(applyDrop(EMPTY_PLAN, BONITTO, { section: "Bench", position: "WR" })).toBeNull();
  });

  it("allows Flex as a target only in the Starting section", () => {
    expect(applyDrop(EMPTY_PLAN, ADAMS, { section: "Bench", position: "WRRB_FLEX" })).toBeNull();
    expect(applyDrop(EMPTY_PLAN, ADAMS, { section: "Starting", position: "WRRB_FLEX" })?.sections)
      .toEqual({ "3": "Starting" });
  });

  it("treats a drop back onto the player's current spot as a no-op", () => {
    expect(applyDrop(EMPTY_PLAN, BONITTO, { section: "Starting", position: "LB" })).toBeNull();
  });

  it("does not mutate the plan it was given", () => {
    const plan: RosterPlan = { positions: {}, sections: {}, cut: [], picks: {} };
    applyDrop(plan, BONITTO, { section: "IR", position: "LB" });
    expect(plan).toEqual(EMPTY_PLAN);
  });
});

// ── applyDrop for picks ────────────────────────────────────────────────────

describe("applyDrop for picks", () => {
  it("places a pick from the panel without touching player entries", () => {
    const next = applyDrop(EMPTY_PLAN, PICK, { section: "Taxi", position: "WR" });
    expect(next).toEqual({ ...EMPTY_PLAN, picks: { "2027:1:1": { section: "Taxi", position: "WR" } } });
  });

  it("moves an already placed pick to a new spot", () => {
    const placed = applyDrop(EMPTY_PLAN, PICK, { section: "Taxi", position: "WR" })!;
    const moved = applyDrop(placed, { ...PICK, section: "Taxi", position: "WR" }, { section: "Bench", position: "QB" });
    expect(moved?.picks).toEqual({ "2027:1:1": { section: "Bench", position: "QB" } });
  });

  it("allows Flex for a pick only in the Starting section", () => {
    expect(applyDrop(EMPTY_PLAN, PICK, { section: "Bench", position: "WRRB_FLEX" })).toBeNull();
    expect(applyDrop(EMPTY_PLAN, PICK, { section: "Starting", position: "WRRB_FLEX" })).not.toBeNull();
  });

  it("returns a placed pick to the panel", () => {
    const placed = applyDrop(EMPTY_PLAN, PICK, { section: "Taxi", position: "WR" })!;
    expect(unplacePick(placed, "2027:1:1").picks).toEqual({});
  });
});

// ── cutPlayer / restorePlayer ──────────────────────────────────────────────

describe("cutPlayer / restorePlayer", () => {
  it("adds a player to the cut list once", () => {
    const once = cutPlayer(EMPTY_PLAN, "9");
    expect(cutPlayer(once, "9").cut).toEqual(["9"]);
  });

  it("removes a restored player from the cut list", () => {
    expect(restorePlayer(cutPlayer(EMPTY_PLAN, "9"), "9").cut).toEqual([]);
  });
});

// ── isPlanEmpty ────────────────────────────────────────────────────────────

describe("isPlanEmpty", () => {
  it("is true only when nothing has been moved or cut", () => {
    expect(isPlanEmpty(EMPTY_PLAN)).toBe(true);
    expect(isPlanEmpty(cutPlayer(EMPTY_PLAN, "9"))).toBe(false);
    expect(isPlanEmpty({ ...EMPTY_PLAN, positions: { "9": "DL" } })).toBe(false);
    expect(isPlanEmpty({ ...EMPTY_PLAN, picks: { "2027:1:1": { section: "Taxi", position: "WR" } } })).toBe(false);
  });
});

// ── parsePlan ──────────────────────────────────────────────────────────────

describe("parsePlan", () => {
  it("parses a stored plan", () => {
    const stored: RosterPlan = {
      positions: { "9": "DL" }, sections: { "9": "Taxi" }, cut: ["1"],
      picks: { "2027:1:1": { section: "Taxi", position: "WR" } },
    };
    expect(parsePlan(JSON.stringify(stored), null)).toEqual(stored);
  });

  it("returns an empty plan for missing or malformed storage", () => {
    expect(parsePlan(null, null)).toEqual(EMPTY_PLAN);
    expect(parsePlan("{not json", null)).toEqual(EMPTY_PLAN);
    expect(parsePlan("[1,2]", null)).toEqual(EMPTY_PLAN);
  });

  it("drops unknown section names and non-string entries", () => {
    const raw = JSON.stringify({ positions: { "9": "DL", "8": 4 }, sections: { "9": "Practice" }, cut: ["1", 2] });
    expect(parsePlan(raw, null)).toEqual({ positions: { "9": "DL" }, sections: {}, cut: ["1"], picks: {} });
  });

  it("drops pick placements with an unknown section or a non-string column", () => {
    const raw = JSON.stringify({
      picks: {
        "2027:1:1": { section: "Taxi", position: "WR" },
        "2027:2:1": { section: "Practice", position: "WR" },
        "2027:3:1": { section: "Bench", position: 3 },
        "2027:4:1": "Taxi",
      },
    });
    expect(parsePlan(raw, null).picks).toEqual({ "2027:1:1": { section: "Taxi", position: "WR" } });
  });

  it("loads a plan saved before picks existed", () => {
    expect(parsePlan(JSON.stringify({ positions: {}, sections: {}, cut: ["1"] }), null).picks).toEqual({});
  });

  it("seeds column choices from legacy column corrections when no plan is stored", () => {
    expect(parsePlan(null, JSON.stringify({ "9": "DL" }))).toEqual({ ...EMPTY_PLAN, positions: { "9": "DL" } });
  });

  it("prefers a stored plan over legacy column corrections", () => {
    const stored = JSON.stringify({ positions: {}, sections: {}, cut: ["1"] });
    expect(parsePlan(stored, JSON.stringify({ "9": "DL" }))).toEqual({ ...EMPTY_PLAN, cut: ["1"] });
  });
});
