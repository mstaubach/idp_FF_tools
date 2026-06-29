import Link from "next/link";
import TaxiFillerTable from "@/components/taxi-filler/TaxiFillerTable";
import { getLeague, getRosters, getPlayers } from "@/lib/taxi-filler/sleeper";
import {
  buildTaxiCandidates,
  deriveEligiblePositions,
} from "@/lib/taxi-filler/filter";

export const revalidate = 300;

export default async function TaxiFillerLeaguePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  const [league, rosters, players] = await Promise.all([
    getLeague(leagueId),
    getRosters(leagueId),
    getPlayers(),
  ]);

  if (!league) {
    return (
      <main className="mx-auto max-w-2xl py-12 text-center">
        <p className="mb-4 text-gray-600 dark:text-slate-300">
          No Sleeper league matched &ldquo;{leagueId}&rdquo;. Check the ID and
          try again.
        </p>
        <Link
          href="/taxi-filler"
          className="text-sm text-green-600 hover:underline dark:text-green-400"
        >
          ← Try another league
        </Link>
      </main>
    );
  }

  const taxiYears = league.settings.taxi_years ?? 1;
  const leaguePositions = deriveEligiblePositions(league.roster_positions);
  const candidates = buildTaxiCandidates(rosters, players, leaguePositions, taxiYears);

  const subtitle =
    taxiYears === 1
      ? "Showing rookies available on waivers"
      : `Showing rookies + players with up to ${taxiYears - 1} year${
          taxiYears - 1 === 1 ? "" : "s"
        } of experience available on waivers`;

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-gray-900 dark:text-slate-100">
            {league.name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>
        <Link
          href="/taxi-filler"
          className="text-sm text-green-600 hover:underline dark:text-green-400"
        >
          ← Try another league
        </Link>
      </div>

      {candidates.length === 0 ? (
        <p className="text-gray-600 dark:text-slate-300">
          No eligible players found on the waiver wire for this league&apos;s
          taxi settings.
        </p>
      ) : (
        <TaxiFillerTable candidates={candidates} positions={leaguePositions} />
      )}
    </main>
  );
}
