import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import RosterCountsSummary from "@/components/roster-management/RosterCountsSummary";
import type { RosterCounts } from "@/lib/roster-management/roster-counts";

afterEach(cleanup);

describe("RosterCountsSummary", () => {
  it("renders a badge for each section with a nonzero total", () => {
    const counts: RosterCounts = {
      starting: { used: 9, total: 9 },
      bench: { used: 6, total: 8 },
      taxi: { used: 3, total: 4 },
      ir: { used: 1, total: 2 },
    };
    render(<RosterCountsSummary counts={counts} />);
    expect(screen.getByText("Starting 9/9")).toBeTruthy();
    expect(screen.getByText("Bench 6/8")).toBeTruthy();
    expect(screen.getByText("Taxi 3/4")).toBeTruthy();
    expect(screen.getByText("IR 1/2")).toBeTruthy();
  });

  it("hides badges whose total is zero", () => {
    const counts: RosterCounts = {
      starting: { used: 9, total: 9 },
      bench: { used: 6, total: 8 },
      taxi: { used: 0, total: 0 },
      ir: { used: 0, total: 0 },
    };
    render(<RosterCountsSummary counts={counts} />);
    expect(screen.queryByText(/Taxi/)).toBeNull();
    expect(screen.queryByText(/IR/)).toBeNull();
  });

  it("renders nothing when every section total is zero", () => {
    const counts: RosterCounts = {
      starting: { used: 0, total: 0 },
      bench: { used: 0, total: 0 },
      taxi: { used: 0, total: 0 },
      ir: { used: 0, total: 0 },
    };
    const { container } = render(<RosterCountsSummary counts={counts} />);
    expect(container.firstChild).toBeNull();
  });

  it("flags a section that is over its slot limit", () => {
    const counts: RosterCounts = {
      starting: { used: 9, total: 9 },
      bench: { used: 6, total: 8 },
      taxi: { used: 5, total: 4 },
      ir: { used: 0, total: 2 },
    };
    render(<RosterCountsSummary counts={counts} />);
    expect(screen.getByTitle("1 over the limit").textContent).toBe("Taxi 5/4");
    expect(screen.queryAllByTitle(/over the limit/)).toHaveLength(1);
  });

  describe("target badge", () => {
    const counts: RosterCounts = {
      starting: { used: 9, total: 9 },
      bench: { used: 6, total: 8 },
      taxi: { used: 0, total: 0 },
      ir: { used: 0, total: 0 },
    };

    it("is green when the roster meets the target total", () => {
      render(<RosterCountsSummary counts={counts} target={{ used: 15, total: 15 }} />);
      const badge = screen.getByText("Target 15/15");
      expect(badge.className).toContain("text-green");
      expect(badge.getAttribute("title")).toBeNull();
    });

    it("is red and says how many short when the roster is below the target total", () => {
      render(<RosterCountsSummary counts={counts} target={{ used: 15, total: 18 }} />);
      const badge = screen.getByTitle("3 short of target");
      expect(badge.textContent).toBe("Target 15/18");
      expect(badge.className).toContain("text-red");
    });

    it("is hidden when no target is passed", () => {
      render(<RosterCountsSummary counts={counts} />);
      expect(screen.queryByText(/Target/)).toBeNull();
    });

    it("shows even when every section total is zero", () => {
      const empty: RosterCounts = {
        starting: { used: 0, total: 0 },
        bench: { used: 0, total: 0 },
        taxi: { used: 0, total: 0 },
        ir: { used: 0, total: 0 },
      };
      render(<RosterCountsSummary counts={empty} target={{ used: 0, total: 2 }} />);
      expect(screen.getByText("Target 0/2")).toBeTruthy();
    });
  });

  it("shows a section with no slots if players are still in it", () => {
    const counts: RosterCounts = {
      starting: { used: 9, total: 9 },
      bench: { used: 6, total: 8 },
      taxi: { used: 1, total: 0 },
      ir: { used: 0, total: 0 },
    };
    render(<RosterCountsSummary counts={counts} />);
    expect(screen.getByText("Taxi 1/0")).toBeTruthy();
  });
});
