import Link from "next/link";

export const metadata = {
  title: "Injury Tracker — Coming Soon",
};

export default function InjuryTrackerPage() {
  return (
    <main className="mx-auto max-w-2xl py-12 text-center">
      <div className="rounded-2xl border border-gray-200 bg-white p-10 dark:border-pitch-700 dark:bg-pitch-800/50">
        <div className="mb-4 text-5xl">🚑</div>
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-slate-100">Injury Tracker</h1>
        <span className="mb-6 inline-block rounded-full bg-green-700/20 px-3 py-1 text-sm font-medium text-green-600 dark:text-green-400">
          Coming soon
        </span>
        <p className="mx-auto mb-8 max-w-md text-gray-600 dark:text-slate-300">
          A central place to monitor injury news for the players on your Sleeper
          rosters — practice status, game designations, and return timelines.
          We&apos;re still building this one.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white transition hover:bg-green-600"
        >
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
