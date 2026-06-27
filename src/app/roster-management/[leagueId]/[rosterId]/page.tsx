import Link from "next/link";
import DepthChartTable from "@/components/roster-management/DepthChartTable";
import {
  getLeague,
  getRosters,
  getUsers,
  getPlayers,
} from "@/lib/roster-management/sleeper";
import {
  buildDepthChart,
  derivePositionColumns,
} from "@/lib/roster-management/depth-chart";

export const revalidate = 300;

export default async function RosterPage({
  params,
}: {
  params: Promise<{ leagueId: string; rosterId: string }>;
}) {
  const { leagueId, rosterId } = await params;
  const rosterIdNum = Number(rosterId);

  const [league, rosters, users, players] = await Promise.all([
    getLeague(leagueId),
    getRosters(leagueId),
    getUsers(leagueId),
    getPlayers(),
  ]);

  if (!league) {
    return (
      <main className="mx-auto max-w-2xl py-12 text-center">
        <p className="mb-4 text-gray-600 dark:text-slate-300">
          League not found.
        </p>
        <Link
          href="/roster-management"
          className="text-sm text-green-600 hover:underline dark:text-green-400"
        >
          ← Start over
        </Link>
      </main>
    );
  }

  const roster = rosters.find((r) => r.roster_id === rosterIdNum);
  if (!roster) {
    return (
      <main className="mx-auto max-w-2xl py-12 text-center">
        <p className="mb-4 text-gray-600 dark:text-slate-300">
          Roster not found in this league.
        </p>
        <Link
          href={`/roster-management/${leagueId}`}
          className="text-sm text-green-600 hover:underline dark:text-green-400"
        >
          ← Back to teams
        </Link>
      </main>
    );
  }

  const userMap = new Map(users.map((u) => [u.user_id, u.display_name]));
  const ownerName = roster.owner_id
    ? (userMap.get(roster.owner_id) ?? "Unknown")
    : "Unowned";

  const positions = derivePositionColumns(league.roster_positions);
  const grid = buildDepthChart(roster, players, positions);

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-gray-900 dark:text-slate-100">
            {ownerName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {league.name}
          </p>
        </div>
        <Link
          href={`/roster-management/${leagueId}`}
          className="text-sm text-green-600 hover:underline dark:text-green-400"
        >
          ← Back to teams
        </Link>
      </div>

      <DepthChartTable grid={grid} />
    </main>
  );
}
