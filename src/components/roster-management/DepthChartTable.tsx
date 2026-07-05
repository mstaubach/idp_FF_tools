"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  buildDepthChart,
  type DepthChartCell,
  type DepthChartSection,
} from "@/lib/roster-management/depth-chart";
import type { SleeperPlayer, SleeperRoster } from "@/lib/roster-management/types";

function overridesKey(leagueId: string, rosterId: number): string {
  return `roster-mgmt:overrides:${leagueId}:${rosterId}`;
}

function loadOverrides(leagueId: string, rosterId: number): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(overridesKey(leagueId, rosterId));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveOverrides(leagueId: string, rosterId: number, overrides: Record<string, string>) {
  try {
    window.localStorage.setItem(overridesKey(leagueId, rosterId), JSON.stringify(overrides));
  } catch {
    // Private browsing or storage disabled - corrections just won't persist.
  }
}

function DraggableCell({
  cell,
  section,
  position,
}: {
  cell: DepthChartCell;
  section: string;
  position: string;
}) {
  const draggable = cell.eligiblePositions.length > 1;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${section}:${position}:${cell.playerId}`,
    data: { cell, section, currentPosition: position },
    disabled: !draggable,
  });

  if (!draggable) {
    return <span>{cell.displayName}</span>;
  }

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 10 }
    : undefined;

  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-draggable="true"
      style={style}
      className={`cursor-grab rounded bg-green-50 px-1 dark:bg-pitch-700/60 ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      {cell.displayName}
    </span>
  );
}

function DroppableCell({
  section,
  position,
  rowIndex,
  cell,
}: {
  section: string;
  position: string;
  rowIndex: number;
  cell: DepthChartCell | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${section}:${position}:${rowIndex}`,
    data: { section, position },
  });

  return (
    <td
      ref={setNodeRef}
      data-position={position}
      data-section={section}
      className={`border-b border-l border-gray-100 px-4 py-2 text-center text-gray-900 dark:border-pitch-700 dark:text-slate-100 ${
        isOver ? "bg-green-100 dark:bg-green-900/40" : ""
      }`}
    >
      {cell ? <DraggableCell cell={cell} section={section} position={position} /> : ""}
    </td>
  );
}

export default function DepthChartTable({
  roster,
  players,
  positions,
  leagueId,
  rosterId,
}: {
  roster: SleeperRoster;
  players: Record<string, SleeperPlayer>;
  positions: string[];
  leagueId: string;
  rosterId: number;
}) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    // Deferred to a post-mount effect (not the useState initializer) because
    // localStorage isn't available during Next's server-side render; reading
    // it here avoids an SSR/client hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOverrides(loadOverrides(leagueId, rosterId));
  }, [leagueId, rosterId]);

  const grid = useMemo(
    () => buildDepthChart(roster, players, positions, overrides),
    [roster, players, positions, overrides],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as
      | { cell: DepthChartCell; section: string; currentPosition: string }
      | undefined;
    const overData = over.data.current as { section: string; position: string } | undefined;
    if (!activeData || !overData) return;
    if (activeData.section !== overData.section) return;
    if (!activeData.cell.eligiblePositions.includes(overData.position)) return;
    // Dropped back onto the column it's already rendered in - no-op, don't
    // create a phantom override that would make "Reset corrections" appear.
    if (overData.position === activeData.currentPosition) return;

    const next = { ...overrides, [activeData.cell.playerId]: overData.position };
    setOverrides(next);
    saveOverrides(leagueId, rosterId, next);
  }

  function handleReset() {
    setOverrides({});
    saveOverrides(leagueId, rosterId, {});
  }

  return (
    <div className="space-y-2">
      {Object.keys(overrides).length > 0 && (
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-green-600 hover:underline dark:text-green-400"
        >
          Reset corrections
        </button>
      )}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-pitch-700">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-gray-200 bg-gray-100 px-4 py-2.5 text-center font-bold text-gray-700 dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-300">
                  Rank
                </th>
                {grid.positions.map((pos) => (
                  <th
                    key={pos}
                    className="border-b border-l border-gray-200 bg-green-700 px-4 py-2.5 text-center font-bold text-white dark:border-pitch-700"
                  >
                    {pos}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.sections.map((section: DepthChartSection, si: number) =>
                section.rows.map((row, ri) => (
                  <tr
                    key={`${section.label}-${ri}`}
                    className={
                      si > 0 && ri === 0
                        ? "border-t-2 border-gray-300 dark:border-pitch-700"
                        : ""
                    }
                  >
                    <td className="border-b border-gray-100 px-4 py-2 text-center font-bold text-gray-700 dark:border-pitch-700 dark:text-slate-300">
                      {section.label}
                    </td>
                    {row.map((cell, ci) => (
                      <DroppableCell
                        key={ci}
                        section={section.label}
                        position={grid.positions[ci]}
                        rowIndex={ri}
                        cell={cell}
                      />
                    ))}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </DndContext>
    </div>
  );
}
