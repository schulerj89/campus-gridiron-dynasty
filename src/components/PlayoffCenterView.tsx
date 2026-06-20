import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import type { DynastyState, Game, Team } from "../sim/types";
import { PlayoffBracket } from "./AwardsView";

type PlayoffBracketRound = NonNullable<Game["playoffRound"]>;

type PlayoffRoundSpec = {
  key: PlayoffBracketRound;
  label: string;
};

const PLAYOFF_ROUNDS: PlayoffRoundSpec[] = [
  { key: "quarter", label: "Quarterfinals" },
  { key: "semi", label: "Semifinals" },
  { key: "final", label: "Crown Bowl" },
];

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

export function PlayoffCenter({ state }: { state: DynastyState }) {
  const games = state.playoff?.games ?? [];
  const championName = state.teams.find((team) => team.id === state.playoff?.championTeamId)?.name;
  const isMobile = useCompactMobile();

  return (
    <section className="panel span-2" data-testid="playoff-center-panel">
      <div className="panel-head compact">
        <h2>Playoff Center</h2>
        <Trophy size={20} />
      </div>
      {state.playoff ? (
        <PlayoffCenterRounds games={games} teams={state.teams} championName={championName} isMobile={isMobile} />
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
  isMobile,
}: {
  games: Game[];
  teams: Team[];
  championName?: string;
  isMobile: boolean;
}) {
  const roundStates = useMemo(
    () =>
      PLAYOFF_ROUNDS.map((round) => {
        const roundGames = games.filter((game) => game.playoffRound === round.key);
        const playedGames = roundGames.filter((game) => Boolean(game.result)).length;
        const totalGames = roundGames.length;
        const headerCopy = totalGames ? `${playedGames}/${totalGames} games complete` : "Pending prior round";
        return { ...round, playedGames, totalGames, headerCopy };
      }),
    [games]
  );

  const defaultRound = useMemo<PlayoffBracketRound>(() => {
    const activeRound = roundStates.find((round) => round.totalGames && round.playedGames < round.totalGames);
    if (activeRound) return activeRound.key;
    const lastComplete = [...roundStates].reverse().find((round) => round.totalGames > 0 && round.playedGames === round.totalGames);
    return lastComplete?.key ?? "quarter";
  }, [roundStates]);

  const [mobileRound, setMobileRound] = useState<PlayoffBracketRound>(defaultRound);
  useEffect(() => {
    setMobileRound((current) => (roundStates.some((round) => round.key === current) ? current : defaultRound));
  }, [roundStates, defaultRound]);

  if (isMobile) {
    const activeRound = roundStates.find((round) => round.key === mobileRound) ?? roundStates[0];
    return (
      <div className="playoff-mobile-rounds" data-testid="playoff-center-rounds">
        <div className="playoff-round-control">
          <label htmlFor="playoff-round-select">Playoff Round</label>
          <select id="playoff-round-select" value={mobileRound} onChange={(event) => setMobileRound(event.target.value as PlayoffBracketRound)}>
            {roundStates.map((round) => (
              <option key={round.key} value={round.key}>
                {round.label} - {round.headerCopy}
              </option>
            ))}
          </select>
        </div>
        {activeRound ? <p className="playoff-round-summary">{activeRound.headerCopy}</p> : null}
        <PlayoffBracket games={games} teams={teams} priorPlayoffTeams={[]} championName={championName} activeRound={mobileRound} />
      </div>
    );
  }

  return (
    <div className="playoff-round-accordion" data-testid="playoff-center-rounds">
      {roundStates.map((round, index) => {
        return (
          <details
            key={round.key}
            className="playoff-round-details"
            open={index === 0 || round.totalGames > 0}
            data-round={round.key}
          >
            <summary>
              <span>{round.label}</span>
              <strong>{round.totalGames ? `${round.playedGames}/${round.totalGames} games complete` : "Pending"} </strong>
            </summary>
            {round.totalGames > 0 ? (
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
