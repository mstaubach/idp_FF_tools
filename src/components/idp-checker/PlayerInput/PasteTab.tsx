'use client';

interface PasteTabProps {
  value: string;
  onChange: (value: string) => void;
}

export default function PasteTab({ value, onChange }: PasteTabProps) {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Paste your IDP rankings here...\n\nExamples:\n1. Patrick Queen LB BAL\n2. Roquan Smith LB BAL\n\nOr just names:\nPatrick Queen\nRoquan Smith`}
        className="w-full h-48 px-3 py-2 border border-gray-300 rounded-md text-sm text-black font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
      />
      <p className="text-xs text-gray-400 mt-1">Max 200 players. Supports numbered lists, tab-separated, comma-separated, or plain names.</p>
    </div>
  );
}
