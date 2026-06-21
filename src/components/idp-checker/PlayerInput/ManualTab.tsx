'use client';

import { useState, useEffect, useRef } from 'react';

interface AutocompletePlayer {
  id: string;
  name: string;
  position: string;
  team: string;
}

interface ManualTabProps {
  players: { name: string; position?: string }[];
  onAdd: (name: string, position?: string) => void;
  onRemove: (index: number) => void;
}

export default function ManualTab({ players, onAdd, onRemove }: ManualTabProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AutocompletePlayer[]>([]);
  const [allPlayers, setAllPlayers] = useState<AutocompletePlayer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/players')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAllPlayers(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    const lower = query.toLowerCase();
    const filtered = allPlayers
      .filter(p => p.name.toLowerCase().includes(lower))
      .slice(0, 8);
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  }, [query, allPlayers]);

  const handleSelect = (player: AutocompletePlayer) => {
    onAdd(player.name, player.position);
    setQuery('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault();
      if (suggestions.length > 0) {
        handleSelect(suggestions[0]);
      } else {
        onAdd(query.trim());
        setQuery('');
      }
    }
  };

  return (
    <div>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Type a player name..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {showSuggestions && (
          <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto">
            {suggestions.map((p) => (
              <li
                key={p.id}
                onMouseDown={() => handleSelect(p)}
                className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer flex justify-between"
              >
                <span>{p.name}</span>
                <span className="text-gray-400">{p.position} - {p.team}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {players.length > 0 && (
        <div className="mt-3 space-y-1">
          {players.map((p, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-1.5 rounded text-sm">
              <span>{i + 1}. {p.name} {p.position && <span className="text-gray-400">({p.position})</span>}</span>
              <button onClick={() => onRemove(i)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-2">Type to search, press Enter to add. Max 200 players.</p>
    </div>
  );
}
