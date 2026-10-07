"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { DraftPick } from "@/lib/roster-management/picks";
import type { DragSource } from "@/lib/roster-management/plan";

// Drop-target data that marks the panel itself, so DepthChartTable can tell
// "return this pick" apart from a drop onto a grid cell.
export const PICK_PANEL_DROP = { panel: true } as const;

function PickChip({
  pick,
  label,
  positions,
}: {
  pick: DraftPick;
  label: string;
  positions: string[];
}) {
  const source: DragSource = {
    kind: "pick",
    id: pick.id,
    eligiblePositions: positions,
    section: null,
    position: null,
  };
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `panel:${pick.id}`,
    data: source,
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 10 }
    : undefined;

  return (
    <li
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={`cursor-grab rounded-full border border-dashed border-amber-400 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200 ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      {label}
    </li>
  );
}

export default function DraftPicksPanel({
  season,
  picks,
  ownedCount,
  rosterId,
  teamNames,
  positions,
}: {
  season: string;
  picks: DraftPick[]; // unplaced picks only
  ownedCount: number;
  rosterId: number;
  teamNames: Record<number, string>;
  positions: string[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "pick-panel", data: PICK_PANEL_DROP });
  const title = `${season} Picks`;

  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      className={`rounded-xl border border-gray-200 p-3 dark:border-pitch-700 lg:w-56 lg:shrink-0 ${
        isOver ? "bg-green-100 dark:bg-green-900/40" : ""
      }`}
    >
      <h2 className="text-sm font-bold text-gray-700 dark:text-slate-300">{title}</h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
        Drag a pick onto the chart to plan a rookie.
      </p>
      {picks.length === 0 ? (
        <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
          {ownedCount === 0 ? "No picks owned" : "All picks placed"}
        </p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {picks.map((pick) => {
            const via =
              pick.originalRosterId !== rosterId
                ? ` · via ${teamNames[pick.originalRosterId] ?? `Team ${pick.originalRosterId}`}`
                : "";
            return (
              <PickChip
                key={pick.id}
                pick={pick}
                label={`Rd ${pick.round}${via}`}
                positions={positions}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}
