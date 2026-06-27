'use client';

import { PlayerResult } from '@/lib/idp-checker/types';
import { getPositionGroup } from '@/lib/idp-checker/types';

interface ResultsTableProps {
  results: PlayerResult[];
  positionFilter: string;
  availableOnly: boolean;
}

export default function ResultsTable({ results, positionFilter, availableOnly }: ResultsTableProps) {
  const filtered = results.filter((r) => {
    if (availableOnly && !r.available) return false;
    if (positionFilter !== 'ALL' && r.matchedPlayer) {
      const group = getPositionGroup(r.matchedPlayer.position);
      if (group !== positionFilter) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-8">No players match the current filters.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-pitch-700 text-left">
            <th className="px-3 py-2 font-medium text-gray-500 dark:text-slate-400">Rank</th>
            <th className="px-3 py-2 font-medium text-gray-500 dark:text-slate-400">Tier</th>
            <th className="px-3 py-2 font-medium text-gray-500 dark:text-slate-400">Player</th>
            <th className="px-3 py-2 font-medium text-gray-500 dark:text-slate-400">Pos</th>
            <th className="px-3 py-2 font-medium text-gray-500 dark:text-slate-400">NFL Team</th>
            <th className="px-3 py-2 font-medium text-gray-500 dark:text-slate-400">Status</th>
            <th className="px-3 py-2 font-medium text-gray-500 dark:text-slate-400">Rostered By</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-pitch-700/50 hover:bg-gray-50 dark:hover:bg-pitch-900/50">
              <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{r.rank ?? '—'}</td>
              <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{r.tier ? `T${r.tier}` : '—'}</td>
              <td className="px-3 py-2 font-medium text-gray-900 dark:text-slate-100">
                {r.matchedPlayer?.name ?? r.inputName}
              </td>
              <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{r.matchedPlayer?.position ?? '—'}</td>
              <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{r.matchedPlayer?.team ?? '—'}</td>
              <td className="px-3 py-2">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  r.available
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {r.available ? 'Available' : 'Rostered'}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{r.rosteredBy?.teamName ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
