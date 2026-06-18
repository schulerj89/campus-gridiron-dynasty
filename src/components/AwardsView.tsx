import { useState } from "react";
import clsx from "clsx";
import { Award, BookOpen, ClipboardList, LineChart, Medal, Trophy } from "lucide-react";
import { PaginationControls } from "./PaginationControls";
import { createSeasonAwards } from "../sim/awards";
import { getUserTeam } from "../sim/dynasty";
import { buildProgramRecordBook, type ProgramRecordBook as ProgramRecordBookData } from "../sim/history";
import type { AwardWinner, DynastyState, Game, PlayerStats, Team } from "../sim/types";

type LeaderboardScope = "national" | "conference" | "team";
type LeaderboardStatKey = keyof PlayerStats;

const leaderboardStats: { key: LeaderboardStatKey; label: string }[] = [
  { key: "passYards", label: "Passing Yards" },
  { key: "passTd", label: "Passing TD" },
  { key: "interceptionsThrown", label: "INT Thrown" },
  { key: "rushYards", label: "Rushing Yards" },
  { key: "rushTd", label: "Rushing TD" },
  { key: "receivingYards", label: "Receiving Yards" },
  { key: "receivingTd", label: "Receiving TD" },
  { key: "tackles", label: "Tackles" },
  { key: "sacks", label: "Sacks" },
  { key: "interceptions", label: "Interceptions" },
  { key: "pancakes", label: "Pancakes" },
  { key: "fieldGoals", label: "Field Goals" },
];

const leaderboardColumns: { key: LeaderboardStatKey; label: string }[] = [
  { key: "passYards", label: "Pass Yds" },
  { key: "passTd", label: "Pass TD" },
  { key: "interceptionsThrown", label: "INT Thrown" },
  { key: "rushYards", label: "Rush Yds" },
  { key: "rushTd", label: "Rush TD" },
  { key: "receivingYards", label: "Rec Yds" },
  { key: "receivingTd", label: "Rec TD" },
  { key: "tackles", label: "Tackles" },
  { key: "sacks", label: "Sacks" },
  { key: "interceptions", label: "INT" },
  { key: "pancakes", label: "Pancakes" },
  { key: "fieldGoals", label: "FG" },
];

const LEADERBOARD_PAGE_SIZE = 10;

export function Awards({ state }: { state: DynastyState }) {
  const userTeam = getUserTeam(state);
  const userConference = state.conferences.find((conference) => conference.id === userTeam.conferenceId);
  const conferenceAwards = userConference && state.seasonAwards ? state.seasonAwards.allConference[userConference.id] : undefined;
  const playoffGames = state.playoff?.games ?? [];
  const latestHistory = state.history[0];
  const latestWeeklyAwards = state.weeklyAwards[0]?.national ?? [];
  const latestConferenceWeeklyAwards = userConference ? state.weeklyAwards[0]?.conference[userConference.id] ?? [] : [];
  const seasonAwardWatch = !state.seasonAwards && state.phase === "regular" && state.week >= 8 ? createSeasonAwards(state.teams, state.conferences, state.calendarYear).nationalAwards : undefined;
  const awardSource = state.seasonAwards?.nationalAwards ?? seasonAwardWatch ?? (state.phase === "regular" ? [] : latestHistory?.awardWinners ?? []);
  const priorPlayoffTeams = latestHistory?.playoffTeams.map((id) => state.teams.find((team) => team.id === id)?.name ?? id) ?? [];
  const recordBook = buildProgramRecordBook(state);
  return (
    <>
      <section className="panel span-2" data-testid="player-of-week-panel">
        <div className="panel-head compact">
          <h2>National Players of the Week</h2>
          <Award size={20} />
        </div>
        <AwardGrid awards={latestWeeklyAwards.slice(0, 2)} userTeamId={state.userTeamId} />
      </section>
      <section className="panel span-2" data-testid="conference-player-of-week-panel">
        <div className="panel-head compact">
          <h2>{userConference?.name ?? "Conference"} Players of the Week</h2>
          <Medal size={20} />
        </div>
        <AwardGrid awards={latestConferenceWeeklyAwards.slice(0, 2)} userTeamId={state.userTeamId} />
      </section>
      <section className="panel span-2" data-testid="awards-panel">
        <div className="panel-head compact">
          <h2>{state.seasonAwards ? "Season Awards" : state.week >= 8 ? "Season Award Watch" : "Season Award Watch Opens Week 8"}</h2>
          <Award size={20} />
        </div>
        {state.week >= 8 || state.seasonAwards || state.phase !== "regular" ? <AwardGrid awards={awardSource} userTeamId={state.userTeamId} /> : <p className="muted">Season award tracking unlocks after Week 8.</p>}
      </section>
      <ProgramRecordBookPanel recordBook={recordBook} />
      <StatLeaderboard state={state} />
      {state.seasonAwards && (
        <>
          <AwardTeamPanel title="All-American First Team" awards={state.seasonAwards.allAmericans.first} testId="all-american-first-panel" userTeamId={state.userTeamId} />
          <AwardTeamPanel title="All-American Second Team" awards={state.seasonAwards.allAmericans.second} testId="all-american-second-panel" userTeamId={state.userTeamId} />
          <AwardTeamPanel title="Freshman All-American" awards={state.seasonAwards.allAmericans.freshman} testId="all-american-freshman-panel" userTeamId={state.userTeamId} />
        </>
      )}
      {conferenceAwards && (
        <>
          <AwardTeamPanel title={`${userConference?.name ?? "Conference"} First Team`} awards={conferenceAwards.first} testId="all-conference-first-panel" userTeamId={state.userTeamId} />
          <AwardTeamPanel title={`${userConference?.name ?? "Conference"} Second Team`} awards={conferenceAwards.second} testId="all-conference-second-panel" userTeamId={state.userTeamId} />
          <AwardTeamPanel title={`${userConference?.name ?? "Conference"} Freshman Team`} awards={conferenceAwards.freshman} testId="all-conference-freshman-panel" userTeamId={state.userTeamId} />
        </>
      )}
      <section className="panel span-2" data-testid="playoff-panel">
        <div className="panel-head compact">
          <h2>{state.playoff ? "Summit Four Playoff" : "Latest Playoff Field"}</h2>
          <Trophy size={20} />
        </div>
        <PlayoffBracket games={playoffGames} teams={state.teams} priorPlayoffTeams={priorPlayoffTeams} championName={latestHistory?.championName} />
      </section>
      <section className="panel span-2">
        <div className="panel-head compact">
          <h2>Dynasty History</h2>
          <ClipboardList size={20} />
        </div>
        <div className="table-list">
          {state.history.slice(0, 10).map((entry) => (
            <div key={entry.year} className="table-row">
              <span>{entry.year}</span>
              <strong>{entry.championName ?? "No champion"}</strong>
              <span>{entry.awardWinners[0]?.playerName ?? "Awards pending"}</span>
              <span>{entry.topClasses[0]?.teamName ?? "Class pending"}</span>
              <span>{entry.userRecruitingRank ? `Recruiting #${entry.userRecruitingRank}` : "Recruiting pending"}</span>
            </div>
          ))}
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

export function AwardGrid({ awards, limit = 12, userTeamId }: { awards: AwardWinner[]; limit?: number; userTeamId?: string }) {
  const list = awards.slice(0, limit);
  if (!list.length) return <p className="muted">Awards appear once games are simulated.</p>;
  return (
    <div className="award-grid">
      {list.map((award) => (
        <article key={`${award.awardName}-${award.playerId}`} className={clsx("card", award.teamId === userTeamId && "user-team-highlight")} data-testid={award.teamId === userTeamId ? "user-team-award-card" : undefined}>
          <p className="eyebrow">{award.awardName}</p>
          <h3>{award.playerName}</h3>
          <p>
            {award.teamName} - {award.position}
          </p>
          <span>{award.note}</span>
        </article>
      ))}
    </div>
  );
}

function AwardTeamPanel({ title: panelTitle, awards, testId, userTeamId }: { title: string; awards: AwardWinner[]; testId: string; userTeamId: string }) {
  return (
    <section className="panel span-2" data-testid={testId}>
      <div className="panel-head compact">
        <h2>{panelTitle}</h2>
        <Medal size={20} />
      </div>
      <HonorGrid awards={awards} limit={16} userTeamId={userTeamId} />
    </section>
  );
}

function StatLeaderboard({ state }: { state: DynastyState }) {
  const userTeam = getUserTeam(state);
  const [scope, setScope] = useState<LeaderboardScope>("national");
  const [statKey, setStatKey] = useState<LeaderboardStatKey>("passYards");
  const [page, setPage] = useState(1);
  const userConferenceTeamIds = new Set(state.conferences.find((conference) => conference.id === userTeam.conferenceId)?.teamIds ?? []);
  const rows = state.teams
    .filter((team) => scope === "national" || (scope === "conference" ? userConferenceTeamIds.has(team.id) : team.id === userTeam.id))
    .flatMap((team) =>
      team.roster.map((player) => ({
        team,
        player,
        value: player.stats[statKey],
      })),
    )
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || b.player.overall - a.player.overall);
  const pageCount = Math.max(1, Math.ceil(rows.length / LEADERBOARD_PAGE_SIZE));
  const visibleRows = rows.slice((page - 1) * LEADERBOARD_PAGE_SIZE, page * LEADERBOARD_PAGE_SIZE);
  const changeScope = (nextScope: LeaderboardScope) => {
    setScope(nextScope);
    setPage(1);
  };
  const changeStat = (nextStat: LeaderboardStatKey) => {
    setStatKey(nextStat);
    setPage(1);
  };

  return (
    <section className="panel span-2" data-testid="leaderboard-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Stat Leaders</p>
          <h2>{leaderboardStats.find((stat) => stat.key === statKey)?.label}</h2>
        </div>
        <LineChart size={20} />
      </div>
      <div className="filter-grid compact-filters">
        <label>
          Scope
          <select value={scope} onChange={(event) => changeScope(event.target.value as LeaderboardScope)}>
            <option value="national">National</option>
            <option value="conference">Conference</option>
            <option value="team">Team</option>
          </select>
        </label>
        <label>
          Statistic
          <select value={statKey} onChange={(event) => changeStat(event.target.value as LeaderboardStatKey)}>
            {leaderboardStats.map((stat) => (
              <option key={stat.key} value={stat.key}>{stat.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-list leaderboard-list">
        <div className="table-row leaderboard-row leaderboard-header">
          <span>Rank</span>
          <strong>Player</strong>
          <span>Pos</span>
          <span>Team</span>
          {leaderboardColumns.map((column) => (
            <span key={column.key} className={clsx(column.key === statKey && "selected-stat")}>{column.label}</span>
          ))}
        </div>
        {visibleRows.length ? (
          visibleRows.map((row, index) => (
            <div key={`${row.player.id}-${statKey}`} className={clsx("table-row leaderboard-row", row.team.id === userTeam.id && "user-team-highlight")} data-testid={row.team.id === userTeam.id ? "user-team-leaderboard-row" : undefined}>
              <span>{(page - 1) * LEADERBOARD_PAGE_SIZE + index + 1}</span>
              <strong>{row.player.name}</strong>
              <span>{row.player.position}</span>
              <span>{row.team.name}</span>
              {leaderboardColumns.map((column) => (
                <span key={column.key} className={clsx(column.key === statKey && "selected-stat")}>
                  {row.player.stats[column.key].toLocaleString()}
                </span>
              ))}
            </div>
          ))
        ) : (
          <p className="muted">Stat leaders populate after games are played.</p>
        )}
      </div>
      <PaginationControls page={page} pageCount={pageCount} total={rows.length} pageSize={LEADERBOARD_PAGE_SIZE} label="leaders" onPageChange={setPage} />
    </section>
  );
}

export function PlayoffBracket({ games, teams, priorPlayoffTeams, championName }: { games: Game[]; teams: Team[]; priorPlayoffTeams: string[]; championName?: string }) {
  if (!games.length && priorPlayoffTeams.length) {
    return (
      <div className="playoff-bracket field-only">
        <div className="bracket-round">
          {priorPlayoffTeams.map((teamName, index) => (
            <article key={`${teamName}-${index}`} className="bracket-game">
              <p className="eyebrow">Seed {index + 1}</p>
              <strong>{teamName}</strong>
              <span>{championName === teamName ? "Crown Bowl Champion" : "Playoff qualifier"}</span>
            </article>
          ))}
        </div>
      </div>
    );
  }
  if (!games.length) return <p className="muted">Playoff bracket forms after Week 12.</p>;

  const rounds = [
    { label: "Quarterfinals", games: games.filter((game) => game.playoffRound === "quarter"), placeholder: "Opening bowls pending" },
    { label: "Semifinals", games: games.filter((game) => game.playoffRound === "semi"), placeholder: "Awaiting quarterfinal winners" },
    { label: "Crown Bowl", games: games.filter((game) => game.playoffRound === "final"), placeholder: "Awaiting semifinal winners" },
  ];

  return (
    <div className="playoff-bracket">
      {rounds.map((round) => (
        <div key={round.label} className="bracket-round">
          <h3>{round.label}</h3>
          {round.games.map((game) => {
            const home = teams.find((team) => team.id === game.homeTeamId);
            const away = teams.find((team) => team.id === game.awayTeamId);
            return (
              <article key={game.id} className="bracket-game">
                <p className="eyebrow">{game.bowlName}</p>
                <div className={clsx(game.result?.winnerTeamId === away?.id && "winner")}>
                  <strong>{away?.name}</strong>
                  <span>{game.result?.awayScore ?? "-"}</span>
                </div>
                <div className={clsx(game.result?.winnerTeamId === home?.id && "winner")}>
                  <strong>{home?.name}</strong>
                  <span>{game.result?.homeScore ?? "-"}</span>
                </div>
              </article>
            );
          })}
          {!round.games.length && (
            <article className="bracket-game placeholder">
              <p className="eyebrow">{round.label}</p>
              <strong>{round.placeholder}</strong>
              <span>Bracket advances after the prior round.</span>
            </article>
          )}
        </div>
      ))}
    </div>
  );
}

function HonorGrid({ awards, limit = 16, userTeamId }: { awards: AwardWinner[]; limit?: number; userTeamId?: string }) {
  const list = awards.slice(0, limit);
  if (!list.length) return <p className="muted">Honor teams appear once season awards are available.</p>;
  return (
    <div className="award-grid honor-grid">
      {list.map((award) => (
        <article key={`${award.playerId}-${award.position}`} className={clsx("card", award.teamId === userTeamId && "user-team-highlight")} data-testid={award.teamId === userTeamId ? "user-team-honor-card" : undefined}>
          <p className="eyebrow">{award.position}</p>
          <h3>{award.playerName}</h3>
          <p>{award.teamName}</p>
          <span>{award.note}</span>
        </article>
      ))}
    </div>
  );
}
