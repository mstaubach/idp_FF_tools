"use client";

import { useEffect } from "react";
import type { SeasonBoard } from "@/lib/draft-history/board";

function slotLabel(round: number, slot: number): string {
  return `${round}.${String(slot).padStart(2, "0")}`;
}

export default function SlotHistoryModal({
  boards,
  round,
  slot,
  onClose,
}: {
  boards: SeasonBoard[];
  round: number;
  slot: number;
  onClose: () => void;
}) {
  // Boards arrive newest-first; show the slot's history in that order.
  const entries = boards.flatMap((b) => {
    const cell = b.cells.find((c) => c.round === round && c.slot === slot);
    return cell ? [{ season: b.season, cell }] : [];
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-pitch-700 dark:bg-pitch-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
            Pick {slotLabel(round, slot)} through the years
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-pitch-700 dark:hover:text-white"
          >
            ✕
          </button>
        </div>
        <ul className="divide-y divide-gray-100 dark:divide-pitch-700">
          {entries.map(({ season, cell }) => (
            <li key={season} className="flex items-start gap-3 py-2.5">
              <span className="w-12 shrink-0 font-mono text-sm font-semibold text-gray-500 dark:text-slate-400">
                {season}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-gray-900 dark:text-slate-100">
                  {cell.playerName}
                  {cell.position && (
                    <span className="ml-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                      {cell.position}
                      {cell.nflTeam ? ` · ${cell.nflTeam}` : ""}
                    </span>
                  )}
                </span>
                <span className="block text-xs text-gray-500 dark:text-slate-400">
                  {cell.drafterTeamName}
                  {cell.isTraded ? ` (via ${cell.originalOwnerTeamName})` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
