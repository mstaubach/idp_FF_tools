import Link from "next/link";
import { getLeagueName, loadLeagueHistory } from "@/lib/standings/sleeper";
import ChampionsStrip from "@/components/standings/ChampionsStrip";
import StandingsView from "@/components/standings/StandingsView";

// Standings are fetched per request (the client uses revalidate TTLs); the
// build never makes network calls.
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
          <h1 className="text-2xl font-bold">
            {leagueName ?? "League Standings"}
          </h1>
          <p className="text-sm text-slate-400">All-time history · League ID {leagueId}</p>
        </div>
        <Link href="/standings" className="text-sm text-emerald-400 hover:underline">
          ← Look up another league
        </Link>
      </div>

      {history ? (
        <>
          <ChampionsStrip champions={history.champions} />
          <StandingsView history={history} />
        </>
      ) : (
        <div className="rounded-xl border border-pitch-700 bg-pitch-800/50 p-5 text-sm text-slate-300">
          Standings are temporarily unavailable. The Sleeper API couldn&apos;t be
          reached, or this league ID has no data — try again in a moment.
        </div>
      )}
    </main>
  );
}
