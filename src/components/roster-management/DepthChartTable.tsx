import type { DepthChartGrid } from "@/lib/roster-management/depth-chart";

export default function DepthChartTable({ grid }: { grid: DepthChartGrid }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-pitch-700">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-gray-200 bg-gray-100 px-4 py-2.5 text-left font-bold text-gray-700 dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-300">
              Rank
            </th>
            {grid.positions.map((pos) => (
              <th
                key={pos}
                className="border-b border-l border-gray-200 bg-green-700 px-4 py-2.5 text-center font-bold text-white dark:border-pitch-700"
              >
                {pos}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.sections.map((section, si) =>
            section.rows.map((row, ri) => (
              <tr
                key={`${section.label}-${ri}`}
                className={
                  si > 0 && ri === 0
                    ? "border-t-2 border-gray-300 dark:border-pitch-700"
                    : ""
                }
              >
                <td className="border-b border-gray-100 px-4 py-2 font-bold text-gray-700 dark:border-pitch-700 dark:text-slate-300">
                  {section.label}
                </td>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="border-b border-l border-gray-100 px-4 py-2 text-gray-900 dark:border-pitch-700 dark:text-slate-100"
                  >
                    {cell ?? ""}
                  </td>
                ))}
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}
