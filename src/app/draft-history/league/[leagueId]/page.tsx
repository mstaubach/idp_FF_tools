import DraftBoardView from "@/components/draft-history/DraftBoardView";
import Message from "@/components/draft-history/Message";
import {
  buildDraftHistory,
  rookieLeagues,
  type SeasonBoard,
  type SeasonInput,
} from "@/lib/draft-history/board";
import {
  getDraft,
  getDraftPicks,
  getDrafts,
  getLeagueChain,
  getRosters,
  getUsers,
} from "@/lib/draft-history/sleeper";

export const revalidate = 300;

export default async function DraftHistoryLeaguePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  let leagueName: string;
  let boards: SeasonBoard[];

  let chain: Awaited<ReturnType<typeof getLeagueChain>>;
  try {
    chain = await getLeagueChain(leagueId);
  } catch {
    return (
      <Message
        title="Couldn't load this league"
        body="Sleeper's API didn't respond as expected. Double-check the league ID and try again."
      />
    );
  }

  if (chain.length === 0) {
    return (
      <Message
        title="League not found"
        body={`No Sleeper league matched the ID "${leagueId}". Make sure you copied the full ID.`}
      />
    );
  }

  leagueName = chain[0].name;

  const rookies = rookieLeagues(chain);
  if (rookies.length === 0) {
    return (
      <Message
        title="No rookie drafts yet"
        body="This league is still in its startup season — check back after its first rookie draft."
      />
    );
  }

  try {
    const inputs: SeasonInput[] = (
      await Promise.all(
        rookies.map(async (league) => {
          const [users, rosters, drafts] = await Promise.all([
            getUsers(league.league_id),
            getRosters(league.league_id),
            getDrafts(league.league_id),
          ]);
          return Promise.all(
            // The drafts list omits slot_to_roster_id, so fetch each full
            // draft. Fall back to the list entry if the detail fetch 404s.
            drafts.map(async (d) => {
              const [full, picks] = await Promise.all([
                getDraft(d.draft_id),
                getDraftPicks(d.draft_id),
              ]);
              return { league, draft: full ?? d, picks, users, rosters };
            }),
          );
        }),
      )
    ).flat();

    boards = buildDraftHistory(inputs);
  } catch {
    return (
      <Message
        title="Couldn't load this league"
        body="Sleeper's API didn't respond as expected. Double-check the league ID and try again."
      />
    );
  }

  if (boards.length === 0) {
    return (
      <Message
        title="No rookie drafts yet"
        body="No completed rookie draft picks were found for this league."
      />
    );
  }

  return (
    <main className="mx-auto max-w-[90rem] space-y-6 px-2">
      <div>
        <h1 className="text-2xl font-black tracking-tighter text-gray-900 dark:text-slate-100">
          {leagueName}
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Draft history — click any pick to see that slot through the years
        </p>
      </div>
      <DraftBoardView boards={boards} />
    </main>
  );
}
