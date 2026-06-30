import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookupSleeperUser, fetchUserLeagues } from '@/lib/profile/sleeper';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

describe('lookupSleeperUser', () => {
  it('returns user on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user_id: '123',
        username: 'mstaubach',
        display_name: 'Michael',
      }),
    });
    const user = await lookupSleeperUser('mstaubach');
    expect(user.user_id).toBe('123');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.sleeper.app/v1/user/mstaubach'
    );
  });

  it('throws when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => null });
    await expect(lookupSleeperUser('nobody')).rejects.toThrow('User not found');
  });

  it('throws when response has no user_id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => null,
    });
    await expect(lookupSleeperUser('nobody')).rejects.toThrow('User not found');
  });

  it('URL-encodes the username', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user_id: '9', username: 'a b', display_name: 'A B' }),
    });
    await lookupSleeperUser('a b');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.sleeper.app/v1/user/a%20b'
    );
  });
});

describe('fetchUserLeagues', () => {
  it('maps Sleeper response to SavedLeague array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { league_id: 'abc', name: 'IDP Dynasty 2025' },
        { league_id: 'def', name: 'Best Ball' },
      ],
    });
    const leagues = await fetchUserLeagues('123', '2025');
    expect(leagues).toEqual([
      { leagueId: 'abc', name: 'IDP Dynasty 2025' },
      { leagueId: 'def', name: 'Best Ball' },
    ]);
  });

  it('returns empty array when API returns null', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => null });
    const leagues = await fetchUserLeagues('123', '2025');
    expect(leagues).toEqual([]);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => null });
    await expect(fetchUserLeagues('123', '2025')).rejects.toThrow(
      'Failed to fetch leagues'
    );
  });
});
