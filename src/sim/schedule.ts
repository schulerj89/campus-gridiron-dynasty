import { BOWL_NAMES } from "./names";
import { Rng } from "./rng";
import type { Game, Team } from "./types";

export function createSchedule(rng: Rng, teams: Team[], seasonYear: number): Game[] {
  const schedule: Game[] = [];
  const conferenceGroups = new Map<string, Team[]>();
  for (const team of teams) {
    const group = conferenceGroups.get(team.conferenceId) ?? [];
    group.push(team);
    conferenceGroups.set(team.conferenceId, group);
  }

  for (let week = 1; week <= 12; week += 1) {
    const used = new Set<string>();
    const weekTeams = week <= 7 ? [...conferenceGroups.values()].flatMap((group) => rng.shuffle(group)) : rng.shuffle(teams);
    const pairings = pairTeams(rng, weekTeams, used, week <= 7);
    for (const [home, away] of pairings) {
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

function pairTeams(rng: Rng, teams: Team[], used: Set<string>, conferencePreferred: boolean): [Team, Team][] {
  const pairings: [Team, Team][] = [];
  for (const home of teams) {
    if (used.has(home.id)) continue;
    const candidates = teams.filter((candidate) => {
      if (candidate.id === home.id || used.has(candidate.id)) return false;
      return !conferencePreferred || candidate.conferenceId === home.conferenceId;
    });
    const fallback = teams.filter((candidate) => candidate.id !== home.id && !used.has(candidate.id));
    const away = candidates.length ? rng.pick(candidates) : fallback.length ? rng.pick(fallback) : undefined;
    if (!away) continue;
    used.add(home.id);
    used.add(away.id);
    pairings.push(rng.chance(0.5) ? [home, away] : [away, home]);
  }
  return pairings;
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
