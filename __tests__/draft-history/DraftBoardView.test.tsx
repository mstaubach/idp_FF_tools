import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import DraftBoardView from "@/components/draft-history/DraftBoardView";
import type { BoardCell, SeasonBoard } from "@/lib/draft-history/board";

afterEach(cleanup);

const BOARD_2026: SeasonBoard = {
  season: "2026",
  rounds: 1,
  slots: 1,
  slotOwners: ["Alpha"],
  slotOwnerRosterIds: [1],
  cells: [
    {
      round: 1,
      slot: 1,
      pickNo: 1,
      playerName: "New Guy",
      position: "LB",
      nflTeam: "SF",
      drafterRosterId: 1,
      drafterTeamName: "Alpha",
      originalOwnerRosterId: 1,
      originalOwnerTeamName: "Alpha",
      isTraded: false,
    },
  ],
};

const BOARD_2025: SeasonBoard = {
  season: "2025",
  rounds: 1,
  slots: 1,
  slotOwners: ["Bravo"],
  slotOwnerRosterIds: [2],
  cells: [
    {
      round: 1,
      slot: 1,
      pickNo: 1,
      playerName: "Old Guy",
      position: "DL",
      nflTeam: "KC",
      drafterRosterId: 2,
      drafterTeamName: "Bravo",
      originalOwnerRosterId: 2,
      originalOwnerTeamName: "Bravo",
      isTraded: false,
    },
  ],
};

const TEAMS = [
  { rosterId: 1, name: "Alpha" },
  { rosterId: 2, name: "Bravo" },
];

describe("DraftBoardView", () => {
  it("shows the newest season's board initially and swaps on tab click", () => {
    render(<DraftBoardView boards={[BOARD_2026, BOARD_2025]} teams={TEAMS} />);
    expect(screen.getByText("New Guy")).toBeTruthy();
    expect(screen.queryByText("Old Guy")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "2025" }));

    expect(screen.getByText("Old Guy")).toBeTruthy();
    expect(screen.queryByText("New Guy")).toBeNull();
  });

  it("opens the slot history modal with entries from both seasons on cell click", () => {
    render(<DraftBoardView boards={[BOARD_2026, BOARD_2025]} teams={TEAMS} />);

    fireEvent.click(screen.getByText("New Guy"));

    const dialog = screen.getByRole("dialog");
    expect(
      screen.getByRole("heading", { name: "Pick 1.01 through the years" }),
    ).toBeTruthy();
    expect(dialog.textContent).toContain("New Guy");
    expect(dialog.textContent).toContain("Old Guy");
  });

  it("closes the modal on Escape", () => {
    render(<DraftBoardView boards={[BOARD_2026, BOARD_2025]} teams={TEAMS} />);
    fireEvent.click(screen.getByText("New Guy"));
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the modal on backdrop click but not on panel click", () => {
    render(<DraftBoardView boards={[BOARD_2026, BOARD_2025]} teams={TEAMS} />);
    fireEvent.click(screen.getByText("New Guy"));

    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(screen.getByRole("dialog")).toBeTruthy();

    const backdrop = dialog.parentElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as HTMLElement);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("switches to the team view and back", () => {
    render(<DraftBoardView boards={[BOARD_2026, BOARD_2025]} teams={TEAMS} />);
    expect(screen.getByText("New Guy")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "By Team" }));

    // Alpha (first team) drafted New Guy in 2026; season tabs are gone.
    expect(screen.getByRole("combobox")).toHaveValue("0");
    expect(screen.queryByRole("button", { name: "2025" })).toBeNull();
    expect(screen.getByText("New Guy")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "By Season" }));
    expect(screen.getByRole("button", { name: "2025" })).toBeTruthy();
  });

  it("shows the selected team's cross-season picks in team view", () => {
    render(<DraftBoardView boards={[BOARD_2026, BOARD_2025]} teams={TEAMS} />);
    fireEvent.click(screen.getByRole("button", { name: "By Team" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "1" } });

    // Bravo (roster 2) drafted Old Guy in 2025, nothing in 2026.
    expect(screen.getByText("Old Guy")).toBeTruthy();
    expect(screen.queryByText("New Guy")).toBeNull();
  });

  it("groups the season board by drafting team, stacking multiple same-round picks and leaving empty columns for teams with no picks", () => {
    const cell = (overrides: Partial<BoardCell>): BoardCell => ({
      round: 1,
      slot: 1,
      pickNo: 1,
      playerName: "X",
      position: null,
      nflTeam: null,
      drafterRosterId: 1,
      drafterTeamName: "Alpha",
      originalOwnerRosterId: 1,
      originalOwnerTeamName: "Alpha",
      isTraded: false,
      ...overrides,
    });
    // Bravo (slot 2) traded both of their picks to Alpha, so Alpha ends up
    // with two picks in round 1 (their own plus Bravo's traded slot) and
    // Bravo's column has nothing at all.
    const board: SeasonBoard = {
      season: "2026",
      rounds: 2,
      slots: 2,
      slotOwners: ["Alpha", "Bravo"],
      slotOwnerRosterIds: [1, 2],
      cells: [
        cell({ round: 1, slot: 1, pickNo: 1, playerName: "Own R1" }),
        cell({
          round: 1,
          slot: 2,
          pickNo: 2,
          playerName: "Traded In R1",
          originalOwnerRosterId: 2,
          originalOwnerTeamName: "Bravo",
          isTraded: true,
        }),
        cell({ round: 2, slot: 1, pickNo: 3, playerName: "Own R2" }),
        cell({
          round: 2,
          slot: 2,
          pickNo: 4,
          playerName: "Traded In R2",
          originalOwnerRosterId: 2,
          originalOwnerTeamName: "Bravo",
          isTraded: true,
        }),
      ],
    };

    render(<DraftBoardView boards={[board]} teams={TEAMS} />);

    expect(screen.getByText("Own R1")).toBeTruthy();
    expect(screen.getByText("Traded In R1")).toBeTruthy();
    expect(screen.getByText("Own R2")).toBeTruthy();
    expect(screen.getByText("Traded In R2")).toBeTruthy();
    expect(screen.getAllByText("via Bravo")).toHaveLength(2);

    // Bravo traded away every pick, so their column shows the empty state.
    const bravoHeading = screen.getByRole("heading", { name: "Bravo" });
    const bravoColumn = bravoHeading.parentElement as HTMLElement;
    expect(within(bravoColumn).getByText("—")).toBeTruthy();
    expect(within(bravoColumn).queryByText("Own R1")).toBeNull();

    expect(screen.queryByText("Rd")).toBeNull();
  });

  it("persists the selected team across a toggle to season view and back", () => {
    render(<DraftBoardView boards={[BOARD_2026, BOARD_2025]} teams={TEAMS} />);
    fireEvent.click(screen.getByRole("button", { name: "By Team" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "1" } });
    expect(screen.getByText("Old Guy")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "By Season" }));
    fireEvent.click(screen.getByRole("button", { name: "By Team" }));

    // Bravo should still be selected; its pick still shows.
    expect(screen.getByText("Old Guy")).toBeTruthy();
    expect(screen.queryByText("New Guy")).toBeNull();
  });
});
