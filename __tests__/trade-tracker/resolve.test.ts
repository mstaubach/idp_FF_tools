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

import { buildLeagueTrades } from '@/lib/trade-tracker/resolve';
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
    { user_id: 'u1', display_name: 'Alice', avatar: null, metadata: { team_name: 'Alpha' } },
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
});
