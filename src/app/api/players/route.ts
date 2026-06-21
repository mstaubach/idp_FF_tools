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
    return NextResponse.json(autocomplete);
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch player data' },
      { status: 502 }
    );
  }
}
