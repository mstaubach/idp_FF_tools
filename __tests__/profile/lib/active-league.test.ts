import { describe, it, expect } from 'vitest';
import {
  ACTIVE_LEAGUE_COOKIE,
  activeLeagueCookieString,
  isValidLeagueId,
  leaguePathFor,
  toolRootFor,
} from '@/lib/profile/active-league';

describe('leaguePathFor', () => {
  it.each([
    ['/standings', '/standings/123456'],
    ['/standings/999999', '/standings/123456'],
    ['/trade-tracker', '/trade-tracker/league/123456'],
    ['/trade-tracker/league/999999', '/trade-tracker/league/123456'],
    ['/roster-management', '/roster-management/123456'],
    ['/roster-management/999999', '/roster-management/123456'],
    ['/taxi-filler', '/taxi-filler/123456'],
    ['/taxi-filler/999999', '/taxi-filler/123456'],
  ])('maps %s to %s', (pathname, expected) => {
    expect(leaguePathFor(pathname, '123456')).toBe(expected);
  });

  it.each([['/'], ['/idp-checker'], ['/injury-tracker'], ['/standings-archive']])(
    'returns null for %s',
    (pathname) => {
      expect(leaguePathFor(pathname, '123456')).toBeNull();
    }
  );
});

describe('toolRootFor', () => {
  it('returns the tool root for nested league paths', () => {
    expect(toolRootFor('/trade-tracker/league/999999')).toBe('/trade-tracker');
    expect(toolRootFor('/standings/999999')).toBe('/standings');
  });

  it('returns null off tool pages', () => {
    expect(toolRootFor('/')).toBeNull();
    expect(toolRootFor('/idp-checker')).toBeNull();
  });
});

describe('isValidLeagueId', () => {
  it('accepts 6+ digit ids', () => {
    expect(isValidLeagueId('123456')).toBe(true);
    expect(isValidLeagueId('1048426134855081984')).toBe(true);
  });

  it('rejects short, empty, non-numeric, and missing values', () => {
    expect(isValidLeagueId('12345')).toBe(false);
    expect(isValidLeagueId('')).toBe(false);
    expect(isValidLeagueId('12a456')).toBe(false);
    expect(isValidLeagueId(undefined)).toBe(false);
    expect(isValidLeagueId(null)).toBe(false);
  });
});

describe('activeLeagueCookieString', () => {
  it('sets a year-long cookie for a league id', () => {
    expect(activeLeagueCookieString('123456')).toBe(
      `${ACTIVE_LEAGUE_COOKIE}=123456; path=/; max-age=31536000; samesite=lax`
    );
  });

  it('expires the cookie for null', () => {
    expect(activeLeagueCookieString(null)).toBe(
      `${ACTIVE_LEAGUE_COOKIE}=; path=/; max-age=0; samesite=lax`
    );
  });
});
