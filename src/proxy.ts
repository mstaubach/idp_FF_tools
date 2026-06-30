import { NextRequest, NextResponse } from "next/server";

// Rate limiting for the routes that fan out to many upstream Sleeper calls (the
// API routes and each tool's dynamic [leagueId] pages — the standings /
// trade-tracker chain walks alone can issue dozens of requests). With no
// database in this app the window state lives in memory: it is per-instance and
// resets on cold start, so treat it as a best-effort abuse cap, not a hard
// quota. Strong enforcement belongs at the platform edge (e.g. Vercel Firewall
// / Cloudflare) or a shared store keyed on a trusted client IP.
//
// Two layers, because the per-IP key is derived from forwarding headers a caller
// can spoof:
//   1. A global, identity-free ceiling that caps TOTAL traffic to these routes.
//      It keys on nothing, so rotating/spoofing the client IP cannot bypass it,
//      and it is what actually bounds how much we can amplify onto Sleeper. O(1)
//      memory.
//   2. A per-IP limit for fairness against naive/non-spoofing abusers, with a
//      hard ceiling on tracked keys so a flood of spoofed IPs cannot grow the
//      map without bound (it evicts the oldest entries instead).
const WINDOW_MS = 60_000;
const PER_IP_MAX = 60; // per IP per window
const GLOBAL_MAX = 600; // total across all matched routes per window
const MAX_TRACKED_KEYS = 10_000; // hard cap on the per-IP map

type Window = { count: number; resetAt: number };

const hits = new Map<string, Window>();
let globalWindow: Window = { count: 0, resetAt: 0 };

function clientKey(req: NextRequest): string {
  // x-forwarded-for's left-most entry is the claimed client. Behind a trusted
  // platform proxy this is the real IP, but it is not trustworthy at the app
  // layer — which is exactly why layer 1 (global) and the hard key cap exist.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function overGlobalLimit(now: number): boolean {
  if (now > globalWindow.resetAt) {
    globalWindow = { count: 1, resetAt: now + WINDOW_MS };
    return false;
  }
  globalWindow.count += 1;
  return globalWindow.count > GLOBAL_MAX;
}

function overPerIpLimit(key: string, now: number): boolean {
  const entry = hits.get(key);
  if (entry && now <= entry.resetAt) {
    entry.count += 1;
    return entry.count > PER_IP_MAX;
  }

  // New or expired window. Re-insert at the end of the Map's insertion order,
  // and enforce the hard cap by evicting the oldest entries first so memory
  // stays bounded no matter how many distinct (possibly spoofed) keys arrive.
  hits.delete(key);
  while (hits.size >= MAX_TRACKED_KEYS) {
    const oldest = hits.keys().next().value;
    if (oldest === undefined) break;
    hits.delete(oldest);
  }
  hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
  return false;
}

export function proxy(req: NextRequest): NextResponse {
  const now = Date.now();
  // Evaluate both before branching so each window's counter is incremented even
  // when the other already trips (no short-circuit skipping a count).
  const global = overGlobalLimit(now);
  const perIp = overPerIpLimit(clientKey(req), now);

  if (global || perIp) {
    return new NextResponse("Too many requests. Slow down and try again shortly.", {
      status: 429,
      headers: { "Retry-After": "60", "Content-Type": "text/plain" },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/standings/:path*",
    "/trade-tracker/:path*",
    "/roster-management/:path*",
    "/taxi-filler/:path*",
  ],
};
