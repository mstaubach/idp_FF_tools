import { describe, it, expect } from 'vitest';
import { chainKeySets } from '@/components/trade-tracker/chainKeys';

describe('chainKeySets', () => {
  it('indexes asset keys by source and target trade', () => {
    const { sourceKeysByTrade, targetKeysByTrade } = chainKeySets([
      { assetKey: 'k1', fromTradeId: 't1', toTradeId: 't2' },
      { assetKey: 'k2', fromTradeId: 't1', toTradeId: 't3' },
    ]);
    expect(sourceKeysByTrade.get('t1')).toEqual(new Set(['k1', 'k2']));
    expect(targetKeysByTrade.get('t2')).toEqual(new Set(['k1']));
    expect(targetKeysByTrade.get('t3')).toEqual(new Set(['k2']));
    expect(sourceKeysByTrade.get('t2')).toBeUndefined();
  });
});
