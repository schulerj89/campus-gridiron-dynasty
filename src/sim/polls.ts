import { rankTeams } from "./awards";
import { clamp } from "./rng";
import type { Phase, PollEntry, PollSnapshot, Team } from "./types";

const POLL_SIZE = 25;
const FIRST_PLACE_VOTES = 62;

export function createPollSnapshot(teams: Team[], year: number, week: number, phase: Phase, previous?: PollSnapshot): { teams: Team[]; poll: PollSnapshot } {
  const rankedTeams = rankTeams(teams);
  const topTeams = rankedTeams.slice(0, POLL_SIZE);
  const previousRankByTeam = new Map(previous?.entries.map((entry) => [entry.teamId, entry.rank]) ?? []);
  const currentTeamIds = new Set(topTeams.map((team) => team.id));
  const firstPlaceVotes = distributeFirstPlaceVotes(topTeams, year, week, phase);
  let previousVotes = Number.POSITIVE_INFINITY;
  const entries = topTeams.map((team, index): PollEntry => {
    const rank = index + 1;
    const priorRank = previousRankByTeam.get(team.id);
    const rawVotes = pollVotesFor(team, rank, firstPlaceVotes.get(team.id) ?? 0, year, week, phase);
    const votes = Math.min(rawVotes, previousVotes - 1);
    previousVotes = votes;
    return {
      teamId: team.id,
      teamName: team.name,
      conferenceId: team.conferenceId,
      rank,
      previousRank: priorRank,
      movement: priorRank ? priorRank - rank : 0,
      votes,
      firstPlaceVotes: firstPlaceVotes.get(team.id) ?? 0,
      wins: team.season.wins,
      losses: team.season.losses,
    };
  });

  const movedIn = previous ? entries.filter((entry) => !previousRankByTeam.has(entry.teamId)) : [];
  const movedOut = previous ? previous.entries.filter((entry) => !currentTeamIds.has(entry.teamId)) : [];

  return {
    teams: rankedTeams,
    poll: {
      year,
      week,
      phase,
      entries,
      movedIn,
      movedOut,
    },
  };
}

function pollVotesFor(team: Team, rank: number, firstPlaceVotes: number, year: number, week: number, phase: Phase): number {
  const games = team.season.wins + team.season.losses;
  const winPct = games ? team.season.wins / games : 0.55;
  const margin = team.season.pointsFor - team.season.pointsAgainst;
  const baseline = (POLL_SIZE + 1 - rank) * 57;
  const recordBonus = winPct * 72 + team.season.wins * 5 - team.season.losses * 12;
  const marginBonus = clamp(Math.round(margin * 0.05), -28, 44);
  const phaseBonus = phase === "postseason" || phase === "offseason" ? 18 : 0;
  const noise = seededNoise(`${team.id}-${year}-${week}-${phase}`, -17, 18);
  return clamp(Math.round(baseline + firstPlaceVotes * 5 + recordBonus + marginBonus + phaseBonus + noise), 1, POLL_SIZE * FIRST_PLACE_VOTES);
}

function distributeFirstPlaceVotes(teams: Team[], year: number, week: number, phase: Phase): Map<string, number> {
  const contenders = teams.slice(0, 8).map((team, index) => {
    const rank = index + 1;
    const games = team.season.wins + team.season.losses;
    const winPct = games ? team.season.wins / games : 0.55;
    const noise = seededNoise(`${team.id}-${year}-${week}-${phase}-fpv`, 0, 16);
    return {
      team,
      weight: Math.max(1, (9 - rank) ** 2 + winPct * 22 + team.season.wins * 1.5 - team.season.losses * 2 + noise),
    };
  });
  const totalWeight = contenders.reduce((sum, entry) => sum + entry.weight, 0);
  const votes = new Map<string, number>();
  let assigned = 0;
  const fractions: { teamId: string; fraction: number }[] = [];
  for (const entry of contenders) {
    const exact = (entry.weight / totalWeight) * FIRST_PLACE_VOTES;
    const value = Math.floor(exact);
    votes.set(entry.team.id, value);
    assigned += value;
    fractions.push({ teamId: entry.team.id, fraction: exact - value });
  }
  fractions.sort((a, b) => b.fraction - a.fraction);
  for (let index = 0; assigned < FIRST_PLACE_VOTES; index += 1) {
    const target = fractions[index % fractions.length]!;
    votes.set(target.teamId, (votes.get(target.teamId) ?? 0) + 1);
    assigned += 1;
  }
  return votes;
}

function seededNoise(seed: string, min: number, max: number): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = (hash >>> 0) / 4294967295;
  return Math.round(min + normalized * (max - min));
}
