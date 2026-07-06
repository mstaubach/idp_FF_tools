import { describe, it, expect } from "vitest";
import { computeRosterCounts } from "@/lib/roster-management/roster-counts";
import type { SleeperPlayer, SleeperRoster } from "@/lib/roster-management/types";

const PLAYERS: Record<string, SleeperPlayer> = {
  "1": { player_id: "1", first_name: "Justin", last_name: "Herbert", position: "QB" },
  "2": { player_id: "2", first_name: "Christian", last_name: "McCaffrey", position: "RB" },
  "3": { player_id: "3", first_name: "Davante", last_name: "Adams", position: "WR" },
  "4": { player_id: "4", first_name: "Travis", last_name: "Kelce", position: "TE" },
};

const ROSTER_POSITIONS = ["QB", "RB", "WR", "TE", "FLEX", "BN", "BN", "BN"];

describe("computeRosterCounts", () => {
  it("counts starting slots used vs total, ignoring empty '0' slots", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["1", "2", "0"], players: ["1", "2"], taxi: null, reserve: null,
    };
    const counts = computeRosterCounts(roster, PLAYERS, ROSTER_POSITIONS, {});
    expect(counts.starting).toEqual({ used: 2, total: 3 });
  });

  it("counts bench slots from players not in starters, taxi, or reserve", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: ["1"], players: ["1", "3", "4"], taxi: null, reserve: null,
    };
    const counts = computeRosterCounts(roster, PLAYERS, ROSTER_POSITIONS, {});
    expect(counts.bench).toEqual({ used: 2, total: 3 });
  });

  it("counts taxi slots against the league's taxi_slots setting", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: [], players: ["3"], taxi: ["3"], reserve: null,
    };
    const counts = computeRosterCounts(roster, PLAYERS, ROSTER_POSITIONS, { taxi_slots: 4 });
    expect(counts.taxi).toEqual({ used: 1, total: 4 });
  });

  it("counts IR slots against the league's reserve_slots setting", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: [], players: ["4"], taxi: null, reserve: ["4"],
    };
    const counts = computeRosterCounts(roster, PLAYERS, ROSTER_POSITIONS, { reserve_slots: 2 });
    expect(counts.ir).toEqual({ used: 1, total: 2 });
  });

  it("reports a zero total when the league has no taxi or IR settings", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: [], players: [], taxi: null, reserve: null,
    };
    const counts = computeRosterCounts(roster, PLAYERS, ROSTER_POSITIONS, {});
    expect(counts.taxi).toEqual({ used: 0, total: 0 });
    expect(counts.ir).toEqual({ used: 0, total: 0 });
  });

  it("excludes unknown player ids and the '0' sentinel from used counts", () => {
    const roster: SleeperRoster = {
      roster_id: 1, owner_id: "u1",
      starters: [], players: [], taxi: ["999", "0"], reserve: null,
    };
    const counts = computeRosterCounts(roster, PLAYERS, ROSTER_POSITIONS, { taxi_slots: 4 });
    expect(counts.taxi).toEqual({ used: 0, total: 4 });
  });
});
