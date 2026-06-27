import Link from "next/link";
import { getLeague, getRosters, getUsers } from "@/lib/roster-management/sleeper";

export const revalidate = 300;

export default async function RosterManagementLeaguePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  const [league, rosters, users] = await Promise.all([
    getLeague(leagueId),
    getRosters(leagueId),
    getUsers(leagueId),
  ]);

  if (!league) {
    return (
      <main className="mx-auto max-w-2xl py-12 text-center">
        <p className="mb-4 text-gray-600 dark:text-slate-300">
          No Sleeper league matched &ldquo;{leagueId}&rdquo;. Check the ID and
          try again.
        </p>
        <Link
          href="/roster-management"
          className="text-sm text-green-600 hover:underline dark:text-green-400"
        >
          ← Try another league
        </Link>
      </main>
    );
  }

  const userMap = new Map(users.map((u) => [u.user_id, u.display_name]));

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-gray-900 dark:text-slate-100">
            {league.name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Pick a team to view its depth chart
          </p>
        </div>
        <Link
          href="/roster-management"
          className="text-sm text-green-600 hover:underline dark:text-green-400"
        >
          ← Try another league
        </Link>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {rosters.map((roster) => {
          const ownerName = roster.owner_id
            ? (userMap.get(roster.owner_id) ?? "Unknown")
            : "Unowned";
          return (
            <li key={roster.roster_id}>
              <Link
                href={`/roster-management/${leagueId}/${roster.roster_id}`}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 transition hover:border-green-600/50 dark:border-pitch-700 dark:bg-pitch-800/60 dark:hover:border-green-600/50"
              >
                <span className="font-semibold text-gray-900 dark:text-slate-100">
                  {ownerName}
                </span>
                <span className="text-sm text-gray-500 dark:text-slate-400">
                  Team {roster.roster_id}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
