import type { SeasonStandings } from "@/lib/standings/types";

export default function SeasonTable({ season }: { season: SeasonStandings }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-pitch-700 text-left text-slate-400">
            <th className="p-3 font-medium">#</th>
            <th className="p-3 font-medium">Team</th>
            <th className="p-3 font-medium">W</th>
            <th className="p-3 font-medium">L</th>
            <th className="p-3 font-medium">T</th>
          </tr>
        </thead>
        <tbody>
          {season.rows.map((row) => {
            const isChamp = row.ownerId === season.championOwnerId;
            return (
              <tr
                key={row.ownerId}
                className={
                  isChamp
                    ? "border-b border-pitch-800 bg-amber-500/10"
                    : "border-b border-pitch-800 hover:bg-pitch-800/40"
                }
              >
                <td className="p-3 text-slate-400">{row.rank}</td>
                <td className="p-3 text-slate-100">
                  {row.teamName}
                  {isChamp && <span className="ml-2">🏆</span>}
                </td>
                <td className="p-3 text-slate-200">{row.wins}</td>
                <td className="p-3 text-slate-200">{row.losses}</td>
                <td className="p-3 text-slate-200">{row.ties}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
