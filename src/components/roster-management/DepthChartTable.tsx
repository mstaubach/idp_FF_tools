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
  columnLabel,
  countActiveByPosition,
  playerDisplayName,
  type DepthChartCell,
  type DepthChartSection,
} from "@/lib/roster-management/depth-chart";
import {
  EMPTY_PLAN,
  applyDrop,
  cutPlayer,
  isPlanEmpty,
  parsePlan,
  restorePlayer,
  type DragSource,
  type DropTarget,
  type PlanSection,
  type RosterPlan,
} from "@/lib/roster-management/plan";
import RosterCountsSummary from "@/components/roster-management/RosterCountsSummary";
import { computeRosterCounts, sectionSlotTotals } from "@/lib/roster-management/roster-counts";
import type { SleeperLeague, SleeperPlayer, SleeperRoster } from "@/lib/roster-management/types";

const NO_ROSTER_POSITIONS: string[] = [];
const NO_SETTINGS: SleeperLeague["settings"] = {};

function planKey(leagueId: string, rosterId: number): string {
  return `roster-mgmt:plan:${leagueId}:${rosterId}`;
}

// Column corrections saved before the planner existed. Read once to seed the
// plan, then removed on the first save so a reset can't resurrect them.
function legacyOverridesKey(leagueId: string, rosterId: number): string {
  return `roster-mgmt:overrides:${leagueId}:${rosterId}`;
}

function loadPlan(leagueId: string, rosterId: number): RosterPlan {
  try {
    return parsePlan(
      window.localStorage.getItem(planKey(leagueId, rosterId)),
      window.localStorage.getItem(legacyOverridesKey(leagueId, rosterId)),
    );
  } catch {
    return EMPTY_PLAN;
  }
}

function savePlan(leagueId: string, rosterId: number, plan: RosterPlan) {
  try {
    window.localStorage.setItem(planKey(leagueId, rosterId), JSON.stringify(plan));
    window.localStorage.removeItem(legacyOverridesKey(leagueId, rosterId));
  } catch {
    // Private browsing or storage disabled - the plan just won't persist.
  }
}

function DraggableCell({
  cell,
  section,
  position,
  onCut,
}: {
  cell: DepthChartCell;
  section: PlanSection;
  position: string;
  onCut: (playerId: string) => void;
}) {
  const source: DragSource = {
    playerId: cell.playerId,
    eligiblePositions: cell.eligiblePositions,
    section,
    position,
  };
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${section}:${position}:${cell.playerId}`,
    data: source,
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 10 }
    : undefined;

  // Drag listeners sit on the name only, so clicking the cut button never
  // starts a drag.
  return (
    <span
      ref={setNodeRef}
      style={style}
      className={`inline-flex items-center gap-1 ${isDragging ? "opacity-50" : ""}`}
    >
      <span
        {...listeners}
        {...attributes}
        data-draggable="true"
        className="cursor-grab rounded px-1 hover:bg-green-50 dark:hover:bg-pitch-700/60"
      >
        {cell.displayName}
      </span>
      <button
        type="button"
        onClick={() => onCut(cell.playerId)}
        aria-label={`Cut ${cell.displayName}`}
        title="Cut"
        className="rounded px-1 text-gray-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400"
      >
        ×
      </button>
    </span>
  );
}

function DroppableCell({
  section,
  position,
  rowIndex,
  cell,
  onCut,
}: {
  section: PlanSection;
  position: string;
  rowIndex: number;
  cell: DepthChartCell | null;
  onCut: (playerId: string) => void;
}) {
  const target: DropTarget = { section, position };
  const { setNodeRef, isOver } = useDroppable({
    id: `${section}:${position}:${rowIndex}`,
    data: target,
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
      {cell ? (
        <DraggableCell cell={cell} section={section} position={position} onCut={onCut} />
      ) : (
        ""
      )}
    </td>
  );
}

function CutList({
  playerIds,
  players,
  onRestore,
}: {
  playerIds: string[];
  players: Record<string, SleeperPlayer>;
  onRestore: (playerId: string) => void;
}) {
  return (
    <section
      aria-label="Cut players"
      className="rounded-xl border border-gray-200 p-3 dark:border-pitch-700"
    >
      <h2 className="text-sm font-bold text-gray-700 dark:text-slate-300">
        Cut ({playerIds.length})
      </h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {playerIds.map((id) => {
          const name = playerDisplayName(players[id]);
          return (
            <li
              key={id}
              className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs text-gray-500 dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-400"
            >
              <span className="line-through">{name}</span>
              <button
                type="button"
                onClick={() => onRestore(id)}
                aria-label={`Restore ${name}`}
                className="font-semibold text-green-600 hover:underline dark:text-green-400"
              >
                Restore
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function DepthChartTable({
  roster,
  players,
  positions,
  rosterPositions = NO_ROSTER_POSITIONS,
  settings = NO_SETTINGS,
  leagueId,
  rosterId,
}: {
  roster: SleeperRoster;
  players: Record<string, SleeperPlayer>;
  positions: string[];
  rosterPositions?: string[];
  settings?: SleeperLeague["settings"];
  leagueId: string;
  rosterId: number;
}) {
  const [plan, setPlan] = useState<RosterPlan>(EMPTY_PLAN);

  useEffect(() => {
    // Deferred to a post-mount effect (not the useState initializer) because
    // localStorage isn't available during Next's server-side render; reading
    // it here avoids an SSR/client hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlan(loadPlan(leagueId, rosterId));
  }, [leagueId, rosterId]);

  const slotTotals = useMemo(
    () => sectionSlotTotals(rosterPositions, settings),
    [rosterPositions, settings],
  );
  const grid = useMemo(() => {
    // Sections the league has slots for stay on screen as drop targets even
    // when empty.
    const showEmpty = (Object.keys(slotTotals) as PlanSection[]).filter((s) => slotTotals[s] > 0);
    return buildDepthChart(roster, players, positions, { rosterPositions, plan, showEmpty });
  }, [roster, players, positions, rosterPositions, slotTotals, plan]);
  const activeCounts = useMemo(() => countActiveByPosition(grid), [grid]);
  const sectionCounts = useMemo(() => computeRosterCounts(grid, slotTotals), [grid, slotTotals]);
  // Cut players who have since left the roster in Sleeper aren't shown.
  const cutIds = plan.cut.filter((id) => players[id]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function updatePlan(next: RosterPlan) {
    setPlan(next);
    savePlan(leagueId, rosterId, next);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const source = active.data.current as DragSource | undefined;
    const target = over.data.current as DropTarget | undefined;
    if (!source || !target) return;

    const next = applyDrop(plan, source, target);
    if (next) updatePlan(next);
  }

  return (
    <div className="space-y-2">
      <RosterCountsSummary counts={sectionCounts} />
      {!isPlanEmpty(plan) && (
        <button
          type="button"
          onClick={() => updatePlan(EMPTY_PLAN)}
          className="text-xs text-green-600 hover:underline dark:text-green-400"
        >
          Reset plan
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
                    {columnLabel(pos)}: {activeCounts[pos]}
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
                        onCut={(id) => updatePlan(cutPlayer(plan, id))}
                      />
                    ))}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </DndContext>
      {cutIds.length > 0 && (
        <CutList
          playerIds={cutIds}
          players={players}
          onRestore={(id) => updatePlan(restorePlayer(plan, id))}
        />
      )}
    </div>
  );
}
