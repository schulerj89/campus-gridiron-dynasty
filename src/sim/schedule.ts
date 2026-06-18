import { BOWL_NAMES } from "./names";
import { Rng } from "./rng";
import type { Game, Team } from "./types";

export function createSchedule(rng: Rng, teams: Team[], seasonYear: number): Game[] {
  const schedule: Game[] = [];
  const usedPairs = new Set<string>();
  const conferenceGroups = new Map<string, Team[]>();
  for (const team of teams) {
    const group = conferenceGroups.get(team.conferenceId) ?? [];
    group.push(team);
    conferenceGroups.set(team.conferenceId, group);
  }

  for (let week = 1; week <= 12; week += 1) {
    const weekTeams = week <= 7 ? [...conferenceGroups.values()].flatMap((group) => rng.shuffle(group)) : rng.shuffle(teams);
    const pairings = pairTeams(rng, weekTeams, usedPairs, week <= 7);
    for (const [home, away] of pairings) {
      usedPairs.add(pairKey(home.id, away.id));
      schedule.push({
        id: `game-${seasonYear}-${week}-${home.id}-${away.id}`,
        week,
        homeTeamId: home.id,
        awayTeamId: away.id,
        conferenceGame: home.conferenceId === away.conferenceId,
        played: false,
      });
    }
  }

  return schedule;
}

export function createPlayoffGames(year: number, seeds: string[]): Game[] {
  const quarterBowls = [BOWL_NAMES[0], BOWL_NAMES[1], BOWL_NAMES[2], BOWL_NAMES[3]];
  return [
    playoffGame(year, "q1", 13, seeds[0]!, seeds[7]!, "quarter", quarterBowls[0]!),
    playoffGame(year, "q2", 13, seeds[3]!, seeds[4]!, "quarter", quarterBowls[1]!),
    playoffGame(year, "q3", 13, seeds[1]!, seeds[6]!, "quarter", quarterBowls[2]!),
    playoffGame(year, "q4", 13, seeds[2]!, seeds[5]!, "quarter", quarterBowls[3]!),
  ];
}

export function createNextPlayoffRound(year: number, round: "semi" | "final", winners: string[]): Game[] {
  if (round === "semi") {
    return [
      playoffGame(year, "s1", 14, winners[0]!, winners[1]!, "semi", "Summit Bowl"),
      playoffGame(year, "s2", 14, winners[2]!, winners[3]!, "semi", "Foundry Bowl"),
    ];
  }
  return [playoffGame(year, "f1", 15, winners[0]!, winners[1]!, "final", "Crown Bowl")];
}

function pairTeams(rng: Rng, teams: Team[], usedPairs: Set<string>, conferencePreferred: boolean): [Team, Team][] {
  let bestPairings: [Team, Team][] = [];
  let bestRepeatCount = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const remaining = rng.shuffle(teams);
    const pairings: [Team, Team][] = [];
    let repeatCount = 0;

    while (remaining.length > 1) {
      const home = mostConstrainedTeam(remaining, usedPairs, conferencePreferred);
      removeRemainingTeam(remaining, home.id);
      const candidates = remaining.filter((candidate) => (conferencePreferred ? candidate.conferenceId === home.conferenceId : true));
      const uniqueCandidates = candidates.filter((candidate) => !usedPairs.has(pairKey(home.id, candidate.id)));
      const uniqueFallback = remaining.filter((candidate) => !usedPairs.has(pairKey(home.id, candidate.id)));
      const pool = uniqueCandidates.length ? uniqueCandidates : uniqueFallback.length ? uniqueFallback : candidates.length ? candidates : remaining;
      const away = pool.length ? rng.pick(pool) : undefined;
      if (!away) break;
      if (usedPairs.has(pairKey(home.id, away.id))) repeatCount += 1;
      removeRemainingTeam(remaining, away.id);
      pairings.push(rng.chance(0.5) ? [home, away] : [away, home]);
    }

    if (pairings.length === Math.floor(teams.length / 2) && repeatCount === 0) return pairings;
    if (pairings.length > bestPairings.length || (pairings.length === bestPairings.length && repeatCount < bestRepeatCount)) {
      bestPairings = pairings;
      bestRepeatCount = repeatCount;
    }
  }

  return bestPairings;
}

function mostConstrainedTeam(teams: Team[], usedPairs: Set<string>, conferencePreferred: boolean): Team {
  return [...teams].sort((a, b) => uniqueOpponentCount(a, teams, usedPairs, conferencePreferred) - uniqueOpponentCount(b, teams, usedPairs, conferencePreferred))[0]!;
}

function uniqueOpponentCount(team: Team, teams: Team[], usedPairs: Set<string>, conferencePreferred: boolean): number {
  const preferred = teams.filter((candidate) => candidate.id !== team.id && (!conferencePreferred || candidate.conferenceId === team.conferenceId) && !usedPairs.has(pairKey(team.id, candidate.id))).length;
  if (preferred > 0) return preferred;
  return teams.filter((candidate) => candidate.id !== team.id && !usedPairs.has(pairKey(team.id, candidate.id))).length;
}

function removeRemainingTeam(teams: Team[], teamId: string): void {
  const index = teams.findIndex((team) => team.id === teamId);
  if (index >= 0) teams.splice(index, 1);
}

function pairKey(teamA: string, teamB: string): string {
  return [teamA, teamB].sort().join("-");
}

function playoffGame(
  year: number,
  suffix: string,
  week: number,
  homeTeamId: string,
  awayTeamId: string,
  playoffRound: "quarter" | "semi" | "final",
  bowlName: string,
): Game {
  return {
    id: `playoff-${year}-${suffix}`,
    week,
    homeTeamId,
    awayTeamId,
    conferenceGame: false,
    played: false,
    playoffRound,
    bowlName,
  };
}
