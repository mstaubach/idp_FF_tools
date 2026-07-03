import { describe, it, expect, afterEach, beforeEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import TeamTradeView from '@/components/trade-tracker/TeamTradeView';
import type { TeamView } from '@/lib/trade-tracker/team-view';

afterEach(cleanup);
beforeEach(() => localStorage.clear());
beforeAll(() => {
  // jsdom lacks ResizeObserver, which the flow canvas observes its track with.
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const view: TeamView = {
  leagueName: 'L', teamName: 'T',
  trades: [{
    tradeId: 't1', season: '2024', createdAt: 1000,
    counterparties: [{ rosterId: 2, name: 'Bravo' }],
    tradedAway: [], receives: [{ kind: 'player', playerName: 'P1', position: 'LB', team: 'SF' }],
  }],
  chainLinks: [],
};

describe('TeamTradeView', () => {
  it('defaults to the timeline and shows the summary strip', () => {
    render(<TeamTradeView view={view} leagueId="lg" />);
    expect(screen.getByRole('heading', { level: 3, name: /2024 season/i })).toBeTruthy();
    expect(screen.getByText('Players acquired')).toBeTruthy();
  });

  it('switches to flow view and persists the choice', () => {
    render(<TeamTradeView view={view} leagueId="lg" />);
    fireEvent.click(screen.getByRole('button', { name: /flow/i }));
    // flow mode: no season headings; the standalone "flow" of one unchained
    // trade renders the trade card without a timeline section
    expect(screen.queryByRole('heading', { level: 3, name: /2024 season/i })).toBeNull();
    expect(localStorage.getItem('trade-tracker:view-mode')).toBe('flow');
  });

  it('honors a persisted flow preference on mount', () => {
    localStorage.setItem('trade-tracker:view-mode', 'flow');
    render(<TeamTradeView view={view} leagueId="lg" />);
    expect(screen.queryByRole('heading', { level: 3, name: /2024 season/i })).toBeNull();
  });
});
