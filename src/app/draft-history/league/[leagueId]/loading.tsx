export default function Loading() {
  return (
    <main className="mx-auto max-w-[90rem] space-y-4 px-2">
      <div className="h-7 w-48 animate-pulse rounded-sm bg-gray-200 dark:bg-pitch-700" />
      <p className="text-sm text-gray-500 dark:text-slate-400">
        Fetching every season&apos;s rookie draft…
      </p>
      <div className="h-96 animate-pulse rounded-xl border border-gray-200 bg-gray-100/40 dark:border-pitch-700 dark:bg-pitch-800/40" />
    </main>
  );
}
