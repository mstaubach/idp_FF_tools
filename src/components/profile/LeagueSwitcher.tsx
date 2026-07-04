'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useProfile } from '@/context/ProfileContext';
import { leaguePathFor, toolRootFor } from '@/lib/profile/active-league';

type OpenState = { open: boolean; path: string | null };

export default function LeagueSwitcher() {
  const { profile, activeLeagueId, setActiveLeagueId } = useProfile();
  const pathname = usePathname();
  const router = useRouter();
  const [openState, setOpenState] = useState<OpenState>({
    open: false,
    path: null,
  });
  const ref = useRef<HTMLDivElement>(null);

  const open = openState.open && openState.path === pathname;
  const close = () => setOpenState({ open: false, path: null });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () =>
      document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!profile || profile.leagues.length === 0) return null;

  const activeLeague =
    profile.leagues.find((l) => l.leagueId === activeLeagueId) ?? null;
  const toolRoot = toolRootFor(pathname);

  const handleSelect = (leagueId: string) => {
    setActiveLeagueId(leagueId);
    close();
    const target = leaguePathFor(pathname, leagueId);
    if (target) router.push(target);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() =>
          setOpenState(open ? { open: false, path: null } : { open: true, path: pathname })
        }
        className="flex max-w-[14rem] items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-pitch-800 dark:hover:text-white"
      >
        <span className="truncate">
          {activeLeague ? activeLeague.name : 'Select league'}
        </span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[13rem] rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-pitch-700 dark:bg-pitch-800">
          {profile.leagues.map((league) => {
            const isPrimary = league.leagueId === profile.primaryLeagueId;
            const isActive = league.leagueId === activeLeagueId;
            return (
              <button
                key={league.leagueId}
                onClick={() => handleSelect(league.leagueId)}
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium transition ${
                  isActive
                    ? 'bg-green-700 text-white'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-200 dark:hover:bg-pitch-700 dark:hover:text-white'
                }`}
              >
                {isPrimary && <span className="text-amber-400">★</span>}
                <span className="flex-1 truncate">{league.name}</span>
              </button>
            );
          })}
          {toolRoot && (
            <>
              <hr className="my-1 border-gray-100 dark:border-pitch-700" />
              <Link
                href={`${toolRoot}?picker=1`}
                onClick={close}
                className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-200 dark:hover:bg-pitch-700 dark:hover:text-white"
              >
                Different league…
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
