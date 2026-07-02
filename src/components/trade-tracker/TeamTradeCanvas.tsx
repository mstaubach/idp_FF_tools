"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { toBlob } from "html-to-image";
import type { TeamView } from "@/lib/trade-tracker/team-view";
import TeamTradeCard from "./TeamTradeCard";
import { computeArrowPath, type GutterRoute } from "./arrowPath";
import {
  CHAIN_COLORS,
  colorForAssetKey,
  labelForAssetKey,
  orderedAssetKeys,
} from "./arrowStyle";
import { chainKeySets } from "./chainKeys";
import { layoutChainComponents, type CellPosition } from "./tradeLayout";

interface Arrow {
  d: string;
  color: string;
  label: string;
  mid: { x: number; y: number };
  component: number;
}

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

export default function TeamTradeCanvas({
  view,
  leagueId,
}: {
  view: TeamView;
  leagueId?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [hoveredComponent, setHoveredComponent] = useState<number | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [copyState, setCopyState] = useState<
    "idle" | "working" | "copied" | "downloaded" | "error"
  >("idle");
  const { resolvedTheme } = useTheme();

  async function handleCopy() {
    const node = contentRef.current;
    if (!node || copyState === "working") return;
    setCopyState("working");
    try {
      const width = node.scrollWidth;
      const height = node.scrollHeight;
      const maxDimension = 4000;
      const pixelRatio = Math.min(2, maxDimension / width, maxDimension / height);
      const captureBackground = resolvedTheme === "light" ? "#f9fafb" : "#0b1120";
      const blob = await toBlob(node, {
        backgroundColor: captureBackground,
        pixelRatio,
        width,
        height,
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

  const { sourceKeysByTrade, targetKeysByTrade } = useMemo(
    () => chainKeySets(view.chainLinks),
    [view.chainLinks],
  );

  const orderedKeys = useMemo(
    () => orderedAssetKeys(view.chainLinks),
    [view.chainLinks],
  );

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

  const { components, positionByTrade, componentByTrade } = useMemo(() => {
    const components = layoutChainComponents(chainTrades, view.chainLinks);
    const positionByTrade = new Map<string, CellPosition>();
    const componentByTrade = new Map<string, number>();
    components.forEach((c, ci) => {
      for (const [id, pos] of c.positions) {
        positionByTrade.set(id, pos);
        componentByTrade.set(id, ci);
      }
    });
    return { components, positionByTrade, componentByTrade };
  }, [chainTrades, view.chainLinks]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const updateEdges = () =>
      setEdges({
        left: track.scrollLeft > 8,
        right: track.scrollLeft + track.clientWidth < track.scrollWidth - 8,
      });

    const recompute = () => {
      const origin = track.getBoundingClientRect();
      const toContentX = (x: number) => x - origin.left + track.scrollLeft;
      const toContentY = (y: number) => y - origin.top + track.scrollTop;
      const next: Arrow[] = [];
      for (const link of view.chainLinks) {
        const src = track.querySelector(
          `[data-anchor="src:${link.fromTradeId}:${link.assetKey}"]`,
        );
        const dst = track.querySelector(
          `[data-anchor="dst:${link.toTradeId}:${link.assetKey}"]`,
        );
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

        const fp = positionByTrade.get(link.fromTradeId);
        const tp = positionByTrade.get(link.toTradeId);
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
              exitX: toContentX(sc.right) + 12,
              enterX: toContentX(tc.left) - 12,
              gutterY: toContentY(tc.top) - 12,
            };
          }
        }

        next.push({
          d: computeArrowPath(from, to, route),
          color: colorForAssetKey(link.assetKey, orderedKeys),
          label: labelForAssetKey(link.assetKey),
          mid: route
            ? { x: (route.exitX + route.enterX) / 2, y: route.gutterY }
            : { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
          component: componentByTrade.get(link.fromTradeId) ?? -1,
        });
      }
      setArrows(next);
      updateEdges();
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(track);
    track.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      track.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", recompute);
    };
  }, [view, positionByTrade, componentByTrade, orderedKeys]);

  // Drag-to-pan the chain track (ignore drags starting on links/buttons).
  function onPointerDown(e: React.PointerEvent) {
    const track = trackRef.current;
    if (!track || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("a,button")) return;
    const startX = e.clientX;
    const startLeft = track.scrollLeft;
    const onMove = (ev: PointerEvent) => {
      track.scrollLeft = startLeft - (ev.clientX - startX);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const dimmed = (ci: number) =>
    hoveredComponent != null && hoveredComponent !== ci;

  return (
    <div className="space-y-4">
      {components.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={copyState === "working"}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-green-600/50 disabled:opacity-60 dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-200 dark:hover:border-green-600/50"
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
          <span className="text-xs text-gray-400 dark:text-slate-500">
            Copies the pick-chain flow as an image to paste anywhere.
          </span>
        </div>
      )}

      {components.length > 0 && (
        <div className="relative">
          <div
            ref={trackRef}
            onPointerDown={onPointerDown}
            className="relative cursor-grab overflow-x-auto pb-4 active:cursor-grabbing"
          >
            <div ref={contentRef} className="relative w-max space-y-8">
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                style={{ overflow: "visible" }}
              >
                <defs>
                  {CHAIN_COLORS.map((color, i) => (
                    <marker
                      key={color}
                      id={`trade-arrowhead-${i}`}
                      markerWidth="8"
                      markerHeight="8"
                      refX="6"
                      refY="3"
                      orient="auto"
                    >
                      <path d="M0,0 L6,3 L0,6 Z" fill={color} />
                    </marker>
                  ))}
                </defs>
                {arrows.map((a, i) => (
                  <path
                    key={i}
                    d={a.d}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={hoveredComponent === a.component ? 2.5 : 2}
                    opacity={dimmed(a.component) ? 0.2 : 1}
                    className="transition-opacity"
                    markerEnd={`url(#trade-arrowhead-${CHAIN_COLORS.indexOf(a.color)})`}
                  />
                ))}
              </svg>

              {arrows.map((a, i) => (
                <span
                  key={i}
                  className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border bg-gray-50 px-1.5 text-[10px] font-semibold leading-4 transition-opacity dark:bg-pitch-900 ${
                    dimmed(a.component) ? "opacity-20" : ""
                  }`}
                  style={{
                    left: a.mid.x,
                    top: a.mid.y,
                    color: a.color,
                    borderColor: `${a.color}55`,
                    margin: 0,
                  }}
                >
                  {a.label}
                </span>
              ))}

              <section className="space-y-6">
                {standaloneTrades.length > 0 && (
                  <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">
                    Pick chains
                  </h3>
                )}
                {components.map((component, ci) => (
                  <div
                    key={ci}
                    className="grid w-max items-start gap-x-8 gap-y-6"
                    style={{
                      gridTemplateColumns: `repeat(${component.columnCount}, 24rem)`,
                      gridAutoRows: "min-content",
                    }}
                  >
                    {component.trades.map((trade) => {
                      const cell = component.positions.get(trade.tradeId);
                      return (
                        <div
                          key={trade.tradeId}
                          data-trade={trade.tradeId}
                          onMouseEnter={() => setHoveredComponent(ci)}
                          onMouseLeave={() => setHoveredComponent(null)}
                          className={`transition-opacity ${
                            dimmed(ci) ? "opacity-40" : ""
                          }`}
                          style={{
                            gridColumn: (cell?.column ?? 0) + 1,
                            gridRow: (cell?.row ?? 0) + 1,
                          }}
                        >
                          <TeamTradeCard
                            trade={trade}
                            leagueId={leagueId}
                            sourceKeys={sourceKeysByTrade.get(trade.tradeId) ?? new Set()}
                            targetKeys={targetKeysByTrade.get(trade.tradeId) ?? new Set()}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </section>
            </div>
          </div>

          {edges.right && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex w-20 items-center justify-end bg-gradient-to-l from-gray-50 to-transparent dark:from-pitch-900">
              <span className="mr-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500 shadow-sm dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-400">
                more →
              </span>
            </div>
          )}
          {edges.left && (
            <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-gray-50 to-transparent dark:from-pitch-900" />
          )}
        </div>
      )}

      {standaloneTrades.length > 0 && (
        <section className="space-y-2">
          {components.length > 0 && (
            <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">
              Other trades
            </h3>
          )}
          <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {standaloneTrades.map((trade) => (
              <TeamTradeCard
                key={trade.tradeId}
                trade={trade}
                leagueId={leagueId}
                sourceKeys={new Set()}
                targetKeys={new Set()}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
