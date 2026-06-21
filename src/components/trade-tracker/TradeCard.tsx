import type { ReceivedAsset, TradeView } from "@/lib/trade-tracker/resolve";
import TradeSankey from "./TradeSankey";

function PickOutcomeBadge({ asset }: { asset: Extract<ReceivedAsset, { kind: "pick" }> }) {
  const { outcome } = asset;
  if (outcome.status === "drafted") {
    return (
      <span className="text-sm">
        <span className="text-slate-400">→ became </span>
        <span className="font-semibold text-emerald-400">
          {outcome.playerName}
        </span>
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
    return (
      <span className="text-sm text-amber-400/80">→ not yet drafted</span>
    );
  }
  return (
    <span className="text-sm text-slate-500">→ selection unknown</span>
  );
}

function AssetRow({ asset }: { asset: ReceivedAsset }) {
  if (asset.kind === "player") {
    return (
      <li className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium text-slate-100">{asset.playerName}</span>
        {(asset.position || asset.team) && (
          <span className="text-xs text-slate-400">
            {[asset.position, asset.team].filter(Boolean).join(" · ")}
          </span>
        )}
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-medium text-sky-300">{asset.label}</span>
      <PickOutcomeBadge asset={asset} />
    </li>
  );
}

export default function TradeCard({ trade }: { trade: TradeView }) {
  const date = new Date(trade.createdAt);
  return (
    <article className="rounded-xl border border-pitch-700 bg-pitch-800/60 p-5">
      <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
        <span>{trade.season} season</span>
        <time dateTime={date.toISOString()}>
          {date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </time>
      </div>
      {trade.flows.length > 0 && (
        <div className="mb-5 rounded-lg bg-pitch-900/40 p-3">
          <TradeSankey flows={trade.flows} />
        </div>
      )}

      <details className="group">
        <summary className="mb-3 cursor-pointer list-none text-xs font-medium uppercase tracking-wide text-slate-400 hover:text-slate-200">
          <span className="group-open:hidden">▸ Show breakdown</span>
          <span className="hidden group-open:inline">▾ Hide breakdown</span>
        </summary>
      <div className="grid gap-4 sm:grid-cols-2">
        {trade.sides.map((side) => (
          <div
            key={side.rosterId}
            className="rounded-lg border border-pitch-700 bg-pitch-900/60 p-4"
          >
            <h3 className="mb-2 font-semibold text-slate-100">
              {side.teamName}
              <span className="ml-1 text-xs font-normal text-slate-500">
                received
              </span>
            </h3>
            {side.received.length > 0 ? (
              <ul className="space-y-1.5">
                {side.received.map((asset, i) => (
                  <AssetRow key={i} asset={asset} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Nothing</p>
            )}
          </div>
        ))}
      </div>
      </details>
    </article>
  );
}
