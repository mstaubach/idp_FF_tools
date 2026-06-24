"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import type { TeamView } from "@/lib/trade-tracker/team-view";
import TeamTradeCard from "./TeamTradeCard";
import { computeArrowPath, type GutterRoute } from "./arrowPath";
import { layoutTrades } from "./tradeLayout";

// Matches the app's body background (bg-pitch-900) so the screenshot isn't
// transparent where it shows between cards.
const CAPTURE_BACKGROUND = "#0b1120";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function TeamTradeCanvas({ view }: { view: TeamView }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [copyState, setCopyState] = useState<"idle" | "working" | "copied" | "downloaded" | "error">("idle");

  async function handleCopy() {
    const node = contentRef.current;
    if (!node || copyState === "working") return;
    setCopyState("working");
    try {
      const blob = await toBlob(node, {
        backgroundColor: CAPTURE_BACKGROUND,
        pixelRatio: 2,
        width: node.scrollWidth,
        height: node.scrollHeight,
      });
      if (!blob) throw new Error("capture produced no image");

      const canClipboard =
        typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;
      if (canClipboard) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          setCopyState("copied");
          return;
        } catch {
          // Clipboard blocked/unsupported — fall back to a download.
        }
      }
      downloadBlob(blob, `${view.teamName.replace(/\s+/g, "-")}-trades.png`);
      setCopyState("downloaded");
    } catch {
      setCopyState("error");
    }
  }

  const copyLabel = {
    idle: "Copy image",
    working: "Capturing…",
    copied: "Copied to clipboard ✓",
    downloaded: "Image downloaded ✓",
    error: "Couldn't capture — try again",
  }[copyState];

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

  // Trades that take part in a pick-chain get the arrowed flow layout; the rest
  // (the majority) are packed into a dense block so they don't each waste a row.
  const { chainTrades, standaloneTrades } = useMemo(() => {
    const linked = new Set<string>();
    for (const link of view.chainLinks) {
      linked.add(link.fromTradeId);
      linked.add(link.toTradeId);
    }
    return {
      chainTrades: view.trades.filter((t) => linked.has(t.tradeId)),
      standaloneTrades: view.trades.filter((t) => !linked.has(t.tradeId)),
    };
  }, [view.trades, view.chainLinks]);

  const { positions, columnCount } = useMemo(() => {
    const positions = layoutTrades(chainTrades, view.chainLinks);
    let columnCount = 1;
    for (const { column } of positions.values()) {
      columnCount = Math.max(columnCount, column + 1);
    }
    return { positions, columnCount };
  }, [chainTrades, view.chainLinks]);

  const standaloneColumns = Math.max(columnCount, 3);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const recompute = () => {
      const origin = track.getBoundingClientRect();
      const toContentX = (x: number) => x - origin.left + track.scrollLeft;
      const toContentY = (y: number) => y - origin.top + track.scrollTop;
      const next: string[] = [];
      for (const link of view.chainLinks) {
        const src = track.querySelector(`[data-anchor="src:${link.fromTradeId}:${link.assetKey}"]`);
        const dst = track.querySelector(`[data-anchor="dst:${link.toTradeId}:${link.assetKey}"]`);
        if (!src || !dst) continue;
        const s = src.getBoundingClientRect();
        const d = dst.getBoundingClientRect();
        const from = {
          x: toContentX(s.right),
          y: toContentY(s.top + s.height / 2),
        };
        const to = {
          x: toContentX(d.left),
          y: toContentY(d.top + d.height / 2),
        };

        // Adjacent same-row hops get the clean curve. Anything that spans rows
        // or skips a column routes through the empty gutters so it can't cross
        // a card on the way.
        const fp = positions.get(link.fromTradeId);
        const tp = positions.get(link.toTradeId);
        const straight =
          fp && tp && fp.row === tp.row && tp.column === fp.column + 1;

        let route: GutterRoute | undefined;
        if (!straight) {
          const srcCard = track.querySelector(`[data-trade="${link.fromTradeId}"]`);
          const tgtCard = track.querySelector(`[data-trade="${link.toTradeId}"]`);
          if (srcCard && tgtCard) {
            const sc = srcCard.getBoundingClientRect();
            const tc = tgtCard.getBoundingClientRect();
            route = {
              exitX: toContentX(sc.right) + 24,
              enterX: toContentX(tc.left) - 24,
              gutterY: toContentY(tc.top) - 16,
            };
          }
        }

        next.push(computeArrowPath(from, to, route));
      }
      setPaths(next);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(track);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [view, positions]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={copyState === "working"}
          className="inline-flex items-center gap-2 rounded-lg border border-pitch-700 bg-pitch-800 px-3 py-1.5 text-sm font-medium text-slate-200 hover:border-emerald-500/50 disabled:opacity-60"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {copyLabel}
        </button>
        <span className="text-xs text-slate-500">
          Copies the whole flow as an image to paste anywhere.
        </span>
      </div>

      <div ref={trackRef} className="relative overflow-x-auto pb-4">
        <div ref={contentRef} className="relative w-max space-y-8">
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
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

          {chainTrades.length > 0 && (
            <section className="space-y-2">
              {standaloneTrades.length > 0 && (
                <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Pick chains
                </h3>
              )}
              <div
                className="grid items-start gap-x-16 gap-y-8"
                style={{
                  gridTemplateColumns: `repeat(${columnCount}, 28rem)`,
                  gridAutoRows: "min-content",
                }}
              >
                {chainTrades.map((trade) => {
                  const cell = positions.get(trade.tradeId);
                  return (
                    <div
                      key={trade.tradeId}
                      data-trade={trade.tradeId}
                      style={{
                        gridColumn: (cell?.column ?? 0) + 1,
                        gridRow: (cell?.row ?? 0) + 1,
                      }}
                    >
                      <TeamTradeCard
                        trade={trade}
                        sourceKeys={sourceKeysByTrade.get(trade.tradeId) ?? new Set()}
                        targetKeys={targetKeysByTrade.get(trade.tradeId) ?? new Set()}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {standaloneTrades.length > 0 && (
            <section className="space-y-2">
              {chainTrades.length > 0 && (
                <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Other trades
                </h3>
              )}
              <div
                className="grid items-start gap-4"
                style={{ gridTemplateColumns: `repeat(${standaloneColumns}, 28rem)` }}
              >
                {standaloneTrades.map((trade) => (
                  <TeamTradeCard
                    key={trade.tradeId}
                    trade={trade}
                    sourceKeys={new Set()}
                    targetKeys={new Set()}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
