import { describe, it, expect } from 'vitest';
import {
  championOwnerId,
  buildSeasonStandings,
  buildLeagueHistory,
} from '@/lib/standings/history';
import type { SeasonInput } from '@/lib/standings/types';

// Helpers to build raw season inputs concisely.
function roster(roster_id: number, owner_id: string | null, w: number, l: number, t = 0, fpts = 0) {
  return { roster_id, owner_id, settings: { wins: w, losses: l, ties: t, fpts } };
}
function user(user_id: string, team_name: string, display_name = user_id) {
  return { user_id, display_name, metadata: { team_name } };
}

// A 4-team season. Roster 1 (alice) wins the title.
function season2024(): SeasonInput {
  return {
    league: { league_id: 'L24', name: 'Dynasty', season: '2024', previous_league_id: null, total_rosters: 4, status: 'complete' },
    rosters: [roster(1, 'alice', 10, 4, 0, 1500), roster(2, 'bob', 8, 6, 0, 1400), roster(3, 'carol', 6, 8, 0, 1300), roster(4, 'dave', 4, 10, 0, 1200)],
    users: [user('alice', 'Alice FC'), user('bob', 'Bob United'), user('carol', 'Carol City'), user('dave', 'Dave Rovers')],
    bracket: [{ r: 1, m: 1, t1: 1, t2: 4, w: 1, l: 4 }, { r: 1, m: 2, t1: 2, t2: 3, w: 2, l: 3 }, { r: 2, m: 3, t1: 1, t2: 2, w: 1, l: 2, p: 1 }],
  };
}

describe('championOwnerId', () => {
  it('returns the owner of the roster that won the p===1 match', () => {
    const s = season2024();
    expect(championOwnerId(s.bracket, s.rosters)).toBe('alice');
  });

  it('returns null when no final is decided', () => {
    const s = season2024();
    const undecided = s.bracket.map((m) => (m.p === 1 ? { ...m, w: null } : m));
    expect(championOwnerId(undecided, s.rosters)).toBeNull();
  });

  it('returns null when there is no championship match', () => {
    expect(championOwnerId([], season2024().rosters)).toBeNull();
  });
});

describe('buildSeasonStandings', () => {
  it('ranks rows by wins desc, then losses asc, then fpts desc', () => {
    const s = buildSeasonStandings(season2024());
    expect(s.rows.map((r) => r.ownerId)).toEqual(['alice', 'bob', 'carol', 'dave']);
    expect(s.rows[0].rank).toBe(1);
    expect(s.rows[3].rank).toBe(4);
  });

  it('resolves team names and the champion owner', () => {
    const s = buildSeasonStandings(season2024());
    expect(s.rows[0].teamName).toBe('Alice FC');
    expect(s.championOwnerId).toBe('alice');
    expect(s.season).toBe('2024');
  });
});

describe('buildLeagueHistory', () => {
  it('sums W/L/T across seasons and counts championships per owner', () => {
    const s2024 = season2024();
    const s2025: SeasonInput = {
      league: { league_id: 'L25', name: 'Dynasty', season: '2025', previous_league_id: 'L24', total_rosters: 4, status: 'complete' },
      rosters: [roster(1, 'alice', 9, 5, 0, 1450), roster(2, 'bob', 11, 3, 0, 1600), roster(3, 'carol', 7, 7, 0, 1350), roster(4, 'dave', 5, 9, 0, 1250)],
      users: [user('alice', 'Alice FC'), user('bob', 'Bob United'), user('carol', 'Carol City'), user('dave', 'Dave Rovers')],
      // bob wins 2025
      bracket: [{ r: 2, m: 3, t1: 2, t2: 1, w: 2, l: 1, p: 1 }],
    };
    // Newest first.
    const h = buildLeagueHistory([s2025, s2024]);
    const alice = h.allTime.find((m) => m.ownerId === 'alice')!;
    expect(alice.wins).toBe(19); // 10 + 9
    expect(alice.losses).toBe(9); // 4 + 5
    expect(alice.championships).toBe(1);
    const bob = h.allTime.find((m) => m.ownerId === 'bob')!;
    expect(bob.championships).toBe(1);
    expect(h.champions).toEqual([
      { season: '2025', ownerId: 'bob', teamName: 'Bob United' },
      { season: '2024', ownerId: 'alice', teamName: 'Alice FC' },
    ]);
  });

  it('flags only newest-season members as current and keeps departed managers', () => {
    const s2024 = season2024(); // has dave
    const s2025: SeasonInput = {
      league: { league_id: 'L25', name: 'Dynasty', season: '2025', previous_league_id: 'L24', total_rosters: 4, status: 'in_season' },
      // dave gone, replaced by erin; no champion yet (undecided)
      rosters: [roster(1, 'alice', 9, 5), roster(2, 'bob', 11, 3), roster(3, 'carol', 7, 7), roster(5, 'erin', 5, 9)],
      users: [user('alice', 'Alice FC'), user('bob', 'Bob United'), user('carol', 'Carol City'), user('erin', 'Erin Town')],
      bracket: [{ r: 2, m: 3, t1: 2, t2: 1, w: null, l: null, p: 1 }],
    };
    const h = buildLeagueHistory([s2025, s2024]);
    const dave = h.allTime.find((m) => m.ownerId === 'dave')!;
    expect(dave.isCurrentMember).toBe(false);
    expect(dave.wins).toBe(4); // retains 2024 total
    const erin = h.allTime.find((m) => m.ownerId === 'erin')!;
    expect(erin.isCurrentMember).toBe(true);
    // in-progress 2025 contributes no champion
    expect(h.champions.map((c) => c.season)).toEqual(['2024']);
  });

  it('computes winPct as (wins + 0.5*ties) / games, 0 when no games', () => {
    const s: SeasonInput = {
      league: { league_id: 'L1', name: 'X', season: '2024', previous_league_id: null, total_rosters: 2 },
      rosters: [roster(1, 'alice', 3, 1, 2), roster(2, 'zero', 0, 0, 0)],
      users: [user('alice', 'A'), user('zero', 'Z')],
      bracket: [],
    };
    const h = buildLeagueHistory([s]);
    const alice = h.allTime.find((m) => m.ownerId === 'alice')!;
    expect(alice.winPct).toBeCloseTo((3 + 1) / 6); // (3 + 0.5*2)/6
    const zero = h.allTime.find((m) => m.ownerId === 'zero')!;
    expect(zero.winPct).toBe(0);
  });
});
