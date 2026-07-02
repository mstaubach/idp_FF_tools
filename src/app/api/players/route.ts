import { NextResponse } from 'next/server';
import { fetchPlayers } from '@/lib/idp-checker/sleeper';

export async function GET() {
  try {
    const players = await fetchPlayers();
    // Return minimal data for autocomplete
    const autocomplete = players.map(p => ({
      id: p.player_id,
      name: p.full_name,
      position: p.position,
      team: p.team,
    }));
    // ~400KB of rarely-changing data: let browsers/CDN cache it instead of
    // re-serializing per request. TTLs mirror the server-side player cache.
    return NextResponse.json(autocomplete, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=3600',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch player data' },
      { status: 502 }
    );
  }
}
