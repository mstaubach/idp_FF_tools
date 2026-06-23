import { describe, it, expect } from 'vitest';
import { deriveLeagueTeams, deriveTeamView } from '@/lib/trade-tracker/team-view';
import type {
  LeagueTrades,
  ReceivedAsset,
  TradeFlow,
  TradeView,
} from '@/lib/trade-tracker/resolve';

function pickAsset(season: string, round: number, originalRoster: number): ReceivedAsset {
  return {
    kind: 'pick',
    season,
    round,
    originalRoster,
    label: `${season} round ${round}`,
    outcome: { status: 'pending' },
  };
}

function playerAsset(name: string): ReceivedAsset {
  return { kind: 'player', playerName: name, position: 'WR', team: 'ARI' };
}

function flow(
  fromRosterId: number | null,
  fromTeamName: string | null,
  toRosterId: number,
  toTeamName: string,
  asset: ReceivedAsset,
): TradeFlow {
  return { fromRosterId, fromTeamName, toRosterId, toTeamName, asset };
}

function trade(id: string, createdAt: number, flows: TradeFlow[]): TradeView {
  return { id, leagueId: 'L1', season: '2024', createdAt, sides: [], flows };
}

// Team 1 (Alpha) receives team 2's 2024 2nd in trade t1, then trades it to
// team 3 in the later trade t2. Team 1 also gets a player in t1.
function fixture(): LeagueTrades {
  return {
    leagueName: 'Test League',
    seasons: ['2024'],
    teams: [
      { rosterId: 1, teamName: 'Alpha', ownerName: 'Alice' },
      { rosterId: 2, teamName: 'Bravo', ownerName: 'Bob' },
      { rosterId: 3, teamName: 'Charlie', ownerName: 'Cara' },
    ],
    trades: [
      trade('t1', 1000, [
        flow(2, 'Bravo', 1, 'Alpha', pickAsset('2024', 2, 2)),
        flow(1, 'Alpha', 2, 'Bravo', playerAsset('Player1')),
      ]),
      trade('t2', 2000, [
        flow(1, 'Alpha', 3, 'Charlie', pickAsset('2024', 2, 2)),
        flow(3, 'Charlie', 1, 'Alpha', playerAsset('Player3')),
      ]),
    ],
  };
}

describe('deriveLeagueTeams', () => {
  it('counts each team\'s trades', () => {
    const { teams } = deriveLeagueTeams(fixture());
    const byId = Object.fromEntries(teams.map((t) => [t.rosterId, t.tradeCount]));
    expect(byId).toEqual({ 1: 2, 2: 1, 3: 1 });
  });
});

describe('deriveTeamView', () => {
  it('returns null for an unknown roster', () => {
    expect(deriveTeamView(fixture(), 99)).toBeNull();
  });

  it('splits each trade into receives and tradedAway for the focal team', () => {
    const view = deriveTeamView(fixture(), 1)!;
    expect(view.teamName).toBe('Alpha');
    expect(view.trades.map((t) => t.tradeId)).toEqual(['t1', 't2']);

    const t1 = view.trades[0];
    expect(t1.receives.map((a) => (a.kind === 'pick' ? 'pick' : a.playerName))).toEqual(['pick']);
    expect(t1.tradedAway.map((a) => (a.kind === 'player' ? a.playerName : 'pick'))).toEqual(['Player1']);
    expect(t1.counterparties).toEqual(['Bravo']);
  });

  it('links a received pick to the later trade where it was traded away', () => {
    const view = deriveTeamView(fixture(), 1)!;
    expect(view.chainLinks).toEqual([
      { assetKey: '2024:2:2', fromTradeId: 't1', toTradeId: 't2' },
    ]);
  });

  it('does not link picks that were kept (no later trade-away)', () => {
    const view = deriveTeamView(fixture(), 3)!;
    expect(view.chainLinks).toEqual([]);
  });
});
