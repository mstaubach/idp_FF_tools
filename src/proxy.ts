import { NextRequest, NextResponse } from "next/server";

// Lightweight per-IP rate limit on the routes that fan out to many upstream
// Sleeper calls (the API routes and each tool's dynamic [leagueId] pages — the
// standings/trade-tracker chain walks alone can issue dozens of requests). With
// no database in this app, the window state lives in memory: it is per-instance
// and resets on cold start, so treat it as a basic abuse cap, not a hard quota.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60; // per IP per window across the matched routes
const MAX_TRACKED_IPS = 20_000; // bound memory; sweep expired entries past this

type Window = { count: number; resetAt: number };
const hits = new Map<string, Window>();

function sweepExpired(now: number): void {
  for (const [ip, w] of hits) {
    if (now > w.resetAt) hits.delete(ip);
  }
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    if (hits.size > MAX_TRACKED_IPS) sweepExpired(now);
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

export function proxy(req: NextRequest): NextResponse {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
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
