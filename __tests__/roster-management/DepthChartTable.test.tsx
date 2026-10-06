import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import DepthChartTable from "@/components/roster-management/DepthChartTable";
import type { DraftPick } from "@/lib/roster-management/picks";
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

  it("gives draggables the same aria-describedby on every render so SSR hydration matches", () => {
    // dnd-kit falls back to a module-level counter for this id, which keeps
    // climbing on a long-lived server but starts at 0 in the browser.
    const describedBy = () => {
      render(
        <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
      );
      const value = screen.getByText("Nik Bonitto").getAttribute("aria-describedby");
      cleanup();
      return value;
    };
    expect(describedBy()).toBe(describedBy());
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
      positions: {}, sections: {}, cut: [], picks: {},
    });
    expect(window.localStorage.getItem("roster-mgmt:overrides:league1:1")).toBeNull();
    expect(screen.getByText("Justin Herbert")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reset plan" })).toBeNull();
  });

  describe("position targets", () => {
    const renderTable = () =>
      render(
        <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
      );
    const targetInput = (label: string) =>
      screen.getByRole("spinbutton", { name: `${label} target` }) as HTMLInputElement;

    it("renders an empty target input for each position", () => {
      renderTable();
      expect(screen.getByRole("rowheader", { name: "Target" })).toBeTruthy();
      for (const pos of POSITIONS) {
        expect(targetInput(pos).value).toBe("");
        expect(targetInput(pos).dataset.status).toBeUndefined();
      }
    });

    it("marks a target as met when the position count reaches it", () => {
      renderTable();
      fireEvent.change(targetInput("QB"), { target: { value: "1" } });
      expect(targetInput("QB").dataset.status).toBe("met");
      expect(targetInput("QB").className).toContain("text-green");
    });

    it("marks a target as short when the position count is below it", () => {
      renderTable();
      fireEvent.change(targetInput("QB"), { target: { value: "3" } });
      expect(targetInput("QB").dataset.status).toBe("short");
      expect(targetInput("QB").className).toContain("text-red");
    });

    it("re-evaluates the target as the plan changes", () => {
      renderTable();
      fireEvent.change(targetInput("QB"), { target: { value: "1" } });
      fireEvent.click(screen.getByRole("button", { name: "Cut Justin Herbert" }));
      expect(targetInput("QB").dataset.status).toBe("short");
    });

    it("saves targets to storage and reloads them", () => {
      renderTable();
      fireEvent.change(targetInput("LB"), { target: { value: "4" } });
      expect(JSON.parse(window.localStorage.getItem("roster-mgmt:targets:league1:1")!)).toEqual({ LB: 4 });

      cleanup();
      renderTable();
      expect(targetInput("LB").value).toBe("4");
    });

    it("shows a Target badge totaling the targets once one is set", () => {
      renderTable();
      expect(screen.queryByText(/^Target \d/)).toBeNull();
      fireEvent.change(targetInput("QB"), { target: { value: "2" } });
      fireEvent.change(targetInput("LB"), { target: { value: "2" } });
      expect(screen.getByTitle("2 short of target").textContent).toBe("Target 2/4");
    });

    it("keeps targets when the plan is reset", () => {
      renderTable();
      fireEvent.change(targetInput("QB"), { target: { value: "2" } });
      fireEvent.click(screen.getByRole("button", { name: "Cut Justin Herbert" }));
      fireEvent.click(screen.getByRole("button", { name: "Reset plan" }));
      expect(targetInput("QB").value).toBe("2");
    });
  });

  describe("draft picks", () => {
    const PICKS: DraftPick[] = [
      { id: "2027:1:1", season: "2027", round: 1, originalRosterId: 1 },
      { id: "2027:2:4", season: "2027", round: 2, originalRosterId: 4 },
    ];
    const TEAM_NAMES = { 1: "me", 4: "mongo41" };
    const renderWithPicks = () =>
      render(
        <DepthChartTable
          roster={ROSTER} players={PLAYERS} positions={POSITIONS}
          picks={PICKS} draftSeason="2027" teamNames={TEAM_NAMES}
          leagueId="league1" rosterId={1}
        />,
      );
    const placeFirstRoundPick = () =>
      window.localStorage.setItem(
        "roster-mgmt:plan:league1:1",
        JSON.stringify({ picks: { "2027:1:1": { section: "Bench", position: "QB" } } }),
      );

    it("lists the roster's owned picks in a side panel, naming the original team of acquired picks", () => {
      renderWithPicks();
      const panel = screen.getByRole("region", { name: "2027 Picks" });
      expect(panel.textContent).toContain("Rd 1");
      expect(panel.textContent).toContain("Rd 2 · via mongo41");
      expect(panel.textContent).not.toContain("via me");
    });

    it("shows a placed pick in the grid, counts it, and takes it out of the panel", () => {
      placeFirstRoundPick();
      const { container } = renderWithPicks();
      const benchQb = container.querySelector('td[data-section="Bench"][data-position="QB"]');
      expect(benchQb?.textContent).toContain("2027 Rd 1");
      expect(screen.getByRole("columnheader", { name: "QB: 2" })).toBeTruthy();
      const panel = screen.getByRole("region", { name: "2027 Picks" });
      expect(panel.textContent).not.toContain("Rd 1");
    });

    it("returns a placed pick to the panel with its remove button", () => {
      placeFirstRoundPick();
      const { container } = renderWithPicks();
      fireEvent.click(screen.getByRole("button", { name: "Return 2027 Rd 1 to picks" }));
      expect(container.querySelector("table")?.textContent).not.toContain("2027 Rd 1");
      expect(screen.getByRole("region", { name: "2027 Picks" }).textContent).toContain("Rd 1");
      expect(screen.queryByRole("region", { name: "Cut players" })).toBeNull();
    });

    it("says so when every pick has been placed", () => {
      window.localStorage.setItem(
        "roster-mgmt:plan:league1:1",
        JSON.stringify({
          picks: {
            "2027:1:1": { section: "Bench", position: "QB" },
            "2027:2:4": { section: "Bench", position: "LB" },
          },
        }),
      );
      renderWithPicks();
      expect(screen.getByRole("region", { name: "2027 Picks" }).textContent).toContain("All picks placed");
    });

    it("shows no picks panel when no picks are passed", () => {
      render(
        <DepthChartTable roster={ROSTER} players={PLAYERS} positions={POSITIONS} leagueId="league1" rosterId={1} />,
      );
      expect(screen.queryByRole("region", { name: /Picks/ })).toBeNull();
    });
  });
});
