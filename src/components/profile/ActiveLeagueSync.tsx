'use client';

import { useEffect } from 'react';
import { useProfile } from '@/context/ProfileContext';

// Reaching a league page through the "Different league…" manual-entry form
// (or a direct link) never calls setActiveLeagueId — that only happens via
// LeagueSwitcher. Without this, viewing a saved league that way leaves the
// active-league cookie/localStorage pointing at whatever was active before,
// so the next tool you switch to redirects there instead of this league.
export default function ActiveLeagueSync({ leagueId }: { leagueId: string }) {
  const { profile, activeLeagueId, setActiveLeagueId } = useProfile();

  useEffect(() => {
    if (!profile || activeLeagueId === leagueId) return;
    if (!profile.leagues.some((l) => l.leagueId === leagueId)) return;
    setActiveLeagueId(leagueId);
  }, [profile, activeLeagueId, leagueId, setActiveLeagueId]);

  return null;
}
