import { redirect } from "next/navigation";

async function goToLeague(formData: FormData) {
  "use server";
  const raw = String(formData.get("leagueId") ?? "").trim();
  // Accept either a bare league ID or a pasted Sleeper URL containing one.
  const match = raw.match(/(\d{6,})/);
  if (match) redirect(`/trade-tracker/league/${match[1]}`);
  redirect("/trade-tracker?error=1");
}

export default async function TradeTrackerHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-6xl space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold">
          What did your trade actually become?
        </h1>
        <p className="max-w-2xl text-slate-300">
          Trade away a first-round pick for Tee Higgins? This tool follows that
          pick to the draft and shows you exactly who got selected with it — so
          you can finally settle who won the trade.
        </p>
      </section>

      <form action={goToLeague} className="max-w-xl space-y-3">
        <label htmlFor="leagueId" className="block text-sm font-medium text-slate-300">
          Sleeper League ID
        </label>
        <div className="flex gap-2">
          <input
            id="leagueId"
            name="leagueId"
            type="text"
            inputMode="numeric"
            placeholder="e.g. 992734045862027264"
            required
            className="flex-1 rounded-lg border border-pitch-700 bg-pitch-800 px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-hidden"
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-500"
          >
            Track trades
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-400">
            Please enter a valid Sleeper league ID.
          </p>
        )}
      </form>

      <section className="max-w-2xl rounded-xl border border-pitch-700 bg-pitch-800/50 p-5 text-sm text-slate-300">
        <h2 className="mb-2 font-semibold text-slate-100">
          Where do I find my league ID?
        </h2>
        <p>
          Open your league in the Sleeper web app. The long number in the URL
          (<code className="text-emerald-400">sleeper.com/leagues/&lt;LEAGUE_ID&gt;</code>)
          is your league ID. You can paste the whole URL above too.
        </p>
      </section>
    </main>
  );
}
