import { Trophy } from "lucide-react";
import type { DynastyState, Game, Team } from "../sim/types";
import { PlayoffBracket } from "./AwardsView";

type PlayoffBracketRound = NonNullable<Game["playoffRound"]>;

export function PlayoffCenter({ state }: { state: DynastyState }) {
  const games = state.playoff?.games ?? [];
  const championName = state.teams.find((team) => team.id === state.playoff?.championTeamId)?.name;

  return (
    <section className="panel span-2" data-testid="playoff-center-panel">
      <div className="panel-head compact">
        <h2>Playoff Center</h2>
        <Trophy size={20} />
      </div>
      {state.playoff ? (
        <PlayoffCenterRounds games={games} teams={state.teams} championName={championName} />
      ) : (
        <p className="muted">Playoff field forms once the regular season concludes.</p>
      )}
    </section>
  );
}

function PlayoffCenterRounds({
  games,
  teams,
  championName,
}: {
  games: Game[];
  teams: Team[];
  championName?: string;
}) {
  const rounds: { key: PlayoffBracketRound; label: string }[] = [
    { key: "quarter", label: "Quarterfinals" },
    { key: "semi", label: "Semifinals" },
    { key: "final", label: "Crown Bowl" },
  ];

  return (
    <div className="playoff-round-accordion" data-testid="playoff-center-rounds">
      {rounds.map((round, index) => {
        const roundGames = games.filter((game) => game.playoffRound === round.key);
        const playedGames = roundGames.filter((game) => Boolean(game.result)).length;
        const totalGames = roundGames.length;
        const headerCopy = totalGames ? `${playedGames}/${totalGames} games complete` : "Pending prior round";
        const hasGames = totalGames > 0;
        return (
          <details key={round.key} className="playoff-round-details" open={index === 0 || hasGames} data-round={round.key}>
            <summary>
              <span>{round.label}</span>
              <strong>{hasGames ? headerCopy : "Pending"} </strong>
            </summary>
            {hasGames ? (
              <PlayoffBracket games={games} teams={teams} priorPlayoffTeams={[]} championName={championName} activeRound={round.key} />
            ) : (
              <p className="muted">Bracket will appear after prior rounds complete.</p>
            )}
          </details>
        );
      })}
    </div>
  );
}
