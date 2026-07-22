import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/trade-tracker/sleeper', () => ({
  getLeagueChain: vi.fn(),
  getUsers: vi.fn(),
  getRosters: vi.fn(),
  getTransactions: vi.fn(),
  getDrafts: vi.fn(),
  getDraft: vi.fn(),
  getDraftPicks: vi.fn(),
  getPlayers: vi.fn(),
}));

import { buildLeagueTrades, ordinal } from '@/lib/trade-tracker/resolve';
import * as sleeper from '@/lib/trade-tracker/sleeper';

function seedMocks() {
  vi.mocked(sleeper.getLeagueChain).mockResolvedValue([
    {
      league_id: 'L1',
      name: 'Test League',
      season: '2024',
      previous_league_id: null,
      draft_id: 'D1',
      total_rosters: 2,
    },
  ]);
  vi.mocked(sleeper.getUsers).mockResolvedValue([
    // team_name arrives padded from Sleeper sometimes — resolution must trim it.
    { user_id: 'u1', display_name: 'Alice', avatar: null, metadata: { team_name: 'Alpha ' } },
    { user_id: 'u2', display_name: 'Bob', avatar: null },
  ]);
  vi.mocked(sleeper.getRosters).mockResolvedValue([
    { roster_id: 1, owner_id: 'u1' },
    { roster_id: 2, owner_id: 'u2' },
  ]);
  vi.mocked(sleeper.getTransactions).mockResolvedValue([
    {
      transaction_id: 't1',
      type: 'trade',
      status: 'complete',
      created: 1000,
      roster_ids: [1, 2],
      adds: null,
      drops: null,
      draft_picks: [
        { season: '2024', round: 1, roster_id: 1, previous_owner_id: 1, owner_id: 2 },
      ],
    },
  ]);
  vi.mocked(sleeper.getDrafts).mockResolvedValue([
    { draft_id: 'D1', season: '2024', league_id: 'L1', status: 'complete', slot_to_roster_id: undefined as never },
  ]);
  vi.mocked(sleeper.getDraft).mockResolvedValue({
    draft_id: 'D1', season: '2024', league_id: 'L1', status: 'complete', slot_to_roster_id: { '1': 1, '2': 2 },
  });
  vi.mocked(sleeper.getDraftPicks).mockResolvedValue([
    {
      round: 1, pick_no: 1, draft_slot: 1, player_id: 'p1', picked_by: 'u2', roster_id: 2,
      metadata: { first_name: 'Marvin', last_name: 'Harrison', position: 'WR', team: 'ARI' },
    },
  ]);
  vi.mocked(sleeper.getPlayers).mockResolvedValue({});
}

describe('buildLeagueTrades', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedMocks();
  });

  it('resolves a traded pick to the player who was drafted with it', async () => {
    const result = await buildLeagueTrades('L1');
    expect(result).not.toBeNull();
    const pickAsset = result!.trades[0].flows.find((f) => f.asset.kind === 'pick')!.asset;
    if (pickAsset.kind !== 'pick') throw new Error('expected pick');
    expect(pickAsset.outcome.status).toBe('drafted');
    if (pickAsset.outcome.status !== 'drafted') throw new Error('expected drafted');
    expect(pickAsset.outcome.playerName).toBe('Marvin Harrison');
  });

  it('stamps the original roster on each pick asset', async () => {
    const result = await buildLeagueTrades('L1');
    const pickAsset = result!.trades[0].flows.find((f) => f.asset.kind === 'pick')!.asset;
    if (pickAsset.kind !== 'pick') throw new Error('expected pick');
    expect(pickAsset.originalRoster).toBe(1);
  });

  it('returns the newest league roster list with team and owner names', async () => {
    const result = await buildLeagueTrades('L1');
    expect(result!.teams).toEqual([
      { rosterId: 1, teamName: 'Alpha', ownerName: 'Alice' },
      { rosterId: 2, teamName: 'Bob', ownerName: 'Bob' },
    ]);
  });

  it('trims padded team names in per-league flow names', async () => {
    const result = await buildLeagueTrades('L1');
    const flow = result!.trades[0].flows[0];
    expect(flow.fromTeamName).toBe('Alpha');
  });
});

// Startups often run a veterans-only initial draft and a separate rookie
// draft in the SAME season. Both drafts have a round 1 owned by roster 1, so
// season+round+originalRoster alone cannot tell them apart. A traded pick is
// the one whose drafter differs from its original owner.
// Sleeper returns the two drafts in no guaranteed order, so resolution must
// not depend on which one is indexed last.
describe.each([
  ['rookie draft listed first', ['rookie', 'startup']],
  ['startup draft listed first', ['startup', 'rookie']],
])('buildLeagueTrades with a split startup/rookie season (%s)', (_label, order) => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedMocks();
    vi.mocked(sleeper.getDrafts).mockResolvedValue(
      order.map((id) => ({
        draft_id: id, season: '2024', league_id: 'L1', status: 'complete',
        slot_to_roster_id: undefined as never,
      })),
    );
    vi.mocked(sleeper.getDraft).mockImplementation(async (id: string) => ({
      draft_id: id,
      season: '2024',
      league_id: 'L1',
      status: 'complete',
      slot_to_roster_id: { '1': 1, '2': 2 },
      settings: { rounds: id === 'startup' ? 41 : 6, player_type: id === 'startup' ? 2 : 1 },
    }));
    vi.mocked(sleeper.getDraftPicks).mockImplementation(async (id: string) =>
      id === 'startup'
        ? [
            {
              // Roster 1 kept and used its own startup pick — not the traded one.
              round: 1, pick_no: 1, draft_slot: 1, player_id: 'v1', picked_by: 'u1', roster_id: 1,
              metadata: { first_name: 'Veteran', last_name: 'Vince', position: 'WR', team: 'CIN' },
            },
          ]
        : [
            {
              // Roster 2 made this pick from roster 1's slot — this is the trade.
              round: 1, pick_no: 1, draft_slot: 1, player_id: 'r1', picked_by: 'u2', roster_id: 2,
              metadata: { first_name: 'Rookie', last_name: 'Randy', position: 'LB', team: 'CIN' },
            },
          ],
    );
  });

  it('resolves the traded pick to the rookie draft selection, not the startup one', async () => {
    const result = await buildLeagueTrades('L1');
    const pickAsset = result!.trades[0].flows.find((f) => f.asset.kind === 'pick')!.asset;
    if (pickAsset.kind !== 'pick') throw new Error('expected pick');
    expect(pickAsset.outcome.status).toBe('drafted');
    if (pickAsset.outcome.status !== 'drafted') throw new Error('expected drafted');
    expect(pickAsset.outcome.playerName).toBe('Rookie Randy');
  });
});

describe('ordinal', () => {
  it('formats draft rounds', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(9)).toBe('9th');
  });
});
