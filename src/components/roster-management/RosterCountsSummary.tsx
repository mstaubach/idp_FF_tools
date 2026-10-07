import type { RosterCounts, SlotCount } from "@/lib/roster-management/roster-counts";

const BADGE_CLASSES = "rounded-full border px-3 py-1 text-xs font-semibold";
const NEUTRAL_CLASSES =
  "border-gray-200 bg-gray-100 text-gray-700 dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-300";
const RED_CLASSES =
  "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300";
const GREEN_CLASSES =
  "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/60 dark:text-green-300";

function Badge({ label, slot }: { label: string; slot: SlotCount }) {
  const over = slot.used - slot.total;
  return (
    <span
      title={over > 0 ? `${over} over the limit` : undefined}
      className={`${BADGE_CLASSES} ${over > 0 ? RED_CLASSES : NEUTRAL_CLASSES}`}
    >
      {label} {slot.used}/{slot.total}
    </span>
  );
}

// Like the section badges, going over the slots is flagged red; filling them
// exactly is called out green.
function TargetBadge({ target }: { target: SlotCount }) {
  const over = target.used - target.total;
  const colors = over > 0 ? RED_CLASSES : over === 0 ? GREEN_CLASSES : NEUTRAL_CLASSES;
  return (
    <span
      title={over > 0 ? `${over} over the limit` : undefined}
      className={`${BADGE_CLASSES} ${colors}`}
    >
      Target {target.used}/{target.total}
    </span>
  );
}

export default function RosterCountsSummary({
  counts,
  target,
}: {
  counts: RosterCounts;
  target?: SlotCount | null; // omit until the owner sets a position target
}) {
  const sections: Array<[string, SlotCount]> = [
    ["Starting", counts.starting],
    ["Bench", counts.bench],
    ["Taxi", counts.taxi],
    ["IR", counts.ir],
  ];
  // A section with no slots still shows while players are in it, since that's
  // over the limit.
  const visible = sections.filter(([, slot]) => slot.total > 0 || slot.used > 0);
  if (visible.length === 0 && !target) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map(([label, slot]) => (
        <Badge key={label} label={label} slot={slot} />
      ))}
      {target && <TargetBadge target={target} />}
    </div>
  );
}
