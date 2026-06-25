import type { ReceivedAsset } from "@/lib/trade-tracker/resolve";

export default function PickOutcomeBadge({
  asset,
}: {
  asset: Extract<ReceivedAsset, { kind: "pick" }>;
}) {
  const { outcome } = asset;
  if (outcome.status === "drafted") {
    return (
      <span className="block text-sm leading-tight">
        <span className="flex items-baseline gap-x-1">
          <span className="text-slate-400">→</span>
          <span
            className="min-w-0 truncate font-semibold text-emerald-400"
            title={outcome.playerName}
          >
            {outcome.playerName}
          </span>
        </span>
        {(outcome.position || outcome.team) && (
          <span className="block text-xs text-slate-400">
            {[outcome.position, outcome.team].filter(Boolean).join(" · ")}, pick{" "}
            {outcome.pickNo}
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
