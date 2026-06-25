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
    <div className="bg-gray-50 text-gray-900 rounded-2xl border border-pitch-700">
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Sleeper IDP Availability Checker
        </h1>
        <p className="text-gray-600 mb-6">
          Paste your IDP rankings and check player availability in your Sleeper league.
        </p>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-xs border p-4">
            <LeagueInput leagueId={leagueId} onChange={setLeagueId} />
          </div>

          <div className="bg-white rounded-lg shadow-xs border p-4">
            <PlayerInput onSubmit={handleSubmit} isLoading={isLoading} />
          </div>

          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          {data && (
            <>
              {data.waiverInfo && (
                <div className="bg-white rounded-lg shadow-xs border p-4">
                  <WaiverInfo waiverInfo={data.waiverInfo} />
                </div>
              )}

              <div className="bg-white rounded-lg shadow-xs border p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
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
      </main>
    </div>
  );
}
