import Link from "next/link";
import Message from "@/components/trade-tracker/Message";
import TeamTradeCanvas from "@/components/trade-tracker/TeamTradeCanvas";
import { buildTeamView } from "@/lib/trade-tracker/team-view";

export const revalidate = 300;

export default async function TeamPage({
  params,
}: {
  params: Promise<{ leagueId: string; rosterId: string }>;
}) {
  const { leagueId, rosterId: rosterIdParam } = await params;
  const rosterId = Number(rosterIdParam);

  let data;
  try {
    data = Number.isNaN(rosterId)
      ? null
      : await buildTeamView(leagueId, rosterId);
  } catch {
    return (
      <Message
        title="Couldn't load this team"
        body="Sleeper's API didn't respond as expected. Try again in a few minutes."
      />
    );
  }

  if (!data) {
    return (
      <Message
        title="Team not found"
        body="No team matched that link. Go back and pick a team from the list."
      />
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{data.teamName}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {data.trades.length} trade{data.trades.length === 1 ? "" : "s"} ·{" "}
            {data.leagueName}
          </p>
        </div>
        <Link
          href={`/trade-tracker/league/${leagueId}`}
          className="text-sm text-green-600 hover:underline dark:text-green-400"
        >
          ← All teams
        </Link>
      </div>

      {data.trades.length === 0 ? (
        <Message
          title="No trades yet"
          body="This team hasn't made any trades in the league's history."
        />
      ) : (
        <TeamTradeCanvas view={data} />
      )}
    </main>
  );
}
