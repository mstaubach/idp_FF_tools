import { NextRequest, NextResponse } from 'next/server';
import { fetchPlayers, fetchRosters, fetchUsers, fetchLeague } from '@/lib/idp-checker/sleeper';
import { matchPlayers } from '@/lib/idp-checker/matcher';
import { buildAvailabilityResults } from '@/lib/idp-checker/availability';
import { CheckAvailabilityRequest, CheckAvailabilityResponse } from '@/lib/idp-checker/types';

export async function POST(request: NextRequest) {
  try {
    const body: CheckAvailabilityRequest = await request.json();

    if (!body.leagueId || !body.players?.length) {
      return NextResponse.json(
        { error: 'leagueId and players are required' },
        { status: 400 }
      );
    }

    if (body.players.length > 200) {
      return NextResponse.json(
        { error: 'Maximum 200 players per request' },
        { status: 400 }
      );
    }

    // Fetch all Sleeper data in parallel
    const [sleeperPlayers, rosters, users, league] = await Promise.all([
      fetchPlayers(),
      fetchRosters(body.leagueId),
      fetchUsers(body.leagueId),
      fetchLeague(body.leagueId),
    ]);

    // Fuzzy match input players against Sleeper DB
    const { matched, unmatched } = matchPlayers(body.players, sleeperPlayers);

    // Check availability against rosters
    const { results, waiverInfo } = buildAvailabilityResults(matched, rosters, users, league);

    const response: CheckAvailabilityResponse = {
      results,
      waiverInfo,
      unmatchedPlayers: unmatched,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('Sleeper API error: 404')) {
      return NextResponse.json(
        { error: 'League not found. Check your league ID.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Sleeper API is unavailable. Try again in a few minutes.' },
      { status: 502 }
    );
  }
}
