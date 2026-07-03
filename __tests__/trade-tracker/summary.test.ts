import { describe, it, expect } from 'vitest';
import { summarizeTeamView } from '@/lib/trade-tracker/summary';
import type { TeamView, TeamTrade } from '@/lib/trade-tracker/team-view';
import type { ReceivedAsset } from '@/lib/trade-tracker/resolve';

const draftedPick: ReceivedAsset = {
  kind: 'pick', season: '2024', round: 2, originalRoster: 3, label: '2024 2nd',
  originalOwnerName: null,
  outcome: { status: 'drafted', playerName: 'P', position: 'WR', team: 'CIN', round: 2, pickNo: 15 },
};
const pendingPick: ReceivedAsset = {
  kind: 'pick', season: '2026', round: 1, originalRoster: 4, label: '2026 1st',
  originalOwnerName: null, outcome: { status: 'pending' },
};
const flippedPick: ReceivedAsset = {
  kind: 'pick', season: '2025', round: 3, originalRoster: 5, label: '2025 3rd',
  originalOwnerName: null,
  outcome: { status: 'drafted', playerName: 'Q', position: 'LB', team: 'SF', round: 3, pickNo: 30 },
};
const player: ReceivedAsset = { kind: 'player', playerName: 'A', position: 'LB', team: 'SF' };

function trade(
  id: string,
  at: number,
  partnerName: string,
  receives: ReceivedAsset[],
  tradedAway: ReceivedAsset[] = [],
): TeamTrade {
  return {
    tradeId: id, season: '2024', createdAt: at,
    counterparties: [{ rosterId: 9, name: partnerName }],
    receives, tradedAway,
  };
}

describe('summarizeTeamView', () => {
  it('counts trades, players, picks, outcomes, flips, and top partner', () => {
    const view: TeamView = {
      leagueName: 'L', teamName: 'T',
      trades: [
        trade('t1', 100, 'Bravo', [player, draftedPick]),
        trade('t2', 200, 'Bravo', [flippedPick]),
        trade('t3', 300, 'Charlie', [pendingPick], [flippedPick]),
      ],
      // flippedPick received in t2 was traded away again in t3
      chainLinks: [{ assetKey: '2025:3:5', fromTradeId: 't2', toTradeId: 't3' }],
    };
    const s = summarizeTeamView(view);
    expect(s.tradeCount).toBe(3);
    expect(s.playersAcquired).toBe(1);
    expect(s.picksAcquired).toBe(3);
    expect(s.picksFlipped).toBe(1);
    expect(s.picksDrafted).toBe(1); // flipped pick's drafted outcome not counted
    expect(s.picksPending).toBe(1);
    expect(s.topPartner).toEqual({ name: 'Bravo', trades: 2 });
  });

  it('returns null topPartner for a team with no trades', () => {
    const s = summarizeTeamView({ leagueName: 'L', teamName: 'T', trades: [], chainLinks: [] });
    expect(s.tradeCount).toBe(0);
    expect(s.topPartner).toBeNull();
  });
});
