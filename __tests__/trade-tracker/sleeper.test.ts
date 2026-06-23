import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLeagueChain } from '@/lib/trade-tracker/sleeper';

const BASE = 'https://api.sleeper.app/v1';

function league(id: string, season: string, prev: string | null) {
  return { league_id: id, name: 'IDP DYNASTY', season, previous_league_id: prev, draft_id: null, total_rosters: 10 };
}

const LEAGUES: Record<string, ReturnType<typeof league>> = {
  L2023: league('L2023', '2023', null),
  L2024: league('L2024', '2024', 'L2023'),
  L2025: league('L2025', '2025', 'L2024'),
  L2026: league('L2026', '2026', 'L2025'),
};

// member 'U' belongs to every season's league
const USER_LEAGUES: Record<string, string[]> = {
  '2024': ['L2024'],
  '2025': ['L2025'],
  '2026': ['L2026'],
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
    const chain = await getLeagueChain('L2024');
    expect(chain.map((l) => l.season)).toEqual(['2026', '2025', '2024', '2023']);
  });

  it('returns the full chain when given the oldest id', async () => {
    const chain = await getLeagueChain('L2023');
    expect(chain.map((l) => l.season)).toEqual(['2026', '2025', '2024', '2023']);
  });

  it('returns empty when the league does not exist', async () => {
    const chain = await getLeagueChain('L9999');
    expect(chain).toEqual([]);
  });
});
