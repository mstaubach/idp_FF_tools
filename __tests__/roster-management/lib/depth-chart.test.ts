import { describe, it, expect } from "vitest";
import {
  buildDepthChart,
  derivePositionColumns,
  derivePlayerEligiblePositions,
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

// ── derivePlayerEligiblePositions ──────────────────────────────────────────

const POSITIONS = ["QB", "RB", "WR", "TE", "DL", "LB", "DB"];

describe("derivePlayerEligiblePositions", () => {
  it("normalizes and dedupes fantasy_positions", () => {
    const player: SleeperPlayer = {
      player_id: "9", first_name: "Nik", last_name: "Bonitto",
      position: "LB", fantasy_positions: ["OLB", "DE"],
    };
    // OLB -> LB, DE -> DL
    expect(derivePlayerEligiblePositions(player, POSITIONS)).toEqual(["LB", "DL"]);
  });

  it("falls back to the single position field when fantasy_positions is missing", () => {
    const player: SleeperPlayer = {
      player_id: "8", first_name: "Myles", last_name: "Garrett", position: "DE",
    };
    expect(derivePlayerEligiblePositions(player, POSITIONS)).toEqual(["DL"]);
  });

  it("falls back to the single position field when fantasy_positions is empty", () => {
    const player: SleeperPlayer = {
      player_id: "8", first_name: "Myles", last_name: "Garrett", position: "DE",
      fantasy_positions: [],
    };
    expect(derivePlayerEligiblePositions(player, POSITIONS)).toEqual(["DL"]);
  });

  it("excludes positions not in the league's column list", () => {
    const player: SleeperPlayer = {
      player_id: "99", first_name: "Justin", last_name: "Tucker",
      position: "K", fantasy_positions: ["K"],
    };
    expect(derivePlayerEligiblePositions(player, POSITIONS)).toEqual([]);
  });
});

// ── buildDepthChart ────────────────────────────────────────────────────────

const PLAYERS: Record<string, SleeperPlayer> = {
  "1": { player_id: "1", first_name: "Justin", last_name: "Herbert", position: "QB", fantasy_positions: ["QB"] },
  "2": { player_id: "2", first_name: "Christian", last_name: "McCaffrey", position: "RB", fantasy_positions: ["RB"] },
  "3": { player_id: "3", first_name: "Davante", last_name: "Adams", position: "WR", fantasy_positions: ["WR"] },
  "4": { player_id: "4", first_name: "Travis", last_name: "Kelce", position: "TE", fantasy_positions: ["TE"] },
  "5": { player_id: "5", first_name: "Tyler", last_name: "Williams", position: "WR", fantasy_positions: ["WR"] },
  "6": { player_id: "6", first_name: "Garrett", last_name: "Williams", position: "DB", fantasy_positions: ["CB"] },
  "7": { player_id: "7", first_name: "Micah", last_name: "Parsons", position: "LB", fantasy_positions: ["OLB"] },
  "8": { player_id: "8", first_name: "Myles", last_name: "Garrett", position: "DE", fantasy_positions: ["DE"] },
  "9": { player_id: "9", first_name: "Nik", last_name: "Bonitto", position: "LB", fantasy_positions: ["LB", "DL"] },
  "10": { player_id: "10", first_name: "Kyle", last_name: "Juszczyk", position: "FB", fantasy_positions: ["RB", "TE"] },
};

describe("buildDepthChart", () => {
  it("assigns starters to Starting section in correct position columns", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["1", "2", "3"], players: ["1", "2", "3"],
      taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting).toBeDefined();
    expect(starting.rows[0][POSITIONS.indexOf("QB")]?.displayName).toBe("Justin Herbert");
    expect(starting.rows[0][POSITIONS.indexOf("RB")]?.displayName).toBe("Christian McCaffrey");
    expect(starting.rows[0][POSITIONS.indexOf("WR")]?.displayName).toBe("Davante Adams");
  });

  it("assigns non-starter non-taxi non-reserve players to Bench", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["1"], players: ["1", "4"],
      taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const bench = grid.sections.find((s) => s.label === "Bench")!;
    expect(bench).toBeDefined();
    expect(bench.rows[0][POSITIONS.indexOf("TE")]?.displayName).toBe("Travis Kelce");
  });

  it("ignores empty starter slots ('0')", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["1", "0", "0"], players: ["1"],
      taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting.rows).toHaveLength(1);
  });

  it("omits sections that have no players", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["1"], players: ["1"],
      taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const labels = grid.sections.map((s) => s.label);
    expect(labels).not.toContain("Taxi");
    expect(labels).not.toContain("IR");
    expect(labels).not.toContain("Bench");
  });

  it("assigns taxi players to Taxi section", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: [], players: ["7"], taxi: ["7"], reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const taxi = grid.sections.find((s) => s.label === "Taxi")!;
    expect(taxi).toBeDefined();
    expect(taxi.rows[0][POSITIONS.indexOf("LB")]?.displayName).toBe("Micah Parsons");
  });

  it("assigns reserve players to IR section", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: [], players: ["4"], taxi: null, reserve: ["4"],
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const ir = grid.sections.find((s) => s.label === "IR")!;
    expect(ir).toBeDefined();
    expect(ir.rows[0][POSITIONS.indexOf("TE")]?.displayName).toBe("Travis Kelce");
  });

  it("shows each player's full first and last name", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["5"], players: ["5", "6"], taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting.rows[0][POSITIONS.indexOf("WR")]?.displayName).toBe("Tyler Williams");
  });

  it("maps DE to the DL column via normalizePosition", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["8"], players: ["8"], taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting.rows[0][POSITIONS.indexOf("DL")]?.displayName).toBe("Myles Garrett");
  });

  it("builds multiple rows when a position has more than one player in a section", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["3", "5"], players: ["3", "5"], taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting.rows).toHaveLength(2);
    expect(starting.rows[1][POSITIONS.indexOf("QB")]).toBeNull();
    expect(starting.rows[1][POSITIONS.indexOf("WR")]).not.toBeNull();
  });

  it("skips players whose position is not in the positions list", () => {
    const kicker: SleeperPlayer = {
      player_id: "99", first_name: "Justin", last_name: "Tucker", position: "K",
    };
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["99"], players: ["99"], taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, { "99": kicker }, POSITIONS);
    expect(grid.sections).toHaveLength(0);
  });

  it("reports a dual-eligible player's eligiblePositions on their cell", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["9"], players: ["9"], taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    // Defaults to LB (their primary `position` field)
    const cell = starting.rows[0][POSITIONS.indexOf("LB")];
    expect(cell?.playerId).toBe("9");
    expect(cell?.eligiblePositions).toEqual(["LB", "DL"]);
  });

  it("moves a dual-eligible player to their override column", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["9"], players: ["9"], taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS, { "9": "DL" });
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting.rows[0][POSITIONS.indexOf("DL")]?.playerId).toBe("9");
    expect(starting.rows[0][POSITIONS.indexOf("LB")]).toBeNull();
  });

  it("ignores an override that isn't one of the player's eligible positions", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["9"], players: ["9"], taxi: null, reserve: null,
    };
    // "9" is only eligible for LB/DL - a "WR" override should be ignored.
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS, { "9": "WR" });
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    expect(starting.rows[0][POSITIONS.indexOf("LB")]?.playerId).toBe("9");
    expect(starting.rows[0][POSITIONS.indexOf("WR")]).toBeNull();
  });

  it("falls back to eligiblePositions[0] when the player's own position field isn't a valid default", () => {
    // "10" has position: "FB" (not in POSITIONS, and no POSITION_MAP entry, so
    // normalizePosition("FB") passes through as "FB" - not a valid default),
    // but fantasy_positions ["RB", "TE"] are both valid columns. With no
    // override supplied, assignedPos must fall back to eligiblePositions[0].
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["10"], players: ["10"], taxi: null, reserve: null,
    };
    const grid = buildDepthChart(roster, PLAYERS, POSITIONS);
    const starting = grid.sections.find((s) => s.label === "Starting")!;
    const cell = starting.rows[0][POSITIONS.indexOf("RB")];
    expect(cell?.playerId).toBe("10");
    expect(cell?.displayName).toBe("Kyle Juszczyk");
    expect(cell?.eligiblePositions).toEqual(["RB", "TE"]);
    expect(starting.rows[0][POSITIONS.indexOf("TE")]).toBeNull();
  });
});
