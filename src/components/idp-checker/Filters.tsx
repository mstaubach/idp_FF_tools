'use client';

interface FiltersProps {
  positionFilter: string;
  onPositionChange: (value: string) => void;
  availableOnly: boolean;
  onAvailableOnlyChange: (value: boolean) => void;
}

export default function Filters({
  positionFilter,
  onPositionChange,
  availableOnly,
  onAvailableOnlyChange,
}: FiltersProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <label htmlFor="pos-filter" className="text-sm text-gray-600">Position:</label>
        <select
          id="pos-filter"
          value={positionFilter}
          onChange={(e) => onPositionChange(e.target.value)}
          className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All</option>
          <option value="LB">LB</option>
          <option value="DL">DL (DE/DT)</option>
          <option value="DB">DB (CB/S)</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={availableOnly}
          onChange={(e) => onAvailableOnlyChange(e.target.checked)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        Available only
      </label>
    </div>
  );
}
