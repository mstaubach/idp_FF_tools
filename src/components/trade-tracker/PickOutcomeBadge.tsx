import type { ReceivedAsset } from "@/lib/trade-tracker/resolve";

export default function PickOutcomeBadge({
  asset,
}: {
  asset: Extract<ReceivedAsset, { kind: "pick" }>;
}) {
  const { outcome } = asset;
  if (outcome.status === "drafted") {
    return (
      <span className="text-sm">
        <span className="text-slate-400">→ became </span>
        <span className="font-semibold text-emerald-400">{outcome.playerName}</span>
        {(outcome.position || outcome.team) && (
          <span className="text-slate-400">
            {" "}
            ({[outcome.position, outcome.team].filter(Boolean).join(" · ")}, pick{" "}
            {outcome.pickNo})
          </span>
        )}
      </span>
    );
  }
  if (outcome.status === "pending") {
    return <span className="text-sm text-amber-400/80">→ not yet drafted</span>;
  }
  return <span className="text-sm text-slate-500">→ selection unknown</span>;
}
