import type { KeyboardEvent } from "react";
import clsx from "clsx";
import { Award, Medal, Trophy } from "lucide-react";
import { createSeasonAwardCandidateBoards, createSeasonAwards, SEASON_AWARD_DEFINITIONS, type SeasonAwardCandidateBoard, type SeasonAwardKey } from "../sim/awards";
import { getUserTeam } from "../sim/dynasty";
import type { AwardWinner, DynastyState, Game, Player, Team } from "../sim/types";

const AWARD_KEY_BY_NAME = new Map(SEASON_AWARD_DEFINITIONS.map((definition) => [definition.awardName, definition.key]));

export function Awards({ state, onOpenPlayer }: { state: DynastyState; onOpenPlayer?: (player: Player) => void }) {
  const userTeam = getUserTeam(state);
  const userConference = state.conferences.find((conference) => conference.id === userTeam.conferenceId);
  const conferenceAwards = userConference && state.seasonAwards ? state.seasonAwards.allConference[userConference.id] : undefined;
  const playerById = new Map(state.teams.flatMap((team) => team.roster.map((player) => [player.id, player] as const)));
  const playoffGames = state.playoff?.games ?? [];
  const latestHistory = state.history[0];
  const latestWeeklyAwards = state.weeklyAwards[0]?.national ?? [];
  const latestConferenceWeeklyAwards = userConference ? state.weeklyAwards[0]?.conference[userConference.id] ?? [] : [];
  const seasonAwardWatch = !state.seasonAwards && state.phase === "regular" && state.week >= 8 ? createSeasonAwards(state.teams, state.conferences, state.calendarYear).nationalAwards : undefined;
  const awardSource = state.seasonAwards?.nationalAwards ?? seasonAwardWatch ?? (state.phase === "regular" ? [] : latestHistory?.awardWinners ?? []);
  const seasonAwardsTitle = state.seasonAwards ? "Season Awards" : seasonAwardWatch ? "Season Award Watch" : state.phase !== "regular" && awardSource.length ? "Latest Season Awards" : "Season Award Watch Opens Week 8";
  const seasonAwardCandidateBoards = state.week >= 8 || state.seasonAwards ? createSeasonAwardCandidateBoards(state.teams) : [];
  const showSeasonAwardCandidates = Boolean(state.seasonAwards || seasonAwardWatch);
  const currentChampionName = state.playoff?.championTeamId ? state.teams.find((team) => team.id === state.playoff?.championTeamId)?.name : undefined;
  const bracketChampionName = state.playoff ? currentChampionName : latestHistory?.championName;
  const priorPlayoffTeams = latestHistory?.playoffTeams.map((id) => state.teams.find((team) => team.id === id)?.name ?? id) ?? [];
  return (
    <>
      <section className="panel span-2" data-testid="player-of-week-panel">
        <div className="panel-head compact">
          <h2>National Players of the Week</h2>
          <Award size={20} />
        </div>
        <AwardGrid awards={latestWeeklyAwards} limit={2} userTeamId={state.userTeamId} playerById={playerById} onOpenPlayer={onOpenPlayer} />
      </section>
      <section className="panel span-2" data-testid="conference-player-of-week-panel">
        <div className="panel-head compact">
          <h2>{userConference?.name ?? "Conference"} Players of the Week</h2>
          <Medal size={20} />
        </div>
        <AwardGrid awards={latestConferenceWeeklyAwards.slice(0, 2)} userTeamId={state.userTeamId} playerById={playerById} onOpenPlayer={onOpenPlayer} />
      </section>
      <section className="panel span-2" data-testid="awards-panel">
        <div className="panel-head compact">
          <h2>{seasonAwardsTitle}</h2>
          <Award size={20} />
        </div>
        {state.week >= 8 || state.seasonAwards || state.phase !== "regular" ? (
          <SeasonAwardShowcase awards={awardSource} candidateBoards={seasonAwardCandidateBoards} showCandidates={showSeasonAwardCandidates} userTeamId={state.userTeamId} playerById={playerById} onOpenPlayer={onOpenPlayer} />
        ) : (
          <p className="muted">Season award tracking unlocks after Week 8.</p>
        )}
      </section>
      {state.seasonAwards && (
        <>
          <AwardTeamPanel title="All-American First Team" awards={state.seasonAwards.allAmericans.first} testId="all-american-first-panel" userTeamId={state.userTeamId} playerById={playerById} onOpenPlayer={onOpenPlayer} />
          <AwardTeamPanel title="All-American Second Team" awards={state.seasonAwards.allAmericans.second} testId="all-american-second-panel" userTeamId={state.userTeamId} playerById={playerById} onOpenPlayer={onOpenPlayer} />
          <AwardTeamPanel title="Freshman All-American" awards={state.seasonAwards.allAmericans.freshman} testId="all-american-freshman-panel" userTeamId={state.userTeamId} playerById={playerById} onOpenPlayer={onOpenPlayer} />
        </>
      )}
      {conferenceAwards && (
        <>
          <AwardTeamPanel title={`${userConference?.name ?? "Conference"} First Team`} awards={conferenceAwards.first} testId="all-conference-first-panel" userTeamId={state.userTeamId} playerById={playerById} onOpenPlayer={onOpenPlayer} />
          <AwardTeamPanel title={`${userConference?.name ?? "Conference"} Second Team`} awards={conferenceAwards.second} testId="all-conference-second-panel" userTeamId={state.userTeamId} playerById={playerById} onOpenPlayer={onOpenPlayer} />
          <AwardTeamPanel title={`${userConference?.name ?? "Conference"} Freshman Team`} awards={conferenceAwards.freshman} testId="all-conference-freshman-panel" userTeamId={state.userTeamId} playerById={playerById} onOpenPlayer={onOpenPlayer} />
        </>
      )}
      <section className="panel span-2" data-testid="playoff-panel">
        <div className="panel-head compact">
          <h2>{state.playoff ? "Summit Four Playoff" : "Latest Playoff Field"}</h2>
          <Trophy size={20} />
        </div>
        <PlayoffBracket games={playoffGames} teams={state.teams} priorPlayoffTeams={priorPlayoffTeams} championName={bracketChampionName} />
      </section>
    </>
  );
}

export function AwardGrid({
  awards,
  limit = 12,
  userTeamId,
  playerById,
  onOpenPlayer,
}: {
  awards: AwardWinner[];
  limit?: number;
  userTeamId?: string;
  playerById?: Map<string, Player>;
  onOpenPlayer?: (player: Player) => void;
}) {
  const list = awards.slice(0, limit);
  if (!list.length) return <p className="muted">Awards appear once games are simulated.</p>;
  return (
    <div className="award-grid">
      {list.map((award) => {
        const player = playerById?.get(award.playerId);
        return (
          <article
            key={`${award.awardName}-${award.playerId}`}
            className={clsx("card", player && onOpenPlayer && "clickable-card", award.teamId === userTeamId && "user-team-highlight")}
            data-testid={award.teamId === userTeamId ? "user-team-award-card" : undefined}
            {...playerOpenProps(player, onOpenPlayer, `Open ${award.playerName} player card`)}
          >
            <p className="eyebrow">{award.awardName}</p>
            <h3>{award.playerName}</h3>
            <p>
              {award.teamName} - {award.position}
            </p>
            <span>{award.note}</span>
          </article>
        );
      })}
    </div>
  );
}

function SeasonAwardShowcase({
  awards,
  candidateBoards,
  showCandidates,
  userTeamId,
  playerById,
  onOpenPlayer,
}: {
  awards: AwardWinner[];
  candidateBoards: SeasonAwardCandidateBoard[];
  showCandidates: boolean;
  userTeamId: string;
  playerById: Map<string, Player>;
  onOpenPlayer?: (player: Player) => void;
}) {
  if (!awards.length) return <p className="muted">Season award tracking unlocks after Week 8.</p>;

  const boardsByName = new Map(candidateBoards.map((board) => [board.awardName, board]));

  return (
    <div className="season-award-showcase" data-testid="season-award-showcase">
      {awards.map((award) => {
        const key = awardKeyForName(award.awardName);
        const board = boardsByName.get(award.awardName);
        const winner = playerById.get(award.playerId);
        return (
          <article
            key={`${award.awardName}-${award.playerId}`}
            className={clsx("season-award-card", award.teamId === userTeamId && "user-team-highlight")}
            data-testid={award.teamId === userTeamId ? "user-team-award-card" : "season-award-card"}
          >
            <div className={clsx("season-award-main", winner && onOpenPlayer && "clickable-award-main")} {...playerOpenProps(winner, onOpenPlayer, `Open ${award.playerName} player card`)}>
              <div className="award-statue-frame">
                <img src={`/assets/award-statues/${key}.png`} alt={`${award.awardName} bronze statue`} data-testid="award-statue-image" />
              </div>
              <div className="season-award-winner">
                <p className="eyebrow">{award.awardName}</p>
                <h3>{award.playerName}</h3>
                <p>
                  {award.teamName} - {award.position}
                </p>
                <span>{award.note}</span>
              </div>
            </div>
            {showCandidates && board?.candidates.length ? (
              <div className="award-candidate-list" data-testid="award-candidate-list" aria-label={`${award.awardName} top 8 candidates`}>
                <div className="candidate-list-head">
                  <strong>Top 8 Candidates</strong>
                  <span>Score</span>
                </div>
                {board.candidates.map((candidate) => (
                  <div
                    key={`${award.awardName}-${candidate.playerId}`}
                    className={clsx("award-candidate-row", playerById.get(candidate.playerId) && onOpenPlayer && "clickable-award-row", candidate.teamId === userTeamId && "user-team-highlight")}
                    {...playerOpenProps(playerById.get(candidate.playerId), onOpenPlayer, `Open ${candidate.playerName} player card`)}
                  >
                    <span className="candidate-rank">#{candidate.rank}</span>
                    <div>
                      <strong>{candidate.playerName}</strong>
                      <span>
                        {candidate.teamName} - {candidate.position} - {candidate.year} - {candidate.overall} OVR
                      </span>
                    </div>
                    <em>{candidate.score.toLocaleString()}</em>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted compact-note">Candidate boards are available for the active award watch and current season awards.</p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function awardKeyForName(awardName: string): SeasonAwardKey {
  return AWARD_KEY_BY_NAME.get(awardName) ?? "overall";
}

function AwardTeamPanel({
  title: panelTitle,
  awards,
  testId,
  userTeamId,
  playerById,
  onOpenPlayer,
}: {
  title: string;
  awards: AwardWinner[];
  testId: string;
  userTeamId: string;
  playerById: Map<string, Player>;
  onOpenPlayer?: (player: Player) => void;
}) {
  return (
    <section className="panel span-2" data-testid={testId}>
      <div className="panel-head compact">
        <h2>{panelTitle}</h2>
        <Medal size={20} />
      </div>
      <HonorGrid awards={awards} limit={16} userTeamId={userTeamId} playerById={playerById} onOpenPlayer={onOpenPlayer} />
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
          {championName && round.label === "Crown Bowl" && (
            <div className="playoff-champion-banner" data-testid="playoff-champion-banner">
              <Trophy size={18} />
              <div>
                <span>Crown Bowl Champion</span>
                <strong>{championName}</strong>
              </div>
            </div>
          )}
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

function HonorGrid({ awards, limit = 16, userTeamId, playerById, onOpenPlayer }: { awards: AwardWinner[]; limit?: number; userTeamId?: string; playerById: Map<string, Player>; onOpenPlayer?: (player: Player) => void }) {
  const list = awards.slice(0, limit);
  if (!list.length) return <p className="muted">Honor teams appear once season awards are available.</p>;
  return (
    <div className="award-grid honor-grid">
      {list.map((award) => {
        const player = playerById.get(award.playerId);
        return (
          <article
            key={`${award.playerId}-${award.position}`}
            className={clsx("card", player && onOpenPlayer && "clickable-card", award.teamId === userTeamId && "user-team-highlight")}
            data-testid={award.teamId === userTeamId ? "user-team-honor-card" : undefined}
            {...playerOpenProps(player, onOpenPlayer, `Open ${award.playerName} player card`)}
          >
            <p className="eyebrow">{award.position}</p>
            <h3>{award.playerName}</h3>
            <p>{award.teamName}</p>
            <span>{award.note}</span>
          </article>
        );
      })}
    </div>
  );
}

function playerOpenProps(player: Player | undefined, onOpenPlayer: ((player: Player) => void) | undefined, ariaLabel: string) {
  if (!player || !onOpenPlayer) return {};
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": ariaLabel,
    onClick: () => onOpenPlayer(player),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onOpenPlayer(player);
    },
  };
}
