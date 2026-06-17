import { teamPower, teamUnitRatings } from "./ratings";
import type { DynastyState, Game, Team } from "./types";

export interface MatchupUnitEdge {
  label: string;
  userValue: number;
  opponentValue: number;
  edge: number;
}

export interface MatchupPreview {
  game: Game;
  userTeam: Team;
  opponent: Team;
  venue: "Home" | "Away" | "Neutral";
  venueLabel: string;
  userPower: number;
  opponentPower: number;
  userRank?: number;
  opponentRank?: number;
  stakes: string[];
  unitEdges: MatchupUnitEdge[];
}

export function buildMatchupPreview(state: DynastyState): MatchupPreview | undefined {
  const userTeam = state.teams.find((team) => team.id === state.userTeamId);
  if (!userTeam) return undefined;
  const games = [...state.schedule, ...(state.playoff?.games ?? [])]
    .filter((game) => !game.played && (game.homeTeamId === userTeam.id || game.awayTeamId === userTeam.id))
    .sort((a, b) => a.week - b.week);
  const game = games[0];
  if (!game) return undefined;
  const opponentId = game.homeTeamId === userTeam.id ? game.awayTeamId : game.homeTeamId;
  const opponent = state.teams.find((team) => team.id === opponentId);
  if (!opponent) return undefined;
  const venue = game.bowlName ? "Neutral" : game.homeTeamId === userTeam.id ? "Home" : "Away";
  const userRank = currentRank(state, userTeam.id);
  const opponentRank = currentRank(state, opponent.id);
  const userUnits = teamUnitRatings(userTeam.roster);
  const opponentUnits = teamUnitRatings(opponent.roster);
  const stakes = [
    game.bowlName ?? (game.conferenceGame ? "Conference game" : "Non-conference game"),
    opponentRank ? `Ranked opponent #${opponentRank}` : undefined,
    userRank ? `User rank #${userRank}` : "Poll statement chance",
    game.week >= 10 ? "Late-season pressure" : undefined,
  ].filter((item): item is string => Boolean(item));

  return {
    game,
    userTeam,
    opponent,
    venue,
    venueLabel: game.bowlName ?? (venue === "Home" ? `${userTeam.city}, ${userTeam.state}` : `${opponent.city}, ${opponent.state}`),
    userPower: teamPower(userTeam.roster),
    opponentPower: teamPower(opponent.roster),
    userRank,
    opponentRank,
    stakes,
    unitEdges: [
      edge("Overall", userUnits.overall, opponentUnits.overall),
      edge("Pass", userUnits.passing, opponentUnits.passing),
      edge("Run", userUnits.rushing, opponentUnits.rushing),
      edge("Targets", userUnits.receiving, opponentUnits.receiving),
      edge("Blocking", userUnits.blocking, opponentUnits.blocking),
      edge("Front", userUnits.defense, opponentUnits.defense),
      edge("Coverage", userUnits.coverage, opponentUnits.coverage),
      edge("Special", userUnits.specialTeams, opponentUnits.specialTeams),
    ],
  };
}

function currentRank(state: DynastyState, teamId: string): number | undefined {
  return state.rankings?.[0]?.allEntries.find((entry) => entry.teamId === teamId)?.rank;
}

function edge(label: string, userValue: number, opponentValue: number): MatchupUnitEdge {
  return {
    label,
    userValue,
    opponentValue,
    edge: Math.round((userValue - opponentValue) * 10) / 10,
  };
}
