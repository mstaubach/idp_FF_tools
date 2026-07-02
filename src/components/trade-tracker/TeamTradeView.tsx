"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { TeamView } from "@/lib/trade-tracker/team-view";
import { summarizeTeamView } from "@/lib/trade-tracker/summary";
import SummaryStrip from "./SummaryStrip";
import TeamTradeCanvas from "./TeamTradeCanvas";
import TradeTimeline from "./TradeTimeline";

const STORAGE_KEY = "trade-tracker:view-mode";
type Mode = "timeline" | "flow";

const MODE_EVENT = "trade-tracker:view-mode-change";

const MODES: { mode: Mode; label: string }[] = [
  { mode: "timeline", label: "Timeline" },
  { mode: "flow", label: "Pick-chain flow" },
];

// localStorage-backed mode via useSyncExternalStore: the server snapshot is
// always "timeline", and React reconciles the persisted client value after
// hydration without a mismatch.
function subscribeToMode(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(MODE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(MODE_EVENT, callback);
  };
}

function readMode(): Mode {
  return localStorage.getItem(STORAGE_KEY) === "flow" ? "flow" : "timeline";
}

export default function TeamTradeView({
  view,
  leagueId,
}: {
  view: TeamView;
  leagueId: string;
}) {
  const mode = useSyncExternalStore(subscribeToMode, readMode, () => "timeline");

  function switchMode(next: Mode) {
    localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(MODE_EVENT));
  }

  const stats = useMemo(() => summarizeTeamView(view), [view]);

  return (
    <div className="space-y-6">
      <SummaryStrip stats={stats} />

      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 dark:border-pitch-700 dark:bg-pitch-800">
        {MODES.map(({ mode: m, label }) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            aria-pressed={mode === m}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === m
                ? "bg-green-700 text-white"
                : "text-gray-600 hover:text-gray-900 dark:text-slate-300 dark:hover:text-slate-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "timeline" ? (
        <TradeTimeline view={view} leagueId={leagueId} />
      ) : (
        <TeamTradeCanvas view={view} leagueId={leagueId} />
      )}
    </div>
  );
}
