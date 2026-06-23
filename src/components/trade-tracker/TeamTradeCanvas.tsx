"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TeamView } from "@/lib/trade-tracker/team-view";
import TeamTradeCard from "./TeamTradeCard";
import { computeArrowPath } from "./arrowPath";

export default function TeamTradeCanvas({ view }: { view: TeamView }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const { sourceKeysByTrade, targetKeysByTrade } = useMemo(() => {
    const source = new Map<string, Set<string>>();
    const target = new Map<string, Set<string>>();
    for (const link of view.chainLinks) {
      if (!source.has(link.fromTradeId)) source.set(link.fromTradeId, new Set());
      source.get(link.fromTradeId)!.add(link.assetKey);
      if (!target.has(link.toTradeId)) target.set(link.toTradeId, new Set());
      target.get(link.toTradeId)!.add(link.assetKey);
    }
    return { sourceKeysByTrade: source, targetKeysByTrade: target };
  }, [view.chainLinks]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const recompute = () => {
      const origin = track.getBoundingClientRect();
      const next: string[] = [];
      for (const link of view.chainLinks) {
        const src = track.querySelector(`[data-anchor="src:${link.assetKey}"]`);
        const dst = track.querySelector(`[data-anchor="dst:${link.assetKey}"]`);
        if (!src || !dst) continue;
        const s = src.getBoundingClientRect();
        const d = dst.getBoundingClientRect();
        next.push(
          computeArrowPath(
            {
              x: s.right - origin.left + track.scrollLeft,
              y: s.top + s.height / 2 - origin.top + track.scrollTop,
            },
            {
              x: d.left - origin.left + track.scrollLeft,
              y: d.top + d.height / 2 - origin.top + track.scrollTop,
            },
          ),
        );
      }
      setPaths(next);
      setSize({ w: track.scrollWidth, h: track.scrollHeight });
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(track);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [view]);

  return (
    <div ref={trackRef} className="relative overflow-x-auto pb-4">
      <svg
        className="pointer-events-none absolute left-0 top-0"
        width={size.w}
        height={size.h}
        style={{ overflow: "visible" }}
      >
        <defs>
          <marker
            id="trade-arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="#38bdf8" />
          </marker>
        </defs>
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={2}
            markerEnd="url(#trade-arrowhead)"
          />
        ))}
      </svg>

      <div className="flex w-max items-start gap-16">
        {view.trades.map((trade) => (
          <TeamTradeCard
            key={trade.tradeId}
            trade={trade}
            sourceKeys={sourceKeysByTrade.get(trade.tradeId) ?? new Set()}
            targetKeys={targetKeysByTrade.get(trade.tradeId) ?? new Set()}
          />
        ))}
      </div>
    </div>
  );
}
