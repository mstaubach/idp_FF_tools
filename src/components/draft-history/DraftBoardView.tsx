"use client";

import { useState } from "react";
import type { BoardCell, SeasonBoard, TeamEntry } from "@/lib/draft-history/board";
import SlotHistoryModal from "./SlotHistoryModal";
import TeamHistoryView from "./TeamHistoryView";

function cellAt(
  board: SeasonBoard,
  round: number,
  slot: number,
): BoardCell | undefined {
  return board.cells.find((c) => c.round === round && c.slot === slot);
}

export default function DraftBoardView({
  boards,
  teams,
}: {
  boards: SeasonBoard[];
  teams: TeamEntry[];
}) {
  const [view, setView] = useState<"season" | "team">("season");
  const [seasonIdx, setSeasonIdx] = useState(0);
  const [teamIdx, setTeamIdx] = useState(0);
  const [selected, setSelected] = useState<{ round: number; slot: number } | null>(
    null,
  );
  const board = boards[seasonIdx];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-gray-200 pb-3 dark:border-pitch-700">
        {(
          [
            ["season", "By Season"],
            ["team", "By Team"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              view === key
                ? "bg-amber-400 text-gray-900"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-pitch-800 dark:hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "season" ? (
        <>
          <div className="flex flex-wrap gap-1">
            {boards.map((b, i) => (
              <button
                key={b.season}
                onClick={() => setSeasonIdx(i)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  i === seasonIdx
                    ? "bg-amber-400 text-gray-900"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-pitch-800 dark:hover:text-white"
                }`}
              >
                {b.season}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-pitch-700">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-gray-50 dark:bg-pitch-800/60">
                <tr>
                  <th className="px-3 py-2 font-semibold text-gray-500 dark:text-slate-400">
                    Rd
                  </th>
                  {Array.from({ length: board.slots }, (_, i) => (
                    <th key={i} className="min-w-[9rem] px-3 py-2">
                      <span className="font-semibold text-gray-900 dark:text-slate-100">
                        {i + 1}
                      </span>
                      <span className="block truncate text-xs font-normal text-gray-500 dark:text-slate-400">
                        {board.slotOwners[i]}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-pitch-700 dark:bg-pitch-800/30">
                {Array.from({ length: board.rounds }, (_, r) => (
                  <tr key={r}>
                    <td className="px-3 py-2 font-mono text-gray-500 dark:text-slate-400">
                      {r + 1}
                    </td>
                    {Array.from({ length: board.slots }, (_, s) => {
                      const cell = cellAt(board, r + 1, s + 1);
                      return (
                        <td key={s} className="px-1 py-1 align-top">
                          {cell ? (
                            <button
                              onClick={() =>
                                setSelected({ round: r + 1, slot: s + 1 })
                              }
                              className="w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-gray-100 dark:hover:bg-pitch-700"
                            >
                              <span className="block truncate font-semibold text-gray-900 dark:text-slate-100">
                                {cell.playerName}
                                {cell.position && (
                                  <span className="ml-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                                    {cell.position}
                                    {cell.nflTeam ? ` · ${cell.nflTeam}` : ""}
                                  </span>
                                )}
                              </span>
                              <span className="block truncate text-xs text-gray-500 dark:text-slate-400">
                                {cell.drafterTeamName}
                                {cell.isTraded && (
                                  <span className="text-amber-600 dark:text-amber-400">
                                    {" "}
                                    via {cell.originalOwnerTeamName}
                                  </span>
                                )}
                              </span>
                            </button>
                          ) : (
                            <span className="block px-2 py-1.5 text-gray-300 dark:text-slate-600">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected && (
            <SlotHistoryModal
              boards={boards}
              round={selected.round}
              slot={selected.slot}
              onClose={() => setSelected(null)}
            />
          )}
        </>
      ) : (
        <TeamHistoryView
          boards={boards}
          teams={teams}
          teamIdx={teamIdx}
          onSelectTeam={setTeamIdx}
        />
      )}
    </div>
  );
}
