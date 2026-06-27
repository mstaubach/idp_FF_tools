import type { SeasonStandings } from "@/lib/standings/types";

export default function SeasonTable({ season }: { season: SeasonStandings }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-pitch-700 dark:text-slate-400">
            <th className="p-3 font-medium" scope="col">#</th>
            <th className="p-3 font-medium" scope="col">Team</th>
            <th className="p-3 font-medium" scope="col">W</th>
            <th className="p-3 font-medium" scope="col">L</th>
            <th className="p-3 font-medium" scope="col">T</th>
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
                    ? "border-b border-gray-100 bg-amber-500/10 dark:border-pitch-800"
                    : "border-b border-gray-100 hover:bg-gray-50 dark:border-pitch-800 dark:hover:bg-pitch-800/40"
                }
              >
                <td className="p-3 text-gray-500 dark:text-slate-400">{row.rank}</td>
                <td className="p-3 text-gray-900 dark:text-slate-100">
                  {row.teamName}
                  {isChamp && <span className="ml-2">🏆</span>}
                </td>
                <td className="p-3 text-gray-700 dark:text-slate-200">{row.wins}</td>
                <td className="p-3 text-gray-700 dark:text-slate-200">{row.losses}</td>
                <td className="p-3 text-gray-700 dark:text-slate-200">{row.ties}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
