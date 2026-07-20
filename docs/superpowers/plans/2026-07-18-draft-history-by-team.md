# Draft History By-Team View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "By Season / By Team" toggle to the draft-history league page so a user can see every rookie-draft pick one franchise has ever made in one flat table.

**Architecture:** Pure client-side re-projection of data the page already loads. `BoardCell` gains stable `drafterRosterId` / `originalOwnerRosterId` fields (roster IDs persist across a Sleeper dynasty chain; team names don't), a new `buildTeamDirectory` helper produces the franchise list named by newest-season names, and a new `TeamHistoryView` client component renders team pills + a Season · Pick · Player · Pos · Via table. `DraftBoardView` hosts the view toggle. No new routes, no new fetches.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind (dark slate `dark:*-pitch-*` palette), Vitest + Testing Library (jsdom, globals enabled).

**Spec:** `docs/superpowers/specs/2026-07-18-draft-history-by-team-design.md`

## Global Constraints

- Per-tool namespace rule (CLAUDE.md): stay inside `src/lib/draft-history/`, `src/components/draft-history/`, `src/app/draft-history/`. Never import from `src/lib/trade-tracker/` or `src/lib/idp-checker/`.
- ESLint rule `react-hooks/error-boundaries` forbids constructing JSX inside `try`/`catch`. `next build` does NOT catch it — only `npm run lint` does. Keep try blocks narrow around awaits.
- CI runs lint + build only. Run `npm test` and `npm run typecheck` locally; they are the only gate.
- Work on branch `feature/draft-history-by-team`. One focused commit per task.
- Commands: `npm test` (vitest single pass), `npm run typecheck` (`tsc --noEmit`), `npm run lint`, `npm run build`. Single test file: `npx vitest run __tests__/draft-history/lib/board.test.ts`.
- Tests live under `__tests__/draft-history/`, mirroring `src`. Path alias `@/*` → `src/*` works in both app and tests.

---

### Task 1: Roster IDs on BoardCell + shared `slotLabel`

**Files:**
- Modify: `src/lib/draft-history/board.ts`
- Modify: `src/components/draft-history/SlotHistoryModal.tsx` (import `slotLabel` instead of local copy)
- Modify: `__tests__/draft-history/lib/board.test.ts`
- Modify: `__tests__/draft-history/DraftBoardView.test.tsx` (fixtures gain the two new required fields)

**Interfaces:**
- Consumes: existing `buildDraftHistory(inputs: SeasonInput[]): SeasonBoard[]` and `BoardCell` in `src/lib/draft-history/board.ts`.
- Produces: `BoardCell` gains `drafterRosterId: number` and `originalOwnerRosterId: number | null`; new export `slotLabel(round: number, slot: number): string` (formats `2.05`). Tasks 3–4 rely on both.

- [ ] **Step 1: Write the failing tests**

Append to the `buildDraftHistory` describe block in `__tests__/draft-history/lib/board.test.ts`:

```ts
  it("carries drafter and original-owner roster ids on each cell", () => {
    const boards = buildDraftHistory([
      seasonInput("2026", [
        pick({ draft_slot: 2, pick_no: 2, roster_id: 1, player_id: "p2" }),
      ]),
    ]);
    const cell = boards[0].cells[0];
    expect(cell.drafterRosterId).toBe(1);
    expect(cell.originalOwnerRosterId).toBe(2);
  });

  it("nulls originalOwnerRosterId when slot_to_roster_id lacks the slot", () => {
    const input = seasonInput("2026", [pick({})]);
    input.draft.slot_to_roster_id = {};
    const [board] = buildDraftHistory([input]);
    expect(board.cells[0].originalOwnerRosterId).toBeNull();
    expect(board.cells[0].isTraded).toBe(false);
  });
```

Add a new top-level describe block (import `slotLabel` in the existing import from `@/lib/draft-history/board`):

```ts
describe("slotLabel", () => {
  it("zero-pads the slot number", () => {
    expect(slotLabel(2, 5)).toBe("2.05");
    expect(slotLabel(1, 12)).toBe("1.12");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/draft-history/lib/board.test.ts`
Expected: FAIL — `slotLabel` is not exported (import error) and/or `drafterRosterId` is `undefined`.

- [ ] **Step 3: Implement in `src/lib/draft-history/board.ts`**

Add the two fields to `BoardCell` (keep existing fields and comments; insert `drafterRosterId` directly above `drafterTeamName` and `originalOwnerRosterId` directly above `originalOwnerTeamName`):

```ts
export interface BoardCell {
  round: number;
  slot: number;
  pickNo: number;
  playerName: string;
  position: string | null;
  nflTeam: string | null;
  drafterRosterId: number;
  drafterTeamName: string;
  // The franchise that originally owned this draft slot (slot_to_roster_id).
  // Roster ids persist across a dynasty chain; names may change per season.
  originalOwnerRosterId: number | null;
  originalOwnerTeamName: string;
  isTraded: boolean;
}
```

Add the exported helper (below `rookieLeagues`):

```ts
// Formats a round + slot as the conventional pick label, e.g. 2.05.
export function slotLabel(round: number, slot: number): string {
  return `${round}.${String(slot).padStart(2, "0")}`;
}
```

In `buildDraftHistory`'s `cells` mapping, add the two fields next to their name counterparts:

```ts
    const cells: BoardCell[] = picks.map((p) => {
      const originalRoster = slotToRoster[String(p.draft_slot)];
      const first = p.metadata.first_name ?? "";
      const last = p.metadata.last_name ?? "";
      return {
        round: p.round,
        slot: p.draft_slot,
        pickNo: p.pick_no,
        playerName: `${first} ${last}`.trim() || p.player_id,
        position: p.metadata.position ?? null,
        nflTeam: p.metadata.team ?? null,
        drafterRosterId: p.roster_id,
        drafterTeamName: nameOf(p.roster_id),
        originalOwnerRosterId: originalRoster ?? null,
        originalOwnerTeamName: nameOf(originalRoster),
        isTraded: originalRoster != null && originalRoster !== p.roster_id,
      };
    });
```

- [ ] **Step 4: Point `SlotHistoryModal.tsx` at the shared helper**

In `src/components/draft-history/SlotHistoryModal.tsx`, delete the local `slotLabel` function (lines defining it near the top) and change the import to:

```ts
import { slotLabel, type SeasonBoard } from "@/lib/draft-history/board";
```

Everything else in the file is unchanged.

- [ ] **Step 5: Update `DraftBoardView.test.tsx` fixtures for the new required fields**

In `__tests__/draft-history/DraftBoardView.test.tsx`, the `BOARD_2026` cell gains `drafterRosterId: 1, originalOwnerRosterId: 1,` and the `BOARD_2025` cell gains `drafterRosterId: 2, originalOwnerRosterId: 2,` (place each directly above the corresponding `drafterTeamName` / `originalOwnerTeamName` lines). Vitest strips types so it would pass without this, but `npm run typecheck` would not.

- [ ] **Step 6: Run tests + typecheck to verify green**

Run: `npm test` — Expected: all pass (12 board tests + 4 DraftBoardView tests + pre-existing idp-checker suites).
Run: `npm run typecheck` — Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/draft-history/board.ts src/components/draft-history/SlotHistoryModal.tsx __tests__/draft-history/lib/board.test.ts __tests__/draft-history/DraftBoardView.test.tsx
git commit -m "feat(draft-history): carry roster ids on board cells, share slotLabel"
```

---

### Task 2: `buildTeamDirectory`

**Files:**
- Modify: `src/lib/draft-history/board.ts`
- Modify: `__tests__/draft-history/lib/board.test.ts`

**Interfaces:**
- Consumes: existing private `rosterNames(users, rosters): Map<number, string>` and `SeasonInput` in `board.ts`.
- Produces: `export interface TeamEntry { rosterId: number; name: string }` and `export function buildTeamDirectory(inputs: SeasonInput[]): TeamEntry[]` — every franchise across all seasons, named by its newest season's name, sorted alphabetically. Tasks 3–4 rely on both.

- [ ] **Step 1: Write the failing tests**

Add a new top-level describe block to `__tests__/draft-history/lib/board.test.ts` (import `buildTeamDirectory` from `@/lib/draft-history/board`):

```ts
describe("buildTeamDirectory", () => {
  it("names a franchise by its newest-season name after a rename", () => {
    const older = seasonInput("2025", []);
    const newer = seasonInput("2026", []);
    newer.users = [
      {
        user_id: "u1",
        display_name: "Alice",
        avatar: null,
        metadata: { team_name: "Alpha Prime" },
      },
      { user_id: "u2", display_name: "Bravo", avatar: null },
    ];
    const teams = buildTeamDirectory([older, newer]);
    expect(teams).toContainEqual({ rosterId: 1, name: "Alpha Prime" });
  });

  it("includes a franchise that only appears in an older season", () => {
    const older = seasonInput("2025", []);
    older.rosters.push({ roster_id: 3, owner_id: null });
    const teams = buildTeamDirectory([seasonInput("2026", []), older]);
    expect(teams).toContainEqual({ rosterId: 3, name: "Roster 3" });
  });

  it("sorts entries alphabetically by name", () => {
    const teams = buildTeamDirectory([seasonInput("2026", [])]);
    expect(teams.map((t) => t.name)).toEqual(["Alpha", "Bravo"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/draft-history/lib/board.test.ts`
Expected: FAIL — `buildTeamDirectory` is not exported.

- [ ] **Step 3: Implement in `src/lib/draft-history/board.ts`**

Add below `buildDraftHistory` (uses the existing private `rosterNames`):

```ts
export interface TeamEntry {
  rosterId: number;
  name: string;
}

// Every franchise seen across the given seasons, named by its newest season's
// name (roster ids are stable across a dynasty chain; names may change).
// Sorted alphabetically for display in a team selector.
export function buildTeamDirectory(inputs: SeasonInput[]): TeamEntry[] {
  const newestFirst = [...inputs].sort(
    (a, b) => Number(b.league.season) - Number(a.league.season),
  );
  const names = new Map<number, string>();
  for (const { users, rosters } of newestFirst) {
    for (const [rosterId, name] of rosterNames(users, rosters)) {
      if (!names.has(rosterId)) names.set(rosterId, name);
    }
  }
  return [...names.entries()]
    .map(([rosterId, name]) => ({ rosterId, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/draft-history/lib/board.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/draft-history/board.ts __tests__/draft-history/lib/board.test.ts
git commit -m "feat(draft-history): add buildTeamDirectory franchise list"
```

---

### Task 3: `TeamHistoryView` component

**Files:**
- Create: `src/components/draft-history/TeamHistoryView.tsx`
- Test: `__tests__/draft-history/TeamHistoryView.test.tsx`

**Interfaces:**
- Consumes: `SeasonBoard`, `TeamEntry`, `slotLabel` from `@/lib/draft-history/board` (Tasks 1–2); `BoardCell.drafterRosterId` / `originalOwnerRosterId` (Task 1).
- Produces: default-export client component `TeamHistoryView({ boards, teams }: { boards: SeasonBoard[]; teams: TeamEntry[] })`. Task 4 renders it. Callers must pass a non-empty `teams` array (the page guarantees this: rosters exist whenever boards exist).

- [ ] **Step 1: Write the failing tests**

Create `__tests__/draft-history/TeamHistoryView.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import TeamHistoryView from "@/components/draft-history/TeamHistoryView";
import type { BoardCell, SeasonBoard, TeamEntry } from "@/lib/draft-history/board";

afterEach(cleanup);

function cell(overrides: Partial<BoardCell>): BoardCell {
  return {
    round: 1,
    slot: 1,
    pickNo: 1,
    playerName: "Someone",
    position: "LB",
    nflTeam: "SF",
    drafterRosterId: 1,
    drafterTeamName: "Alpha",
    originalOwnerRosterId: 1,
    originalOwnerTeamName: "Alpha",
    isTraded: false,
    ...overrides,
  };
}

const TEAMS: TeamEntry[] = [
  { rosterId: 1, name: "Alpha" },
  { rosterId: 2, name: "Bravo" },
];

// Newest-first, as buildDraftHistory returns them. Alpha drafted in both
// seasons (2026 via a pick acquired from Bravo); Bravo never drafted.
const BOARDS: SeasonBoard[] = [
  {
    season: "2026",
    rounds: 1,
    slots: 2,
    slotOwners: ["Alpha", "Bravo"],
    cells: [
      cell({ playerName: "New Guy" }),
      cell({
        slot: 2,
        pickNo: 2,
        playerName: "Trade Guy",
        drafterRosterId: 1,
        drafterTeamName: "Alpha",
        originalOwnerRosterId: 2,
        originalOwnerTeamName: "Bravo",
        isTraded: true,
      }),
    ],
  },
  {
    season: "2025",
    rounds: 1,
    slots: 2,
    slotOwners: ["Alpha", "Bravo"],
    cells: [cell({ playerName: "Old Guy" })],
  },
];

describe("TeamHistoryView", () => {
  it("shows the first team's picks across all seasons, newest first", () => {
    render(<TeamHistoryView boards={BOARDS} teams={TEAMS} />);
    const rows = screen.getAllByRole("row").slice(1); // drop header row
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("New Guy"),
      expect.stringContaining("Trade Guy"),
      expect.stringContaining("Old Guy"),
    ]);
    expect(rows[0].textContent).toContain("2026");
    expect(rows[2].textContent).toContain("2025");
  });

  it("formats picks with slotLabel and marks trade-acquired picks with a via note", () => {
    render(<TeamHistoryView boards={BOARDS} teams={TEAMS} />);
    const tradeRow = screen.getByText("Trade Guy").closest("tr") as HTMLElement;
    expect(within(tradeRow).getByText("1.02")).toBeTruthy();
    expect(within(tradeRow).getByText("via Bravo")).toBeTruthy();
    const ownRow = screen.getByText("New Guy").closest("tr") as HTMLElement;
    expect(within(ownRow).getByText("1.01")).toBeTruthy();
    expect(within(ownRow).queryByText(/via/)).toBeNull();
  });

  it("switches teams on pill click and shows an empty state for a team with no picks", () => {
    render(<TeamHistoryView boards={BOARDS} teams={TEAMS} />);
    fireEvent.click(screen.getByRole("button", { name: "Bravo" }));
    expect(screen.queryByText("New Guy")).toBeNull();
    expect(screen.getByText("No rookie picks yet.")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/draft-history/TeamHistoryView.test.tsx`
Expected: FAIL — cannot resolve `@/components/draft-history/TeamHistoryView`.

- [ ] **Step 3: Create `src/components/draft-history/TeamHistoryView.tsx`**

```tsx
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/draft-history/TeamHistoryView.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/draft-history/TeamHistoryView.tsx __tests__/draft-history/TeamHistoryView.test.tsx
git commit -m "feat(draft-history): add TeamHistoryView flat pick table"
```

---

### Task 4: View toggle in `DraftBoardView` + page wiring + full verification

**Files:**
- Modify: `src/components/draft-history/DraftBoardView.tsx`
- Modify: `src/app/draft-history/league/[leagueId]/page.tsx`
- Modify: `__tests__/draft-history/DraftBoardView.test.tsx`

**Interfaces:**
- Consumes: `TeamHistoryView` (Task 3), `buildTeamDirectory` / `TeamEntry` (Task 2).
- Produces: `DraftBoardView` prop signature becomes `{ boards: SeasonBoard[]; teams: TeamEntry[] }` — the page is its only consumer.

- [ ] **Step 1: Write the failing tests**

In `__tests__/draft-history/DraftBoardView.test.tsx`, add after the imports and fixtures:

```tsx
const TEAMS = [
  { rosterId: 1, name: "Alpha" },
  { rosterId: 2, name: "Bravo" },
];
```

Update every existing `render(<DraftBoardView boards={[BOARD_2026, BOARD_2025]} />)` call (all 4 tests) to:

```tsx
render(<DraftBoardView boards={[BOARD_2026, BOARD_2025]} teams={TEAMS} />);
```

Append two tests to the describe block:

```tsx
  it("switches to the team view and back", () => {
    render(<DraftBoardView boards={[BOARD_2026, BOARD_2025]} teams={TEAMS} />);
    expect(screen.getByText("New Guy")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "By Team" }));

    // Alpha (first team) drafted New Guy in 2026; season tabs are gone.
    expect(screen.getByRole("button", { name: "Alpha" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "2025" })).toBeNull();
    expect(screen.getByText("New Guy")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "By Season" }));
    expect(screen.getByRole("button", { name: "2025" })).toBeTruthy();
  });

  it("shows the selected team's cross-season picks in team view", () => {
    render(<DraftBoardView boards={[BOARD_2026, BOARD_2025]} teams={TEAMS} />);
    fireEvent.click(screen.getByRole("button", { name: "By Team" }));
    fireEvent.click(screen.getByRole("button", { name: "Bravo" }));

    // Bravo (roster 2) drafted Old Guy in 2025, nothing in 2026.
    expect(screen.getByText("Old Guy")).toBeTruthy();
    expect(screen.queryByText("New Guy")).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run __tests__/draft-history/DraftBoardView.test.tsx`
Expected: FAIL — no button named "By Team" (the 4 existing tests still pass; the extra `teams` prop is ignored by the current component at runtime).

- [ ] **Step 3: Add the toggle to `src/components/draft-history/DraftBoardView.tsx`**

Change the imports, props, and state at the top of the component:

```tsx
"use client";

import { useState } from "react";
import type { BoardCell, SeasonBoard, TeamEntry } from "@/lib/draft-history/board";
import SlotHistoryModal from "./SlotHistoryModal";
import TeamHistoryView from "./TeamHistoryView";
```

```tsx
export default function DraftBoardView({
  boards,
  teams,
}: {
  boards: SeasonBoard[];
  teams: TeamEntry[];
}) {
  const [view, setView] = useState<"season" | "team">("season");
  const [seasonIdx, setSeasonIdx] = useState(0);
  const [selected, setSelected] = useState<{ round: number; slot: number } | null>(
    null,
  );
  const board = boards[seasonIdx];
```

Insert the toggle as the first child of the outer `<div className="space-y-4">`, above the season-tab row:

```tsx
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
```

Wrap the existing season UI (season-tab row + board table + modal) so it only renders in season view, and render `TeamHistoryView` otherwise. The component's return becomes:

```tsx
  return (
    <div className="space-y-4">
      {/* toggle from above */}
      {view === "season" ? (
        <>
          {/* existing season-tab row, unchanged */}
          {/* existing overflow-x-auto board table, unchanged */}
          {/* existing {selected && <SlotHistoryModal ... />}, unchanged */}
        </>
      ) : (
        <TeamHistoryView boards={boards} teams={teams} />
      )}
    </div>
  );
```

(The three commented placeholders above mean: move the existing JSX blocks verbatim inside the fragment — do not rewrite them.)

- [ ] **Step 4: Wire the page — `src/app/draft-history/league/[leagueId]/page.tsx`**

Extend the board import:

```ts
import {
  buildDraftHistory,
  buildTeamDirectory,
  rookieLeagues,
  type SeasonBoard,
  type SeasonInput,
  type TeamEntry,
} from "@/lib/draft-history/board";
```

Declare alongside `boards` (before the try block):

```ts
  let boards: SeasonBoard[];
  let teams: TeamEntry[];
```

Inside the existing data-fetch `try`, directly after `boards = buildDraftHistory(inputs);`:

```ts
    teams = buildTeamDirectory(inputs);
```

Pass it down (also update the subtitle copy to cover both views):

```tsx
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Draft history — browse by season or by team; click any pick on the
          board to see that slot through the years
        </p>
```

```tsx
      <DraftBoardView boards={boards} teams={teams} />
```

- [ ] **Step 5: Full verification**

Run: `npm test` — Expected: all suites pass (board 15, DraftBoardView 6, TeamHistoryView 3, plus pre-existing idp-checker suites).
Run: `npm run typecheck` — Expected: no errors.
Run: `npm run lint` — Expected: no errors (JSX stays outside try/catch — this task adds none inside).
Run: `npm run build` — Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/draft-history/DraftBoardView.tsx "src/app/draft-history/league/[leagueId]/page.tsx" __tests__/draft-history/DraftBoardView.test.tsx
git commit -m "feat(draft-history): add By Season / By Team view toggle"
```
