import { describe, it, expect } from 'vitest';
import { sanitizeParsedPlayers, MAX_PLAYERS, MAX_NAME_LENGTH } from '@/lib/idp-checker/validate';

describe('sanitizeParsedPlayers', () => {
  it('accepts a well-formed list and returns sanitized copies', () => {
    const result = sanitizeParsedPlayers([
      { name: '  Pat Queen  ', position: 'LB', team: 'BAL', rank: 1, tier: 1 },
      { name: 'Myles Garrett' },
    ]);
    expect(result).toEqual([
      { name: 'Pat Queen', position: 'LB', team: 'BAL', rank: 1, tier: 1 },
      { name: 'Myles Garrett', position: undefined, team: undefined, rank: undefined, tier: undefined },
    ]);
  });

  it('strips unknown fields from entries', () => {
    const result = sanitizeParsedPlayers([
      { name: 'Pat Queen', __proto__: { evil: true }, extra: 'x'.repeat(10_000) },
    ]);
    expect(result).toEqual([
      { name: 'Pat Queen', position: undefined, team: undefined, rank: undefined, tier: undefined },
    ]);
  });

  it('rejects non-arrays, empty lists, and oversized lists', () => {
    expect(sanitizeParsedPlayers(undefined)).toBeNull();
    expect(sanitizeParsedPlayers('Pat Queen')).toBeNull();
    expect(sanitizeParsedPlayers([])).toBeNull();
    expect(
      sanitizeParsedPlayers(Array.from({ length: MAX_PLAYERS + 1 }, () => ({ name: 'a' })))
    ).toBeNull();
  });

  it('rejects entries with missing, empty, or oversized names', () => {
    expect(sanitizeParsedPlayers([{ position: 'LB' }])).toBeNull();
    expect(sanitizeParsedPlayers([{ name: '   ' }])).toBeNull();
    expect(sanitizeParsedPlayers([{ name: 42 }])).toBeNull();
    expect(sanitizeParsedPlayers([{ name: 'a'.repeat(MAX_NAME_LENGTH + 1) }])).toBeNull();
  });

  it('rejects oversized or mistyped position/team tags', () => {
    expect(sanitizeParsedPlayers([{ name: 'Pat Queen', position: 'x'.repeat(50) }])).toBeNull();
    expect(sanitizeParsedPlayers([{ name: 'Pat Queen', team: 'x'.repeat(50) }])).toBeNull();
    expect(sanitizeParsedPlayers([{ name: 'Pat Queen', position: 7 }])).toBeNull();
  });

  it('rejects non-finite rank/tier values', () => {
    expect(sanitizeParsedPlayers([{ name: 'Pat Queen', rank: Infinity }])).toBeNull();
    expect(sanitizeParsedPlayers([{ name: 'Pat Queen', tier: 'one' }])).toBeNull();
  });

  it('rejects the whole list when any single entry is malformed', () => {
    expect(sanitizeParsedPlayers([{ name: 'Pat Queen' }, { name: '' }])).toBeNull();
  });
});
