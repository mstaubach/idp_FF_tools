import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import TeamTradeCard from '@/components/trade-tracker/TeamTradeCard';
import type { TeamTrade } from '@/lib/trade-tracker/team-view';
import type { ReceivedAsset } from '@/lib/trade-tracker/resolve';

afterEach(cleanup);

const pick: ReceivedAsset = {
  kind: 'pick', season: '2024', round: 2, originalRoster: 2,
  label: '2024 2nd', outcome: { status: 'pending' },
};
const player: ReceivedAsset = { kind: 'player', playerName: 'Player1', position: 'WR', team: 'ARI' };

const trade: TeamTrade = {
  tradeId: 't1', season: '2024', createdAt: 1000,
  counterparties: ['Bravo'], tradedAway: [player], receives: [pick],
};

describe('TeamTradeCard', () => {
  it('shows the counterparty header and both columns', () => {
    render(<TeamTradeCard trade={trade} sourceKeys={new Set()} targetKeys={new Set()} />);
    expect(screen.getByText(/Trade w\/ Bravo/)).toBeTruthy();
    expect(screen.getByText('Player1')).toBeTruthy();
    expect(screen.getByText('2024 2nd')).toBeTruthy();
  });

  it('marks a re-traded received pick with a trade-scoped source anchor', () => {
    const { container } = render(
      <TeamTradeCard trade={trade} sourceKeys={new Set(['2024:2:2'])} targetKeys={new Set()} />,
    );
    expect(container.querySelector('[data-anchor="src:t1:2024:2:2"]')).toBeTruthy();
  });

  it('marks an incoming traded-away pick with a trade-scoped target anchor', () => {
    const incoming: TeamTrade = { ...trade, tradedAway: [pick], receives: [player] };
    const { container } = render(
      <TeamTradeCard trade={incoming} sourceKeys={new Set()} targetKeys={new Set(['2024:2:2'])} />,
    );
    expect(container.querySelector('[data-anchor="dst:t1:2024:2:2"]')).toBeTruthy();
  });

  it('produces distinct anchors for the same pick re-acquired and re-traded across different trades', () => {
    const tradeT1: TeamTrade = {
      tradeId: 't1', season: '2024', createdAt: 1000,
      counterparties: ['Alpha'], tradedAway: [player], receives: [pick],
    };
    const tradeT3: TeamTrade = {
      tradeId: 't3', season: '2024', createdAt: 3000,
      counterparties: ['Gamma'], tradedAway: [player], receives: [pick],
    };

    const { container: c1 } = render(
      <TeamTradeCard trade={tradeT1} sourceKeys={new Set(['2024:2:2'])} targetKeys={new Set()} />,
    );
    const { container: c2 } = render(
      <TeamTradeCard trade={tradeT3} sourceKeys={new Set(['2024:2:2'])} targetKeys={new Set()} />,
    );

    const anchorT1 = c1.querySelector('[data-anchor="src:t1:2024:2:2"]');
    const anchorT3 = c2.querySelector('[data-anchor="src:t3:2024:2:2"]');

    expect(anchorT1).toBeTruthy();
    expect(anchorT3).toBeTruthy();
    expect(anchorT1).not.toBe(anchorT3);
  });
});
