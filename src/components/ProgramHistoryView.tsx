import { BookOpen, ClipboardList } from "lucide-react";
import { buildProgramRecordBook, type ProgramRecordBook as ProgramRecordBookData } from "../sim/history";
import type { DynastyState } from "../sim/types";

export function ProgramHistory({ state }: { state: DynastyState }) {
  const recordBook = buildProgramRecordBook(state);

  return (
    <>
      <ProgramRecordBookPanel recordBook={recordBook} />
      <section className="panel span-2" data-testid="dynasty-history-panel">
        <div className="panel-head compact">
          <h2>Dynasty History</h2>
          <ClipboardList size={20} />
        </div>
        <div className="table-list">
          {state.history.length ? (
            state.history.slice(0, 10).map((entry) => (
              <div key={entry.year} className="table-row">
                <span>{entry.year}</span>
                <strong>{entry.championName ?? "No champion"}</strong>
                <span>{entry.awardWinners[0]?.playerName ?? "Awards pending"}</span>
                <span>{entry.topClasses[0]?.teamName ?? "Class pending"}</span>
                <span>{entry.userRecruitingRank ? `Recruiting #${entry.userRecruitingRank}` : "Recruiting pending"}</span>
              </div>
            ))
          ) : (
            <p className="muted">Completed seasons will be archived here.</p>
          )}
        </div>
      </section>
    </>
  );
}

function ProgramRecordBookPanel({ recordBook }: { recordBook?: ProgramRecordBookData }) {
  if (!recordBook) {
    return (
      <section className="panel span-2" data-testid="program-record-book-panel">
        <div className="panel-head compact">
          <h2>Program Record Book</h2>
          <BookOpen size={20} />
        </div>
        <p className="muted">Program history appears after a completed season.</p>
      </section>
    );
  }
  const metrics = [
    { label: "Seasons Logged", value: recordBook.seasonsLogged.toString(), detail: recordBook.teamName },
    { label: "Best Record", value: recordBook.bestRecord?.record ?? "-", detail: recordBook.bestRecord ? `${recordBook.bestRecord.year}` : "Complete a season" },
    { label: "Best Final Rank", value: recordBook.bestFinalRank ? `#${recordBook.bestFinalRank.rank}` : "-", detail: recordBook.bestFinalRank ? `${recordBook.bestFinalRank.year}` : "No ranked finish" },
    { label: "Best Class", value: recordBook.bestRecruitingClass ? `#${recordBook.bestRecruitingClass.rank}` : "-", detail: recordBook.bestRecruitingClass ? `${recordBook.bestRecruitingClass.year}` : "No class rank" },
    { label: "Crown Bowl Titles", value: recordBook.crownBowlTitles.toString(), detail: "Championship seasons" },
    { label: "Summit Four Trips", value: recordBook.summitFourTrips.toString(), detail: `${recordBook.bowlTrips} bowl trips` },
    { label: "Top 10 Finishes", value: recordBook.topTenFinishes.toString(), detail: "Final poll" },
    { label: "Individual Awards", value: recordBook.individualAwards.toString(), detail: "Player honors" },
  ];

  return (
    <section className="panel span-2 record-book-panel" data-testid="program-record-book-panel">
      <div className="panel-head compact">
        <div>
          <p className="eyebrow">Program History</p>
          <h2>Program Record Book</h2>
        </div>
        <BookOpen size={20} />
      </div>
      <div className="metric-grid record-book-metrics">
        {metrics.map((metric) => (
          <div key={metric.label} className="metric">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </div>
        ))}
      </div>
      <div className="record-book-split">
        <div>
          <h3>Recent Seasons</h3>
          <div className="table-list record-book-table">
            <div className="table-row record-book-row record-book-header">
              <span>Year</span>
              <strong>Record</strong>
              <span>Rank</span>
              <span>Postseason</span>
              <span>Class</span>
              <span>Awards</span>
            </div>
            {recordBook.recentSeasons.length ? (
              recordBook.recentSeasons.map((season) => (
                <div key={season.year} className="table-row record-book-row">
                  <span>{season.year}</span>
                  <strong>{season.record}</strong>
                  <span>{season.finalRank ? `#${season.finalRank}` : "-"}</span>
                  <span>{season.postseason}</span>
                  <span>{season.recruitingClassRank ? `#${season.recruitingClassRank}` : "-"}</span>
                  <span>{season.awards.length}</span>
                </div>
              ))
            ) : (
              <p className="muted">Complete a season to open the record book.</p>
            )}
          </div>
        </div>
        <div>
          <h3>Award Shelf</h3>
          <div className="record-book-awards">
            {recordBook.awardLeaders.length ? (
              recordBook.awardLeaders.map((award) => (
                <span key={award.awardName}>{award.awardName} x{award.count}</span>
              ))
            ) : (
              <p className="muted">Player award totals will accumulate here.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
