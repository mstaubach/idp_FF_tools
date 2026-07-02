import { ParsedPlayer } from './types';

// Request-payload validation for the check-availability API route. The client
// UI only ever produces small, well-formed entries (parser.ts caps names at
// normal lengths and the route caps the list at 200), but the route is public:
// without per-entry bounds a single request could carry multi-megabyte "name"
// strings that flow straight into Fuse.js fuzzy matching and burn CPU.
export const MAX_PLAYERS = 200;
export const MAX_NAME_LENGTH = 100;
export const MAX_TAG_LENGTH = 12; // position / team codes

// Returns a sanitized copy of the players list (known fields only, names
// trimmed), or null if any entry is malformed or over the size bounds.
export function sanitizeParsedPlayers(input: unknown): ParsedPlayer[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_PLAYERS) {
    return null;
  }

  const out: ParsedPlayer[] = [];
  for (const entry of input) {
    if (typeof entry !== 'object' || entry === null) return null;
    const { name, position, team, rank, tier } = entry as Record<string, unknown>;

    if (typeof name !== 'string') return null;
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > MAX_NAME_LENGTH) return null;

    if (position !== undefined && (typeof position !== 'string' || position.length > MAX_TAG_LENGTH)) {
      return null;
    }
    if (team !== undefined && (typeof team !== 'string' || team.length > MAX_TAG_LENGTH)) {
      return null;
    }
    if (rank !== undefined && (typeof rank !== 'number' || !Number.isFinite(rank))) {
      return null;
    }
    if (tier !== undefined && (typeof tier !== 'number' || !Number.isFinite(tier))) {
      return null;
    }

    out.push({
      name: trimmedName,
      position: position as string | undefined,
      team: team as string | undefined,
      rank: rank as number | undefined,
      tier: tier as number | undefined,
    });
  }
  return out;
}
