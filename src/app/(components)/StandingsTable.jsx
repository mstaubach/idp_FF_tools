const LEAGUE_ID = "1048426134855081984";

export default async function StandingsTable({ leagueId = LEAGUE_ID }) {
  let teams = [];
  try {
    const response = await fetch(
      `https://api.sleeper.app/v1/league/${leagueId}/rosters`,
      { cache: "no-store" }
    );
    if (response.ok) {
      teams = await response.json();
    }
  } catch {
    teams = [];
  }

  if (!Array.isArray(teams) || teams.length === 0) {
    return (
      <div className="rounded-xl border border-pitch-700 bg-pitch-800/50 p-5 text-sm text-slate-300">
        Standings are temporarily unavailable. The Sleeper API couldn&apos;t be
        reached — try again in a moment.
      </div>
    );
  }

  // Sort wins from highest to lowest.
  teams.sort(
    (a, b) => parseFloat(b.settings.wins) - parseFloat(a.settings.wins)
  );

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse border border-white">
        <thead>
          <tr>
            <th className="border border-white p-4">Roster</th>
            <th className="border border-white p-4">Wins</th>
            <th className="border border-white p-4">Losses</th>
            <th className="border border-white p-4">Ties</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr key={team.roster_id}>
              <td className="border border-white p-4">{team.roster_id}</td>
              <td className="border border-white p-4">{team.settings.wins}</td>
              <td className="border border-white p-4">
                {team.settings.losses}
              </td>
              <td className="border border-white p-4">{team.settings.ties}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
