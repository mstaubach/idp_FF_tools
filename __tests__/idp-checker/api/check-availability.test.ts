import { describe, it, expect } from 'vitest';
import { buildAvailabilityResults } from '@/lib/idp-checker/availability';
import { PlayerResult, SleeperRoster, SleeperUser, SleeperLeague } from '@/lib/idp-checker/types';

// We test the core logic function, not the HTTP handler directly.

const mockMatchedPlayers: PlayerResult[] = [
  {
    inputName: 'Patrick Queen',
    matchedPlayer: { id: '100', name: 'Patrick Queen', position: 'LB', team: 'BAL' },
    matchConfidence: 0.95,
    rank: 1,
    tier: 1,
    available: true,
    rosteredBy: null,
  },
  {
    inputName: 'Myles Garrett',
    matchedPlayer: { id: '200', name: 'Myles Garrett', position: 'DE', team: 'CLE' },
    matchConfidence: 0.9,
    rank: 2,
    tier: 1,
    available: true,
    rosteredBy: null,
  },
];

const mockRosters: SleeperRoster[] = [
  { roster_id: 1, owner_id: 'u1', players: ['100', '300'], starters: ['100'], reserve: null, taxi: null },
  { roster_id: 2, owner_id: 'u2', players: ['400'], starters: ['400'], reserve: ['500'], taxi: ['600'] },
];

const mockUsers: SleeperUser[] = [
  { user_id: 'u1', display_name: 'Mike', metadata: { team_name: "Mike's Team" } },
  { user_id: 'u2', display_name: 'Joe', metadata: { team_name: "Joe's Squad" } },
];

const mockLeagueFaab: SleeperLeague = {
  league_id: 'l1',
  name: 'Test League',
  settings: { waiver_type: 2, waiver_budget: 100 },
};

const mockLeagueRolling: SleeperLeague = {
  league_id: 'l2',
  name: 'Rolling League',
  settings: { waiver_type: 0 },
};

describe('buildAvailabilityResults', () => {
  it('marks rostered players correctly', () => {
    const result = buildAvailabilityResults(mockMatchedPlayers, mockRosters, mockUsers, mockLeagueFaab);
    const queen = result.results.find(r => r.inputName === 'Patrick Queen')!;
    expect(queen.available).toBe(false);
    expect(queen.rosteredBy?.teamName).toBe("Mike's Team");
  });

  it('marks available players correctly', () => {
    const result = buildAvailabilityResults(mockMatchedPlayers, mockRosters, mockUsers, mockLeagueFaab);
    const garrett = result.results.find(r => r.inputName === 'Myles Garrett')!;
    expect(garrett.available).toBe(true);
    expect(garrett.rosteredBy).toBeNull();
  });

  it('detects players on reserve (IR) as rostered', () => {
    const players: PlayerResult[] = [{
      inputName: 'IR Player',
      matchedPlayer: { id: '500', name: 'IR Player', position: 'LB', team: 'NYG' },
      matchConfidence: 0.9,
      rank: 1,
      available: true,
      rosteredBy: null,
    }];
    const result = buildAvailabilityResults(players, mockRosters, mockUsers, mockLeagueFaab);
    expect(result.results[0].available).toBe(false);
    expect(result.results[0].rosteredBy?.teamName).toBe("Joe's Squad");
  });

  it('detects players on taxi squad as rostered', () => {
    const players: PlayerResult[] = [{
      inputName: 'Taxi Player',
      matchedPlayer: { id: '600', name: 'Taxi Player', position: 'CB', team: 'DAL' },
      matchConfidence: 0.9,
      rank: 1,
      available: true,
      rosteredBy: null,
    }];
    const result = buildAvailabilityResults(players, mockRosters, mockUsers, mockLeagueFaab);
    expect(result.results[0].available).toBe(false);
  });

  it('returns FAAB waiver info', () => {
    const result = buildAvailabilityResults(mockMatchedPlayers, mockRosters, mockUsers, mockLeagueFaab);
    expect(result.waiverInfo.type).toBe('faab');
    expect(result.waiverInfo.faabBudgets).toBeDefined();
    expect(result.waiverInfo.faabBudgets!.length).toBeGreaterThan(0);
  });

  it('returns rolling waiver info', () => {
    const result = buildAvailabilityResults(mockMatchedPlayers, mockRosters, mockUsers, mockLeagueRolling);
    expect(result.waiverInfo.type).toBe('rolling');
    expect(result.waiverInfo.waiverOrder).toBeDefined();
  });

  it('uses display_name when team_name is missing', () => {
    const usersNoTeamName: SleeperUser[] = [
      { user_id: 'u1', display_name: 'Mike' },
    ];
    const result = buildAvailabilityResults(mockMatchedPlayers, mockRosters, usersNoTeamName, mockLeagueFaab);
    const queen = result.results.find(r => r.inputName === 'Patrick Queen')!;
    expect(queen.rosteredBy?.teamName).toBe('Mike');
  });
});
