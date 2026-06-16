import { AWARD_NAMES, POSITION_LABELS } from "./names";
import { teamPower } from "./ratings";
import type { AwardWinner, Conference, Game, Player, PlayerStats, Position, SeasonAwards, Team, WeeklyAwards } from "./types";

type PlayerEntry = { team: Team; player: Player };
type AwardEntry = { team: Team; player: Pick<Player, "id" | "name" | "position" | "stats"> };

const OFFENSIVE_PLAYER_POSITIONS: Position[] = ["QB", "HB", "WR", "TE"];
const DEFENSIVE_PLAYER_POSITIONS: Position[] = ["DL", "LB", "CB", "S"];

export function rankTeams(teams: Team[]): Team[] {
  const ranked = [...teams].sort((a, b) => rankingScore(b) - rankingScore(a));
  return ranked.map((team, index) => ({
    ...team,
    season: {
      ...team.season,
      rank: index < 25 ? index + 1 : undefined,
    },
  }));
}

export function selectPlayoffSeeds(teams: Team[], userTeamId: string, forceUser = false): string[] {
  const ranked = rankTeams(teams).slice(0, 16);
  let seeds = ranked.slice(0, 8).map((team) => team.id);
  if (forceUser && !seeds.includes(userTeamId)) {
    seeds = [userTeamId, ...seeds.filter((id) => id !== userTeamId)].slice(0, 8);
  }
  return seeds;
}

export function createWeeklyAwards(teams: Team[], conferences: Conference[], year: number, week: number, games: Game[] = []): WeeklyAwards {
  const candidates = weeklyPlayersWithTeams(games, teams);
  const awardCandidates = candidates.length ? candidates : playersWithTeams(teams);
  const national = [
    winner("National Offensive Player of the Week", topBy(awardCandidates, weeklyOffenseValue, OFFENSIVE_PLAYER_POSITIONS)),
    winner("National Defensive Player of the Week", topBy(awardCandidates, weeklyDefenseValue, DEFENSIVE_PLAYER_POSITIONS)),
    winner("Ground Surge", topBy(awardCandidates, (entry) => entry.player.stats.rushYards + entry.player.stats.rushTd * 75, ["HB"])),
    winner("Sky Route", topBy(awardCandidates, (entry) => entry.player.stats.receivingYards + entry.player.stats.receivingTd * 80, ["WR", "TE"])),
  ].filter(Boolean) as AwardWinner[];

  const conference: Record<string, AwardWinner[]> = {};
  for (const conf of conferences) {
    const confCandidates = awardCandidates.filter((entry) => entry.team.conferenceId === conf.id);
    conference[conf.id] = [
      winner(`${conf.name} Offensive Player of the Week`, topBy(confCandidates, weeklyOffenseValue, OFFENSIVE_PLAYER_POSITIONS)),
      winner(`${conf.name} Defensive Player of the Week`, topBy(confCandidates, weeklyDefenseValue, DEFENSIVE_PLAYER_POSITIONS)),
    ].filter(Boolean) as AwardWinner[];
  }

  return {
    year,
    week,
    national,
    conference,
  };
}

export function createSeasonAwards(teams: Team[], conferences: Conference[], year: number, forceUserTeamId?: string): SeasonAwards {
  const candidates = playersWithTeams(teams);
  const forced = forceUserTeamId ? candidates.find((entry) => entry.team.id === forceUserTeamId && entry.player.position === "QB") : undefined;
  const nationalAwards = [
    winner(AWARD_NAMES.overall, forced ?? topBy(candidates, playerValue, undefined)),
    winner(AWARD_NAMES.qb, topBy(candidates, playerValue, ["QB"])),
    winner(AWARD_NAMES.rb, topBy(candidates, playerValue, ["HB"])),
    winner(AWARD_NAMES.wr, topBy(candidates, playerValue, ["WR", "TE"])),
    winner(AWARD_NAMES.ol, topBy(candidates, playerValue, ["OL"])),
    winner(AWARD_NAMES.dl, topBy(candidates, playerValue, ["DL"])),
    winner(AWARD_NAMES.lb, topBy(candidates, playerValue, ["LB"])),
    winner(AWARD_NAMES.db, topBy(candidates, playerValue, ["CB", "S"])),
    winner(AWARD_NAMES.kicker, topBy(candidates, playerValue, ["K", "P"])),
    winner(AWARD_NAMES.freshman, topBy(candidates.filter((entry) => entry.player.year === "FR"), playerValue, undefined)),
  ].filter(Boolean) as AwardWinner[];

  const allAmericans = {
    first: allTeam(candidates, 1),
    second: allTeam(candidates, 2),
    freshman: allTeam(candidates.filter((entry) => entry.player.year === "FR"), 1),
  };

  const allConference: SeasonAwards["allConference"] = {};
  for (const conf of conferences) {
    const confCandidates = candidates.filter((entry) => entry.team.conferenceId === conf.id);
    allConference[conf.id] = {
      first: allTeam(confCandidates, 1),
      second: allTeam(confCandidates, 2),
      freshman: allTeam(confCandidates.filter((entry) => entry.player.year === "FR"), 1),
    };
  }

  return {
    year,
    nationalAwards,
    allAmericans,
    allConference,
  };
}

export function recruitingClassRankings(teams: Team[], signedCounts: Record<string, number> = {}, limit = 10): { teamId: string; teamName: string; points: number }[] {
  return teams
    .map((team) => ({
      teamId: team.id,
      teamName: team.name,
      points: Math.round(team.program.prestige * 0.7 + team.program.recruitingReach * 0.8 + (signedCounts[team.id] ?? 0) * 3 + teamPower(team.roster) * 0.5),
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

function rankingScore(team: Team): number {
  const games = team.season.wins + team.season.losses;
  const winPct = games ? team.season.wins / games : 0.5;
  const margin = team.season.pointsFor - team.season.pointsAgainst;
  return winPct * 120 + team.season.wins * 7 + margin * 0.08 + teamPower(team.roster) * 0.75 + team.program.prestige * 0.25;
}

function playersWithTeams(teams: Team[]) {
  return teams.flatMap((team) => team.roster.map((player) => ({ team, player })));
}

function weeklyPlayersWithTeams(games: Game[], teams: Team[]): AwardEntry[] {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const byPlayer = new Map<string, AwardEntry>();
  for (const game of games) {
    for (const box of [game.result?.boxScore?.home, game.result?.boxScore?.away]) {
      if (!box) continue;
      const team = teamById.get(box.teamId);
      if (!team) continue;
      for (const line of box.players) {
        const previous = byPlayer.get(line.playerId);
        byPlayer.set(line.playerId, {
          team,
          player: {
            id: line.playerId,
            name: line.playerName,
            position: line.position,
            stats: previous ? addStats(previous.player.stats, line.stats) : { ...line.stats },
          },
        });
      }
    }
  }
  return Array.from(byPlayer.values());
}

function winner(label: string, entry?: AwardEntry): AwardWinner | undefined {
  if (!entry) return undefined;
  return {
    awardName: label,
    playerId: entry.player.id,
    playerName: entry.player.name,
    teamId: entry.team.id,
    teamName: entry.team.name,
    position: entry.player.position,
    note: noteFor(entry.player),
  };
}

function topBy<T extends AwardEntry>(
  entries: T[],
  score: (entry: T) => number,
  positions?: Position[],
): T | undefined {
  return entries
    .filter((entry) => !positions || positions.includes(entry.player.position))
    .sort((a, b) => score(b) - score(a))[0];
}

function allTeam(entries: PlayerEntry[], tier: 1 | 2): AwardWinner[] {
  const groups: Position[][] = [["QB"], ["HB"], ["WR"], ["WR"], ["TE"], ["OL"], ["OL"], ["DL"], ["DL"], ["LB"], ["CB"], ["S"], ["K"]];
  const used = new Set<string>();
  const winners: AwardWinner[] = [];
  for (const positions of groups) {
    const ranked = entries
      .filter((entry) => positions.includes(entry.player.position) && !used.has(entry.player.id))
      .sort((a, b) => playerValue(b) - playerValue(a));
    const entry = ranked[tier - 1] ?? ranked[0];
    if (!entry) continue;
    used.add(entry.player.id);
    const award = winner(POSITION_LABELS[entry.player.position], entry);
    if (award) winners.push(award);
  }
  return winners;
}

function playerValue(entry: { player: Player }): number {
  const stats = entry.player.stats;
  const offense =
    stats.passYards * 0.05 +
    stats.passTd * 24 -
    stats.interceptionsThrown * 18 +
    stats.rushYards * 0.08 +
    stats.rushTd * 18 +
    stats.receivingYards * 0.08 +
    stats.receivingTd * 18 +
    stats.pancakes * 4;
  const defense = stats.tackles * 3 + stats.sacks * 18 + stats.interceptions * 34;
  const special = stats.fieldGoals * 9 + stats.fieldGoalAttempts * 0.5;
  return entry.player.overall * 2.2 + offense + defense + special;
}

function weeklyOffenseValue(entry: AwardEntry): number {
  const stats = entry.player.stats;
  return (
    stats.passYards * 0.09 +
    stats.passTd * 32 -
    stats.interceptionsThrown * 22 +
    stats.rushYards * 0.16 +
    stats.rushTd * 24 +
    stats.receivingYards * 0.17 +
    stats.receivingTd * 26
  );
}

function weeklyDefenseValue(entry: AwardEntry): number {
  const stats = entry.player.stats;
  return stats.tackles * 4 + stats.sacks * 18 + stats.interceptions * 30 + (stats.sacks >= 2 ? 12 : 0) + (stats.interceptions >= 2 ? 24 : 0);
}

function addStats(left: PlayerStats, right: PlayerStats): PlayerStats {
  const total = { ...left };
  for (const key of Object.keys(total) as (keyof PlayerStats)[]) {
    total[key] += right[key];
  }
  return total;
}

function noteFor(player: AwardEntry["player"]): string {
  const stats = player.stats;
  if (player.position === "QB") return `${stats.passYards.toLocaleString()} pass yards, ${stats.passTd} TD`;
  if (player.position === "HB") return `${stats.rushYards.toLocaleString()} rush yards, ${stats.rushTd} TD`;
  if (player.position === "WR" || player.position === "TE") return `${stats.receivingYards.toLocaleString()} receiving yards, ${stats.receivingTd} TD`;
  if (player.position === "OL") return `${stats.pancakes} pancakes`;
  if (player.position === "K" || player.position === "P") return `${stats.fieldGoals}/${stats.fieldGoalAttempts} field goals`;
  return `${stats.tackles} tackles, ${stats.sacks} sacks, ${stats.interceptions} INT`;
}
