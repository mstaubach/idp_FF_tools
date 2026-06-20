import Fuse from 'fuse.js';
import type { FuseResult } from 'fuse.js';
import { SleeperPlayer, ParsedPlayer, PlayerResult, POSITION_GROUPS } from './types';

const STRICT_THRESHOLD = 0.3;
const LOOSE_THRESHOLD = 0.35;

interface MatchResult {
  matched: PlayerResult[];
  unmatched: string[];
}

function buildResult(
  player: ParsedPlayer,
  best: FuseResult<SleeperPlayer>
): PlayerResult {
  return {
    inputName: player.name,
    matchedPlayer: {
      id: best.item.player_id,
      name: best.item.full_name,
      position: best.item.position || 'Unknown',
      team: best.item.team || 'FA',
    },
    matchConfidence: 1 - (best.score ?? 0),
    rank: player.rank,
    tier: player.tier,
    available: true,
    rosteredBy: null,
  };
}

function applyTiebreakers(
  results: FuseResult<SleeperPlayer>[],
  player: ParsedPlayer
): FuseResult<SleeperPlayer> {
  let best = results[0];

  // Apply position/team tiebreakers if provided
  if (player.position || player.team) {
    const filtered = results.filter((r) => {
      const p = r.item;
      if (player.position && p.position) {
        const inputGroup = Object.entries(POSITION_GROUPS).find(([, positions]) =>
          positions.includes(player.position!)
        )?.[0];
        const playerGroup = Object.entries(POSITION_GROUPS).find(([, positions]) =>
          positions.includes(p.position!)
        )?.[0];
        if (inputGroup && playerGroup && inputGroup !== playerGroup) return false;
        if (!inputGroup && player.position !== p.position) return false;
      }
      if (player.team && p.team && player.team.toUpperCase() !== p.team.toUpperCase()) {
        return false;
      }
      return true;
    });
    if (filtered.length > 0) {
      best = filtered[0];
    }
  }

  return best;
}

export function matchPlayers(
  input: ParsedPlayer[],
  sleeperPlayers: SleeperPlayer[]
): MatchResult {
  // Primary search: strict full_name matching
  const primaryFuse = new Fuse(sleeperPlayers, {
    keys: [
      { name: 'full_name', weight: 5 },
      { name: 'last_name', weight: 1 },
      { name: 'first_name', weight: 0.5 },
    ],
    threshold: STRICT_THRESHOLD,
    includeScore: true,
    ignoreLocation: true,
    distance: 200,
  });

  // Fallback search: last-name focused for abbreviated first names (e.g. "Pat Queen")
  const fallbackFuse = new Fuse(sleeperPlayers, {
    keys: [
      { name: 'last_name', weight: 3 },
      { name: 'first_name', weight: 1 },
      { name: 'full_name', weight: 1 },
    ],
    threshold: LOOSE_THRESHOLD,
    includeScore: true,
    ignoreLocation: true,
    distance: 200,
  });

  const matched: PlayerResult[] = [];
  const unmatched: string[] = [];

  for (const player of input) {
    // Pass 1: strict full_name match
    const results = primaryFuse.search(player.name);

    if (results.length > 0) {
      const best = applyTiebreakers(results, player);
      matched.push(buildResult(player, best));
      continue;
    }

    // Pass 2: fallback last-name-focused search
    // Split input name and try matching by last name token
    const nameParts = player.name.trim().split(/\s+/);
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : player.name;

    const fallbackResults = fallbackFuse.search(lastName);

    if (fallbackResults.length > 0) {
      // Among fallback results, prefer those whose first name starts with the input first name
      const firstNamePrefix = nameParts.length > 1 ? nameParts[0].toLowerCase() : '';
      if (firstNamePrefix) {
        // Find all candidates whose first name starts with the input prefix
        const prefixMatches = fallbackResults.filter(r =>
          r.item.first_name.toLowerCase().startsWith(firstNamePrefix)
        );
        if (prefixMatches.length > 0) {
          // Use the prefix match directly — first-name match is a stronger signal
          // than active-roster status (e.g. "Devin White" should match the LB, not "Brendon White")
          const best = prefixMatches.length > 1 ? applyTiebreakers(prefixMatches, player) : prefixMatches[0];
          matched.push(buildResult(player, best));
          continue;
        }
      }

      const best = applyTiebreakers(fallbackResults, player);
      matched.push(buildResult(player, best));
      continue;
    }

    unmatched.push(player.name);
  }

  return { matched, unmatched };
}
