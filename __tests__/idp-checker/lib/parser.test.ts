import { describe, it, expect } from 'vitest';
import { parseTextInput, parseCSV } from '@/lib/idp-checker/parser';

describe('parseTextInput', () => {
  it('parses numbered list format', () => {
    const input = `1. Patrick Queen LB BAL
2. Roquan Smith LB BAL
3. Myles Garrett DE CLE`;
    const result = parseTextInput(input);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      name: 'Patrick Queen',
      position: 'LB',
      team: 'BAL',
      rank: 1,
      tier: 1,
    });
    // All players in same group get same tier
    expect(result[1].tier).toBe(1);
    expect(result[2].tier).toBe(1);
  });

  it('parses comma-separated values in paste input', () => {
    const input = `1,Patrick Queen,LB,BAL
2,Roquan Smith,LB,BAL`;
    const result = parseTextInput(input);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Patrick Queen');
    expect(result[0].position).toBe('LB');
  });

  it('parses tier headers', () => {
    const input = `Tier 1
1. Patrick Queen LB BAL
2. Roquan Smith LB BAL

Tier 2
3. Myles Garrett DE CLE`;
    const result = parseTextInput(input);
    expect(result[0].tier).toBe(1);
    expect(result[1].tier).toBe(1);
    expect(result[2].tier).toBe(2);
  });

  it('parses blank-line separated tiers without headers', () => {
    const input = `1. Patrick Queen LB BAL
2. Roquan Smith LB BAL

3. Myles Garrett DE CLE
4. TJ Watt DE PIT`;
    const result = parseTextInput(input);
    expect(result[0].tier).toBe(1);
    expect(result[2].tier).toBe(2);
  });

  it('parses tab-separated format', () => {
    const input = `1\tPatrick Queen\tLB\tBAL
2\tRoquan Smith\tLB\tBAL`;
    const result = parseTextInput(input);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Patrick Queen');
  });

  it('parses raw names (no rank/position)', () => {
    const input = `Patrick Queen
Roquan Smith
Myles Garrett`;
    const result = parseTextInput(input);
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Patrick Queen');
    expect(result[0].rank).toBe(1);
  });

  it('returns empty array for empty input', () => {
    expect(parseTextInput('')).toEqual([]);
    expect(parseTextInput('   ')).toEqual([]);
  });

  it('enforces 200 player limit', () => {
    const lines = Array.from({ length: 250 }, (_, i) => `${i + 1}. Player ${i} LB BAL`).join('\n');
    const result = parseTextInput(lines);
    expect(result).toHaveLength(200);
  });
});

describe('parseCSV', () => {
  it('parses CSV with headers', () => {
    const input = `rank,name,position,team
1,Patrick Queen,LB,BAL
2,Roquan Smith,LB,BAL`;
    const result = parseCSV(input);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Patrick Queen');
    expect(result[0].rank).toBe(1);
  });

  it('parses CSV without headers (positional)', () => {
    const input = `1,Patrick Queen,LB,BAL
2,Roquan Smith,LB,BAL`;
    const result = parseCSV(input);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Patrick Queen');
  });

  it('handles name-only CSV', () => {
    const input = `Patrick Queen
Roquan Smith`;
    const result = parseCSV(input);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Patrick Queen');
  });
});
