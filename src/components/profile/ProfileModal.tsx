'use client';

import { useState, useEffect } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { lookupSleeperUser, fetchCurrentSeasonLeagues } from '@/lib/profile/sleeper';
import { SavedLeague, Profile } from '@/lib/profile/types';

type Step = 'username' | 'leagues';

type Props = {
  onClose: () => void;
};

export default function ProfileModal({ onClose }: Props) {
  const { profile, setProfile } = useProfile();

  const [step, setStep] = useState<Step>(profile ? 'leagues' : 'username');
  const [username, setUsername] = useState(profile?.sleeperUsername ?? '');
  const [userId, setUserId] = useState(profile?.sleeperUserId ?? '');
  const [leagues, setLeagues] = useState<SavedLeague[]>(profile?.leagues ?? []);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(profile?.leagues.map((l) => l.leagueId) ?? [])
  );
  const [primaryLeagueId, setPrimaryLeagueId] = useState(
    profile?.primaryLeagueId ?? ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [season, setSeason] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await lookupSleeperUser(username.trim());
      const { season: resolvedSeason, leagues: fetched } =
        await fetchCurrentSeasonLeagues(user.user_id);
      setUserId(user.user_id);
      setSeason(resolvedSeason);
      setLeagues(fetched);
      setSelected(new Set(fetched.map((l) => l.leagueId)));
      setPrimaryLeagueId(fetched[0]?.leagueId ?? '');
      setStep('leagues');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const toggleLeague = (leagueId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(leagueId)) {
        next.delete(leagueId);
        if (primaryLeagueId === leagueId) {
          const remaining = leagues.find((l) => next.has(l.leagueId));
          setPrimaryLeagueId(remaining?.leagueId ?? '');
        }
      } else {
        next.add(leagueId);
      }
      return next;
    });
  };

  const handleSave = () => {
    const saved = leagues.filter((l) => selected.has(l.leagueId));
    if (!saved.length) {
      setError('Select at least one league.');
      return;
    }
    if (!primaryLeagueId || !selected.has(primaryLeagueId)) {
      setError('Choose a primary league (click the ★).');
      return;
    }
    const newProfile: Profile = {
      sleeperUsername: username.trim(),
      sleeperUserId: userId,
      leagues: saved,
      primaryLeagueId,
    };
    setProfile(newProfile);
    onClose();
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="profile-modal-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-pitch-700 dark:bg-pitch-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="profile-modal-title" className="text-lg font-bold text-gray-900 dark:text-slate-100">
            {step === 'username' ? 'Set up your profile' : 'Your leagues'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {step === 'username' && (
          <form onSubmit={handleLookup} className="space-y-4">
            <div>
              <label
                htmlFor="sleeper-username"
                className="block text-sm font-medium text-gray-700 dark:text-slate-300"
              >
                Sleeper username
              </label>
              <input
                id="sleeper-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. mstaubach"
                required
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-green-600 focus:outline-hidden dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-green-700 px-4 py-2.5 font-semibold text-white transition hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Looking up…' : 'Look up'}
            </button>
          </form>
        )}

        {step === 'leagues' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Select leagues to save. Star one as your primary.
            </p>
            {leagues.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-slate-500">
                No leagues found for the {season} season.
              </p>
            )}
            <ul className="space-y-2">
              {leagues.map((league) => (
                <li key={league.leagueId} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`league-${league.leagueId}`}
                    checked={selected.has(league.leagueId)}
                    onChange={() => toggleLeague(league.leagueId)}
                    className="h-4 w-4 accent-green-600"
                  />
                  <label
                    htmlFor={`league-${league.leagueId}`}
                    className="flex-1 cursor-pointer text-sm text-gray-800 dark:text-slate-200"
                  >
                    {league.name}
                    <span className="ml-1 text-xs text-gray-400 dark:text-slate-500">
                      {league.leagueId}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setPrimaryLeagueId(league.leagueId)}
                    disabled={!selected.has(league.leagueId)}
                    title={
                      primaryLeagueId === league.leagueId
                        ? 'Primary league'
                        : 'Set as primary'
                    }
                    className={`text-lg disabled:opacity-30 ${
                      primaryLeagueId === league.leagueId
                        ? 'text-amber-400'
                        : 'text-gray-300 hover:text-amber-400'
                    }`}
                  >
                    ★
                  </button>
                </li>
              ))}
            </ul>
            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep('username');
                  setError(null);
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-pitch-700 dark:text-slate-300 dark:hover:bg-pitch-800"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-600"
              >
                Save profile
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
