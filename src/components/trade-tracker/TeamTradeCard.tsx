import type { ReceivedAsset } from "@/lib/trade-tracker/resolve";
import { pickKey } from "@/lib/trade-tracker/resolve";
import type { TeamTrade } from "@/lib/trade-tracker/team-view";
import PickOutcomeBadge from "./PickOutcomeBadge";

function keyOf(asset: Extract<ReceivedAsset, { kind: "pick" }>): string {
  return pickKey(asset.season, asset.round, asset.originalRoster);
}

function AssetRow({
  asset,
  side,
  sourceKeys,
  targetKeys,
  tradeId,
}: {
  asset: ReceivedAsset;
  side: "receives" | "tradedAway";
  sourceKeys: Set<string>;
  targetKeys: Set<string>;
  tradeId: string;
}) {
  if (asset.kind === "player") {
    return (
      <li className="leading-tight">
        <div
          className="truncate font-medium text-gray-900 dark:text-slate-100"
          title={asset.playerName}
        >
          {asset.playerName}
        </div>
        {(asset.position || asset.team) && (
          <div className="text-xs text-gray-500 dark:text-slate-400">
            {[asset.position, asset.team].filter(Boolean).join(" · ")}
          </div>
        )}
      </li>
    );
  }

  if (asset.kind === "faab") {
    return (
      <li className="leading-tight">
        <div className="font-medium text-amber-600/80 dark:text-amber-200/60">{asset.label}</div>
      </li>
    );
  }

  const key = keyOf(asset);
  const isSource = side === "receives" && sourceKeys.has(key);
  const isTarget = side === "tradedAway" && targetKeys.has(key);
  const anchor = isSource ? `src:${tradeId}:${key}` : isTarget ? `dst:${tradeId}:${key}` : undefined;

  return (
    <li data-anchor={anchor} className="leading-tight">
      <div className="font-medium text-sky-600 dark:text-sky-300">{asset.label}</div>
      {asset.originalOwnerName && (
        <div
          className="truncate text-xs text-gray-500 dark:text-slate-400"
          title={asset.originalOwnerName}
        >
          ({asset.originalOwnerName})
        </div>
      )}
      <div className="mt-0.5">
        {isSource ? (
          <span className="text-sm text-sky-500 dark:text-sky-400/80">→ traded pick</span>
        ) : (
          <PickOutcomeBadge asset={asset} />
        )}
      </div>
    </li>
  );
}

function Column({
  title,
  assets,
  side,
  sourceKeys,
  targetKeys,
  tradeId,
}: {
  title: string;
  assets: ReceivedAsset[];
  side: "receives" | "tradedAway";
  sourceKeys: Set<string>;
  targetKeys: Set<string>;
  tradeId: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-pitch-700 dark:bg-pitch-900/60">
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">
        {title}
      </h4>
      {assets.length > 0 ? (
        <ul className="space-y-1.5">
          {assets.map((asset, i) => (
            <AssetRow
              key={i}
              asset={asset}
              side={side}
              sourceKeys={sourceKeys}
              targetKeys={targetKeys}
              tradeId={tradeId}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-400 dark:text-slate-500">Nothing</p>
      )}
    </div>
  );
}

export default function TeamTradeCard({
  trade,
  sourceKeys,
  targetKeys,
}: {
  trade: TeamTrade;
  sourceKeys: Set<string>;
  targetKeys: Set<string>;
}) {
  const date = new Date(trade.createdAt);
  const counterparty = trade.counterparties.join(", ") || "Unknown";
  return (
    <article className="w-md shrink-0 rounded-xl border border-gray-200 bg-white p-5 dark:border-pitch-700 dark:bg-pitch-800/60">
      <div className="mb-1 text-sm font-semibold text-gray-800 dark:text-slate-200">
        Trade w/ {counterparty}
      </div>
      <div className="mb-4 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
        <span>{trade.season} season</span>
        <time dateTime={date.toISOString()}>
          {date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </time>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Column
          title="Traded Away"
          assets={trade.tradedAway}
          side="tradedAway"
          sourceKeys={sourceKeys}
          targetKeys={targetKeys}
          tradeId={trade.tradeId}
        />
        <Column
          title="Receives"
          assets={trade.receives}
          side="receives"
          sourceKeys={sourceKeys}
          targetKeys={targetKeys}
          tradeId={trade.tradeId}
        />
      </div>
    </article>
  );
}
