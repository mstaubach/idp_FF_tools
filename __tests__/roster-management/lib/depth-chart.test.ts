import { describe, it, expect } from "vitest";
import {
  buildDepthChart,
  derivePositionColumns,
  normalizePosition,
} from "@/lib/roster-management/depth-chart";
import type { SleeperRoster, SleeperPlayer } from "@/lib/roster-management/types";

// ── derivePositionColumns ──────────────────────────────────────────────────

describe("derivePositionColumns", () => {
  it("removes slot-only types and deduplicates, preserving order", () => {
    const input = [
      "QB", "RB", "RB", "WR", "WR", "WR", "TE",
      "FLEX", "K", "BN", "BN", "TAXI", "DL", "LB", "DB", "IDP_FLEX",
    ];
    expect(derivePositionColumns(input)).toEqual([
      "QB", "RB", "WR", "TE", "K", "DL", "LB", "DB",
    ]);
  });

  it("returns empty array when all entries are slot-only", () => {
    expect(derivePositionColumns(["BN", "FLEX", "TAXI"])).toEqual([]);
  });
});

// ── normalizePosition ──────────────────────────────────────────────────────

describe("normalizePosition", () => {
  it("maps DE to DL", () => expect(normalizePosition("DE")).toBe("DL"));
  it("maps DT to DL", () => expect(normalizePosition("DT")).toBe("DL"));
  it("maps CB to DB", () => expect(normalizePosition("CB")).toBe("DB"));
  it("maps S to DB", () => expect(normalizePosition("S")).toBe("DB"));
  it("maps OLB to LB", () => expect(normalizePosition("OLB")).toBe("LB"));
  it("maps MLB to LB", () => expect(normalizePosition("MLB")).toBe("LB"));
  it("passes QB through unchanged", () => expect(normalizePosition("QB")).toBe("QB"));
  it("passes DL through unchanged", () => expect(normalizePosition("DL")).toBe("DL"));
  it("returns null for null input", () => expect(normalizePosition(null)).toBeNull());
});

// ── buildDepthChart ────────────────────────────────────────────────────────

const POSITIONS = ["QB", "RB", "WR", "TE", "DL", "LB", "DB"];

const PLAYERS: Record<string, SleeperPlayer> = {
  "1": { player_id: "1", first_name: "Justin", last_name: "Herbert", position: "QB" },
  "2": { player_id: "2", first_name: "Christian", last_name: "McCaffrey", position: "RB" },
  "3": { player_id: "3", first_name: "Davante", last_name: "Adams", position: "WR" },
  "4": { player_id: "4", first_name: "Travis", last_name: "Kelce", position: "TE" },
  "5": { player_id: "5", first_name: "Tyler", last_name: "Williams", position: "WR" },
  "6": { player_id: "6", first_name: "Garrett", last_name: "Williams", position: "DB" },
  "7": { player_id: "7", first_name: "Micah", last_name: "Parsons", position: "LB" },
  "8": { player_id: "8", first_name: "Myles", last_name: "Garrett", position: "DE" },
};

describe("buildDepthChart", () => {
  it("assigns starters to Starting section in correct position columns", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: ["1", "2", "3"],
      players: ["1", "2", "3"],
      taxi: null,
      reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting).toBeDefined();
    expect(starting.rows[0][POSITIONS.indexOf("QB")]).toBe("Herbert");
    expect(starting.rows[0][POSITIONS.indexOf("RB")]).toBe("McCaffrey");
    expect(starting.rows[0][POSITIONS.indexOf("WR")]).toBe("Adams");
  });

  it("assigns non-starter non-taxi non-reserve players to Bench", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: ["1"],
      players: ["1", "4"],
      taxi: null,
      reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const bench = grid.sections.find((s) => s.label === "Bench")!;
    expect(bench).toBeDefined();
    expect(bench.rows[0][POSITIONS.indexOf("TE")]).toBe("Kelce");
  });

  it("ignores empty starter slots ('0')", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: ["1", "0", "0"],
      players: ["1"],
      taxi: null,
      reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting.rows).toHaveLength(1);
  });

  it("omits sections that have no players", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: ["1"],
      players: ["1"],
      taxi: null,
      reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const labels = grid.sections.map((s) => s.label);
    expect(labels).not.toContain("Taxi");
    expect(labels).not.toContain("IR");
    expect(labels).not.toContain("Bench");
  });

  it("assigns taxi players to Taxi section", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: [],
      players: ["7"],
      taxi: ["7"],
      reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const taxi = grid.sections.find((s) => s.label === "Taxi")!;
    expect(taxi).toBeDefined();
    expect(taxi.rows[0][POSITIONS.indexOf("LB")]).toBe("Parsons");
  });

  it("assigns reserve players to IR section", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: [],
      players: ["4"],
      taxi: null,
      reserve: ["4"],
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const ir = grid.sections.find((s) => s.label === "IR")!;
    expect(ir).toBeDefined();
    expect(ir.rows[0][POSITIONS.indexOf("TE")]).toBe("Kelce");
  });

  it("disambiguates players sharing a last name with first initial", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: ["5"],
      players: ["5", "6"],
      taxi: null,
      reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    // Both Williams are on the roster so both get first-initial prefix
    expect(starting.rows[0][POSITIONS.indexOf("WR")]).toBe("T. Williams");
  });

  it("maps DE to the DL column via normalizePosition", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: ["8"],
      players: ["8"],
      taxi: null,
      reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting.rows[0][POSITIONS.indexOf("DL")]).toBe("Garrett");
  });

  it("builds multiple rows when a position has more than one player in a section", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: ["3", "5"],   // two WRs
      players: ["3", "5"],
      taxi: null,
      reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting.rows).toHaveLength(2);
    // Second row: WR cell filled, QB cell null
    expect(starting.rows[1][POSITIONS.indexOf("QB")]).toBeNull();
    expect(starting.rows[1][POSITIONS.indexOf("WR")]).not.toBeNull();
  });

  it("skips players whose position is not in the positions list", () => {
    const kicker: SleeperPlayer = {
      player_id: "99",
      first_name: "Justin",
      last_name: "Tucker",
      position: "K",
    };
    const roster: SleeperRoster = {
      roster_id: 1,
      owner_id: "u1",
      starters: ["99"],
      players: ["99"],
      taxi: null,
      reserve: null,
    };
    // POSITIONS does not include K
    const grid = buildDepthChart(roster, { "99": kicker }, POSITIONS);
    // No sections because the only player has no column
    expect(grid.sections).toHaveLength(0);
  });
});
