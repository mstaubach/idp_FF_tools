import type { TeamTradeStats } from "@/lib/trade-tracker/summary";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-pitch-700 dark:bg-pitch-800/60">
      <div
        className="truncate text-lg font-semibold text-gray-900 dark:text-slate-100"
        title={value}
      >
        {value}
      </div>
      <div className="text-xs text-gray-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

export default function SummaryStrip({ stats }: { stats: TeamTradeStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Stat value={String(stats.tradeCount)} label="Trades" />
      <Stat value={String(stats.playersAcquired)} label="Players acquired" />
      <Stat
        value={`${stats.picksAcquired} / ${stats.picksFlipped}`}
        label="Picks acquired / re-traded"
      />
      <Stat
        value={`${stats.picksDrafted} · ${stats.picksPending}`}
        label="Picks drafted · pending"
      />
      {stats.topPartner ? (
        <Stat
          value={stats.topPartner.name}
          label={`Top partner (${stats.topPartner.trades} trades)`}
        />
      ) : (
        <Stat value="—" label="Top partner" />
      )}
    </div>
  );
}
