# Outreach email — Jon Macri (IDP show)

**Subject:** A free IDP dynasty toolkit built on the Sleeper API — would love your take

---

Hi Jon,

I'm a listener of the show and an IDP dynasty commissioner, and I've been
building something I think your audience would get real use out of. It's called
**IDP Dynasty HQ** — a free web app that reads your Sleeper league and answers
the questions IDP dynasty managers actually argue about.

No login, no account, no API key. You paste a Sleeper league ID and it works.
Everything comes from the public, read-only Sleeper API, and it walks the
`previous_league_id` chain, so it sees every season of a dynasty league, not
just the current one. The IDP part isn't bolted on — defensive positions are
first-class everywhere: DE/DT/NT collapse to DL, CB/S to DB, OLB/ILB/MLB to LB,
and the tools respect your league's actual roster settings instead of assuming
offense-only.

Here's what's in it:

- **League Standings** — the full history of a dynasty league in one screen.
  - All-time table across every season the league has ever played, with wins,
    losses, ties, and win percentage.
  - Per-season tabs with final standings, ranked by wins, then losses, then
    points-for as the tiebreak.
  - Champions strip that reads the actual playoff bracket, so the title goes to
    whoever won the championship match — not whoever finished first in the
    regular season.
  - Regular-season first-place finishes tracked separately from championships,
    which settles a very specific kind of league-chat argument.
  - Former members keep their records in the all-time table; current members are
    flagged so you can tell who's still around.
  - Fetched live on every request, so it's never showing you a stale week.

- **Trade Tracker** — the one I'd lead with. It answers "what did that trade
  actually become?"
  - Follows every traded draft pick forward into the draft and names the player
    who was ultimately selected with it.
  - Picks are keyed to the franchise that originally owned the slot, so a pick
    that changed hands three times still traces back to its origin correctly.
  - Each pick gets an outcome badge: drafted, pending (future pick), or unknown.
  - Covers every season in the dynasty chain, not just this year's trades.
  - Per-team view with a trade timeline showing giver → asset → outcome.
  - Pick chains: if a team received a pick in one trade and flipped it in a
    later one, the two trades are visually linked, and the pick's eventual
    outcome is credited to whoever actually held it on draft day.
  - Summary strip per team: total trades, players acquired, picks acquired vs.
    re-traded, drafted vs. still pending, and most frequent trade partner.

- **Draft History** — every rookie draft the league has ever run.
  - Full draft boards per season, round by round, slot by slot.
  - Automatically identifies and excludes the startup draft, including the messy
    case where a startup and a rookie draft ran in the same season.
  - Traded picks are flagged, showing both the original slot owner and the team
    that actually made the selection.
  - Click any slot (2.05, say) to see who was taken at that exact spot in every
    season of league history.
  - Team view: every pick a single franchise has ever made, across all seasons.

- **Waiver Check** — paste your rankings, see who's actually free.
  - Three input modes: paste text, upload a CSV, or enter names one at a time.
  - The parser handles real-world ranking formats — tab or comma separated,
    rank numbers, NFL team and position tokens, explicit "Tier 3" headers, or
    blank lines as tier breaks.
  - Two-pass fuzzy name matching: a strict full-name pass, then a last-name
    fallback that catches abbreviated first names like "Pat Queen," with
    position-group and NFL-team tiebreakers when names collide.
  - Match confidence shown per player, and anything it couldn't match is listed
    separately rather than silently dropped.
  - Rostered players show which team in your league owns them.
  - Filter by LB / DL / DB, or hide everyone who's already taken.
  - Waiver context included: remaining FAAB per team in budget leagues, or the
    full rolling waiver priority order otherwise.

- **Roster Management** — your roster as an IDP depth chart.
  - Starting, Bench, Taxi, and IR laid out as position columns.
  - Columns are derived from your league's own roster settings, so a league with
    IDP flex spots looks different from one without.
  - Sleeper's granular positions are grouped the way dynasty managers actually
    think about them (DL / LB / DB).
  - Drag and drop to re-slot multi-eligible players — an edge rusher listed at
    LB, for instance — constrained to positions the player is genuinely eligible
    for, and remembered next time you visit.
  - Slot counts at a glance: used vs. total for each section.

- **Taxi Filler** — find the stash before someone else does.
  - Scans every unrostered player in the league for taxi-squad eligibility.
  - Honors your league's actual taxi-years setting rather than guessing at
    "rookies only."
  - Limited to positions your league actually rosters.
  - Sorted by Sleeper's own player ranking, so the best available names float to
    the top.
  - Position tabs plus a rookies-only toggle.

A few things that cut across all of it:

- Save your Sleeper username once and every league you're in becomes a
  one-click switch in the nav bar — the active league follows you from tool to
  tool.
- Light and dark themes.
- Nothing is stored on a server. Your league list lives in your own browser.

If you have a few minutes, I'd genuinely value your feedback — especially on the
Trade Tracker and the waiver-check matching, since those are the two most
opinionated pieces. And if any of it looks useful for the show, I'm happy to
walk through it live, or build out whatever's missing for the kind of leagues
your listeners run.

Either way, thanks for the work you put into the IDP side of the hobby. It's a
big part of why this exists.

Best,
[Your name]
[Link to the site]
