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
          <span className="text-gray-500 dark:text-slate-400">→</span>
          <span
            className="min-w-0 truncate font-semibold text-green-600 dark:text-green-400"
            title={outcome.playerName}
          >
            {outcome.playerName}
          </span>
        </span>
        {(outcome.position || outcome.team) && (
          <span className="block text-xs text-gray-500 dark:text-slate-400">
            {[outcome.position, outcome.team].filter(Boolean).join(" · ")}, pick{" "}
            {outcome.pickNo}
          </span>
        )}
      </span>
    );
  }
  if (outcome.status === "pending") {
    return <span className="text-sm text-amber-500 dark:text-amber-400/80">→ not yet drafted</span>;
  }
  return <span className="text-sm text-gray-400 dark:text-slate-500">→ selection unknown</span>;
}
