import { describe, it, expect } from "vitest";
import {
  deriveOwnedPicks,
  nextDraftSeason,
  pickId,
  pickLabel,
} from "@/lib/roster-management/picks";
import type { SleeperTradedPick } from "@/lib/roster-management/types";

// ── nextDraftSeason ────────────────────────────────────────────────────────

describe("nextDraftSeason", () => {
  it("uses the league's own season before its draft has finished", () => {
    expect(nextDraftSeason({ season: "2027", status: "pre_draft" })).toBe("2027");
    expect(nextDraftSeason({ season: "2027", status: "drafting" })).toBe("2027");
  });

  it("uses the following season once the league's draft is done", () => {
    expect(nextDraftSeason({ season: "2026", status: "in_season" })).toBe("2027");
    expect(nextDraftSeason({ season: "2026", status: "complete" })).toBe("2027");
  });
});

// ── deriveOwnedPicks ───────────────────────────────────────────────────────

describe("deriveOwnedPicks", () => {
  const base = { rosterId: 1, rosterIds: [1, 2, 3], season: "2027", rounds: 2 };
  const trade = (round: number, original: number, owner: number, season = "2027"): SleeperTradedPick => ({
    season, round, roster_id: original, previous_owner_id: original, owner_id: owner,
  });

  it("gives a roster its own pick in every round when nothing was traded", () => {
    expect(deriveOwnedPicks({ ...base, tradedPicks: [] })).toEqual([
      { id: "2027:1:1", season: "2027", round: 1, originalRosterId: 1 },
      { id: "2027:2:1", season: "2027", round: 2, originalRosterId: 1 },
    ]);
  });

  it("adds acquired picks after the roster's own pick in that round", () => {
    const picks = deriveOwnedPicks({ ...base, tradedPicks: [trade(1, 3, 1), trade(1, 2, 1)] });
    expect(picks.map((p) => p.id)).toEqual(["2027:1:1", "2027:1:2", "2027:1:3", "2027:2:1"]);
  });

  it("drops picks the roster traded away", () => {
    const picks = deriveOwnedPicks({ ...base, tradedPicks: [trade(2, 1, 3)] });
    expect(picks.map((p) => p.id)).toEqual(["2027:1:1"]);
  });

  it("keeps a pick that was traded away and later traded back", () => {
    const picks = deriveOwnedPicks({ ...base, tradedPicks: [trade(2, 1, 1)] });
    expect(picks.map((p) => p.id)).toEqual(["2027:1:1", "2027:2:1"]);
  });

  it("ignores trades of picks in other seasons", () => {
    const picks = deriveOwnedPicks({ ...base, tradedPicks: [trade(1, 1, 3, "2028"), trade(1, 2, 1, "2028")] });
    expect(picks.map((p) => p.id)).toEqual(["2027:1:1", "2027:2:1"]);
  });
});

// ── pickId / pickLabel ─────────────────────────────────────────────────────

describe("pickId / pickLabel", () => {
  it("keys a pick by season, round, and original roster", () => {
    expect(pickId("2027", 1, 4)).toBe("2027:1:4");
  });

  it("labels a pick with its season and round", () => {
    expect(pickLabel({ id: "2027:2:4", season: "2027", round: 2, originalRosterId: 4 })).toBe("2027 Rd 2");
  });
});
