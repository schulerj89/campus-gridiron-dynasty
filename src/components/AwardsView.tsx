import { useState } from "react";
import clsx from "clsx";
import { Award, ClipboardList, LineChart, Medal, Trophy } from "lucide-react";
import { PaginationControls } from "./PaginationControls";
import { createSeasonAwards } from "../sim/awards";
import { getUserTeam } from "../sim/dynasty";
import type { AwardWinner, DynastyState, Game, PlayerStats, Team } from "../sim/types";

type LeaderboardScope = "national" | "conference" | "team";
type LeaderboardStatKey = keyof PlayerStats;

const leaderboardStats: { key: LeaderboardStatKey; label: string }[] = [
  { key: "passYards", label: "Passing Yards" },
  { key: "passTd", label: "Passing TD" },
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
  return (
    <>
      <section className="panel span-2" data-testid="player-of-week-panel">
        <div className="panel-head compact">
          <h2>National Players of the Week</h2>
          <Award size={20} />
        </div>
        <AwardGrid awards={latestWeeklyAwards.slice(0, 2)} />
      </section>
      <section className="panel span-2" data-testid="conference-player-of-week-panel">
        <div className="panel-head compact">
          <h2>{userConference?.name ?? "Conference"} Players of the Week</h2>
          <Medal size={20} />
        </div>
        <AwardGrid awards={latestConferenceWeeklyAwards.slice(0, 2)} />
      </section>
      <section className="panel span-2" data-testid="awards-panel">
        <div className="panel-head compact">
          <h2>{state.seasonAwards ? "Season Awards" : state.week >= 8 ? "Season Award Watch" : "Season Award Watch Opens Week 8"}</h2>
          <Award size={20} />
        </div>
        {state.week >= 8 || state.seasonAwards || state.phase !== "regular" ? <AwardGrid awards={awardSource} /> : <p className="muted">Season award tracking unlocks after Week 8.</p>}
      </section>
      <StatLeaderboard state={state} />
      {state.seasonAwards && (
        <>
          <AwardTeamPanel title="All-American First Team" awards={state.seasonAwards.allAmericans.first} testId="all-american-first-panel" />
          <AwardTeamPanel title="All-American Second Team" awards={state.seasonAwards.allAmericans.second} testId="all-american-second-panel" />
          <AwardTeamPanel title="Freshman All-American" awards={state.seasonAwards.allAmericans.freshman} testId="all-american-freshman-panel" />
        </>
      )}
      {conferenceAwards && (
        <>
          <AwardTeamPanel title={`${userConference?.name ?? "Conference"} First Team`} awards={conferenceAwards.first} testId="all-conference-first-panel" />
          <AwardTeamPanel title={`${userConference?.name ?? "Conference"} Second Team`} awards={conferenceAwards.second} testId="all-conference-second-panel" />
          <AwardTeamPanel title={`${userConference?.name ?? "Conference"} Freshman Team`} awards={conferenceAwards.freshman} testId="all-conference-freshman-panel" />
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

export function AwardGrid({ awards, limit = 12 }: { awards: AwardWinner[]; limit?: number }) {
  const list = awards.slice(0, limit);
  if (!list.length) return <p className="muted">Awards appear once games are simulated.</p>;
  return (
    <div className="award-grid">
      {list.map((award) => (
        <article key={`${award.awardName}-${award.playerId}`} className="card">
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

function AwardTeamPanel({ title: panelTitle, awards, testId }: { title: string; awards: AwardWinner[]; testId: string }) {
  return (
    <section className="panel span-2" data-testid={testId}>
      <div className="panel-head compact">
        <h2>{panelTitle}</h2>
        <Medal size={20} />
      </div>
      <HonorGrid awards={awards} limit={16} />
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
        {visibleRows.length ? (
          visibleRows.map((row, index) => (
            <div key={`${row.player.id}-${statKey}`} className="table-row leaderboard-row">
              <span>{(page - 1) * LEADERBOARD_PAGE_SIZE + index + 1}</span>
              <strong>{row.player.name}</strong>
              <span>{row.player.position}</span>
              <span>{row.team.name}</span>
              <span className="selected-stat">{row.value.toLocaleString()}</span>
              <span>{row.player.stats.passYards.toLocaleString()} PYD, {row.player.stats.passTd} PaTD</span>
              <span>{row.player.stats.rushYards.toLocaleString()} RYD, {row.player.stats.rushTd} RuTD</span>
              <span>{row.player.stats.receivingYards.toLocaleString()} REC, {row.player.stats.receivingTd} RecTD</span>
              <span>{row.player.stats.tackles} TKL, {row.player.stats.sacks} SCK, {row.player.stats.interceptions} INT</span>
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

function PlayoffBracket({ games, teams, priorPlayoffTeams, championName }: { games: Game[]; teams: Team[]; priorPlayoffTeams: string[]; championName?: string }) {
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

function HonorGrid({ awards, limit = 16 }: { awards: AwardWinner[]; limit?: number }) {
  const list = awards.slice(0, limit);
  if (!list.length) return <p className="muted">Honor teams appear once season awards are available.</p>;
  return (
    <div className="award-grid honor-grid">
      {list.map((award) => (
        <article key={`${award.playerId}-${award.position}`} className="card">
          <p className="eyebrow">{award.position}</p>
          <h3>{award.playerName}</h3>
          <p>{award.teamName}</p>
          <span>{award.note}</span>
        </article>
      ))}
    </div>
  );
}
