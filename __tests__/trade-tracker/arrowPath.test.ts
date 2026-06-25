import { describe, it, expect } from 'vitest';
import { computeArrowPath } from '@/components/trade-tracker/arrowPath';

describe('computeArrowPath', () => {
  it('starts at `from`, ends at `to`, and is a cubic bezier', () => {
    const d = computeArrowPath({ x: 10, y: 20 }, { x: 210, y: 80 });
    expect(d.startsWith('M 10 20')).toBe(true);
    expect(d).toContain('C');
    expect(d.trim().endsWith('210 80')).toBe(true);
  });

  it('uses horizontal control handles (control y matches endpoint y)', () => {
    const d = computeArrowPath({ x: 0, y: 0 }, { x: 100, y: 50 });
    // M 0 0 C <c1x> 0, <c2x> 50, 100 50
    const match = d.match(/C\s+[\d.]+\s+(\d+),\s+[\d.]+\s+(\d+),/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('0');
    expect(match![2]).toBe('50');
  });
});

describe('computeArrowPath with a gutter route', () => {
  const from = { x: 100, y: 50 };
  const to = { x: 700, y: 250 };
  const route = { exitX: 130, enterX: 670, gutterY: 200 };

  it('starts at `from` and ends at `to`', () => {
    const d = computeArrowPath(from, to, route);
    expect(d.startsWith('M 100 50')).toBe(true);
    expect(d.trim().endsWith('700 250')).toBe(true);
  });

  it('routes through the gutter lanes instead of straight across', () => {
    const d = computeArrowPath(from, to, route);
    // bends at the source gutter (exitX), the row-gap lane (gutterY), and the
    // target gutter (enterX) — through clear lanes, not a diagonal cubic bezier.
    expect(d).toContain('130'); // exitX
    expect(d).toContain('670'); // enterX
    expect(d).toContain('200'); // gutterY
    expect(d).not.toContain('C');
  });
});
