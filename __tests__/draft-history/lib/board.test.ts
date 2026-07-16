import { describe, expect, it } from "vitest";
import { buildDraftHistory, rookieLeagues } from "@/lib/draft-history/board";
import type { SeasonInput } from "@/lib/draft-history/board";
import type { DraftPickResult, League } from "@/lib/draft-history/types";

function league(season: string): League {
  return {
    league_id: `L${season}`,
    name: "Test League",
    season,
    previous_league_id: null,
    draft_id: `D${season}`,
    total_rosters: 2,
  };
}

function pick(overrides: Partial<DraftPickResult>): DraftPickResult {
  return {
    round: 1,
    pick_no: 1,
    draft_slot: 1,
    player_id: "p1",
    roster_id: 1,
    metadata: { first_name: "John", last_name: "Doe", position: "LB", team: "KC" },
    ...overrides,
  };
}

// Two-team league: roster 1 owned by Alice (team name "Alpha ", padded the way
// Sleeper sometimes returns it), roster 2 owned by Bravo (no team_name set).
function seasonInput(season: string, picks: DraftPickResult[]): SeasonInput {
  return {
    league: league(season),
    draft: {
      draft_id: `D${season}`,
      season,
      league_id: `L${season}`,
      status: "complete",
      slot_to_roster_id: { "1": 1, "2": 2 },
      settings: { rounds: 2 },
    },
    picks,
    users: [
      { user_id: "u1", display_name: "Alice", avatar: null, metadata: { team_name: "Alpha " } },
      { user_id: "u2", display_name: "Bravo", avatar: null },
    ],
    rosters: [
      { roster_id: 1, owner_id: "u1" },
      { roster_id: 2, owner_id: "u2" },
    ],
  };
}

describe("rookieLeagues", () => {
  it("drops the startup (oldest) season from a newest-first chain", () => {
    const chain = [league("2026"), league("2025"), league("2024")];
    expect(rookieLeagues(chain).map((l) => l.season)).toEqual(["2026", "2025"]);
  });

  it("returns nothing for a league still in its startup season", () => {
    expect(rookieLeagues([league("2026")])).toEqual([]);
  });
});

describe("buildDraftHistory", () => {
  it("marks a pick made from another franchise's slot as traded", () => {
    const boards = buildDraftHistory([
      seasonInput("2026", [
        pick({ draft_slot: 2, pick_no: 2, roster_id: 1, player_id: "p2" }),
      ]),
    ]);
    expect(boards).toHaveLength(1);
    const cell = boards[0].cells[0];
    expect(cell.isTraded).toBe(true);
    expect(cell.drafterTeamName).toBe("Alpha");
    expect(cell.originalOwnerTeamName).toBe("Bravo");
  });

  it("marks a pick made from the team's own slot as not traded", () => {
    const boards = buildDraftHistory([seasonInput("2026", [pick({})])]);
    const cell = boards[0].cells[0];
    expect(cell.isTraded).toBe(false);
    expect(cell.drafterTeamName).toBe("Alpha");
    expect(cell.originalOwnerTeamName).toBe("Alpha");
  });

  it("resolves slot owners with team_name → display_name → Roster N fallbacks", () => {
    const input = seasonInput("2026", [pick({})]);
    input.rosters.push({ roster_id: 3, owner_id: null });
    input.draft.slot_to_roster_id = { "1": 1, "2": 2, "3": 3 };
    input.league.total_rosters = 3;
    const [board] = buildDraftHistory([input]);
    expect(board.slotOwners).toEqual(["Alpha", "Bravo", "Roster 3"]);
    expect(board.slots).toBe(3);
  });

  it("omits seasons whose draft has no picks", () => {
    const boards = buildDraftHistory([
      seasonInput("2026", []),
      seasonInput("2025", [pick({})]),
    ]);
    expect(boards.map((b) => b.season)).toEqual(["2025"]);
  });

  it("orders boards newest season first", () => {
    const boards = buildDraftHistory([
      seasonInput("2025", [pick({})]),
      seasonInput("2026", [pick({})]),
    ]);
    expect(boards.map((b) => b.season)).toEqual(["2026", "2025"]);
  });

  it("names players from pick metadata, falling back to player id", () => {
    const boards = buildDraftHistory([
      seasonInput("2026", [pick({ metadata: {} })]),
    ]);
    expect(boards[0].cells[0].playerName).toBe("p1");
    expect(boards[0].cells[0].position).toBeNull();
  });

  it("takes round count from draft settings", () => {
    const boards = buildDraftHistory([seasonInput("2026", [pick({})])]);
    expect(boards[0].rounds).toBe(2);
  });
});
