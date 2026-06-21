import { ParsedPlayer, IDP_POSITIONS } from './types';

const MAX_PLAYERS = 200;
const NFL_TEAMS = ['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'];
const POSITIONS = [...IDP_POSITIONS, 'QB', 'RB', 'WR', 'TE', 'K'];

function isPosition(token: string): boolean {
  return POSITIONS.includes(token.toUpperCase());
}

function isTeam(token: string): boolean {
  return NFL_TEAMS.includes(token.toUpperCase());
}

function isRank(token: string): boolean {
  return /^\d+\.?$/.test(token);
}

export function parseTextInput(input: string): ParsedPlayer[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const lines = trimmed.split('\n');
  const players: ParsedPlayer[] = [];
  let currentTier: number | undefined;
  let tierCounter = 1;
  let autoRank = 1;
  let lastLineWasBlank = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Detect tier headers
    const tierMatch = line.match(/^tier\s+(\d+)/i);
    if (tierMatch) {
      currentTier = parseInt(tierMatch[1], 10);
      lastLineWasBlank = false;
      continue;
    }

    // Blank line = tier separator (if no explicit tier headers)
    if (!line) {
      if (!lastLineWasBlank && players.length > 0 && currentTier === undefined) {
        tierCounter++;
      }
      lastLineWasBlank = true;
      continue;
    }
    lastLineWasBlank = false;

    if (players.length >= MAX_PLAYERS) break;

    // Try tab-separated first
    const tabParts = line.split('\t');
    if (tabParts.length >= 2) {
      const parsed = parseTokens(tabParts.map(t => t.trim()).filter(Boolean), autoRank);
      if (parsed) {
        parsed.tier = currentTier ?? tierCounter;
        players.push(parsed);
        autoRank++;
        continue;
      }
    }

    // Try comma-separated (if line has commas, delegate to CSV-style parsing)
    if (line.includes(',')) {
      const cols = line.split(',').map(c => c.trim());
      const parsed = parseTokens(cols.filter(Boolean), autoRank);
      if (parsed) {
        parsed.tier = currentTier ?? tierCounter;
        players.push(parsed);
        autoRank++;
        continue;
      }
    }

    // Fallback: split by whitespace
    const tokens = line.split(/\s+/).filter(Boolean);

    const parsed = parseTokens(tokens, autoRank);
    if (parsed) {
      parsed.tier = currentTier ?? tierCounter;
      players.push(parsed);
      autoRank++;
    }
  }

  return players;
}

function parseTokens(tokens: string[], autoRank: number): ParsedPlayer | null {
  if (tokens.length === 0) return null;

  let rank: number | undefined;
  let position: string | undefined;
  let team: string | undefined;
  const nameTokens: string[] = [];

  for (const token of tokens) {
    const clean = token.replace(/[.,]$/, '');
    if (!rank && isRank(clean)) {
      rank = parseInt(clean, 10);
    } else if (!position && isPosition(clean)) {
      position = clean.toUpperCase();
    } else if (!team && isTeam(clean)) {
      team = clean.toUpperCase();
    } else {
      nameTokens.push(token);
    }
  }

  const name = nameTokens.join(' ').trim();
  if (!name) return null;

  return {
    name,
    position,
    team,
    rank: rank ?? autoRank,
    tier: undefined,
  };
}

export function parseCSV(input: string): ParsedPlayer[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Check if first line is a header
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('name') || firstLine.includes('player');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  // Detect column mapping from header
  let nameCol = -1, rankCol = -1, posCol = -1, teamCol = -1, tierCol = -1;

  if (hasHeader) {
    const headers = firstLine.split(',').map(h => h.trim());
    headers.forEach((h, i) => {
      if (['name', 'player', 'player_name'].includes(h)) nameCol = i;
      else if (['rank', 'ranking', '#'].includes(h)) rankCol = i;
      else if (['position', 'pos'].includes(h)) posCol = i;
      else if (['team', 'nfl_team'].includes(h)) teamCol = i;
      else if (['tier'].includes(h)) tierCol = i;
    });
  }

  const players: ParsedPlayer[] = [];

  for (const line of dataLines) {
    if (players.length >= MAX_PLAYERS) break;

    const cols = line.split(',').map(c => c.trim());

    if (nameCol >= 0) {
      // Header-based parsing
      players.push({
        name: cols[nameCol] || '',
        rank: rankCol >= 0 ? parseInt(cols[rankCol]) || players.length + 1 : players.length + 1,
        position: posCol >= 0 ? cols[posCol] || undefined : undefined,
        team: teamCol >= 0 ? cols[teamCol] || undefined : undefined,
        tier: tierCol >= 0 ? parseInt(cols[tierCol]) || undefined : undefined,
      });
    } else if (cols.length === 1) {
      // Single column = name only
      players.push({
        name: cols[0],
        rank: players.length + 1,
      });
    } else {
      // Positional: rank, name, position, team
      const first = cols[0];
      const isFirstRank = /^\d+$/.test(first);
      players.push({
        name: isFirstRank ? cols[1] : cols[0],
        rank: isFirstRank ? parseInt(first) : players.length + 1,
        position: cols[isFirstRank ? 2 : 1] || undefined,
        team: cols[isFirstRank ? 3 : 2] || undefined,
      });
    }
  }

  return players.filter(p => p.name);
}
