import Link from "next/link";
import Message from "@/components/trade-tracker/Message";
import { listLeagueTeams } from "@/lib/trade-tracker/team-view";

export const revalidate = 300;

export default async function LeaguePage({
  params,
}: {
  params: { leagueId: string };
}) {
  let data;
  try {
    data = await listLeagueTeams(params.leagueId);
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
        body={`No Sleeper league matched the ID "${params.leagueId}". Make sure you copied the full ID.`}
      />
    );
  }

  const teams = [...data.teams].sort(
    (a, b) => b.tradeCount - a.tradeCount || a.teamName.localeCompare(b.teamName),
  );

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{data.leagueName}</h1>
          <p className="text-sm text-slate-400">Pick a team to see its trade history</p>
        </div>
        <Link href="/trade-tracker" className="text-sm text-emerald-400 hover:underline">
          ← Track another league
        </Link>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {teams.map((t) => (
          <li key={t.rosterId}>
            <Link
              href={`/trade-tracker/league/${params.leagueId}/team/${t.rosterId}`}
              className="flex items-center justify-between rounded-xl border border-pitch-700 bg-pitch-800/60 p-4 hover:border-emerald-500/50"
            >
              <span>
                <span className="font-semibold text-slate-100">{t.teamName}</span>
                <span className="block text-xs text-slate-400">{t.ownerName}</span>
              </span>
              <span className="text-sm text-slate-400">
                {t.tradeCount} trade{t.tradeCount === 1 ? "" : "s"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
