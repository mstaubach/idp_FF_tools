import Link from "next/link";
import Message from "@/components/trade-tracker/Message";
import { listLeagueTeams } from "@/lib/trade-tracker/team-view";

export const revalidate = 300;

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  let data;
  try {
    data = await listLeagueTeams(leagueId);
  } catch {
    return (
      <Message
        title="Couldn't load this league"
        body="Sleeper's API didn't respond as expected. Double-check the league ID and try again."
      />
    );
  }

  if (!data) {
    return (
      <Message
        title="League not found"
        body={`No Sleeper league matched the ID "${leagueId}". Make sure you copied the full ID.`}
      />
    );
  }

  const teams = [...data.teams].sort(
    (a, b) => b.tradeCount - a.tradeCount || a.teamName.localeCompare(b.teamName),
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-gray-900 dark:text-slate-100">{data.leagueName}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Pick a team to see its trade history</p>
        </div>
        <Link href="/trade-tracker" className="text-sm text-green-600 hover:underline dark:text-green-400">
          ← Track another league
        </Link>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {teams.map((t) => (
          <li key={t.rosterId}>
            <Link
              href={`/trade-tracker/league/${leagueId}/team/${t.rosterId}`}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 hover:border-green-600/50 dark:border-pitch-700 dark:bg-pitch-800/60 dark:hover:border-green-600/50"
            >
              <span>
                <span className="font-semibold text-gray-900 dark:text-slate-100">{t.teamName}</span>
                <span className="block text-xs text-gray-500 dark:text-slate-400">{t.ownerName}</span>
              </span>
              <span className="text-sm text-gray-500 dark:text-slate-400">
                {t.tradeCount} trade{t.tradeCount === 1 ? "" : "s"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
