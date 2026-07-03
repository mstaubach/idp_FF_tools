import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import TradeTimeline from '@/components/trade-tracker/TradeTimeline';
import type { TeamView, TeamTrade } from '@/lib/trade-tracker/team-view';
import type { ReceivedAsset } from '@/lib/trade-tracker/resolve';

afterEach(cleanup);
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const pick: ReceivedAsset = {
  kind: 'pick', season: '2024', round: 2, originalRoster: 2,
  label: '2024 2nd', originalOwnerName: null, outcome: { status: 'pending' },
};

function trade(id: string, season: string, createdAt: number, extra: Partial<TeamTrade> = {}): TeamTrade {
  return {
    tradeId: id, season, createdAt,
    counterparties: [{ rosterId: 3, name: 'Bravo' }],
    tradedAway: [], receives: [], ...extra,
  };
}

const view: TeamView = {
  leagueName: 'L', teamName: 'T',
  trades: [
    trade('t1', '2023', 1000, { receives: [pick] }),
    trade('t2', '2024', 2000, { tradedAway: [pick] }),
  ],
  chainLinks: [{ assetKey: '2024:2:2', fromTradeId: 't1', toTradeId: 't2' }],
};

describe('TradeTimeline', () => {
  it('groups trades under season headings, newest season first', () => {
    render(<TradeTimeline view={view} leagueId="lg" />);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['2024 season', '2023 season']);
  });

  it('gives each card a stable DOM id', () => {
    const { container } = render(<TradeTimeline view={view} leagueId="lg" />);
    expect(container.querySelector('#trade-t1')).toBeTruthy();
    expect(container.querySelector('#trade-t2')).toBeTruthy();
  });

  it('jump link on a flipped pick scrolls to and flashes the destination card', () => {
    const { container } = render(<TradeTimeline view={view} leagueId="lg" />);
    fireEvent.click(screen.getByRole('button', { name: /traded again/ }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(container.querySelector('#trade-t2')!.className).toContain('ring-2');
  });

  it('links a later-traded-away pick back to where it was acquired', () => {
    render(<TradeTimeline view={view} leagueId="lg" />);
    expect(screen.getByRole('button', { name: /acquired/ })).toBeTruthy();
  });
});
