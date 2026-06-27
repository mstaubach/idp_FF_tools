import Link from "next/link";
import { getLeagueName, loadLeagueHistory } from "@/lib/standings/sleeper";
import ChampionsStrip from "@/components/standings/ChampionsStrip";
import StandingsView from "@/components/standings/StandingsView";

export const dynamic = "force-dynamic";

export default async function LeagueStandingsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const [leagueName, history] = await Promise.all([
    getLeagueName(leagueId),
    loadLeagueHistory(leagueId),
  ]);

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {leagueName ?? "League Standings"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">All-time history · League ID {leagueId}</p>
        </div>
        <Link href="/standings" className="text-sm text-green-600 hover:underline dark:text-green-400">
          ← Look up another league
        </Link>
      </div>

      {history ? (
        <>
          <ChampionsStrip champions={history.champions} />
          <StandingsView history={history} />
        </>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600 dark:border-pitch-700 dark:bg-pitch-800/50 dark:text-slate-300">
          Standings are temporarily unavailable. The Sleeper API couldn&apos;t be
          reached, or this league ID has no data — try again in a moment.
        </div>
      )}
    </main>
  );
}
