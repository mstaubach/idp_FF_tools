import type { TradeFlow } from "@/lib/trade-tracker/resolve";
import {
  layoutTradeSankey,
  type NodeKind,
  type SankeyNode,
} from "@/lib/trade-tracker/sankey";

const NODE_FILL: Record<NodeKind, string> = {
  "team-giver": "#94a3b8",
  "team-outcome": "#94a3b8",
  "player-asset": "#34d399",
  "player-outcome": "#34d399",
  "pick-asset": "#60a5fa",
  pending: "#fbbf24",
  unknown: "#64748b",
};

const LABEL_FILL: Record<NodeKind, string> = {
  "team-giver": "#e2e8f0",
  "team-outcome": "#e2e8f0",
  "player-asset": "#6ee7b7",
  "player-outcome": "#6ee7b7",
  "pick-asset": "#93c5fd",
  pending: "#fcd34d",
  unknown: "#94a3b8",
};

function linkColor(kind: "player" | "pick"): string {
  return kind === "pick" ? "#60a5fa" : "#34d399";
}

function ribbonPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): string {
  const mx = (sx + tx) / 2;
  return `M${sx},${sy} C${mx},${sy} ${mx},${ty} ${tx},${ty}`;
}

function NodeLabel({ node }: { node: SankeyNode }) {
  const fill = LABEL_FILL[node.kind];
  const cy = node.y + node.height / 2;

  if (node.column === 0) {
    // Giver: label to the left of the bar, right-aligned.
    return (
      <text
        x={node.x - 8}
        y={cy}
        textAnchor="end"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
        fill={fill}
      >
        {node.label}
      </text>
    );
  }

  if (node.column === 1) {
    // Asset: stacked above the bar.
    return (
      <text
        x={node.x + node.width / 2}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill={fill}
      >
        {node.sublabel ? (
          <>
            <tspan x={node.x + node.width / 2} y={node.y - 16}>
              {node.label}
            </tspan>
            <tspan x={node.x + node.width / 2} y={node.y - 5} fontSize={9} fontWeight={400} fill="#94a3b8">
              {node.sublabel}
            </tspan>
          </>
        ) : (
          <tspan x={node.x + node.width / 2} y={node.y - 5}>
            {node.label}
          </tspan>
        )}
      </text>
    );
  }

  // Outcome: label to the right of the bar.
  const x = node.x + node.width + 8;
  return (
    <text x={x} textAnchor="start" fill={fill}>
      {node.sublabel ? (
        <>
          <tspan x={x} y={cy - 4} fontSize={12} fontWeight={600}>
            {node.label}
          </tspan>
          <tspan x={x} y={cy + 9} fontSize={9} fontWeight={400} fill="#94a3b8">
            {node.sublabel}
          </tspan>
        </>
      ) : (
        <tspan x={x} y={cy} fontSize={12} fontWeight={600} dominantBaseline="central">
          {node.label}
        </tspan>
      )}
    </text>
  );
}

export default function TradeSankey({ flows }: { flows: TradeFlow[] }) {
  const layout = layoutTradeSankey(flows);
  if (layout.nodes.length === 0) return null;

  const headerY = 16;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label="Trade flow diagram"
        style={{ width: "100%", minWidth: 560, height: "auto" }}
        className="trade-sankey"
      >
        <style>{`
          .trade-sankey .ribbon { transition: stroke-opacity .15s ease; }
          .trade-sankey:hover .ribbon { stroke-opacity: .18; }
          .trade-sankey .ribbon:hover { stroke-opacity: .75; }
        `}</style>

        {/* column headers */}
        <text x={152 + 11} y={headerY} textAnchor="end" fontSize={9} letterSpacing={1} fill="#64748b">
          TRADED AWAY
        </text>
        <text x={372 + 5.5} y={headerY} textAnchor="middle" fontSize={9} letterSpacing={1} fill="#64748b">
          ASSET
        </text>
        <text x={560} y={headerY} textAnchor="start" fontSize={9} letterSpacing={1} fill="#64748b">
          BECAME / RECEIVED
        </text>

        {/* ribbons first so nodes sit on top */}
        {layout.links.map((link) => (
          <path
            key={link.id}
            className="ribbon"
            d={ribbonPath(link.sourceX, link.sourceY, link.targetX, link.targetY)}
            fill="none"
            stroke={linkColor(link.kind)}
            strokeOpacity={0.4}
            strokeWidth={link.thickness}
            strokeLinecap="butt"
          />
        ))}

        {/* nodes */}
        {layout.nodes.map((node) => (
          <rect
            key={node.id}
            x={node.x}
            y={node.y}
            width={node.width}
            height={node.height}
            rx={4}
            fill={NODE_FILL[node.kind]}
          />
        ))}

        {/* labels */}
        {layout.nodes.map((node) => (
          <NodeLabel key={`l-${node.id}`} node={node} />
        ))}
      </svg>
    </div>
  );
}
