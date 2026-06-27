import Link from "next/link";

export default function Message({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <main className="mx-auto max-w-6xl space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-pitch-700 dark:bg-pitch-800/60">
        <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-slate-100">{title}</h1>
        <p className="text-gray-600 dark:text-slate-300">{body}</p>
        <Link
          href="/trade-tracker"
          className="mt-4 inline-block text-sm text-green-600 hover:underline dark:text-green-400"
        >
          ← Back to start
        </Link>
      </div>
    </main>
  );
}
