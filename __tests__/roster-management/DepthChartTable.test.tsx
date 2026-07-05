import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import DepthChartTable from "@/components/roster-management/DepthChartTable";
import type { SleeperPlayer, SleeperRoster } from "@/lib/roster-management/types";

afterEach(cleanup);
beforeEach(() => window.localStorage.clear());

const POSITIONS = ["QB", "DL", "LB"];

const PLAYERS: Record<string, SleeperPlayer> = {
  "1": { player_id: "1", first_name: "Justin", last_name: "Herbert", position: "QB", fantasy_positions: ["QB"] },
  "9": { player_id: "9", first_name: "Nik", last_name: "Bonitto", position: "LB", fantasy_positions: ["LB", "DL"] },
};

const ROSTER: SleeperRoster = {
  roster_id: 1, owner_id: "u1",
  starters: ["1", "9"], players: ["1", "9"], taxi: null, reserve: null,
};

describe("DepthChartTable", () => {
  it("renders full player names in their default columns", () => {
    render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    expect(screen.getByText("Justin Herbert")).toBeTruthy();
    expect(screen.getByText("Nik Bonitto")).toBeTruthy();
  });

  it("marks a dual-eligible player's cell as draggable", () => {
    render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    expect(screen.getByText("Nik Bonitto").getAttribute("data-draggable")).toBe("true");
  });

  it("does not mark a single-position player's cell as draggable", () => {
    render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    expect(screen.getByText("Justin Herbert").getAttribute("data-draggable")).toBeNull();
  });

  it("shows no reset control when there are no saved corrections", () => {
    render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    expect(screen.queryByRole("button", { name: "Reset corrections" })).toBeNull();
  });

  it("renders a loaded correction in its overridden column", () => {
    window.localStorage.setItem("roster-mgmt:overrides:league1:1", JSON.stringify({ "9": "DL" }));
    const { container } = render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    const dlCell = container.querySelector('td[data-position="DL"]');
    const lbCell = container.querySelector('td[data-position="LB"]');
    expect(dlCell?.textContent).toContain("Nik Bonitto");
    expect(lbCell?.textContent).not.toContain("Nik Bonitto");
  });

  it("shows and clears a reset control when a correction is loaded from storage", () => {
    window.localStorage.setItem("roster-mgmt:overrides:league1:1", JSON.stringify({ "9": "DL" }));
    render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    const resetButton = screen.getByRole("button", { name: "Reset corrections" });
    fireEvent.click(resetButton);
    expect(window.localStorage.getItem("roster-mgmt:overrides:league1:1")).toBe(JSON.stringify({}));
    expect(screen.queryByRole("button", { name: "Reset corrections" })).toBeNull();
  });
});
