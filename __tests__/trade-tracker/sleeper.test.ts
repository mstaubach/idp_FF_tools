import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLeagueChain } from '@/lib/trade-tracker/sleeper';

const BASE = 'https://api.sleeper.app/v1';

function league(id: string, season: string, prev: string | null) {
  return { league_id: id, name: 'IDP DYNASTY', season, previous_league_id: prev, draft_id: null, total_rosters: 10 };
}

// Real Sleeper league IDs are numeric strings, which isValidSleeperId enforces.
const LEAGUES: Record<string, ReturnType<typeof league>> = {
  '1023': league('1023', '2023', null),
  '1024': league('1024', '2024', '1023'),
  '1025': league('1025', '2025', '1024'),
  '1026': league('1026', '2026', '1025'),
};

// member 'U' belongs to every season's league
const USER_LEAGUES: Record<string, string[]> = {
  '2024': ['1024'],
  '2025': ['1025'],
  '2026': ['1026'],
};

function ok(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}

beforeEach(() => {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input).replace(BASE, '');
    let m: RegExpMatchArray | null;

    if ((m = url.match(/^\/league\/([^/]+)\/users$/))) {
      return ok([{ user_id: 'U', display_name: 'Owner', avatar: null }]);
    }
    if ((m = url.match(/^\/user\/U\/leagues\/nfl\/(\d+)$/))) {
      const ids = USER_LEAGUES[m[1]] ?? [];
      return ok(ids.map((id) => LEAGUES[id]));
    }
    if ((m = url.match(/^\/league\/([^/]+)$/))) {
      const lg = LEAGUES[m[1]];
      return lg ? ok(lg) : { ok: false, status: 404, json: async () => null };
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
});

describe('getLeagueChain', () => {
  it('walks forward to the newest league then back, even when given a mid-history id', async () => {
    const chain = await getLeagueChain('1024');
    expect(chain.map((l) => l.season)).toEqual(['2026', '2025', '2024', '2023']);
  });

  it('returns the full chain when given the oldest id', async () => {
    const chain = await getLeagueChain('1023');
    expect(chain.map((l) => l.season)).toEqual(['2026', '2025', '2024', '2023']);
  });

  it('returns empty when the league does not exist', async () => {
    const chain = await getLeagueChain('9999');
    expect(chain).toEqual([]);
  });

  it('returns empty for a non-numeric (invalid) league id', async () => {
    const chain = await getLeagueChain('../evil');
    expect(chain).toEqual([]);
  });
});
