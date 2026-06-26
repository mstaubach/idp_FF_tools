import Link from "next/link";
import StandingsTable from "../../(components)/StandingsTable";

// Standings are fetched live per request so the build never depends on
// outbound network access.
export const dynamic = "force-dynamic";

async function fetchLeagueName(leagueId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.sleeper.app/v1/league/${leagueId}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const league = await res.json();
    return league?.name ?? null;
  } catch {
    return null;
  }
}

export default async function LeagueStandingsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const leagueName = await fetchLeagueName(leagueId);

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {leagueName ?? "League Standings"}
          </h1>
          <p className="text-sm text-slate-400">League ID {leagueId}</p>
        </div>
        <Link
          href="/standings"
          className="text-sm text-emerald-400 hover:underline"
        >
          ← Look up another league
        </Link>
      </div>

      <StandingsTable leagueId={leagueId} />
    </main>
  );
}
