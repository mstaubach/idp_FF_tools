'use client';

import { WaiverInfo as WaiverInfoType } from '@/lib/idp-checker/types';

interface WaiverInfoProps {
  waiverInfo: WaiverInfoType;
}

export default function WaiverInfo({ waiverInfo }: WaiverInfoProps) {
  return (
    <div className="bg-gray-50 dark:bg-pitch-900 rounded-md p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
        Waiver Info — {waiverInfo.type === 'faab' ? 'FAAB' : waiverInfo.type === 'rolling' ? 'Rolling Waivers' : 'Unknown Type'}
      </h3>

      {waiverInfo.type === 'faab' && waiverInfo.faabBudgets && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {waiverInfo.faabBudgets
            .sort((a, b) => b.remaining - a.remaining)
            .map((team, i) => (
              <div key={i} className="bg-white dark:bg-pitch-800 border border-gray-200 dark:border-pitch-700 rounded-sm px-3 py-2 text-xs">
                <div className="font-medium text-gray-700 dark:text-slate-300 truncate">{team.teamName}</div>
                <div className="text-gray-500 dark:text-slate-500">${team.remaining} remaining</div>
              </div>
            ))}
        </div>
      )}

      {waiverInfo.type === 'rolling' && waiverInfo.waiverOrder && (
        <ol className="space-y-1">
          {waiverInfo.waiverOrder.map((team, i) => (
            <li key={i} className="text-xs text-gray-600 dark:text-slate-400">
              <span className="font-medium text-gray-700 dark:text-slate-300">{team.priority}.</span> {team.teamName}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
