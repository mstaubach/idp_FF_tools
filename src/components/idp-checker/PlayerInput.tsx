'use client';

import { useState, useCallback } from 'react';
import PasteTab from './PlayerInput/PasteTab';
import UploadTab from './PlayerInput/UploadTab';
import ManualTab from './PlayerInput/ManualTab';
import { ParsedPlayer } from '@/lib/idp-checker/types';
import { parseTextInput, parseCSV } from '@/lib/idp-checker/parser';

type Tab = 'paste' | 'upload' | 'manual';

interface PlayerInputProps {
  onSubmit: (players: ParsedPlayer[]) => void;
  isLoading: boolean;
}

export default function PlayerInput({ onSubmit, isLoading }: PlayerInputProps) {
  const [activeTab, setActiveTab] = useState<Tab>('paste');
  const [pasteValue, setPasteValue] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [manualPlayers, setManualPlayers] = useState<{ name: string; position?: string }[]>([]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'paste', label: 'Paste Text' },
    { key: 'upload', label: 'Upload File' },
    { key: 'manual', label: 'Manual Entry' },
  ];

  const handleSubmit = useCallback(() => {
    let players: ParsedPlayer[] = [];

    switch (activeTab) {
      case 'paste':
        players = parseTextInput(pasteValue);
        break;
      case 'upload':
        players = uploadContent.includes(',') ? parseCSV(uploadContent) : parseTextInput(uploadContent);
        break;
      case 'manual':
        players = manualPlayers.map((p, i) => ({
          name: p.name,
          position: p.position,
          rank: i + 1,
        }));
        break;
    }

    if (players.length === 0) return;
    onSubmit(players);
  }, [activeTab, pasteValue, uploadContent, manualPlayers, onSubmit]);

  const hasInput = activeTab === 'paste' ? pasteValue.trim().length > 0
    : activeTab === 'upload' ? uploadContent.length > 0
    : manualPlayers.length > 0;

  return (
    <div>
      <div className="flex border-b border-gray-200 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'paste' && <PasteTab value={pasteValue} onChange={setPasteValue} />}
      {activeTab === 'upload' && <UploadTab onFileContent={(content) => setUploadContent(content)} />}
      {activeTab === 'manual' && (
        <ManualTab
          players={manualPlayers}
          onAdd={(name, position) => setManualPlayers(prev => [...prev, { name, position }])}
          onRemove={(i) => setManualPlayers(prev => prev.filter((_, idx) => idx !== i))}
        />
      )}

      <button
        onClick={handleSubmit}
        disabled={!hasInput || isLoading}
        className="mt-4 w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Checking Availability...' : 'Check Availability'}
      </button>
    </div>
  );
}
