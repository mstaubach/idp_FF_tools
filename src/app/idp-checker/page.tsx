'use client';

import { useState, useCallback } from 'react';
import LeagueInput from '@/components/idp-checker/LeagueInput';
import PlayerInput from '@/components/idp-checker/PlayerInput';
import ResultsTable from '@/components/idp-checker/ResultsTable';
import Filters from '@/components/idp-checker/Filters';
import WaiverInfo from '@/components/idp-checker/WaiverInfo';
import UnmatchedPlayers from '@/components/idp-checker/UnmatchedPlayers';
import ErrorBanner from '@/components/idp-checker/ErrorBanner';
import { ParsedPlayer, CheckAvailabilityResponse } from '@/lib/idp-checker/types';

const DEFAULT_LEAGUE_ID = '';

export default function IdpCheckerPage() {
  const [leagueId, setLeagueId] = useState(DEFAULT_LEAGUE_ID);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CheckAvailabilityResponse | null>(null);
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [availableOnly, setAvailableOnly] = useState(false);

  const handleSubmit = useCallback(async (players: ParsedPlayer[]) => {
    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch('/api/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players, leagueId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      const result: CheckAvailabilityResponse = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [leagueId]);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-black tracking-tighter text-gray-900 dark:text-slate-100 mb-2">
        Waiver Check
      </h1>
      <p className="text-gray-600 dark:text-slate-400 mb-6">
        Paste your IDP rankings and check player availability in your Sleeper league.
      </p>

      <div className="space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-pitch-700 dark:bg-pitch-800">
          <LeagueInput leagueId={leagueId} onChange={setLeagueId} />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-pitch-700 dark:bg-pitch-800">
          <PlayerInput onSubmit={handleSubmit} isLoading={isLoading} />
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {data && (
          <>
            {data.waiverInfo && (
              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-pitch-700 dark:bg-pitch-800">
                <WaiverInfo waiverInfo={data.waiverInfo} />
              </div>
            )}

            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-pitch-700 dark:bg-pitch-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                  Results ({data.results.length} players)
                </h2>
                <Filters
                  positionFilter={positionFilter}
                  onPositionChange={setPositionFilter}
                  availableOnly={availableOnly}
                  onAvailableOnlyChange={setAvailableOnly}
                />
              </div>
              <ResultsTable
                results={data.results}
                positionFilter={positionFilter}
                availableOnly={availableOnly}
              />
            </div>

            <UnmatchedPlayers players={data.unmatchedPlayers} />
          </>
        )}
      </div>
    </div>
  );
}
