import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import TeamHistoryView from "@/components/draft-history/TeamHistoryView";
import type { BoardCell, SeasonBoard, TeamEntry } from "@/lib/draft-history/board";

afterEach(cleanup);

function cell(overrides: Partial<BoardCell>): BoardCell {
  return {
    round: 1,
    slot: 1,
    pickNo: 1,
    playerName: "Someone",
    position: "LB",
    nflTeam: "SF",
    drafterRosterId: 1,
    drafterTeamName: "Alpha",
    originalOwnerRosterId: 1,
    originalOwnerTeamName: "Alpha",
    isTraded: false,
    ...overrides,
  };
}

const TEAMS: TeamEntry[] = [
  { rosterId: 1, name: "Alpha" },
  { rosterId: 2, name: "Bravo" },
];

// Newest-first, as buildDraftHistory returns them. Alpha drafted in both
// seasons (2026 via a pick acquired from Bravo); Bravo never drafted.
const BOARDS: SeasonBoard[] = [
  {
    season: "2026",
    rounds: 1,
    slots: 2,
    slotOwners: ["Alpha", "Bravo"],
    slotOwnerRosterIds: [1, 2],
    cells: [
      cell({
        slot: 2,
        pickNo: 2,
        playerName: "Trade Guy",
        drafterRosterId: 1,
        drafterTeamName: "Alpha",
        originalOwnerRosterId: 2,
        originalOwnerTeamName: "Bravo",
        isTraded: true,
      }),
      cell({ playerName: "New Guy" }),
    ],
  },
  {
    season: "2025",
    rounds: 1,
    slots: 2,
    slotOwners: ["Alpha", "Bravo"],
    slotOwnerRosterIds: [1, 2],
    cells: [cell({ playerName: "Old Guy" })],
  },
];

describe("TeamHistoryView", () => {
  it("shows the first team's picks across all seasons, newest first", () => {
    render(
      <TeamHistoryView
        boards={BOARDS}
        teams={TEAMS}
        teamIdx={0}
        onSelectTeam={() => {}}
      />,
    );
    const rows = screen.getAllByRole("row").slice(1); // drop header row
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("New Guy"),
      expect.stringContaining("Trade Guy"),
      expect.stringContaining("Old Guy"),
    ]);
    expect(rows[0].textContent).toContain("2026");
    expect(rows[2].textContent).toContain("2025");
  });

  it("formats picks with slotLabel and marks trade-acquired picks with a via note", () => {
    render(
      <TeamHistoryView
        boards={BOARDS}
        teams={TEAMS}
        teamIdx={0}
        onSelectTeam={() => {}}
      />,
    );
    const tradeRow = screen.getByText("Trade Guy").closest("tr") as HTMLElement;
    expect(within(tradeRow).getByText("1.02")).toBeTruthy();
    expect(within(tradeRow).getByText("via Bravo")).toBeTruthy();
    const ownRow = screen.getByText("New Guy").closest("tr") as HTMLElement;
    expect(within(ownRow).getByText("1.01")).toBeTruthy();
    expect(within(ownRow).queryByText(/via/)).toBeNull();
  });

  it("calls onSelectTeam with the picked team's index on change", () => {
    const onSelectTeam = vi.fn();
    render(
      <TeamHistoryView
        boards={BOARDS}
        teams={TEAMS}
        teamIdx={0}
        onSelectTeam={onSelectTeam}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "1" } });
    expect(onSelectTeam).toHaveBeenCalledWith(1);
  });

  it("reflects the selected team as the picker's value", () => {
    render(
      <TeamHistoryView
        boards={BOARDS}
        teams={TEAMS}
        teamIdx={1}
        onSelectTeam={() => {}}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("1");
  });

  it("shows an empty state for a team with no picks", () => {
    render(
      <TeamHistoryView
        boards={BOARDS}
        teams={TEAMS}
        teamIdx={1}
        onSelectTeam={() => {}}
      />,
    );
    expect(screen.queryByText("New Guy")).toBeNull();
    expect(screen.getByText("No rookie picks yet.")).toBeTruthy();
  });

  it("renders the empty state without crashing when teams is empty", () => {
    render(
      <TeamHistoryView
        boards={BOARDS}
        teams={[]}
        teamIdx={0}
        onSelectTeam={() => {}}
      />,
    );
    expect(screen.getByText("No rookie picks yet.")).toBeTruthy();
  });
});
