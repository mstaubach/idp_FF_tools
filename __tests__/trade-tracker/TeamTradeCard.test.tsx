import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import TeamTradeCard from '@/components/trade-tracker/TeamTradeCard';
import type { TeamTrade } from '@/lib/trade-tracker/team-view';
import type { ReceivedAsset } from '@/lib/trade-tracker/resolve';

afterEach(cleanup);

const pick: ReceivedAsset = {
  kind: 'pick', season: '2024', round: 2, originalRoster: 2,
  label: '2024 2nd', originalOwnerName: null, outcome: { status: 'pending' },
};
const player: ReceivedAsset = { kind: 'player', playerName: 'Player1', position: 'WR', team: 'ARI' };

const trade: TeamTrade = {
  tradeId: 't1', season: '2024', createdAt: 1000,
  counterparties: [{ rosterId: 7, name: 'Bravo' }], tradedAway: [player], receives: [pick],
};

describe('TeamTradeCard', () => {
  it('shows the counterparty header and both columns', () => {
    render(<TeamTradeCard trade={trade} sourceKeys={new Set()} targetKeys={new Set()} />);
    expect(screen.getByText('Bravo')).toBeTruthy();
    expect(screen.getByText('Player1')).toBeTruthy();
    expect(screen.getByText('2024 2nd')).toBeTruthy();
  });

  it('links counterparties to their team page when leagueId is given', () => {
    render(
      <TeamTradeCard trade={trade} sourceKeys={new Set()} targetKeys={new Set()} leagueId="league1" />,
    );
    const link = screen.getByRole('link', { name: 'Bravo' });
    expect(link.getAttribute('href')).toBe('/trade-tracker/league/league1/team/7');
  });

  it('renders plain text counterparty without a rosterId', () => {
    const anon: TeamTrade = { ...trade, counterparties: [{ rosterId: null, name: 'Ghost' }] };
    render(<TeamTradeCard trade={anon} sourceKeys={new Set()} targetKeys={new Set()} leagueId="league1" />);
    expect(screen.queryByRole('link', { name: 'Ghost' })).toBeNull();
    expect(screen.getByText('Ghost')).toBeTruthy();
  });

  it('shows an em dash for an empty column', () => {
    const oneSided: TeamTrade = { ...trade, tradedAway: [] };
    render(<TeamTradeCard trade={oneSided} sourceKeys={new Set()} targetKeys={new Set()} />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('renders a jump button for a flipped received pick and fires onJump', () => {
    const onJump = vi.fn();
    render(
      <TeamTradeCard
        trade={trade}
        sourceKeys={new Set(['2024:2:2'])}
        targetKeys={new Set()}
        chainJump={({ assetKey, side }) =>
          side === 'receives' && assetKey === '2024:2:2'
            ? { targetTradeId: 't9', label: 'traded again Mar 2024' }
            : null
        }
        onJump={onJump}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /traded again Mar 2024/ }));
    expect(onJump).toHaveBeenCalledWith('t9');
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
      counterparties: [{ rosterId: 1, name: 'Alpha' }], tradedAway: [player], receives: [pick],
    };
    const tradeT3: TeamTrade = {
      tradeId: 't3', season: '2024', createdAt: 3000,
      counterparties: [{ rosterId: 3, name: 'Gamma' }], tradedAway: [player], receives: [pick],
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
