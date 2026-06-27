interface UnmatchedPlayersProps {
  players: string[];
}

export default function UnmatchedPlayers({ players }: UnmatchedPlayersProps) {
  if (players.length === 0) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
      <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">
        Unmatched Players ({players.length})
      </h3>
      <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">
        These players could not be matched in the Sleeper database. Check for typos.
      </p>
      <ul className="space-y-1">
        {players.map((name, i) => (
          <li key={i} className="text-xs text-yellow-700 dark:text-yellow-400">{name}</li>
        ))}
      </ul>
    </div>
  );
}
