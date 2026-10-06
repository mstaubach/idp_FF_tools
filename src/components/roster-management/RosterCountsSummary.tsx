import type { RosterCounts, SlotCount } from "@/lib/roster-management/roster-counts";

function Badge({ label, slot }: { label: string; slot: SlotCount }) {
  const over = slot.used - slot.total;
  return (
    <span
      title={over > 0 ? `${over} over the limit` : undefined}
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
        over > 0
          ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300"
          : "border-gray-200 bg-gray-100 text-gray-700 dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-300"
      }`}
    >
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
  // A section with no slots still shows while players are in it, since that's
  // over the limit.
  const visible = sections.filter(([, slot]) => slot.total > 0 || slot.used > 0);
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map(([label, slot]) => (
        <Badge key={label} label={label} slot={slot} />
      ))}
    </div>
  );
}
