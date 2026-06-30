'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { Profile } from '@/lib/profile/types';

const STORAGE_KEY = 'idp_dynasty_profile';

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
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Profile = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.leagues) && parsed.primaryLeagueId) {
          setProfileState(parsed);
          setActiveLeagueId(parsed.primaryLeagueId);
        }
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  const setProfile = (p: Profile) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    setProfileState(p);
    setActiveLeagueId(p.primaryLeagueId);
  };

  const clearProfile = () => {
    localStorage.removeItem(STORAGE_KEY);
    setProfileState(null);
    setActiveLeagueId(null);
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
