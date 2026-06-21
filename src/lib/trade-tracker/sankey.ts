import type { TradeFlow } from "./resolve";

// A deterministic, three-column Sankey layout tuned for a single trade:
//   column 0 = team that gave the asset away
//   column 1 = the asset (player or pick)
//   column 2 = the outcome (drafted player for a pick; receiving team for a player)
// Every asset has equal weight, so each link is one "unit" thick.

export type NodeKind =
  | "team-giver"
  | "player-asset"
  | "pick-asset"
  | "player-outcome"
  | "team-outcome"
  | "pending"
  | "unknown";

export interface SankeyNode {
  id: string;
  column: 0 | 1 | 2;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: NodeKind;
  label: string;
  sublabel?: string;
}

export interface SankeyLink {
  id: string;
  kind: "player" | "pick";
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  thickness: number;
}

export interface SankeyLayout {
  nodes: SankeyNode[];
  links: SankeyLink[];
  width: number;
  height: number;
}

const UNIT = 22; // link thickness / per-asset band height
const GAP = 22; // vertical gap between stacked nodes
const NODE_W = 11;
const TOP_PAD = 44; // room for column headers
const BOTTOM_PAD = 16;

// Column x positions (node left edges) and the total canvas width.
const COL_X: Record<0 | 1 | 2, number> = { 0: 152, 1: 372, 2: 560 };
export const SANKEY_WIDTH = 760;

interface Internal {
  id: string;
  kind: NodeKind;
  column: 0 | 1 | 2;
  label: string;
  sublabel?: string;
  units: number; // band count -> height
  // running counters for link attachment
  outUsed: number;
  inUsed: number;
  y: number;
  height: number;
}

export function layoutTradeSankey(flows: TradeFlow[]): SankeyLayout {
  if (flows.length === 0) {
    return { nodes: [], links: [], width: SANKEY_WIDTH, height: 0 };
  }

  // Infer a missing giver when the trade is strictly between two teams.
  const teamIds = new Set<number>();
  for (const f of flows) {
    teamIds.add(f.toRosterId);
    if (f.fromRosterId != null) teamIds.add(f.fromRosterId);
  }
  const resolveGiver = (f: TradeFlow): { id: number | null; name: string } => {
    if (f.fromRosterId != null) {
      return { id: f.fromRosterId, name: f.fromTeamName ?? `Roster ${f.fromRosterId}` };
    }
    if (teamIds.size === 2) {
      const other = [...teamIds].find((t) => t !== f.toRosterId);
      if (other != null) return { id: other, name: `Roster ${other}` };
    }
    return { id: null, name: "—" };
  };

  const nodes = new Map<string, Internal>();
  const order: string[] = []; // preserve first-appearance order per column later
  const ensure = (n: Omit<Internal, "outUsed" | "inUsed" | "y" | "height">) => {
    let node = nodes.get(n.id);
    if (!node) {
      node = { ...n, outUsed: 0, inUsed: 0, y: 0, height: 0 };
      nodes.set(n.id, node);
      order.push(n.id);
    } else {
      node.units += n.units;
    }
    return node;
  };

  interface Plan {
    giverId: string;
    assetId: string;
    outcomeId: string;
    kind: "player" | "pick";
  }
  const plans: Plan[] = [];

  flows.forEach((f, i) => {
    const giver = resolveGiver(f);
    const giverId = `g:${giver.id ?? "none"}`;
    ensure({ id: giverId, kind: "team-giver", column: 0, label: giver.name, units: 1 });

    const asset = f.asset;
    if (asset.kind === "player") {
      const assetId = `a:${i}`;
      ensure({
        id: assetId,
        kind: "player-asset",
        column: 1,
        label: asset.playerName,
        sublabel: [asset.position, asset.team].filter(Boolean).join(" · ") || undefined,
        units: 1,
      });
      const outcomeId = `o:team:${f.toRosterId}`;
      ensure({
        id: outcomeId,
        kind: "team-outcome",
        column: 2,
        label: f.toTeamName,
        units: 1,
      });
      plans.push({ giverId, assetId, outcomeId, kind: "player" });
    } else {
      const assetId = `a:${i}`;
      ensure({ id: assetId, kind: "pick-asset", column: 1, label: asset.label, units: 1 });
      const outcomeId = `o:pick:${i}`;
      const outcome = asset.outcome;
      if (outcome.status === "drafted") {
        ensure({
          id: outcomeId,
          kind: "player-outcome",
          column: 2,
          label: outcome.playerName,
          sublabel: outcomeSublabel(outcome.position, outcome.team, outcome.pickNo, f.toTeamName),
          units: 1,
        });
      } else if (outcome.status === "pending") {
        ensure({
          id: outcomeId,
          kind: "pending",
          column: 2,
          label: "Not yet drafted",
          sublabel: `→ ${f.toTeamName}`,
          units: 1,
        });
      } else {
        ensure({
          id: outcomeId,
          kind: "unknown",
          column: 2,
          label: "Selection unknown",
          sublabel: `→ ${f.toTeamName}`,
          units: 1,
        });
      }
      plans.push({ giverId, assetId, outcomeId, kind: "pick" });
    }
  });

  // Stack each column top-to-bottom in first-appearance order.
  const columns: Record<0 | 1 | 2, Internal[]> = { 0: [], 1: [], 2: [] };
  for (const id of order) {
    const node = nodes.get(id)!;
    node.height = node.units * UNIT;
    columns[node.column].push(node);
  }
  for (const col of [0, 1, 2] as const) {
    let cursor = TOP_PAD;
    for (const node of columns[col]) {
      node.y = cursor;
      cursor += node.height + GAP;
    }
  }

  // Build links, attaching bands within multi-unit nodes via running counters.
  const links: SankeyLink[] = [];
  plans.forEach((plan, i) => {
    const giver = nodes.get(plan.giverId)!;
    const asset = nodes.get(plan.assetId)!;
    const outcome = nodes.get(plan.outcomeId)!;

    const giverBandY = giver.y + (giver.outUsed + 0.5) * UNIT;
    giver.outUsed += 1;
    const assetCenterY = asset.y + asset.height / 2;

    links.push({
      id: `l1:${i}`,
      kind: plan.kind,
      sourceX: COL_X[0] + NODE_W,
      sourceY: giverBandY,
      targetX: COL_X[1],
      targetY: assetCenterY,
      thickness: UNIT,
    });

    const outcomeBandY = outcome.y + (outcome.inUsed + 0.5) * UNIT;
    outcome.inUsed += 1;

    links.push({
      id: `l2:${i}`,
      kind: plan.kind,
      sourceX: COL_X[1] + NODE_W,
      sourceY: assetCenterY,
      targetX: COL_X[2],
      targetY: outcomeBandY,
      thickness: UNIT,
    });
  });

  const publicNodes: SankeyNode[] = [...nodes.values()].map((n) => ({
    id: n.id,
    column: n.column,
    x: COL_X[n.column],
    y: n.y,
    width: NODE_W,
    height: n.height,
    kind: n.kind,
    label: n.label,
    sublabel: n.sublabel,
  }));

  const maxBottom = Math.max(
    ...publicNodes.map((n) => n.y + n.height),
    TOP_PAD,
  );

  return {
    nodes: publicNodes,
    links,
    width: SANKEY_WIDTH,
    height: maxBottom + BOTTOM_PAD,
  };
}

function outcomeSublabel(
  position: string | null,
  team: string | null,
  pickNo: number,
  toTeam: string,
): string {
  const left = [position, team].filter(Boolean).join(" · ");
  return `${left ? left + " · " : ""}#${pickNo} → ${toTeam}`;
}
