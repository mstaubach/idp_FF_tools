import Link from "next/link";

type Tool = {
  href: string;
  icon: string;
  title: string;
  description: string;
  cta: string;
  soon?: boolean;
};

const tools: Tool[] = [
  {
    href: "/standings",
    icon: "🏆",
    title: "League Standings",
    description:
      "Enter any Sleeper league ID to see its standings — wins, losses, and ties for every roster, pulled straight from Sleeper.",
    cta: "View standings",
  },
  {
    href: "/trade-tracker",
    icon: "🔁",
    title: "Trade Tracker",
    description:
      "See what your trades actually became. Follows every traded draft pick into the draft and shows exactly which player was selected with it.",
    cta: "Track a trade",
  },
  {
    href: "/idp-checker",
    icon: "🛡️",
    title: "Waiver Check",
    description:
      "Paste your IDP rankings or upload a CSV and instantly see which defensive players are still available on the waiver wire in your league.",
    cta: "Check waivers",
  },
  {
    href: "/roster-management",
    icon: "📋",
    title: "Roster Management",
    description:
      "See your entire dynasty roster as a depth chart — starters, bench, taxi, and IR organized by position. Built for IDP leagues.",
    cta: "View depth chart",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl space-y-12">
      <section className="space-y-4 py-6 text-center">
        <span className="inline-block rounded-full bg-green-700/20 px-3 py-1 text-sm font-medium text-green-600 dark:text-green-400">
          For Sleeper IDP dynasty leagues
        </span>
        <h1 className="text-5xl font-black tracking-tighter sm:text-6xl text-gray-900 dark:text-slate-100">
          IDP Dynasty HQ
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-slate-300">
          One home for the fantasy football tools that used to live in four
          separate apps. Browse league standings, settle trade debates, and scout
          the IDP waiver wire — all powered by the public Sleeper API. No login,
          no API keys, just a league ID.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href="/trade-tracker"
            className="rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white transition hover:bg-green-600"
          >
            Track a trade
          </Link>
          <Link
            href="/idp-checker"
            className="rounded-lg border border-amber-400 px-5 py-2.5 font-semibold text-amber-500 transition hover:bg-amber-400/10 dark:text-amber-400"
          >
            Check waivers
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">
          The tools
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-green-600/60 hover:bg-gray-50 dark:border-pitch-700 dark:bg-pitch-800/50 dark:hover:border-green-600/60 dark:hover:bg-pitch-800"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="text-3xl">{tool.icon}</span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                  {tool.title}
                </h3>
                {tool.soon && (
                  <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                    Soon
                  </span>
                )}
              </div>
              <p className="flex-1 text-gray-600 dark:text-slate-300">
                {tool.description}
              </p>
              <span className="mt-4 text-sm font-semibold text-amber-500 group-hover:underline dark:text-amber-400">
                {tool.cta} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-500 dark:border-pitch-700 dark:bg-pitch-800/30 dark:text-slate-400">
        <h2 className="mb-2 text-base font-semibold text-gray-800 dark:text-slate-200">
          How it works
        </h2>
        <p>
          Every tool reads from the public, read-only Sleeper API. Find your
          league ID in your Sleeper URL
          (<code className="text-green-600 dark:text-green-400">sleeper.com/leagues/&lt;LEAGUE_ID&gt;</code>),
          drop it into the tool you want, and go. Nothing is stored and no account
          is required.
        </p>
      </section>
    </div>
  );
}
