interface UnmatchedPlayersProps {
  players: string[];
}

export default function UnmatchedPlayers({ players }: UnmatchedPlayersProps) {
  if (players.length === 0) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
      <h3 className="text-sm font-medium text-yellow-800 mb-2">
        Unmatched Players ({players.length})
      </h3>
      <p className="text-xs text-yellow-600 mb-2">
        These players could not be matched in the Sleeper database. Check for typos.
      </p>
      <ul className="space-y-1">
        {players.map((name, i) => (
          <li key={i} className="text-xs text-yellow-700">{name}</li>
        ))}
      </ul>
    </div>
  );
}
