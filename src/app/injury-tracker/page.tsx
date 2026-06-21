import Link from "next/link";

export const metadata = {
  title: "Injury Tracker — Coming Soon",
};

export default function InjuryTrackerPage() {
  return (
    <main className="mx-auto max-w-2xl py-12 text-center">
      <div className="rounded-2xl border border-pitch-700 bg-pitch-800/50 p-10">
        <div className="mb-4 text-5xl">🚑</div>
        <h1 className="mb-2 text-3xl font-bold">Injury Tracker</h1>
        <span className="mb-6 inline-block rounded-full bg-emerald-600/20 px-3 py-1 text-sm font-medium text-emerald-400">
          Coming soon
        </span>
        <p className="mx-auto mb-8 max-w-md text-slate-300">
          A central place to monitor injury news for the players on your Sleeper
          rosters — practice status, game designations, and return timelines.
          We&apos;re still building this one.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-500"
        >
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
