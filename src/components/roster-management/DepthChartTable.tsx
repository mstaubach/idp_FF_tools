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
  unplacePick,
  type DragSource,
  type DropTarget,
  type PlanSection,
  type RosterPlan,
} from "@/lib/roster-management/plan";
import DraftPicksPanel, { PICK_PANEL_DROP } from "@/components/roster-management/DraftPicksPanel";
import RosterCountsSummary from "@/components/roster-management/RosterCountsSummary";
import type { DraftPick } from "@/lib/roster-management/picks";
import { computeRosterCounts, sectionSlotTotals } from "@/lib/roster-management/roster-counts";
import {
  parseTargets,
  setTarget,
  targetStatus,
  type PositionTargets,
} from "@/lib/roster-management/targets";
import type { SleeperLeague, SleeperPlayer, SleeperRoster } from "@/lib/roster-management/types";

const NO_ROSTER_POSITIONS: string[] = [];
const NO_SETTINGS: SleeperLeague["settings"] = {};
const NO_PICKS: DraftPick[] = [];
const NO_TEAM_NAMES: Record<number, string> = {};

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

// Stored apart from the plan so resetting the plan keeps the owner's targets.
function targetsKey(leagueId: string, rosterId: number): string {
  return `roster-mgmt:targets:${leagueId}:${rosterId}`;
}

function loadTargets(leagueId: string, rosterId: number): PositionTargets {
  try {
    return parseTargets(window.localStorage.getItem(targetsKey(leagueId, rosterId)));
  } catch {
    return {};
  }
}

function saveTargets(leagueId: string, rosterId: number, targets: PositionTargets) {
  try {
    window.localStorage.setItem(targetsKey(leagueId, rosterId), JSON.stringify(targets));
  } catch {
    // Private browsing or storage disabled - targets just won't persist.
  }
}

const TARGET_STATUS_CLASSES = {
  met: "text-green-700 dark:text-green-400",
  short: "text-red-600 dark:text-red-400",
  none: "text-gray-700 dark:text-slate-300",
};

function DraggableCell({
  cell,
  section,
  position,
  onRemove,
}: {
  cell: DepthChartCell;
  section: PlanSection;
  position: string;
  onRemove: (cell: DepthChartCell) => void;
}) {
  const source: DragSource = {
    kind: cell.kind,
    id: cell.id,
    eligiblePositions: cell.eligiblePositions,
    section,
    position,
  };
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${section}:${position}:${cell.id}`,
    data: source,
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 10 }
    : undefined;

  const isPick = cell.kind === "pick";

  // Drag listeners sit on the name only, so clicking the remove button never
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
        className={
          isPick
            ? "cursor-grab rounded-full border border-dashed border-amber-400 bg-amber-50 px-2 text-xs font-semibold text-amber-800 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200"
            : "cursor-grab rounded px-1 hover:bg-green-50 dark:hover:bg-pitch-700/60"
        }
      >
        {cell.displayName}
      </span>
      <button
        type="button"
        onClick={() => onRemove(cell)}
        aria-label={isPick ? `Return ${cell.displayName} to picks` : `Cut ${cell.displayName}`}
        title={isPick ? "Back to picks" : "Cut"}
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
  onRemove,
}: {
  section: PlanSection;
  position: string;
  rowIndex: number;
  cell: DepthChartCell | null;
  onRemove: (cell: DepthChartCell) => void;
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
        <DraggableCell cell={cell} section={section} position={position} onRemove={onRemove} />
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
  picks = NO_PICKS,
  draftSeason,
  teamNames = NO_TEAM_NAMES,
  leagueId,
  rosterId,
}: {
  roster: SleeperRoster;
  players: Record<string, SleeperPlayer>;
  positions: string[];
  rosterPositions?: string[];
  settings?: SleeperLeague["settings"];
  picks?: DraftPick[]; // picks this roster owns in the draft being planned
  draftSeason?: string; // omit to hide the picks panel
  teamNames?: Record<number, string>; // roster ID -> owner name, for "via" labels
  leagueId: string;
  rosterId: number;
}) {
  const [plan, setPlan] = useState<RosterPlan>(EMPTY_PLAN);
  const [targets, setTargets] = useState<PositionTargets>({});

  useEffect(() => {
    // Deferred to a post-mount effect (not the useState initializer) because
    // localStorage isn't available during Next's server-side render; reading
    // it here avoids an SSR/client hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlan(loadPlan(leagueId, rosterId));
    setTargets(loadTargets(leagueId, rosterId));
  }, [leagueId, rosterId]);

  const slotTotals = useMemo(
    () => sectionSlotTotals(rosterPositions, settings),
    [rosterPositions, settings],
  );
  const grid = useMemo(() => {
    // Sections the league has slots for stay on screen as drop targets even
    // when empty.
    const showEmpty = (Object.keys(slotTotals) as PlanSection[]).filter((s) => slotTotals[s] > 0);
    return buildDepthChart(roster, players, positions, { rosterPositions, plan, picks, showEmpty });
  }, [roster, players, positions, rosterPositions, slotTotals, plan, picks]);
  const activeCounts = useMemo(() => countActiveByPosition(grid), [grid]);
  const sectionCounts = useMemo(() => computeRosterCounts(grid, slotTotals), [grid, slotTotals]);
  // Cut players who have since left the roster in Sleeper aren't shown.
  const cutIds = plan.cut.filter((id) => players[id]);
  const placedPickIds = new Set(
    grid.sections.flatMap((s) => s.rows.flat()).flatMap((c) => (c?.kind === "pick" ? [c.id] : [])),
  );
  const unplacedPicks = picks.filter((p) => !placedPickIds.has(p.id));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function updatePlan(next: RosterPlan) {
    setPlan(next);
    savePlan(leagueId, rosterId, next);
  }

  function updateTarget(position: string, raw: string) {
    const next = setTarget(targets, position, raw);
    if (next === targets) return;
    setTargets(next);
    saveTargets(leagueId, rosterId, next);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const source = active.data.current as DragSource | undefined;
    const overData = over.data.current as DropTarget | typeof PICK_PANEL_DROP | undefined;
    if (!source || !overData) return;

    if ("panel" in overData) {
      if (source.kind === "pick") updatePlan(unplacePick(plan, source.id));
      return;
    }

    const next = applyDrop(plan, source, overData);
    if (next) updatePlan(next);
  }

  function handleRemove(cell: DepthChartCell) {
    updatePlan(cell.kind === "pick" ? unplacePick(plan, cell.id) : cutPlayer(plan, cell.id));
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
      {/* A fixed id keeps dnd-kit's aria-describedby stable between the server
          render and hydration; without it dnd-kit uses a module-level counter
          that keeps climbing on the server. */}
      <DndContext id="roster-depth-chart" sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-gray-200 dark:border-pitch-700">
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
                <tr>
                  <th
                    scope="row"
                    className="border-b border-gray-200 bg-gray-50 px-4 py-1.5 text-center font-bold text-gray-700 dark:border-pitch-700 dark:bg-pitch-800/60 dark:text-slate-300"
                  >
                    Target
                  </th>
                  {grid.positions.map((pos) => {
                    const status = targetStatus(activeCounts[pos], targets[pos]);
                    return (
                      <td
                        key={pos}
                        className="border-b border-l border-gray-200 bg-gray-50 px-2 py-1.5 text-center dark:border-pitch-700 dark:bg-pitch-800/60"
                      >
                        <input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          value={targets[pos] ?? ""}
                          onChange={(e) => updateTarget(pos, e.target.value)}
                          aria-label={`${columnLabel(pos)} target`}
                          title={
                            status === "short"
                              ? `${targets[pos] - activeCounts[pos]} short of target`
                              : undefined
                          }
                          data-status={status ?? undefined}
                          placeholder="–"
                          className={`w-14 rounded border border-gray-200 bg-white px-1 py-0.5 text-center font-semibold dark:border-pitch-700 dark:bg-pitch-900 ${
                            TARGET_STATUS_CLASSES[status ?? "none"]
                          }`}
                        />
                      </td>
                    );
                  })}
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
                          onRemove={handleRemove}
                        />
                      ))}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          {draftSeason && (
            <DraftPicksPanel
              season={draftSeason}
              picks={unplacedPicks}
              ownedCount={picks.length}
              rosterId={rosterId}
              teamNames={teamNames}
              positions={positions}
            />
          )}
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
