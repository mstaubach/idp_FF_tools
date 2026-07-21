"use client";

import { useState } from "react";
import {
  slotLabel,
  type BoardCell,
  type SeasonBoard,
  type TeamEntry,
} from "@/lib/draft-history/board";
import SlotHistoryModal from "./SlotHistoryModal";
import TeamHistoryView from "./TeamHistoryView";

// Picks a given roster actually drafted this season, in draft order.
// Column content is keyed by who drafted, not by original slot ownership.
function picksForRoster(
  board: SeasonBoard,
  rosterId: number | null,
): BoardCell[] {
  if (rosterId == null) return [];
  return board.cells
    .filter((c) => c.drafterRosterId === rosterId)
    .sort((a, z) => a.pickNo - z.pickNo);
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

          <div className="overflow-x-auto">
            <div className="flex gap-3">
              {board.slotOwners.map((name, i) => {
                const picks = picksForRoster(board, board.slotOwnerRosterIds[i]);
                return (
                  <div
                    key={i}
                    className="w-40 flex-shrink-0 rounded-xl border border-gray-200 p-2 dark:border-pitch-700"
                  >
                    <h3 className="mb-1 truncate px-1 text-sm font-semibold text-gray-900 dark:text-slate-100">
                      {name}
                    </h3>
                    <ul className="space-y-1">
                      {picks.length === 0 ? (
                        <li className="px-2 py-1.5 text-gray-300 dark:text-slate-600">
                          —
                        </li>
                      ) : (
                        picks.map((cell) => (
                          <li key={`${cell.round}-${cell.slot}`}>
                            <button
                              onClick={() =>
                                setSelected({ round: cell.round, slot: cell.slot })
                              }
                              className="w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-gray-100 dark:hover:bg-pitch-700"
                            >
                              <span className="block truncate font-mono text-xs text-gray-500 dark:text-slate-400">
                                {slotLabel(cell.round, cell.slot)}
                              </span>
                              <span className="block truncate text-xs font-semibold text-gray-900 dark:text-slate-100">
                                {cell.playerName}
                                {cell.position && (
                                  <span className="ml-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                                    {cell.position}
                                    {cell.nflTeam ? ` · ${cell.nflTeam}` : ""}
                                  </span>
                                )}
                              </span>
                              {cell.isTraded && (
                                <span className="block truncate text-xs text-amber-600 dark:text-amber-400">
                                  via {cell.originalOwnerTeamName}
                                </span>
                              )}
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
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
