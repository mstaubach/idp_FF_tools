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
});
