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

  it("shows the Starting + Bench total next to each position header", () => {
    render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    const headers = screen.getAllByRole("columnheader").map((th) => th.textContent);
    expect(headers).toEqual(["Rank", "QB: 1", "DL: 0", "LB: 1"]);
  });

  it("labels the WRRB_FLEX column as Flex", () => {
    render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={[...POSITIONS, "WRRB_FLEX"]} leagueId="league1" rosterId={1} />,
    );
    const headers = screen.getAllByRole("columnheader").map((th) => th.textContent);
    expect(headers).toContain("Flex: 0");
    expect(headers.some((h) => h?.includes("WRRB_FLEX"))).toBe(false);
  });

  it("marks a dual-eligible player's cell as draggable", () => {
    render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    expect(screen.getByText("Nik Bonitto").getAttribute("data-draggable")).toBe("true");
  });

  it("marks every player's cell as draggable so they can change sections", () => {
    render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    expect(screen.getByText("Justin Herbert").getAttribute("data-draggable")).toBe("true");
  });

  it("cuts a player out of the chart and lists them under Cut", () => {
    const { container } = render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cut Justin Herbert" }));
    expect(container.querySelector("table")?.textContent).not.toContain("Justin Herbert");
    expect(screen.getByRole("columnheader", { name: "QB: 0" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Cut players" }).textContent).toContain("Justin Herbert");
  });

  it("restores a cut player to the chart", () => {
    const { container } = render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cut Justin Herbert" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore Justin Herbert" }));
    expect(container.querySelector("table")?.textContent).toContain("Justin Herbert");
    expect(screen.queryByRole("region", { name: "Cut players" })).toBeNull();
  });

  it("saves the plan to storage and reloads it", () => {
    render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cut Justin Herbert" }));
    expect(JSON.parse(window.localStorage.getItem("roster-mgmt:plan:league1:1")!).cut).toEqual(["1"]);

    cleanup();
    render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    expect(screen.getByRole("region", { name: "Cut players" }).textContent).toContain("Justin Herbert");
  });

  it("updates the section badges as the plan changes", () => {
    render(
      <DepthChartTable
        roster={ROSTER} players={PLAYERS} positions={POSITIONS}
        rosterPositions={["QB", "LB", "BN"]} settings={{}}
        leagueId="league1" rosterId={1}
      />,
    );
    expect(screen.getByText("Starting 2/2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cut Justin Herbert" }));
    expect(screen.getByText("Starting 1/2")).toBeTruthy();
  });

  it("renders an empty Taxi row as a drop target when the league has taxi slots", () => {
    const { container } = render(
      <DepthChartTable
        roster={ROSTER} players={PLAYERS} positions={POSITIONS}
        rosterPositions={["QB", "LB", "BN"]} settings={{ taxi_slots: 3 }}
        leagueId="league1" rosterId={1}
      />,
    );
    expect(container.querySelectorAll('td[data-section="Taxi"]')).toHaveLength(POSITIONS.length);
    expect(container.querySelector('td[data-section="IR"]')).toBeNull();
  });

  it("shows no reset control when there is no saved plan", () => {
    render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    expect(screen.queryByRole("button", { name: "Reset plan" })).toBeNull();
  });

  it("carries over a column correction saved before plans existed", () => {
    window.localStorage.setItem("roster-mgmt:overrides:league1:1", JSON.stringify({ "9": "DL" }));
    const { container } = render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    const dlCell = container.querySelector('td[data-position="DL"]');
    const lbCell = container.querySelector('td[data-position="LB"]');
    expect(dlCell?.textContent).toContain("Nik Bonitto");
    expect(lbCell?.textContent).not.toContain("Nik Bonitto");
  });

  it("resets the plan and clears both the plan and legacy storage keys", () => {
    window.localStorage.setItem("roster-mgmt:overrides:league1:1", JSON.stringify({ "9": "DL" }));
    render(
      <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cut Justin Herbert" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset plan" }));
    expect(JSON.parse(window.localStorage.getItem("roster-mgmt:plan:league1:1")!)).toEqual({
      positions: {}, sections: {}, cut: [],
    });
    expect(window.localStorage.getItem("roster-mgmt:overrides:league1:1")).toBeNull();
    expect(screen.getByText("Justin Herbert")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reset plan" })).toBeNull();
  });
});
