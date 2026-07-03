import Link from "next/link";
import type { ReceivedAsset } from "@/lib/trade-tracker/resolve";
import { pickKey } from "@/lib/trade-tracker/resolve";
import type { TeamTrade } from "@/lib/trade-tracker/team-view";
import PickOutcomeBadge from "./PickOutcomeBadge";

export interface ChainJump {
  targetTradeId: string;
  label: string;
}

export type ChainJumpLookup = (args: {
  assetKey: string;
  side: "receives" | "tradedAway";
}) => ChainJump | null;

function keyOf(asset: Extract<ReceivedAsset, { kind: "pick" }>): string {
  return pickKey(asset.season, asset.round, asset.originalRoster);
}

function AssetRow({
  asset,
  side,
  sourceKeys,
  targetKeys,
  tradeId,
  chainJump,
  onJump,
}: {
  asset: ReceivedAsset;
  side: "receives" | "tradedAway";
  sourceKeys: Set<string>;
  targetKeys: Set<string>;
  tradeId: string;
  chainJump?: ChainJumpLookup;
  onJump?: (tradeId: string) => void;
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
  const jump =
    chainJump && onJump && (isSource || isTarget)
      ? chainJump({ assetKey: key, side })
      : null;

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
          jump && onJump ? (
            <button
              type="button"
              onClick={() => onJump(jump.targetTradeId)}
              className="text-sm text-sky-500 hover:underline dark:text-sky-400/80"
            >
              → {jump.label}
            </button>
          ) : (
            <span className="text-sm text-sky-500 dark:text-sky-400/80">→ traded pick</span>
          )
        ) : (
          <>
            {jump && onJump && (
              <button
                type="button"
                onClick={() => onJump(jump.targetTradeId)}
                className="block text-xs text-sky-500 hover:underline dark:text-sky-400/80"
              >
                ↩ {jump.label}
              </button>
            )}
            <PickOutcomeBadge asset={asset} />
          </>
        )}
      </div>
    </li>
  );
}

function Column({
  title,
  accent,
  assets,
  side,
  sourceKeys,
  targetKeys,
  tradeId,
  chainJump,
  onJump,
}: {
  title: string;
  accent: "away" | "receives";
  assets: ReceivedAsset[];
  side: "receives" | "tradedAway";
  sourceKeys: Set<string>;
  targetKeys: Set<string>;
  tradeId: string;
  chainJump?: ChainJumpLookup;
  onJump?: (tradeId: string) => void;
}) {
  const accentClass =
    accent === "away"
      ? "border-l-rose-300 dark:border-l-rose-400/40"
      : "border-l-emerald-300 dark:border-l-emerald-400/40";
  return (
    <div
      className={`rounded-lg border border-gray-200 border-l-2 bg-gray-50 p-4 dark:border-pitch-700 dark:bg-pitch-900/60 ${accentClass}`}
    >
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
              chainJump={chainJump}
              onJump={onJump}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-400 dark:text-slate-500">—</p>
      )}
    </div>
  );
}

export default function TeamTradeCard({
  trade,
  sourceKeys,
  targetKeys,
  leagueId,
  htmlId,
  className,
  chainJump,
  onJump,
}: {
  trade: TeamTrade;
  sourceKeys: Set<string>;
  targetKeys: Set<string>;
  leagueId?: string;
  htmlId?: string;
  className?: string;
  chainJump?: ChainJumpLookup;
  onJump?: (tradeId: string) => void;
}) {
  const date = new Date(trade.createdAt);
  return (
    <article
      id={htmlId}
      className={`w-full rounded-xl border border-gray-200 bg-white p-5 dark:border-pitch-700 dark:bg-pitch-800/60 ${className ?? ""}`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-semibold text-gray-800 dark:text-slate-200">
          Trade w/{" "}
          {trade.counterparties.length === 0
            ? "Unknown"
            : trade.counterparties.map((c, i) => (
                <span key={`${c.rosterId ?? "x"}-${c.name}`}>
                  {i > 0 && ", "}
                  {leagueId && c.rosterId != null ? (
                    <Link
                      href={`/trade-tracker/league/${leagueId}/team/${c.rosterId}`}
                      className="hover:text-green-600 hover:underline dark:hover:text-green-400"
                    >
                      {c.name}
                    </Link>
                  ) : (
                    c.name
                  )}
                </span>
              ))}
        </span>
        <time
          dateTime={date.toISOString()}
          className="shrink-0 text-xs text-gray-500 dark:text-slate-400"
        >
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
          accent="away"
          assets={trade.tradedAway}
          side="tradedAway"
          sourceKeys={sourceKeys}
          targetKeys={targetKeys}
          tradeId={trade.tradeId}
          chainJump={chainJump}
          onJump={onJump}
        />
        <Column
          title="Receives"
          accent="receives"
          assets={trade.receives}
          side="receives"
          sourceKeys={sourceKeys}
          targetKeys={targetKeys}
          tradeId={trade.tradeId}
          chainJump={chainJump}
          onJump={onJump}
        />
      </div>
    </article>
  );
}
