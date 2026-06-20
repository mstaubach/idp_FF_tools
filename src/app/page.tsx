import Link from "next/link";

const tools = [
  {
    href: "/standings",
    icon: "🏆",
    title: "League Standings",
    description:
      "Live standings for the IDP Dynasty league, pulled straight from Sleeper — wins, losses, and ties for every team.",
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
    title: "IDP Availability Checker",
    description:
      "Paste your IDP rankings or upload a CSV and instantly see which defensive players are still available on the waiver wire in your league.",
    cta: "Check availability",
  },
  {
    href: "/injury-tracker",
    icon: "🚑",
    title: "Injury Tracker",
    description:
      "Keep tabs on injury news for the players on your rosters — practice status, game designations, and return timelines.",
    cta: "Coming soon",
    soon: true,
  },
];

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="space-y-4 py-6 text-center">
        <span className="inline-block rounded-full bg-emerald-600/20 px-3 py-1 text-sm font-medium text-emerald-400">
          For Sleeper IDP dynasty leagues
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          IDP Dynasty HQ
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-slate-300">
          One home for the fantasy football tools that used to live in four
          separate apps. Browse league standings, settle trade debates, and scout
          the IDP waiver wire — all powered by the public Sleeper API. No login,
          no API keys, just a league ID.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href="/trade-tracker"
            className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-500"
          >
            Track a trade
          </Link>
          <Link
            href="/idp-checker"
            className="rounded-lg border border-pitch-700 bg-pitch-800 px-5 py-2.5 font-semibold text-slate-100 transition hover:bg-pitch-700"
          >
            Check IDP availability
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-center text-2xl font-bold">The tools</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group flex flex-col rounded-2xl border border-pitch-700 bg-pitch-800/50 p-6 transition hover:border-emerald-500/60 hover:bg-pitch-800"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="text-3xl">{tool.icon}</span>
                <h3 className="text-xl font-bold">{tool.title}</h3>
                {tool.soon && (
                  <span className="rounded-full bg-emerald-600/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                    Soon
                  </span>
                )}
              </div>
              <p className="flex-1 text-slate-300">{tool.description}</p>
              <span className="mt-4 text-sm font-semibold text-emerald-400 group-hover:underline">
                {tool.cta} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-pitch-700 bg-pitch-800/30 p-6 text-sm text-slate-400">
        <h2 className="mb-2 text-base font-semibold text-slate-200">
          How it works
        </h2>
        <p>
          Every tool reads from the public, read-only Sleeper API. Find your
          league ID in your Sleeper URL
          (<code className="text-emerald-400">sleeper.com/leagues/&lt;LEAGUE_ID&gt;</code>),
          drop it into the tool you want, and go. Nothing is stored and no account
          is required.
        </p>
      </section>
    </div>
  );
}
