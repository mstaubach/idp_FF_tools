import { describe, it, expect } from 'vitest';
import { layoutTrades } from '@/components/trade-tracker/tradeLayout';
import type { TeamTrade, PickChainLink } from '@/lib/trade-tracker/team-view';

function trade(tradeId: string, createdAt: number): TeamTrade {
  return { tradeId, season: '2024', createdAt, counterparties: [], tradedAway: [], receives: [] };
}

function link(fromTradeId: string, toTradeId: string): PickChainLink {
  return { assetKey: `${fromTradeId}->${toTradeId}`, fromTradeId, toTradeId };
}

describe('layoutTrades', () => {
  it('stacks unconnected trades vertically in column 0, oldest at top', () => {
    const pos = layoutTrades([trade('a', 100), trade('b', 200), trade('c', 300)], []);
    expect(pos.get('a')).toEqual({ row: 0, column: 0 });
    expect(pos.get('b')).toEqual({ row: 1, column: 0 });
    expect(pos.get('c')).toEqual({ row: 2, column: 0 });
  });

  it('lays a multi-hop chain along one row, stepping right each hop', () => {
    const trades = [trade('t1', 100), trade('t2', 200), trade('t3', 300)];
    const pos = layoutTrades(trades, [link('t1', 't2'), link('t2', 't3')]);
    expect(pos.get('t1')).toEqual({ row: 0, column: 0 });
    expect(pos.get('t2')).toEqual({ row: 0, column: 1 });
    expect(pos.get('t3')).toEqual({ row: 0, column: 2 });
  });

  it('puts a branch (one feeder, two targets) on separate rows, both one column right', () => {
    // t1 feeds both t2 (earlier) and t3 (later)
    const trades = [trade('t1', 100), trade('t2', 200), trade('t3', 300)];
    const pos = layoutTrades(trades, [link('t1', 't2'), link('t1', 't3')]);
    expect(pos.get('t1')).toEqual({ row: 0, column: 0 });
    // earliest target continues t1's row; the next target starts a new row
    expect(pos.get('t2')).toEqual({ row: 0, column: 1 });
    expect(pos.get('t3')).toEqual({ row: 1, column: 1 });
  });

  it('places a diamond target to the right of its farthest feeder, only once', () => {
    // roots t1 and t2 both feed t3; t1 also feeds an intermediate so t3 longest path = 1
    const trades = [trade('t1', 100), trade('t2', 200), trade('t3', 300)];
    const pos = layoutTrades(trades, [link('t1', 't3'), link('t2', 't3')]);
    expect(pos.get('t1')).toEqual({ row: 0, column: 0 });
    expect(pos.get('t2')).toEqual({ row: 1, column: 0 });
    // t3 fed by two roots → column 1; placed once (via the earliest root's row)
    expect(pos.get('t3')!.column).toBe(1);
    expect(pos.get('t3')!.row).toBe(0);
  });

  it('positions a diamond target right of a longer path (column = longest path)', () => {
    // t1 -> t2 -> t4, and t1 -> t4 directly. Longest path to t4 is 2.
    const trades = [trade('t1', 100), trade('t2', 200), trade('t4', 400)];
    const pos = layoutTrades(trades, [link('t1', 't2'), link('t2', 't4'), link('t1', 't4')]);
    expect(pos.get('t4')!.column).toBe(2);
  });

  it('assigns every trade a position', () => {
    const trades = [trade('t1', 100), trade('t2', 200), trade('t3', 300), trade('t4', 400)];
    const pos = layoutTrades(trades, [link('t1', 't2')]);
    for (const t of trades) expect(pos.has(t.tradeId)).toBe(true);
  });
});
