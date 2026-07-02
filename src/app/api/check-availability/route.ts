import { NextRequest, NextResponse } from 'next/server';
import { fetchPlayers, fetchRosters, fetchUsers, fetchLeague } from '@/lib/idp-checker/sleeper';
import { matchPlayers } from '@/lib/idp-checker/matcher';
import { buildAvailabilityResults } from '@/lib/idp-checker/availability';
import { CheckAvailabilityResponse } from '@/lib/idp-checker/types';
import { sanitizeParsedPlayers, MAX_PLAYERS, MAX_NAME_LENGTH } from '@/lib/idp-checker/validate';
import { isValidSleeperId } from '@/lib/sleeper-id';

// A full 200-player payload from our UI is ~40KB; anything near this cap is
// not a legitimate request and gets rejected before the body is buffered.
const MAX_BODY_BYTES = 256_000;

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length'));
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }

  let body: { leagueId?: unknown; players?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.leagueId !== 'string' || !isValidSleeperId(body.leagueId)) {
    return NextResponse.json(
      { error: 'Invalid league ID. Sleeper league IDs are numeric.' },
      { status: 400 }
    );
  }

  const players = sanitizeParsedPlayers(body.players);
  if (!players) {
    return NextResponse.json(
      {
        error: `players must be 1-${MAX_PLAYERS} entries, each with a name under ${MAX_NAME_LENGTH} characters`,
      },
      { status: 400 }
    );
  }

  try {
    // Fetch all Sleeper data in parallel
    const [sleeperPlayers, rosters, users, league] = await Promise.all([
      fetchPlayers(),
      fetchRosters(body.leagueId),
      fetchUsers(body.leagueId),
      fetchLeague(body.leagueId),
    ]);

    // Fuzzy match input players against Sleeper DB
    const { matched, unmatched } = matchPlayers(players, sleeperPlayers);

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
