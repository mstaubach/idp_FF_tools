import { describe, it, expect } from "vitest";
import {
  buildTaxiCandidates,
  deriveEligiblePositions,
} from "@/lib/taxi-filler/filter";
import type { SleeperPlayer, SleeperRoster } from "@/lib/taxi-filler/types";

function makePlayer(overrides: Partial<SleeperPlayer> = {}): SleeperPlayer {
  return {
    player_id: "1",
    first_name: "John",
    last_name: "Doe",
    position: "WR",
    team: "SF",
    age: 22,
    years_exp: 0,
    search_rank: 100,
    active: true,
    ...overrides,
  };
}

const BASE_POSITIONS = ["QB", "RB", "WR", "TE"];

describe("deriveEligiblePositions", () => {
  it("excludes slot-only types", () => {
    expect(
      deriveEligiblePositions(["QB", "RB", "BN", "FLEX", "TAXI", "IR", "IDP_FLEX"]),
    ).toEqual(["QB", "RB"]);
  });

  it("deduplicates positions while preserving first-seen order", () => {
    expect(deriveEligiblePositions(["WR", "QB", "WR", "RB"])).toEqual([
      "WR",
      "QB",
      "RB",
    ]);
  });

  it("returns empty array when all positions are slot-only", () => {
    expect(deriveEligiblePositions(["BN", "FLEX", "TAXI"])).toEqual([]);
  });
});

describe("buildTaxiCandidates", () => {
  it("excludes players on any roster's players array", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      players: ["1"],
      taxi: null,
      reserve: null,
    };
    const players = { "1": makePlayer({ player_id: "1" }) };
    expect(buildTaxiCandidates([roster], players, BASE_POSITIONS, 1)).toEqual(
      [],
    );
  });

  it("excludes players on roster taxi array", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      players: [],
      taxi: ["1"],
      reserve: null,
    };
    const players = { "1": makePlayer({ player_id: "1" }) };
    expect(buildTaxiCandidates([roster], players, BASE_POSITIONS, 1)).toEqual(
      [],
    );
  });

  it("excludes players on roster reserve (IR) array", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      players: [],
      taxi: null,
      reserve: ["1"],
    };
    const players = { "1": makePlayer({ player_id: "1" }) };
    expect(buildTaxiCandidates([roster], players, BASE_POSITIONS, 1)).toEqual(
      [],
    );
  });

  it("ignores Sleeper sentinel '0' in roster arrays", () => {
    const roster: SleeperRoster = {
      roster_id: 1,
      players: ["0"],
      taxi: null,
      reserve: null,
    };
    const players = { "1": makePlayer({ player_id: "1" }) };
    const result = buildTaxiCandidates([roster], players, BASE_POSITIONS, 1);
    expect(result).toHaveLength(1);
  });

  it("excludes players with years_exp >= taxiYears (taxi_years=1 → only rookies)", () => {
    const players = {
      "1": makePlayer({ player_id: "1", years_exp: 1 }),
    };
    expect(buildTaxiCandidates([], players, BASE_POSITIONS, 1)).toEqual([]);
  });

  it("includes rookies (years_exp=0) when taxiYears=1", () => {
    const players = { "1": makePlayer({ player_id: "1", years_exp: 0 }) };
    const result = buildTaxiCandidates([], players, BASE_POSITIONS, 1);
    expect(result).toHaveLength(1);
    expect(result[0].yearsExp).toBe(0);
  });

  it("includes both rookies and 1-year players when taxiYears=2", () => {
    const players = {
      "1": makePlayer({ player_id: "1", years_exp: 0, search_rank: 10 }),
      "2": makePlayer({ player_id: "2", years_exp: 1, search_rank: 20 }),
      "3": makePlayer({ player_id: "3", years_exp: 2, search_rank: 5 }),
    };
    const result = buildTaxiCandidates([], players, BASE_POSITIONS, 2);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.yearsExp).sort()).toEqual([0, 1]);
  });

  it("excludes players whose position is not in leaguePositions", () => {
    const players = { "1": makePlayer({ player_id: "1", position: "K" }) };
    expect(buildTaxiCandidates([], players, BASE_POSITIONS, 1)).toEqual([]);
  });

  it("normalizes granular IDP positions before matching (DE → DL)", () => {
    const idpPositions = [...BASE_POSITIONS, "DL", "LB", "DB"];
    const players = { "1": makePlayer({ player_id: "1", position: "DE" }) };
    const result = buildTaxiCandidates([], players, idpPositions, 1);
    expect(result).toHaveLength(1);
    expect(result[0].position).toBe("DL");
  });

  it("normalizes CB → DB", () => {
    const positions = [...BASE_POSITIONS, "DB"];
    const players = { "1": makePlayer({ player_id: "1", position: "CB" }) };
    const result = buildTaxiCandidates([], players, positions, 1);
    expect(result[0].position).toBe("DB");
  });

  it("normalizes OLB → LB", () => {
    const positions = [...BASE_POSITIONS, "LB"];
    const players = { "1": makePlayer({ player_id: "1", position: "OLB" }) };
    const result = buildTaxiCandidates([], players, positions, 1);
    expect(result[0].position).toBe("LB");
  });

  it("sorts by searchRank ascending", () => {
    const players = {
      "1": makePlayer({ player_id: "1", search_rank: 200 }),
      "2": makePlayer({ player_id: "2", search_rank: 50 }),
    };
    const result = buildTaxiCandidates([], players, BASE_POSITIONS, 1);
    expect(result[0].searchRank).toBe(50);
    expect(result[1].searchRank).toBe(200);
  });

  it("sorts null searchRank players to the bottom", () => {
    const players = {
      "1": makePlayer({ player_id: "1", search_rank: null }),
      "2": makePlayer({ player_id: "2", search_rank: 100 }),
    };
    const result = buildTaxiCandidates([], players, BASE_POSITIONS, 1);
    expect(result[0].searchRank).toBe(100);
    expect(result[1].searchRank).toBeNull();
  });

  it("builds name from first_name + last_name", () => {
    const players = {
      "1": makePlayer({ player_id: "1", first_name: "Patrick", last_name: "Mahomes" }),
    };
    const result = buildTaxiCandidates([], players, BASE_POSITIONS, 1);
    expect(result[0].name).toBe("Patrick Mahomes");
  });

  it("handles null first_name gracefully", () => {
    const players = {
      "1": makePlayer({ player_id: "1", first_name: null, last_name: "Smith" }),
    };
    const result = buildTaxiCandidates([], players, BASE_POSITIONS, 1);
    expect(result[0].name).toBe("Smith");
  });

  it("returns team as null for free agents", () => {
    const players = {
      "1": makePlayer({ player_id: "1", team: null }),
    };
    const result = buildTaxiCandidates([], players, BASE_POSITIONS, 1);
    expect(result[0].team).toBeNull();
  });
});
