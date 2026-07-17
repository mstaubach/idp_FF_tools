export const ACTIVE_LEAGUE_COOKIE = 'idp_active_league';

const TOOLS: Array<{ root: string; leaguePath: (id: string) => string }> = [
  { root: '/standings', leaguePath: (id) => `/standings/${id}` },
  { root: '/trade-tracker', leaguePath: (id) => `/trade-tracker/league/${id}` },
  { root: '/draft-history', leaguePath: (id) => `/draft-history/league/${id}` },
  { root: '/roster-management', leaguePath: (id) => `/roster-management/${id}` },
  { root: '/taxi-filler', leaguePath: (id) => `/taxi-filler/${id}` },
];

function toolFor(pathname: string) {
  return (
    TOOLS.find(
      ({ root }) => pathname === root || pathname.startsWith(`${root}/`)
    ) ?? null
  );
}

export function toolRootFor(pathname: string): string | null {
  return toolFor(pathname)?.root ?? null;
}

export function leaguePathFor(
  pathname: string,
  leagueId: string
): string | null {
  return toolFor(pathname)?.leaguePath(leagueId) ?? null;
}

export function isValidLeagueId(
  value: string | undefined | null
): value is string {
  return typeof value === 'string' && /^\d{6,}$/.test(value);
}

export function activeLeagueCookieString(leagueId: string | null): string {
  const maxAge = leagueId === null ? 0 : 60 * 60 * 24 * 365;
  return `${ACTIVE_LEAGUE_COOKIE}=${leagueId ?? ''}; path=/; max-age=${maxAge}; samesite=lax`;
}
