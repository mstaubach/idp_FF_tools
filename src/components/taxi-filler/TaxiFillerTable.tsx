"use client";

import { useState } from "react";
import type { TaxiCandidate } from "@/lib/taxi-filler/types";

export default function TaxiFillerTable({
  candidates,
  positions,
}: {
  candidates: TaxiCandidate[];
  positions: string[];
}) {
  const [activePosition, setActivePosition] = useState<string>("All");

  // Only show a position tab if at least one candidate has that position.
  const presentPositions = positions.filter((pos) =>
    candidates.some((c) => c.position === pos),
  );

  const filtered =
    activePosition === "All"
      ? candidates
      : candidates.filter((c) => c.position === activePosition);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["All", ...presentPositions].map((pos) => (
          <button
            key={pos}
            onClick={() => setActivePosition(pos)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              activePosition === pos
                ? "bg-green-700 text-white"
                : "border border-gray-200 bg-white text-gray-700 hover:border-green-600/50 dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-300 dark:hover:border-green-600/50"
            }`}
          >
            {pos}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-pitch-700">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {["Rank", "Name", "Position", "Team", "Age", "Exp"].map((col) => (
                <th
                  key={col}
                  className="border-b border-gray-200 bg-green-700 px-4 py-2.5 text-center font-bold text-white dark:border-pitch-700"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.playerId}
                className="border-b border-gray-100 dark:border-pitch-700"
              >
                {/* Left border on first cell — border-l on <tr> doesn't render inside border-collapse tables */}
                <td
                  className={`px-4 py-2 text-center text-gray-700 dark:text-slate-300 ${
                    c.yearsExp === 0 ? "border-l-2 border-l-green-500" : ""
                  }`}
                >
                  {c.searchRank ?? "—"}
                </td>
                <td className="px-4 py-2 text-center font-medium text-gray-900 dark:text-slate-100">
                  {c.name}
                </td>
                <td className="px-4 py-2 text-center text-gray-700 dark:text-slate-300">
                  {c.position}
                </td>
                <td className="px-4 py-2 text-center text-gray-700 dark:text-slate-300">
                  {c.team ?? "FA"}
                </td>
                <td className="px-4 py-2 text-center text-gray-700 dark:text-slate-300">
                  {c.age ?? "—"}
                </td>
                <td className="px-4 py-2 text-center text-gray-700 dark:text-slate-300">
                  {c.yearsExp === 0 ? "Rookie" : `${c.yearsExp} yr${c.yearsExp === 1 ? "" : "s"}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
