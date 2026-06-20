import StandingsTable from "../(components)/StandingsTable";
import FirstPlaceFinish from "../(components)/FirstPlaceFinish";

// Standings are fetched live from the Sleeper API per request so the build
// never depends on outbound network access.
export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  return (
    <main className="flex flex-col gap-8 md:flex-row md:justify-between">
      <div className="max-w-xl">
        <h1 className="mb-4 text-2xl font-bold">IDP Dynasty League</h1>
        <p className="text-slate-300">
          The IDP Dynasty league originally began as a keeper league that
          eventually transformed into a dynasty league. The individual defensive
          format has the teams start 19 total players — offense and defense
          combined.
        </p>
      </div>
      <div className="space-y-4">
        <FirstPlaceFinish />
        <StandingsTable />
      </div>
    </main>
  );
}
