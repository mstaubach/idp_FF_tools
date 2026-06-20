'use client';

interface LeagueInputProps {
  leagueId: string;
  onChange: (id: string) => void;
}

export default function LeagueInput({ leagueId, onChange }: LeagueInputProps) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor="league-id" className="text-sm font-medium text-gray-700 whitespace-nowrap">
        Sleeper League ID
      </label>
      <input
        id="league-id"
        type="text"
        value={leagueId}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your Sleeper league ID"
        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}
