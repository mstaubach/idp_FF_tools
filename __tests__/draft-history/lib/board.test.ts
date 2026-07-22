import { describe, expect, it } from "vitest";
import { buildDraftHistory, buildTeamDirectory, selectRookieDrafts, slotLabel } from "@/lib/draft-history/board";
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

interface DraftShape {
  id?: string;
  rounds?: number;
  playerType?: number;
}

// Two-team league: roster 1 owned by Alice (team name "Alpha ", padded the way
// Sleeper sometimes returns it), roster 2 owned by Bravo (no team_name set).
function seasonInput(
  season: string,
  picks: DraftPickResult[],
  shape: DraftShape = {},
): SeasonInput {
  return {
    league: league(season),
    draft: {
      draft_id: shape.id ?? `D${season}`,
      season,
      league_id: `L${season}`,
      status: "complete",
      slot_to_roster_id: { "1": 1, "2": 2 },
      settings: { rounds: shape.rounds ?? 2, player_type: shape.playerType },
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

describe("selectRookieDrafts", () => {
  const ids = (inputs: SeasonInput[]) => inputs.map((i) => i.draft.draft_id);

  // One draft per season, no player_type set: the oldest season is the startup.
  it("drops the startup season when each season has a single draft", () => {
    const inputs = [
      seasonInput("2026", [pick({})]),
      seasonInput("2025", [pick({})]),
      seasonInput("2024", [pick({})]),
    ];
    expect(ids(selectRookieDrafts(inputs))).toEqual(["D2026", "D2025"]);
  });

  // The "Welcome to the Jungle" shape: a veterans-only startup and a
  // rookies-only draft in the same season. player_type says which is which.
  it("keeps the rookie draft when startup and rookie share one season", () => {
    const inputs = [
      seasonInput("2026", [pick({})], { id: "startup", rounds: 41, playerType: 2 }),
      seasonInput("2026", [pick({})], { id: "rookie", rounds: 6, playerType: 1 }),
    ];
    expect(ids(selectRookieDrafts(inputs))).toEqual(["rookie"]);
  });

  // Same split, but the commissioner left player_type at its default. Fall
  // back to size: the long draft is the startup.
  it("treats the longest draft of the oldest season as the startup", () => {
    const inputs = [
      seasonInput("2026", [pick({})], { id: "startup", rounds: 41 }),
      seasonInput("2026", [pick({})], { id: "rookie", rounds: 6 }),
    ];
    expect(ids(selectRookieDrafts(inputs))).toEqual(["rookie"]);
  });

  it("returns nothing for a league whose only draft is its startup", () => {
    expect(selectRookieDrafts([seasonInput("2026", [pick({})])])).toEqual([]);
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

  it("carries drafter and original-owner roster ids on each cell", () => {
    const boards = buildDraftHistory([
      seasonInput("2026", [
        pick({ draft_slot: 2, pick_no: 2, roster_id: 1, player_id: "p2" }),
      ]),
    ]);
    const cell = boards[0].cells[0];
    expect(cell.drafterRosterId).toBe(1);
    expect(cell.originalOwnerRosterId).toBe(2);
  });

  it("nulls originalOwnerRosterId when slot_to_roster_id lacks the slot", () => {
    const input = seasonInput("2026", [pick({})]);
    input.draft.slot_to_roster_id = {};
    const [board] = buildDraftHistory([input]);
    expect(board.cells[0].originalOwnerRosterId).toBeNull();
    expect(board.cells[0].isTraded).toBe(false);
  });

  it("exposes the original owner's roster id per slot column, nulling gaps", () => {
    const input = seasonInput("2026", [pick({})]);
    input.rosters.push({ roster_id: 3, owner_id: null });
    input.draft.slot_to_roster_id = { "1": 1, "2": 2 };
    input.league.total_rosters = 3;
    const [board] = buildDraftHistory([input]);
    expect(board.slotOwnerRosterIds).toEqual([1, 2, null]);
  });
});

describe("slotLabel", () => {
  it("zero-pads the slot number", () => {
    expect(slotLabel(2, 5)).toBe("2.05");
    expect(slotLabel(1, 12)).toBe("1.12");
  });
});

describe("buildTeamDirectory", () => {
  it("names a franchise by its newest-season name after a rename", () => {
    const older = seasonInput("2025", []);
    const newer = seasonInput("2026", []);
    newer.users = [
      {
        user_id: "u1",
        display_name: "Alice",
        avatar: null,
        metadata: { team_name: "Alpha Prime" },
      },
      { user_id: "u2", display_name: "Bravo", avatar: null },
    ];
    const teams = buildTeamDirectory([older, newer]);
    expect(teams).toContainEqual({ rosterId: 1, name: "Alpha Prime" });
  });

  it("includes a franchise that only appears in an older season", () => {
    const older = seasonInput("2025", []);
    older.rosters.push({ roster_id: 3, owner_id: null });
    const teams = buildTeamDirectory([seasonInput("2026", []), older]);
    expect(teams).toContainEqual({ rosterId: 3, name: "Roster 3" });
  });

  it("sorts entries alphabetically by name", () => {
    const teams = buildTeamDirectory([seasonInput("2026", [])]);
    expect(teams.map((t) => t.name)).toEqual(["Alpha", "Bravo"]);
  });
});
