import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import DraftBoardView from "@/components/draft-history/DraftBoardView";
import type { SeasonBoard } from "@/lib/draft-history/board";

afterEach(cleanup);

const BOARD_2026: SeasonBoard = {
  season: "2026",
  rounds: 1,
  slots: 1,
  slotOwners: ["Alpha"],
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

describe("DraftBoardView", () => {
  it("shows the newest season's board initially and swaps on tab click", () => {
    render(<DraftBoardView boards={[BOARD_2026, BOARD_2025]} />);
    expect(screen.getByText("New Guy")).toBeTruthy();
    expect(screen.queryByText("Old Guy")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "2025" }));

    expect(screen.getByText("Old Guy")).toBeTruthy();
    expect(screen.queryByText("New Guy")).toBeNull();
  });

  it("opens the slot history modal with entries from both seasons on cell click", () => {
    render(<DraftBoardView boards={[BOARD_2026, BOARD_2025]} />);

    fireEvent.click(screen.getByText("New Guy"));

    const dialog = screen.getByRole("dialog");
    expect(
      screen.getByRole("heading", { name: "Pick 1.01 through the years" }),
    ).toBeTruthy();
    expect(dialog.textContent).toContain("New Guy");
    expect(dialog.textContent).toContain("Old Guy");
  });

  it("closes the modal on Escape", () => {
    render(<DraftBoardView boards={[BOARD_2026, BOARD_2025]} />);
    fireEvent.click(screen.getByText("New Guy"));
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the modal on backdrop click but not on panel click", () => {
    render(<DraftBoardView boards={[BOARD_2026, BOARD_2025]} />);
    fireEvent.click(screen.getByText("New Guy"));

    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(screen.getByRole("dialog")).toBeTruthy();

    const backdrop = dialog.parentElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as HTMLElement);

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
