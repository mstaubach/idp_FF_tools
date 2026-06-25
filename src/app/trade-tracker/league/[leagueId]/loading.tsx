export default function Loading() {
  return (
    <main className="space-y-4">
      <div className="h-7 w-48 animate-pulse rounded-sm bg-pitch-700" />
      <p className="text-sm text-slate-400">
        Fetching league history and resolving traded picks…
      </p>
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl border border-pitch-700 bg-pitch-800/40"
          />
        ))}
      </div>
    </main>
  );
}
