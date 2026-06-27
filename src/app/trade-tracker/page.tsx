import { redirect } from "next/navigation";

async function goToLeague(formData: FormData) {
  "use server";
  const raw = String(formData.get("leagueId") ?? "").trim();
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
    <main className="mx-auto max-w-5xl space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-black tracking-tighter text-gray-900 dark:text-slate-100">
          What did your trade actually become?
        </h1>
        <p className="text-gray-600 dark:text-slate-300">
          Trade away a first-round pick for Tee Higgins? This tool follows that
          pick to the draft and shows you exactly who got selected with it — so
          you can finally settle who won the trade.
        </p>
      </section>

      <form action={goToLeague} className="space-y-3">
        <label htmlFor="leagueId" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
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
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-green-600 focus:outline-hidden dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white transition hover:bg-green-600"
          >
            Track trades
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-500 dark:text-red-400">
            Please enter a valid Sleeper league ID.
          </p>
        )}
      </form>

      <section className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600 dark:border-pitch-700 dark:bg-pitch-800/50 dark:text-slate-300">
        <h2 className="mb-2 font-semibold text-gray-900 dark:text-slate-100">
          Where do I find my league ID?
        </h2>
        <p>
          Open your league in the Sleeper web app. The long number in the URL
          (<code className="text-green-600 dark:text-green-400">sleeper.com/leagues/&lt;LEAGUE_ID&gt;</code>)
          is your league ID. You can paste the whole URL above too.
        </p>
      </section>
    </main>
  );
}
