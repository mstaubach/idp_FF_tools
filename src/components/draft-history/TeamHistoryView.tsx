"use client";

import { useState } from "react";
import {
  slotLabel,
  type SeasonBoard,
  type TeamEntry,
} from "@/lib/draft-history/board";

export default function TeamHistoryView({
  boards,
  teams,
}: {
  boards: SeasonBoard[];
  teams: TeamEntry[];
}) {
  const [teamIdx, setTeamIdx] = useState(0);
  const team = teams[teamIdx];

  // Boards arrive newest-first; within a season, order by pick number.
  const rows = boards.flatMap((b) =>
    b.cells
      .filter((c) => c.drafterRosterId === team.rosterId)
      .sort((a, z) => a.pickNo - z.pickNo)
      .map((cell) => ({ season: b.season, cell })),
  );

  const headerClass = "px-3 py-2 font-semibold text-gray-500 dark:text-slate-400";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {teams.map((t, i) => (
          <button
            key={t.rosterId}
            onClick={() => setTeamIdx(i)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              i === teamIdx
                ? "bg-amber-400 text-gray-900"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-pitch-800 dark:hover:text-white"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">
          No rookie picks yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-pitch-700">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-gray-50 dark:bg-pitch-800/60">
              <tr>
                <th className={headerClass}>Season</th>
                <th className={headerClass}>Pick</th>
                <th className={headerClass}>Player</th>
                <th className={headerClass}>Pos</th>
                <th className={headerClass}>Via</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-pitch-700 dark:bg-pitch-800/30">
              {rows.map(({ season, cell }) => (
                <tr key={`${season}-${cell.pickNo}`}>
                  <td className="px-3 py-2 font-mono text-gray-500 dark:text-slate-400">
                    {season}
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-900 dark:text-slate-100">
                    {slotLabel(cell.round, cell.slot)}
                  </td>
                  <td className="px-3 py-2 font-semibold text-gray-900 dark:text-slate-100">
                    {cell.playerName}
                  </td>
                  <td className="px-3 py-2 text-xs font-medium text-green-600 dark:text-green-400">
                    {cell.position
                      ? `${cell.position}${cell.nflTeam ? ` · ${cell.nflTeam}` : ""}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {cell.isTraded ? (
                      <span className="text-amber-600 dark:text-amber-400">
                        via {cell.originalOwnerTeamName}
                      </span>
                    ) : (
                      <span className="text-gray-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
