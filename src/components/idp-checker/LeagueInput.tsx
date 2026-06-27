'use client';

interface LeagueInputProps {
  leagueId: string;
  onChange: (id: string) => void;
}

export default function LeagueInput({ leagueId, onChange }: LeagueInputProps) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor="league-id" className="text-sm font-medium text-gray-700 dark:text-slate-300 whitespace-nowrap">
        Sleeper League ID
      </label>
      <input
        id="league-id"
        type="text"
        value={leagueId}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your Sleeper league ID"
        className="flex-1 px-3 py-2 border border-gray-300 dark:border-pitch-700 rounded-md text-sm text-gray-900 dark:text-slate-100 bg-white dark:bg-pitch-900 focus:ring-2 focus:ring-green-600 focus:border-green-600"
      />
    </div>
  );
}
