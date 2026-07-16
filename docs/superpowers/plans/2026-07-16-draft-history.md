# Draft History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new "Draft History" tool under the League History nav dropdown: per-season rookie-draft boards for a Sleeper dynasty league, with click-through cross-season history for any round + slot.

**Architecture:** Self-contained tool namespace (`src/lib/draft-history/`, `src/components/draft-history/`, `src/app/draft-history/`) per this repo's per-tool convention — its own Sleeper client and types, nothing imported from trade-tracker or idp-checker libs. A pure, unit-tested `board.ts` transforms per-season Sleeper data into `SeasonBoard[]`; a server component page fetches and builds; a client `DraftBoardView` renders tabs + grid + modal.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-16-draft-history-design.md`

## Global Constraints

- Work on branch `feature/draft-history` (already created; spec committed there).
- Per-tool namespace: never import from `src/lib/trade-tracker/` or `src/lib/idp-checker/`. Shared imports allowed: `@/lib/sleeper-id`, `@/lib/profile/active-league`, `@/components/profile/FirstVisitPrompt`.
- TypeScript `strict` is on; path alias `@/*` → `src/*`.
- Styling: Tailwind, house dark-slate palette — every element needs both light and `dark:` variants (`dark:bg-pitch-800`, `dark:text-slate-100`, etc.).
- Caching style for this tool: plain `fetch` with `next: { revalidate }` per-call TTLs; `getJson` returns `null` on 404, throws on other non-OK statuses.
- CI runs lint + build only — run `npm test` and `npm run typecheck` locally before pushing.
- Commit after each task (one focused commit per task).

---

### Task 1: Types + Sleeper client

**Files:**
- Create: `src/lib/draft-history/types.ts`
- Create: `src/lib/draft-history/sleeper.ts`

**Interfaces:**
- Consumes: `isValidSleeperId` from `@/lib/sleeper-id`.
- Produces: types `League`, `SleeperUser`, `Roster`, `Draft`, `DraftPickResult`; functions `getLeague(leagueId)`, `getUserLeagues(userId, season)`, `getLeagueChain(leagueId): Promise<League[]>` (newest first), `getUsers(leagueId)`, `getRosters(leagueId)`, `getDrafts(leagueId)`, `getDraft(draftId)`, `getDraftPicks(draftId)`.

- [ ] **Step 1: Write `src/lib/draft-history/types.ts`**

```typescript
// Shapes returned by the public Sleeper API (https://docs.sleeper.com).
// Only the fields this tool uses are typed.

export interface League {
  league_id: string;
  name: string;
  season: string;
  previous_league_id: string | null;
  draft_id: string | null;
  total_rosters: number;
}

export interface SleeperUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata?: {
    team_name?: string;
  };
}

export interface Roster {
  roster_id: number;
  owner_id: string | null;
}

export interface Draft {
  draft_id: string;
  season: string;
  league_id: string;
  status: string;
  // draft slot (as string) -> roster_id of the franchise that owns that slot.
  // The /league/{id}/drafts list endpoint omits this; only /draft/{id} has it.
  slot_to_roster_id: Record<string, number> | null;
  settings?: {
    rounds?: number;
  };
}

// A completed pick from /draft/{id}/picks
export interface DraftPickResult {
  round: number;
  pick_no: number;
  draft_slot: number;
  player_id: string;
  roster_id: number;
  metadata: {
    first_name?: string;
    last_name?: string;
    position?: string;
    team?: string;
  };
}
```

- [ ] **Step 2: Write `src/lib/draft-history/sleeper.ts`**

```typescript
import { isValidSleeperId } from "@/lib/sleeper-id";
import type {
  Draft,
  DraftPickResult,
  League,
  Roster,
  SleeperUser,
} from "./types";

const BASE = "https://api.sleeper.app/v1";

class SleeperError extends Error {}

async function getJson<T>(
  path: string,
  revalidateSeconds: number,
): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, {
    next: { revalidate: revalidateSeconds },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new SleeperError(`Sleeper request failed (${res.status}): ${path}`);
  }
  return (await res.json()) as T;
}

export async function getLeague(leagueId: string): Promise<League | null> {
  if (!isValidSleeperId(leagueId)) return null;
  return getJson<League>(`/league/${leagueId}`, 60 * 60);
}

// A user's leagues for one NFL season. Used to walk the dynasty chain forward,
// since Sleeper leagues only point backward (previous_league_id), not forward.
export async function getUserLeagues(
  userId: string,
  season: string,
): Promise<League[]> {
  return (
    (await getJson<League[]>(`/user/${userId}/leagues/nfl/${season}`, 60 * 60)) ??
    []
  );
}

// Find the most recent league in the dynasty, starting from any season's
// league. Sleeper has no successor pointer, so for each following season we
// look through a current member's leagues for one whose previous_league_id
// points back at the league we're holding. Stops when no successor exists.
async function getNewestLeague(start: League): Promise<League> {
  let head = start;
  for (let guard = 0; guard < 20; guard++) {
    const nextSeason = String(Number(head.season) + 1);
    const members = await getUsers(head.league_id);
    // Look up every member's next-season leagues in parallel rather than one at
    // a time. Members share the same successor league, but checking all of them
    // tolerates anyone who left the league between seasons.
    const memberLeagues = await Promise.all(
      members.map((member) => getUserLeagues(member.user_id, nextSeason)),
    );
    const successor =
      memberLeagues
        .flat()
        .find((l) => l.previous_league_id === head.league_id) ?? null;
    if (!successor) break;
    head = successor;
  }
  return head;
}

// Capture drafts from every season this dynasty has existed, regardless of
// which season's league id was entered: walk forward to the newest league,
// then walk the previous_league_id chain backward. Newest first.
export async function getLeagueChain(leagueId: string): Promise<League[]> {
  const start = await getLeague(leagueId);
  if (!start) return [];

  const newest = await getNewestLeague(start);

  const chain: League[] = [];
  let current: string | null = newest.league_id;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const league = await getLeague(current);
    if (!league) break;
    chain.push(league);
    current = league.previous_league_id;
  }
  return chain;
}

export async function getUsers(leagueId: string): Promise<SleeperUser[]> {
  return (await getJson<SleeperUser[]>(`/league/${leagueId}/users`, 60 * 60)) ?? [];
}

export async function getRosters(leagueId: string): Promise<Roster[]> {
  return (await getJson<Roster[]>(`/league/${leagueId}/rosters`, 60 * 60)) ?? [];
}

export async function getDrafts(leagueId: string): Promise<Draft[]> {
  return (await getJson<Draft[]>(`/league/${leagueId}/drafts`, 60 * 60)) ?? [];
}

// The /league/{id}/drafts list endpoint omits slot_to_roster_id; only the
// single-draft endpoint includes it. We need it to map draft slots back to the
// franchise that originally owned each pick.
export async function getDraft(draftId: string): Promise<Draft | null> {
  return getJson<Draft>(`/draft/${draftId}`, 60 * 60);
}

export async function getDraftPicks(
  draftId: string,
): Promise<DraftPickResult[]> {
  return (
    (await getJson<DraftPickResult[]>(`/draft/${draftId}/picks`, 60 * 30)) ?? []
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/draft-history/types.ts src/lib/draft-history/sleeper.ts
git commit -m "feat(draft-history): add Sleeper types and client"
```

---

### Task 2: Board model (`board.ts`) — TDD

**Files:**
- Create: `src/lib/draft-history/board.ts`
- Test: `__tests__/draft-history/lib/board.test.ts`

**Interfaces:**
- Consumes: types from `@/lib/draft-history/types` (Task 1).
- Produces:
  - `interface SeasonInput { league: League; draft: Draft; picks: DraftPickResult[]; users: SleeperUser[]; rosters: Roster[] }`
  - `interface BoardCell { round: number; slot: number; pickNo: number; playerName: string; position: string | null; nflTeam: string | null; drafterTeamName: string; originalOwnerTeamName: string; isTraded: boolean }`
  - `interface SeasonBoard { season: string; rounds: number; slots: number; slotOwners: string[]; cells: BoardCell[] }`
  - `rookieLeagues(chain: League[]): League[]` — drops the oldest (startup) season from a newest-first chain.
  - `buildDraftHistory(inputs: SeasonInput[]): SeasonBoard[]` — newest season first; seasons with zero picks omitted.

- [ ] **Step 1: Write the failing tests** — `__tests__/draft-history/lib/board.test.ts`

```typescript
import { describe, expect, it } from "vitest";
import { buildDraftHistory, rookieLeagues } from "@/lib/draft-history/board";
import type { SeasonInput } from "@/lib/draft-history/board";
import type { DraftPickResult, League } from "@/lib/draft-history/types";

function league(season: string): League {
  return {
    league_id: `L${season}`,
    name: "Test League",
    season,
    previous_league_id: null,
    draft_id: `D${season}`,
    total_rosters: 2,
  };
}

function pick(overrides: Partial<DraftPickResult>): DraftPickResult {
  return {
    round: 1,
    pick_no: 1,
    draft_slot: 1,
    player_id: "p1",
    roster_id: 1,
    metadata: { first_name: "John", last_name: "Doe", position: "LB", team: "KC" },
    ...overrides,
  };
}

// Two-team league: roster 1 owned by Alice (team name "Alpha ", padded the way
// Sleeper sometimes returns it), roster 2 owned by Bravo (no team_name set).
function seasonInput(season: string, picks: DraftPickResult[]): SeasonInput {
  return {
    league: league(season),
    draft: {
      draft_id: `D${season}`,
      season,
      league_id: `L${season}`,
      status: "complete",
      slot_to_roster_id: { "1": 1, "2": 2 },
      settings: { rounds: 2 },
    },
    picks,
    users: [
      { user_id: "u1", display_name: "Alice", avatar: null, metadata: { team_name: "Alpha " } },
      { user_id: "u2", display_name: "Bravo", avatar: null },
    ],
    rosters: [
      { roster_id: 1, owner_id: "u1" },
      { roster_id: 2, owner_id: "u2" },
    ],
  };
}

describe("rookieLeagues", () => {
  it("drops the startup (oldest) season from a newest-first chain", () => {
    const chain = [league("2026"), league("2025"), league("2024")];
    expect(rookieLeagues(chain).map((l) => l.season)).toEqual(["2026", "2025"]);
  });

  it("returns nothing for a league still in its startup season", () => {
    expect(rookieLeagues([league("2026")])).toEqual([]);
  });
});

describe("buildDraftHistory", () => {
  it("marks a pick made from another franchise's slot as traded", () => {
    const boards = buildDraftHistory([
      seasonInput("2026", [
        pick({ draft_slot: 2, pick_no: 2, roster_id: 1, player_id: "p2" }),
      ]),
    ]);
    expect(boards).toHaveLength(1);
    const cell = boards[0].cells[0];
    expect(cell.isTraded).toBe(true);
    expect(cell.drafterTeamName).toBe("Alpha");
    expect(cell.originalOwnerTeamName).toBe("Bravo");
  });

  it("marks a pick made from the team's own slot as not traded", () => {
    const boards = buildDraftHistory([seasonInput("2026", [pick({})])]);
    const cell = boards[0].cells[0];
    expect(cell.isTraded).toBe(false);
    expect(cell.drafterTeamName).toBe("Alpha");
    expect(cell.originalOwnerTeamName).toBe("Alpha");
  });

  it("resolves slot owners with team_name → display_name → Roster N fallbacks", () => {
    const input = seasonInput("2026", [pick({})]);
    input.rosters.push({ roster_id: 3, owner_id: null });
    input.draft.slot_to_roster_id = { "1": 1, "2": 2, "3": 3 };
    input.league.total_rosters = 3;
    const [board] = buildDraftHistory([input]);
    expect(board.slotOwners).toEqual(["Alpha", "Bravo", "Roster 3"]);
    expect(board.slots).toBe(3);
  });

  it("omits seasons whose draft has no picks", () => {
    const boards = buildDraftHistory([
      seasonInput("2026", []),
      seasonInput("2025", [pick({})]),
    ]);
    expect(boards.map((b) => b.season)).toEqual(["2025"]);
  });

  it("orders boards newest season first", () => {
    const boards = buildDraftHistory([
      seasonInput("2025", [pick({})]),
      seasonInput("2026", [pick({})]),
    ]);
    expect(boards.map((b) => b.season)).toEqual(["2026", "2025"]);
  });

  it("names players from pick metadata, falling back to player id", () => {
    const boards = buildDraftHistory([
      seasonInput("2026", [pick({ metadata: {} })]),
    ]);
    expect(boards[0].cells[0].playerName).toBe("p1");
    expect(boards[0].cells[0].position).toBeNull();
  });

  it("takes round count from draft settings", () => {
    const boards = buildDraftHistory([seasonInput("2026", [pick({})])]);
    expect(boards[0].rounds).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/draft-history/lib/board.test.ts`
Expected: FAIL — cannot resolve `@/lib/draft-history/board`.

- [ ] **Step 3: Write `src/lib/draft-history/board.ts`**

```typescript
import type {
  Draft,
  DraftPickResult,
  League,
  Roster,
  SleeperUser,
} from "./types";

// One season's worth of raw Sleeper data, ready to be turned into a board.
export interface SeasonInput {
  league: League;
  draft: Draft;
  picks: DraftPickResult[];
  users: SleeperUser[];
  rosters: Roster[];
}

export interface BoardCell {
  round: number;
  slot: number;
  pickNo: number;
  playerName: string;
  position: string | null;
  nflTeam: string | null;
  drafterTeamName: string;
  // The franchise that originally owned this draft slot (slot_to_roster_id).
  originalOwnerTeamName: string;
  isTraded: boolean;
}

export interface SeasonBoard {
  season: string;
  rounds: number;
  slots: number;
  // Team name owning each slot column this season; index 0 = slot 1.
  slotOwners: string[];
  cells: BoardCell[];
}

// The oldest season in a dynasty chain is the startup draft; every later
// season's draft is a rookie draft. Chain arrives newest-first.
export function rookieLeagues(chain: League[]): League[] {
  return chain.slice(0, -1);
}

function cleanName(name: string | null | undefined): string {
  return name?.trim() ?? "";
}

function rosterNames(
  users: SleeperUser[],
  rosters: Roster[],
): Map<number, string> {
  const userById = new Map(users.map((u) => [u.user_id, u]));
  const names = new Map<number, string>();
  for (const roster of rosters) {
    const user = roster.owner_id ? userById.get(roster.owner_id) : undefined;
    names.set(
      roster.roster_id,
      cleanName(user?.metadata?.team_name) ||
        cleanName(user?.display_name) ||
        `Roster ${roster.roster_id}`,
    );
  }
  return names;
}

export function buildDraftHistory(inputs: SeasonInput[]): SeasonBoard[] {
  const boards: SeasonBoard[] = [];

  for (const { league, draft, picks, users, rosters } of inputs) {
    if (picks.length === 0) continue;

    const names = rosterNames(users, rosters);
    const slotToRoster = draft.slot_to_roster_id ?? {};
    const nameOf = (rosterId: number | undefined) =>
      rosterId != null ? names.get(rosterId) ?? `Roster ${rosterId}` : "Unknown";

    const slots = league.total_rosters || Object.keys(slotToRoster).length;
    const rounds =
      draft.settings?.rounds ?? Math.max(...picks.map((p) => p.round));

    const slotOwners = Array.from({ length: slots }, (_, i) =>
      nameOf(slotToRoster[String(i + 1)]),
    );

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
        drafterTeamName: nameOf(p.roster_id),
        originalOwnerTeamName: nameOf(originalRoster),
        isTraded: originalRoster != null && originalRoster !== p.roster_id,
      };
    });

    boards.push({ season: draft.season, rounds, slots, slotOwners, cells });
  }

  boards.sort((a, b) => Number(b.season) - Number(a.season));
  return boards;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/draft-history/lib/board.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/draft-history/board.ts __tests__/draft-history/lib/board.test.ts
git commit -m "feat(draft-history): add pure board model with rookie-season filter"
```

---

### Task 3: Landing page + Message component

**Files:**
- Create: `src/components/draft-history/Message.tsx`
- Create: `src/app/draft-history/page.tsx`

**Interfaces:**
- Consumes: `ACTIVE_LEAGUE_COOKIE`, `isValidLeagueId` from `@/lib/profile/active-league`; `FirstVisitPrompt` from `@/components/profile/FirstVisitPrompt`.
- Produces: `Message({ title, body })` component used by Task 5; route `/draft-history`.

- [ ] **Step 1: Write `src/components/draft-history/Message.tsx`**

Namespaced copy of trade-tracker's error card, pointing back at `/draft-history`:

```tsx
import Link from "next/link";

export default function Message({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <main className="mx-auto max-w-6xl space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-pitch-700 dark:bg-pitch-800/60">
        <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-slate-100">{title}</h1>
        <p className="text-gray-600 dark:text-slate-300">{body}</p>
        <Link
          href="/draft-history"
          className="mt-4 inline-block text-sm text-green-600 hover:underline dark:text-green-400"
        >
          ← Back to start
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write `src/app/draft-history/page.tsx`**

Mirrors trade-tracker's landing: cookie redirect unless `?picker=1`, league-ID form that accepts pasted Sleeper URLs:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import FirstVisitPrompt from "@/components/profile/FirstVisitPrompt";
import {
  ACTIVE_LEAGUE_COOKIE,
  isValidLeagueId,
} from "@/lib/profile/active-league";

async function goToLeague(formData: FormData) {
  "use server";
  const raw = String(formData.get("leagueId") ?? "").trim();
  const match = raw.match(/(\d{6,})/);
  if (match) redirect(`/draft-history/league/${match[1]}`);
  redirect("/draft-history?error=1&picker=1");
}

export default async function DraftHistoryHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; picker?: string }>;
}) {
  const { error, picker } = await searchParams;
  if (!picker) {
    const active = (await cookies()).get(ACTIVE_LEAGUE_COOKIE)?.value;
    if (isValidLeagueId(active)) redirect(`/draft-history/league/${active}`);
  }
  return (
    <main className="mx-auto max-w-5xl space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-black tracking-tighter text-gray-900 dark:text-slate-100">
          Draft History
        </h1>
        <p className="text-gray-600 dark:text-slate-300">
          Every rookie draft in your dynasty's history, one board per season.
          Click any pick to see who was taken at that slot year after year —
          and which team was on the clock.
        </p>
        <FirstVisitPrompt />
      </section>

      <form action={goToLeague} className="space-y-3">
        <label
          htmlFor="leagueId"
          className="block text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          Sleeper League ID
        </label>
        <div className="flex gap-2">
          <input
            id="leagueId"
            name="leagueId"
            type="text"
            inputMode="numeric"
            placeholder="e.g. 992734045862027264"
            required
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-green-600 focus:outline-hidden dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white transition hover:bg-green-600"
          >
            View drafts
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-500 dark:text-red-400">
            Please enter a valid Sleeper league ID.
          </p>
        )}
      </form>

      <section className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600 dark:border-pitch-700 dark:bg-pitch-800/50 dark:text-slate-300">
        <h2 className="mb-2 font-semibold text-gray-900 dark:text-slate-100">
          Where do I find my league ID?
        </h2>
        <p>
          Open your league in the Sleeper web app. The long number in the URL
          (
          <code className="text-green-600 dark:text-green-400">
            sleeper.com/leagues/&lt;LEAGUE_ID&gt;
          </code>
          ) is your league ID. You can paste the whole URL above too.
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/draft-history/Message.tsx src/app/draft-history/page.tsx
git commit -m "feat(draft-history): add landing page and error message card"
```

---

### Task 4: Board UI components

**Files:**
- Create: `src/components/draft-history/SlotHistoryModal.tsx`
- Create: `src/components/draft-history/DraftBoardView.tsx`

**Interfaces:**
- Consumes: `SeasonBoard`, `BoardCell` types from `@/lib/draft-history/board` (Task 2).
- Produces: `DraftBoardView({ boards: SeasonBoard[] })` (default export, client component) used by Task 5; `SlotHistoryModal({ boards, round, slot, onClose })`.

- [ ] **Step 1: Write `src/components/draft-history/SlotHistoryModal.tsx`**

```tsx
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
```

- [ ] **Step 2: Write `src/components/draft-history/DraftBoardView.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { BoardCell, SeasonBoard } from "@/lib/draft-history/board";
import SlotHistoryModal from "./SlotHistoryModal";

function cellAt(
  board: SeasonBoard,
  round: number,
  slot: number,
): BoardCell | undefined {
  return board.cells.find((c) => c.round === round && c.slot === slot);
}

export default function DraftBoardView({ boards }: { boards: SeasonBoard[] }) {
  const [seasonIdx, setSeasonIdx] = useState(0);
  const [selected, setSelected] = useState<{ round: number; slot: number } | null>(
    null,
  );
  const board = boards[seasonIdx];

  return (
    <div className="space-y-4">
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
                          onClick={() => setSelected({ round: r + 1, slot: s + 1 })}
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
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/draft-history/DraftBoardView.tsx src/components/draft-history/SlotHistoryModal.tsx
git commit -m "feat(draft-history): add draft board view and slot history modal"
```

---

### Task 5: League page + loading skeleton

**Files:**
- Create: `src/app/draft-history/league/[leagueId]/page.tsx`
- Create: `src/app/draft-history/league/[leagueId]/loading.tsx`

**Interfaces:**
- Consumes: `getLeagueChain`, `getUsers`, `getRosters`, `getDrafts`, `getDraft`, `getDraftPicks` (Task 1); `rookieLeagues`, `buildDraftHistory`, `SeasonInput` (Task 2); `Message` (Task 3); `DraftBoardView` (Task 4).
- Produces: route `/draft-history/league/[leagueId]`.

- [ ] **Step 1: Write `src/app/draft-history/league/[leagueId]/page.tsx`**

```tsx
import DraftBoardView from "@/components/draft-history/DraftBoardView";
import Message from "@/components/draft-history/Message";
import {
  buildDraftHistory,
  rookieLeagues,
  type SeasonBoard,
  type SeasonInput,
} from "@/lib/draft-history/board";
import {
  getDraft,
  getDraftPicks,
  getDrafts,
  getLeagueChain,
  getRosters,
  getUsers,
} from "@/lib/draft-history/sleeper";

export const revalidate = 300;

export default async function DraftHistoryLeaguePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  let leagueName: string;
  let boards: SeasonBoard[];
  try {
    const chain = await getLeagueChain(leagueId);
    if (chain.length === 0) {
      return (
        <Message
          title="League not found"
          body={`No Sleeper league matched the ID "${leagueId}". Make sure you copied the full ID.`}
        />
      );
    }
    leagueName = chain[0].name;

    const rookies = rookieLeagues(chain);
    if (rookies.length === 0) {
      return (
        <Message
          title="No rookie drafts yet"
          body="This league is still in its startup season — check back after its first rookie draft."
        />
      );
    }

    const inputs: SeasonInput[] = (
      await Promise.all(
        rookies.map(async (league) => {
          const [users, rosters, drafts] = await Promise.all([
            getUsers(league.league_id),
            getRosters(league.league_id),
            getDrafts(league.league_id),
          ]);
          return Promise.all(
            // The drafts list omits slot_to_roster_id, so fetch each full
            // draft. Fall back to the list entry if the detail fetch 404s.
            drafts.map(async (d) => {
              const [full, picks] = await Promise.all([
                getDraft(d.draft_id),
                getDraftPicks(d.draft_id),
              ]);
              return { league, draft: full ?? d, picks, users, rosters };
            }),
          );
        }),
      )
    ).flat();

    boards = buildDraftHistory(inputs);
  } catch {
    return (
      <Message
        title="Couldn't load this league"
        body="Sleeper's API didn't respond as expected. Double-check the league ID and try again."
      />
    );
  }

  if (boards.length === 0) {
    return (
      <Message
        title="No rookie drafts yet"
        body="No completed rookie draft picks were found for this league."
      />
    );
  }

  return (
    <main className="mx-auto max-w-[90rem] space-y-6 px-2">
      <div>
        <h1 className="text-2xl font-black tracking-tighter text-gray-900 dark:text-slate-100">
          {leagueName}
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Draft history — click any pick to see that slot through the years
        </p>
      </div>
      <DraftBoardView boards={boards} />
    </main>
  );
}
```

- [ ] **Step 2: Write `src/app/draft-history/league/[leagueId]/loading.tsx`**

```tsx
export default function Loading() {
  return (
    <main className="mx-auto max-w-[90rem] space-y-4 px-2">
      <div className="h-7 w-48 animate-pulse rounded-sm bg-gray-200 dark:bg-pitch-700" />
      <p className="text-sm text-gray-500 dark:text-slate-400">
        Fetching every season&apos;s rookie draft…
      </p>
      <div className="h-96 animate-pulse rounded-xl border border-gray-200 bg-gray-100/40 dark:border-pitch-700 dark:bg-pitch-800/40" />
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: both exit 0; build output lists the `/draft-history` and `/draft-history/league/[leagueId]` routes.

- [ ] **Step 4: Commit**

```bash
git add "src/app/draft-history/league/[leagueId]/page.tsx" "src/app/draft-history/league/[leagueId]/loading.tsx"
git commit -m "feat(draft-history): add league draft board page"
```

---

### Task 6: Navigation + league-switcher wiring + final verification

**Files:**
- Modify: `src/app/(components)/NavBar.jsx:11-18` (the `dropdowns` array)
- Modify: `src/lib/profile/active-league.ts:3-8` (the `TOOLS` array)

**Interfaces:**
- Consumes: routes from Tasks 3 and 5.
- Produces: "Draft History" entry in the League History dropdown; league-switcher support on `/draft-history` pages (the `LeagueSwitcher` uses `TOOLS` via `leaguePathFor` to stay on the current tool when switching leagues).

- [ ] **Step 1: Add the nav link**

In `src/app/(components)/NavBar.jsx`, add a third link to the "League History" dropdown:

```javascript
  {
    label: "League History",
    links: [
      { href: "/standings", label: "Standings" },
      { href: "/trade-tracker", label: "Trade Tracker" },
      { href: "/draft-history", label: "Draft History" },
    ],
  },
```

- [ ] **Step 2: Register the tool for the league switcher**

In `src/lib/profile/active-league.ts`, add to the `TOOLS` array:

```typescript
const TOOLS: Array<{ root: string; leaguePath: (id: string) => string }> = [
  { root: '/standings', leaguePath: (id) => `/standings/${id}` },
  { root: '/trade-tracker', leaguePath: (id) => `/trade-tracker/league/${id}` },
  { root: '/draft-history', leaguePath: (id) => `/draft-history/league/${id}` },
  { root: '/roster-management', leaguePath: (id) => `/roster-management/${id}` },
  { root: '/taxi-filler', leaguePath: (id) => `/taxi-filler/${id}` },
];
```

- [ ] **Step 3: Full local verification**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all four exit 0 (CI only runs lint + build, so test + typecheck must pass here).

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, open `http://localhost:3000/draft-history` (append `?picker=1` if a cookie redirect fires), submit a real dynasty league ID, and confirm: season tabs render newest-first, board cells show player + drafter + via-notes, clicking a cell opens the slot-history modal, Escape closes it, and the "Draft History" nav link is highlighted.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(components)/NavBar.jsx" src/lib/profile/active-league.ts
git commit -m "feat(draft-history): add nav link and league-switcher support"
```
