import Link from "next/link";

export default function Message({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <main className="space-y-4">
      <div className="rounded-xl border border-pitch-700 bg-pitch-800/60 p-6">
        <h1 className="mb-1 text-xl font-bold">{title}</h1>
        <p className="text-slate-300">{body}</p>
        <Link
          href="/trade-tracker"
          className="mt-4 inline-block text-sm text-emerald-400 hover:underline"
        >
          ← Back to start
        </Link>
      </div>
    </main>
  );
}
