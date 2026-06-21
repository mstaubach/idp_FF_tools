'use client';

import { useCallback, useState } from 'react';

interface UploadTabProps {
  onFileContent: (content: string, fileName: string) => void;
}

export default function UploadTab({ onFileContent }: UploadTabProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (file.size > 1_000_000) {
      alert('File must be under 1MB');
      return;
    }
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      alert('Only .csv and .txt files are supported');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFileName(file.name);
      onFileContent(content, file.name);
    };
    reader.readAsText(file);
  }, [onFileContent]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-md p-8 text-center transition-colors ${
        dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
      }`}
    >
      {fileName ? (
        <p className="text-sm text-gray-700">Loaded: <strong>{fileName}</strong></p>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-2">Drag and drop a .csv or .txt file here</p>
          <label className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-md cursor-pointer hover:bg-blue-700">
            Choose File
            <input
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
          <p className="text-xs text-gray-400 mt-2">Max 1MB. CSV or TXT files.</p>
        </>
      )}
    </div>
  );
}
