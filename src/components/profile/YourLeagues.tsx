'use client';

import { useRouter } from 'next/navigation';
import { useProfile } from '@/context/ProfileContext';

type Props = {
  toolPath: string;
  onLeagueSelect?: (leagueId: string) => void;
};

export default function YourLeagues({ toolPath, onLeagueSelect }: Props) {
  const { profile, activeLeagueId, setActiveLeagueId } = useProfile();
  const router = useRouter();

  if (!profile || !profile.leagues.length) return null;

  const handleSelect = (leagueId: string) => {
    setActiveLeagueId(leagueId);
    if (onLeagueSelect) {
      onLeagueSelect(leagueId);
    } else {
      router.push(`${toolPath}/${leagueId}`);
    }
  };

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-700 dark:text-slate-300">
          Your Leagues
        </h2>
        <div className="flex flex-wrap gap-2">
          {profile.leagues.map((league) => {
            const isPrimary = league.leagueId === profile.primaryLeagueId;
            const isActive = league.leagueId === activeLeagueId;
            return (
              <button
                key={league.leagueId}
                onClick={() => handleSelect(league.leagueId)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'border-green-600 bg-green-700 text-white'
                    : isPrimary
                    ? 'border-amber-400 text-gray-900 hover:bg-amber-50 dark:text-slate-100 dark:hover:bg-amber-400/10'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-pitch-700 dark:text-slate-300 dark:hover:bg-pitch-800'
                }`}
              >
                {isPrimary && (
                  <span className="mr-1 text-amber-500">★</span>
                )}
                {league.name}
              </button>
            );
          })}
        </div>
      </section>
      <div className="flex items-center gap-3">
        <hr className="flex-1 border-gray-200 dark:border-pitch-700" />
        <span className="text-xs text-gray-400 dark:text-slate-500">
          or enter a league ID manually
        </span>
        <hr className="flex-1 border-gray-200 dark:border-pitch-700" />
      </div>
    </div>
  );
}
