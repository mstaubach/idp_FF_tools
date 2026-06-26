import type { ManagerRecord } from "@/lib/standings/types";

function pct(winPct: number): string {
  return winPct.toFixed(3).replace(/^0/, ""); // .625
}

export default function AllTimeTable({
  records,
}: {
  records: ManagerRecord[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-pitch-700 text-left text-slate-400">
            <th className="p-3 font-medium" scope="col">Manager</th>
            <th className="p-3 font-medium" scope="col">W</th>
            <th className="p-3 font-medium" scope="col">L</th>
            <th className="p-3 font-medium" scope="col">T</th>
            <th className="p-3 font-medium" scope="col">Titles</th>
            <th className="p-3 font-medium" scope="col">Win%</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr
              key={r.ownerId}
              className="border-b border-pitch-800 hover:bg-pitch-800/40"
            >
              <td className="p-3">
                <span className={r.isCurrentMember ? "text-slate-100" : "text-slate-500"}>
                  {r.displayName}
                </span>
                {!r.isCurrentMember && (
                  <span className="ml-2 text-xs text-slate-600">(former)</span>
                )}
              </td>
              <td className="p-3 text-slate-200">{r.wins}</td>
              <td className="p-3 text-slate-200">{r.losses}</td>
              <td className="p-3 text-slate-200">{r.ties}</td>
              <td className="p-3 text-amber-300">
                {r.championships > 0 ? `🏆×${r.championships}` : "—"}
              </td>
              <td className="p-3 text-slate-200">{pct(r.winPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
