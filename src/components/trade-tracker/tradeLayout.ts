import type { PickChainLink, TeamTrade } from "@/lib/trade-tracker/team-view";

export interface CellPosition {
  row: number;
  column: number;
}

// Lays trades on a grid: trades not fed by any arrow ("net new") stack
// vertically in column 0, oldest at top. A trade fed by an arrow sits one
// column to the right of its feeder; the earliest such target continues the
// feeder's row while later targets branch onto new rows. A trade fed by
// several arrows (a diamond) is placed once, to the right of its farthest
// feeder (column = longest path from a root). Chain links only ever point
// forward in time, so the graph is acyclic.
export function layoutTrades(
  trades: TeamTrade[],
  chainLinks: PickChainLink[],
): Map<string, CellPosition> {
  const createdAt = new Map(trades.map((t) => [t.tradeId, t.createdAt]));
  const inEdges = new Map<string, string[]>();
  const outEdges = new Map<string, string[]>();
  for (const t of trades) {
    inEdges.set(t.tradeId, []);
    outEdges.set(t.tradeId, []);
  }
  for (const l of chainLinks) {
    if (!inEdges.has(l.toTradeId) || !outEdges.has(l.fromTradeId)) continue;
    outEdges.get(l.fromTradeId)!.push(l.toTradeId);
    inEdges.get(l.toTradeId)!.push(l.fromTradeId);
  }

  // Column = longest path from any root (so a diamond target lands right of
  // every feeder). The graph is acyclic, so the recursion always terminates.
  const columnMemo = new Map<string, number>();
  function column(id: string): number {
    const cached = columnMemo.get(id);
    if (cached !== undefined) return cached;
    let c = 0;
    for (const parent of inEdges.get(id) ?? []) {
      c = Math.max(c, column(parent) + 1);
    }
    columnMemo.set(id, c);
    return c;
  }

  // Targets resolved earliest-first so the oldest continuation keeps the row.
  for (const targets of outEdges.values()) {
    targets.sort((a, b) => (createdAt.get(a) ?? 0) - (createdAt.get(b) ?? 0));
  }

  const pos = new Map<string, CellPosition>();
  let nextRow = 0;

  function place(id: string, row: number): void {
    if (pos.has(id)) return;
    pos.set(id, { row, column: column(id) });
    let continued = false;
    for (const child of outEdges.get(id) ?? []) {
      if (pos.has(child)) continue;
      if (!continued) {
        place(child, row); // earliest unplaced target continues this row
        continued = true;
      } else {
        place(child, nextRow++); // later targets branch onto a new row
      }
    }
  }

  const roots = trades
    .filter((t) => (inEdges.get(t.tradeId) ?? []).length === 0)
    .sort((a, b) => a.createdAt - b.createdAt);
  for (const root of roots) {
    if (!pos.has(root.tradeId)) place(root.tradeId, nextRow++);
  }
  // Safety net for any trade a root traversal didn't reach.
  for (const t of trades) {
    if (!pos.has(t.tradeId)) place(t.tradeId, nextRow++);
  }

  return pos;
}
