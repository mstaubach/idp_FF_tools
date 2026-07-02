"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TeamView } from "@/lib/trade-tracker/team-view";
import TeamTradeCard from "./TeamTradeCard";
import { chainKeySets } from "./chainKeys";

function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

export default function TradeTimeline({
  view,
  leagueId,
}: {
  view: TeamView;
  leagueId: string;
}) {
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const { sourceKeysByTrade, targetKeysByTrade } = useMemo(
    () => chainKeySets(view.chainLinks),
    [view.chainLinks],
  );

  // tradeId:assetKey -> the other end of the chain link, in each direction.
  const { forward, backward } = useMemo(() => {
    const forward = new Map<string, string>();
    const backward = new Map<string, string>();
    for (const l of view.chainLinks) {
      forward.set(`${l.fromTradeId}:${l.assetKey}`, l.toTradeId);
      backward.set(`${l.toTradeId}:${l.assetKey}`, l.fromTradeId);
    }
    return { forward, backward };
  }, [view.chainLinks]);

  const dateByTrade = useMemo(
    () => new Map(view.trades.map((t) => [t.tradeId, t.createdAt])),
    [view.trades],
  );

  const seasons = useMemo(() => {
    const bySeason = new Map<string, typeof view.trades>();
    for (const t of [...view.trades].sort((a, b) => b.createdAt - a.createdAt)) {
      const list = bySeason.get(t.season) ?? [];
      list.push(t);
      bySeason.set(t.season, list);
    }
    return Array.from(bySeason.entries()).sort(
      (a, b) => Number(b[0]) - Number(a[0]),
    );
  }, [view.trades]);

  function jumpTo(tradeId: string) {
    document
      .getElementById(`trade-${tradeId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(tradeId);
    flashTimer.current = setTimeout(() => setFlash(null), 1600);
  }

  return (
    <div className="space-y-8">
      {seasons.map(([season, trades]) => (
        <section key={season} className="space-y-3">
          <h3 className="sticky top-0 z-10 -mx-1 bg-gray-50/95 px-1 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 backdrop-blur dark:bg-pitch-900/95 dark:text-slate-400">
            {season} season
          </h3>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {trades.map((trade) => (
              <TeamTradeCard
                key={trade.tradeId}
                trade={trade}
                htmlId={`trade-${trade.tradeId}`}
                leagueId={leagueId}
                sourceKeys={sourceKeysByTrade.get(trade.tradeId) ?? new Set()}
                targetKeys={targetKeysByTrade.get(trade.tradeId) ?? new Set()}
                className={`transition-shadow ${
                  flash === trade.tradeId
                    ? "ring-2 ring-sky-400 dark:ring-sky-500"
                    : ""
                }`}
                onJump={jumpTo}
                chainJump={({ assetKey, side }) => {
                  const key = `${trade.tradeId}:${assetKey}`;
                  const target =
                    side === "receives" ? forward.get(key) : backward.get(key);
                  if (!target) return null;
                  const when = dateByTrade.get(target);
                  const verb = side === "receives" ? "traded again" : "acquired";
                  return {
                    targetTradeId: target,
                    label: when ? `${verb} ${shortDate(when)}` : verb,
                  };
                }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
