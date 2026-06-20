import { useEffect, useState } from "react";
import clsx from "clsx";
import { TrendingDown, TrendingUp } from "lucide-react";
import { PaginationControls } from "./PaginationControls";
import { TeamHelmet } from "./TeamHelmet";
import type { DynastyState, PollEntry } from "../sim/types";

const PAGE_SIZE = 10;
const MOBILE_PAGE_SIZE = 6;

function useCompactMobile(): boolean {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 480px)").matches);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 480px)");
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return matches;
}

export function Rankings({ state }: { state: DynastyState }) {
  const [page, setPage] = useState(1);
  const latest = state.rankings?.[0];
  const isMobile = useCompactMobile();
  const entries = latest?.allEntries?.length ? latest.allEntries : latest?.entries ?? [];
  const pageSize = isMobile ? MOBILE_PAGE_SIZE : PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleEntries = entries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const teamById = new Map(state.teams.map((team) => [team.id, team]));
  const userEntry = entries.find((entry) => entry.teamId === state.userTeamId);

  if (!latest) {
    return (
      <section className="panel span-2">
        <div className="panel-head compact">
          <h2>National Rankings</h2>
          <TrendingUp size={20} />
        </div>
        <p className="muted">Rankings are generated when the dynasty world is created.</p>
      </section>
    );
  }

  return (
    <>
      <section className="panel span-2" data-testid="rankings-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">National Rankings</p>
            <h2>
              {latest.year} {latest.week === 0 ? "Preseason" : `Week ${latest.week}`} Full 70-Team Board
            </h2>
            {!isMobile && <p className="muted">Votes and first-place votes are generated from record, roster power, point margin, and poll inertia.</p>}
          </div>
          <TrendingUp size={20} />
        </div>
        {userEntry && (
          <div className="user-rank-callout user-team-highlight" data-testid="user-team-ranking-callout">
            <strong>
              {isMobile ? "You: " : "Your Program: "}#{userEntry.rank} {userEntry.teamName}
            </strong>
            <span>
              {userEntry.wins}-{userEntry.losses} • {userEntry.votes.toLocaleString()} votes • {userEntry.firstPlaceVotes} 1st
            </span>
          </div>
        )}
        <div className={clsx("table-list rankings-table", isMobile && "rankings-table-mobile")}>
          {!isMobile && (
            <div className="table-row rankings-header">
              <span>Rank</span>
              <strong>Team</strong>
              <span>Record</span>
              <span>Move</span>
              <span>Votes</span>
              <span>1st</span>
            </div>
          )}
          {visibleEntries.map((entry) => {
            const team = teamById.get(entry.teamId);
            return (
              <div
                key={entry.teamId}
                className={clsx("table-row rankings-row", entry.teamId === state.userTeamId && "user-team-highlight")}
                data-testid={entry.teamId === state.userTeamId ? "user-team-ranking-row" : undefined}
              >
                <span>#{entry.rank}</span>
                <strong>
                  {team && <TeamHelmet team={team} size="sm" />}
                  {entry.teamName}
                </strong>
                {isMobile ? (
                  <>
                    <Movement entry={entry} />
                    <span className="ranking-record">
                      {entry.wins}-{entry.losses}
                    </span>
                    <span className="ranking-metrics">
                      {entry.votes.toLocaleString()} votes • {entry.firstPlaceVotes} 1st
                    </span>
                  </>
                ) : (
                  <>
                    <span>{entry.wins}-{entry.losses}</span>
                    <Movement entry={entry} />
                    <span>{entry.votes.toLocaleString()}</span>
                    <span>{entry.firstPlaceVotes}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <PaginationControls page={currentPage} pageCount={pageCount} total={entries.length} pageSize={pageSize} label="rankings" onPageChange={setPage} />
      </section>

      <section className="panel" data-testid="rankings-moved-in-panel">
        <div className="panel-head compact">
          <h2>Moved In</h2>
          <TrendingUp size={20} />
        </div>
        <MovementList entries={latest.movedIn} empty="No new teams entered this poll." mode="in" userTeamId={state.userTeamId} isMobile={isMobile} />
      </section>

      <section className="panel" data-testid="rankings-moved-out-panel">
        <div className="panel-head compact">
          <h2>Moved Out</h2>
          <TrendingDown size={20} />
        </div>
        <MovementList
          entries={latest.movedOut}
          empty="No teams dropped out this poll."
          mode="out"
          userTeamId={state.userTeamId}
          isMobile={isMobile}
        />
      </section>
    </>
  );
}

function Movement({ entry }: { entry: PollEntry }) {
  if (!entry.previousRank) return <span className="movement-chip new">New</span>;
  if (entry.movement > 0) return <span className="movement-chip up">+{entry.movement}</span>;
  if (entry.movement < 0) return <span className="movement-chip down">{entry.movement}</span>;
  return <span className="movement-chip neutral">0</span>;
}

function MovementList({
  entries,
  empty,
  mode,
  userTeamId,
  isMobile,
}: {
  entries: PollEntry[];
  empty: string;
  mode: "in" | "out";
  userTeamId: string;
  isMobile: boolean;
}) {
  const visibleEntries = entries.slice(0, isMobile ? 4 : 8);
  if (!visibleEntries.length) return <p className="muted">{empty}</p>;
  return (
    <div className={clsx("table-list movement-list", isMobile && "movement-list-mobile")}>
      {visibleEntries.map((entry) => (
        <div key={entry.teamId} className={clsx("table-row movement-row", entry.teamId === userTeamId && "user-team-highlight")} data-testid="ranking-movement-row">
          <span>{mode === "out" ? `Now #${entry.rank}` : `#${entry.rank}`}</span>
          <strong>{entry.teamName}</strong>
          <span>{entry.previousRank ? `From #${entry.previousRank}` : "New"}</span>
          {!isMobile && (
            <span>
              {entry.wins}-{entry.losses}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
