import { describe, it, expect } from 'vitest';
import {
  CHAIN_COLORS,
  colorForAssetKey,
  labelForAssetKey,
  orderedAssetKeys,
} from '@/components/trade-tracker/arrowStyle';

describe('arrowStyle', () => {
  it('derives a pick label from an asset key', () => {
    expect(labelForAssetKey('2024:2:5')).toBe('2024 2nd');
    expect(labelForAssetKey('2026:1:12')).toBe('2026 1st');
  });

  it('gives each distinct chain a color, stable across links of the same pick', () => {
    const links = [
      { assetKey: 'a', fromTradeId: 't1', toTradeId: 't2' },
      { assetKey: 'b', fromTradeId: 't2', toTradeId: 't3' },
      { assetKey: 'a', fromTradeId: 't2', toTradeId: 't4' }, // same pick flipped again
    ];
    const ordered = orderedAssetKeys(links);
    expect(ordered).toEqual(['a', 'b']);
    expect(colorForAssetKey('a', ordered)).toBe(CHAIN_COLORS[0]);
    expect(colorForAssetKey('b', ordered)).toBe(CHAIN_COLORS[1]);
  });

  it('cycles the palette when chains outnumber colors', () => {
    const ordered = Array.from({ length: CHAIN_COLORS.length + 1 }, (_, i) => `k${i}`);
    expect(colorForAssetKey(ordered[CHAIN_COLORS.length], ordered)).toBe(CHAIN_COLORS[0]);
  });
});
