import type { RosterCounts, SlotCount } from "@/lib/roster-management/roster-counts";

function Badge({ label, slot }: { label: string; slot: SlotCount }) {
  return (
    <span className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-300">
      {label} {slot.used}/{slot.total}
    </span>
  );
}

export default function RosterCountsSummary({ counts }: { counts: RosterCounts }) {
  const sections: Array<[string, SlotCount]> = [
    ["Starting", counts.starting],
    ["Bench", counts.bench],
    ["Taxi", counts.taxi],
    ["IR", counts.ir],
  ];
  const visible = sections.filter(([, slot]) => slot.total > 0);
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map(([label, slot]) => (
        <Badge key={label} label={label} slot={slot} />
      ))}
    </div>
  );
}
