import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  _fetchPlayersRaw,
  _fetchRostersRaw,
  _fetchUsersRaw,
  _fetchLeagueRaw,
} from '@/lib/idp-checker/sleeper';

describe('sleeper client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('_fetchPlayersRaw', () => {
    it('fetches and filters to defensive players only', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          '1': { player_id: '1', full_name: 'Pat Queen', first_name: 'Pat', last_name: 'Queen', position: 'LB', team: 'BAL', active: true },
          '2': { player_id: '2', full_name: 'Josh Allen', first_name: 'Josh', last_name: 'Allen', position: 'QB', team: 'BUF', active: true },
          '3': { player_id: '3', full_name: 'Myles Garrett', first_name: 'Myles', last_name: 'Garrett', position: 'DE', team: 'CLE', active: true },
        }),
      });
      const players = await _fetchPlayersRaw();
      expect(players).toHaveLength(2);
      expect(players.map(p => p.full_name)).toContain('Pat Queen');
      expect(players.map(p => p.full_name)).toContain('Myles Garrett');
      expect(players.map(p => p.full_name)).not.toContain('Josh Allen');
    });

    it('throws on API failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(_fetchPlayersRaw()).rejects.toThrow('Sleeper API error');
    });
  });

  describe('_fetchRostersRaw', () => {
    it('fetches rosters for a league', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          { roster_id: 1, owner_id: 'u1', players: ['1', '2'], starters: ['1'], reserve: null, taxi: null },
        ]),
      });
      const rosters = await _fetchRostersRaw('league123');
      expect(rosters).toHaveLength(1);
      expect(rosters[0].owner_id).toBe('u1');
    });
  });

  describe('_fetchUsersRaw', () => {
    it('fetches users for a league', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          { user_id: 'u1', display_name: 'Mike', metadata: { team_name: "Mike's Team" } },
        ]),
      });
      const users = await _fetchUsersRaw('league123');
      expect(users).toHaveLength(1);
      expect(users[0].display_name).toBe('Mike');
    });
  });

  describe('_fetchLeagueRaw', () => {
    it('fetches league settings', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          league_id: 'league123',
          name: 'Test League',
          settings: { waiver_type: 2, waiver_budget: 100 },
        }),
      });
      const league = await _fetchLeagueRaw('league123');
      expect(league.settings.waiver_type).toBe(2);
    });

    it('throws on invalid league ID', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      await expect(_fetchLeagueRaw('bad')).rejects.toThrow();
    });
  });
});
