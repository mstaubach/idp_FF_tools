import Link from "next/link";
import TradeCard from "@/components/trade-tracker/TradeCard";
import { buildLeagueTrades } from "@/lib/trade-tracker/resolve";

export const revalidate = 300;

export default async function LeaguePage({
  params,
}: {
  params: { leagueId: string };
}) {
  let data;
  try {
    data = await buildLeagueTrades(params.leagueId);
  } catch (err) {
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

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{data.leagueName}</h1>
          <p className="text-sm text-slate-400">
            {data.trades.length} trade{data.trades.length === 1 ? "" : "s"} ·{" "}
            {data.seasons.join(", ")}
          </p>
        </div>
        <Link href="/trade-tracker" className="text-sm text-emerald-400 hover:underline">
          ← Track another league
        </Link>
      </div>

      {data.trades.length === 0 ? (
        <Message
          title="No trades yet"
          body="This league's history doesn't have any completed trades to track."
        />
      ) : (
        <div className="space-y-4">
          {data.trades.map((trade) => (
            <TradeCard key={`${trade.leagueId}-${trade.id}`} trade={trade} />
          ))}
        </div>
      )}
    </main>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="space-y-4">
      <div className="rounded-xl border border-pitch-700 bg-pitch-800/60 p-6">
        <h1 className="mb-1 text-xl font-bold">{title}</h1>
        <p className="text-slate-300">{body}</p>
        <Link
          href="/trade-tracker"
          className="mt-4 inline-block text-sm text-emerald-400 hover:underline"
        >
          ← Back to start
        </Link>
      </div>
    </main>
  );
}
