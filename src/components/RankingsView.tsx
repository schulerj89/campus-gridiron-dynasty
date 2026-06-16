import { useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { PaginationControls } from "./PaginationControls";
import { TeamHelmet } from "./TeamHelmet";
import type { DynastyState, PollEntry } from "../sim/types";

const PAGE_SIZE = 10;

export function Rankings({ state }: { state: DynastyState }) {
  const [page, setPage] = useState(1);
  const latest = state.rankings?.[0];
  const entries = latest?.entries ?? [];
  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const visibleEntries = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const teamById = new Map(state.teams.map((team) => [team.id, team]));

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
              {latest.year} {latest.week === 0 ? "Preseason" : `Week ${latest.week}`} Top 25
            </h2>
            <p className="muted">Votes and first-place votes are generated from record, roster power, point margin, and poll inertia.</p>
          </div>
          <TrendingUp size={20} />
        </div>
        <div className="table-list rankings-table">
          <div className="table-row rankings-header">
            <span>Rank</span>
            <strong>Team</strong>
            <span>Record</span>
            <span>Move</span>
            <span>Votes</span>
            <span>1st</span>
          </div>
          {visibleEntries.map((entry) => {
            const team = teamById.get(entry.teamId);
            return (
              <div key={entry.teamId} className="table-row rankings-row">
                <span>#{entry.rank}</span>
                <strong>
                  {team && <TeamHelmet team={team} size="sm" />}
                  {entry.teamName}
                </strong>
                <span>
                  {entry.wins}-{entry.losses}
                </span>
                <Movement entry={entry} />
                <span>{entry.votes.toLocaleString()}</span>
                <span>{entry.firstPlaceVotes}</span>
              </div>
            );
          })}
        </div>
        <PaginationControls page={page} pageCount={pageCount} total={entries.length} pageSize={PAGE_SIZE} label="rankings" onPageChange={setPage} />
      </section>

      <section className="panel" data-testid="rankings-moved-in-panel">
        <div className="panel-head compact">
          <h2>Moved In</h2>
          <TrendingUp size={20} />
        </div>
        <MovementList entries={latest.movedIn} empty="No new teams entered this poll." />
      </section>

      <section className="panel" data-testid="rankings-moved-out-panel">
        <div className="panel-head compact">
          <h2>Moved Out</h2>
          <TrendingDown size={20} />
        </div>
        <MovementList entries={latest.movedOut} empty="No teams dropped out this poll." />
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

function MovementList({ entries, empty }: { entries: PollEntry[]; empty: string }) {
  if (!entries.length) return <p className="muted">{empty}</p>;
  return (
    <div className="table-list movement-list">
      {entries.slice(0, 8).map((entry) => (
        <div key={entry.teamId} className="table-row movement-row" data-testid="ranking-movement-row">
          <span>#{entry.rank}</span>
          <strong>{entry.teamName}</strong>
          <span>
            {entry.wins}-{entry.losses}
          </span>
        </div>
      ))}
    </div>
  );
}
