import type { ChampionEntry } from "@/lib/standings/types";

export default function ChampionsStrip({
  champions,
}: {
  champions: ChampionEntry[];
}) {
  if (champions.length === 0) {
    return (
      <section className="rounded-xl border border-pitch-700 bg-pitch-800/50 p-5 text-sm text-slate-300">
        No champions crowned yet — the first title is still up for grabs.
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-100">🏆 Champions</h2>
      <div className="flex flex-wrap gap-3">
        {champions.map((c) => (
          <div
            key={c.season}
            className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2"
          >
            <span className="text-sm font-bold text-amber-300">{c.season}</span>
            <span className="text-sm text-slate-200">{c.teamName}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
