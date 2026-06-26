"use client";

import { useState } from "react";
import type { LeagueHistory } from "@/lib/standings/types";
import AllTimeTable from "./AllTimeTable";
import SeasonTable from "./SeasonTable";

const ALL_TIME = "all-time";

export default function StandingsView({ history }: { history: LeagueHistory }) {
  const [selected, setSelected] = useState<string>(ALL_TIME);
  const season = history.seasons.find((s) => s.season === selected);

  const buttonClass = (active: boolean) =>
    active
      ? "rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white"
      : "rounded-lg border border-pitch-700 bg-pitch-800 px-3 py-1.5 text-sm text-slate-300 hover:border-emerald-500";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelected(ALL_TIME)}
          className={buttonClass(selected === ALL_TIME)}
        >
          All-time
        </button>
        {history.seasons.map((s) => (
          <button
            key={s.season}
            type="button"
            onClick={() => setSelected(s.season)}
            className={buttonClass(selected === s.season)}
          >
            {s.season}
          </button>
        ))}
      </div>

      {selected === ALL_TIME || !season ? (
        <AllTimeTable records={history.allTime} />
      ) : (
        <SeasonTable season={season} />
      )}
    </section>
  );
}
