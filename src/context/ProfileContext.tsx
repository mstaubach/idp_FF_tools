'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  startTransition,
  ReactNode,
} from 'react';
import { Profile } from '@/lib/profile/types';
import { activeLeagueCookieString } from '@/lib/profile/active-league';

const STORAGE_KEY = 'idp_dynasty_profile';
const ACTIVE_LEAGUE_KEY = 'idp_dynasty_active_league';

function persistActiveLeague(id: string | null) {
  if (id === null) {
    localStorage.removeItem(ACTIVE_LEAGUE_KEY);
  } else {
    localStorage.setItem(ACTIVE_LEAGUE_KEY, id);
  }
  document.cookie = activeLeagueCookieString(id);
}

type ProfileContextValue = {
  profile: Profile | null;
  activeLeagueId: string | null;
  setProfile: (p: Profile) => void;
  setActiveLeagueId: (id: string) => void;
  clearProfile: () => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [activeLeagueId, setActiveLeagueIdState] = useState<string | null>(
    null
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Profile = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.leagues) && parsed.primaryLeagueId) {
          const stored = localStorage.getItem(ACTIVE_LEAGUE_KEY);
          const active = parsed.leagues.some((l) => l.leagueId === stored)
            ? (stored as string)
            : parsed.primaryLeagueId;
          persistActiveLeague(active);
          startTransition(() => {
            setProfileState(parsed);
            setActiveLeagueIdState(active);
          });
        }
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  const setActiveLeagueId = (id: string) => {
    persistActiveLeague(id);
    setActiveLeagueIdState(id);
  };

  const setProfile = (p: Profile) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    const active = p.leagues.some((l) => l.leagueId === activeLeagueId)
      ? (activeLeagueId as string)
      : p.primaryLeagueId;
    persistActiveLeague(active);
    setProfileState(p);
    setActiveLeagueIdState(active);
  };

  const clearProfile = () => {
    localStorage.removeItem(STORAGE_KEY);
    persistActiveLeague(null);
    setProfileState(null);
    setActiveLeagueIdState(null);
  };

  return (
    <ProfileContext.Provider
      value={{ profile, activeLeagueId, setProfile, setActiveLeagueId, clearProfile }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
