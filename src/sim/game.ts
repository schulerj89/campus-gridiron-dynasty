import { Rng, clamp } from "./rng";
import { teamPower, teamUnitRatings } from "./ratings";
import { emptyStats, type Game, type Player, type PlayerGameStats, type PlayerStats, type Team, type TeamBoxScore } from "./types";

export function simulateGame(rng: Rng, game: Game, teams: Team[]): { game: Game; teams: Team[] } {
  const home = teams.find((team) => team.id === game.homeTeamId);
  const away = teams.find((team) => team.id === game.awayTeamId);
  if (!home || !away) return { game, teams };

  const homePower = teamPower(home.roster) + home.program.fanSupport * 0.04 + coachTactics(home) * 0.03 + 1.8;
  const awayPower = teamPower(away.roster) + away.program.fanSupport * 0.02 + coachTactics(away) * 0.03;
  const homeUnits = teamUnitRatings(home.roster);
  const awayUnits = teamUnitRatings(away.roster);
  const homeExpected = 23 + (homePower - awayPower) * 0.55 + (homeUnits.passing + homeUnits.rushing - awayUnits.defense - awayUnits.coverage) * 0.08;
  const awayExpected = 22 + (awayPower - homePower) * 0.55 + (awayUnits.passing + awayUnits.rushing - homeUnits.defense - homeUnits.coverage) * 0.08;
  let homeScore = clamp(Math.round(homeExpected + rng.nextInt(-11, 17)), 3, 63);
  let awayScore = clamp(Math.round(awayExpected + rng.nextInt(-11, 17)), 3, 63);
  if (homeScore === awayScore) {
    if (rng.chance(homePower / (homePower + awayPower))) homeScore += 3;
    else awayScore += 3;
  }

  const homeWon = homeScore > awayScore;
  const updatedHome = updateTeamAfterGame(rng, home, away, homeScore, awayScore, homeWon, game.conferenceGame);
  const updatedAway = updateTeamAfterGame(rng, away, home, awayScore, homeScore, !homeWon, game.conferenceGame);
  const updatedTeams = teams.map((team) => {
    if (team.id === home.id) return updatedHome;
    if (team.id === away.id) return updatedAway;
    return team;
  });

  return {
    game: {
      ...game,
      played: true,
      result: {
        homeScore,
        awayScore,
        winnerTeamId: homeWon ? home.id : away.id,
        summary: `${home.name} ${homeScore}, ${away.name} ${awayScore}`,
        boxScore: {
          home: buildTeamBoxScore(home, updatedHome, homeScore),
          away: buildTeamBoxScore(away, updatedAway, awayScore),
        },
      },
    },
    teams: updatedTeams,
  };
}

export function resetSeasonStats(teams: Team[]): Team[] {
  return teams.map((team) => ({
    ...team,
    season: {
      wins: 0,
      losses: 0,
      confWins: 0,
      confLosses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      streak: 0,
      rank: undefined,
    },
    roster: team.roster.map((player) => ({
      ...player,
      stats: {
        games: 0,
        passYards: 0,
        passTd: 0,
        interceptionsThrown: 0,
        rushYards: 0,
        rushTd: 0,
        receivingYards: 0,
        receivingTd: 0,
        tackles: 0,
        sacks: 0,
        interceptions: 0,
        pancakes: 0,
        fieldGoals: 0,
        fieldGoalAttempts: 0,
      },
      awards: [],
    })),
  }));
}

function updateTeamAfterGame(rng: Rng, team: Team, opponent: Team, pointsFor: number, pointsAgainst: number, won: boolean, conferenceGame: boolean): Team {
  const roster = applyPlayerStats(rng, team.roster, opponent, pointsFor, pointsAgainst, won);
  const wins = team.season.wins + (won ? 1 : 0);
  const losses = team.season.losses + (won ? 0 : 1);
  return {
    ...team,
    roster,
    season: {
      ...team.season,
      wins,
      losses,
      confWins: team.season.confWins + (won && conferenceGame ? 1 : 0),
      confLosses: team.season.confLosses + (!won && conferenceGame ? 1 : 0),
      pointsFor: team.season.pointsFor + pointsFor,
      pointsAgainst: team.season.pointsAgainst + pointsAgainst,
      streak: won ? Math.max(1, team.season.streak + 1) : Math.min(-1, team.season.streak - 1),
    },
  };
}

function applyPlayerStats(rng: Rng, roster: Player[], opponent: Team, pointsFor: number, pointsAgainst: number, won: boolean): Player[] {
  const units = teamUnitRatings(roster);
  const opponentUnits = teamUnitRatings(opponent.roster);
  const qb = topAt(roster, ["QB"], 1)[0];
  const backs = topAt(roster, ["HB"], 3);
  const targets = topAt(roster, ["WR", "TE"], 5);
  const blockers = topAt(roster, ["OL", "TE"], 5);
  const defenders = topAt(roster, ["DL", "LB", "CB", "S"], 9);
  const kicker = topAt(roster, ["K"], 1)[0];
  const passYards = clamp(Math.round(175 + (units.passing + units.receiving - opponentUnits.coverage) * 2.2 + rng.nextInt(-55, 95)), 65, 520);
  const rushYards = clamp(Math.round(110 + (units.rushing + units.blocking - opponentUnits.defense) * 1.8 + rng.nextInt(-45, 85)), 20, 390);
  const passTd = clamp(Math.round(pointsFor / 14 + rng.nextInt(-1, 2)), 0, 6);
  const rushTd = clamp(Math.round(pointsFor / 21 + rng.nextInt(-1, 2)), 0, 5);
  const picks = clamp(Math.round((opponentUnits.coverage - units.passing) / 18 + rng.nextInt(0, 2)), 0, 4);
  const updated = roster.map((player) => ({ ...player, stats: { ...player.stats, games: player.stats.games + 1 } }));

  mutatePlayer(updated, qb?.id, (player) => {
    player.stats.passYards += passYards;
    player.stats.passTd += passTd;
    player.stats.interceptionsThrown += picks;
    player.stats.rushYards += rng.nextInt(0, Math.max(8, Math.round(player.attributes.speed * 0.5)));
  });
  distribute(updated, backs, rushYards, (player, value) => {
    player.stats.rushYards += value;
    player.stats.rushTd += rng.chance(value / Math.max(1, rushYards)) ? Math.min(rushTd, 2) : 0;
  });
  distribute(updated, targets, passYards, (player, value) => {
    player.stats.receivingYards += value;
    player.stats.receivingTd += rng.chance(value / Math.max(1, passYards)) ? Math.min(passTd, 2) : 0;
  });
  distribute(updated, blockers, Math.round(pointsFor + rushYards / 10), (player, value) => {
    player.stats.pancakes += Math.round(value / 18);
  });
  distribute(updated, defenders, clamp(72 - Math.round(pointsAgainst * 0.45), 35, 85), (player, value) => {
    player.stats.tackles += Math.max(1, Math.round(value / 5));
    player.stats.sacks += rng.chance(player.position === "DL" || player.position === "LB" ? 0.18 : 0.04) ? 1 : 0;
    player.stats.interceptions += rng.chance(player.position === "CB" || player.position === "S" ? 0.11 : 0.03) ? 1 : 0;
  });
  mutatePlayer(updated, kicker?.id, (player) => {
    const attempts = clamp(Math.round(pointsFor / 16 + rng.nextInt(0, 2)), 0, 5);
    player.stats.fieldGoalAttempts += attempts;
    player.stats.fieldGoals += clamp(attempts - (rng.chance(player.attributes.kickAccuracy / 120) ? 0 : 1), 0, attempts);
  });

  if (won && qb) {
    mutatePlayer(updated, qb.id, (player) => {
      player.stats.rushTd += rng.chance(0.15) ? 1 : 0;
    });
  }

  return updated;
}

function topAt(roster: Player[], positions: string[], count: number): Player[] {
  return roster
    .filter((player) => positions.includes(player.position))
    .sort((a, b) => b.overall - a.overall)
    .slice(0, count);
}

function coachTactics(team: Team): number {
  return (team.coaches.head.tactics + team.coaches.offense.tactics + team.coaches.defense.tactics) / 3;
}

function mutatePlayer(players: Player[], playerId: string | undefined, mutate: (player: Player) => void): void {
  const player = players.find((candidate) => candidate.id === playerId);
  if (player) mutate(player);
}

function distribute(players: Player[], targets: Player[], amount: number, apply: (player: Player, value: number) => void): void {
  if (!targets.length) return;
  const total = targets.reduce((sum, player) => sum + Math.max(1, player.overall), 0);
  for (const target of targets) {
    const player = players.find((candidate) => candidate.id === target.id);
    if (!player) continue;
    const share = Math.round((amount * Math.max(1, target.overall)) / total);
    apply(player, share);
  }
}

function buildTeamBoxScore(before: Team, after: Team, score: number): TeamBoxScore {
  const allPlayers = after.roster
    .map((player): PlayerGameStats => {
      const previous = before.roster.find((candidate) => candidate.id === player.id);
      return {
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        stats: diffStats(previous?.stats ?? emptyStats(), player.stats),
      };
    })
    .filter((line) => statImpact(line.stats) > 0);

  return {
    teamId: after.id,
    teamName: after.name,
    score,
    totals: sumStats(allPlayers.map((player) => player.stats)),
    players: allPlayers.sort((a, b) => statImpact(b.stats) - statImpact(a.stats)).slice(0, 14),
  };
}

function diffStats(before: PlayerStats, after: PlayerStats): PlayerStats {
  return {
    games: Math.max(0, after.games - before.games),
    passYards: after.passYards - before.passYards,
    passTd: after.passTd - before.passTd,
    interceptionsThrown: after.interceptionsThrown - before.interceptionsThrown,
    rushYards: after.rushYards - before.rushYards,
    rushTd: after.rushTd - before.rushTd,
    receivingYards: after.receivingYards - before.receivingYards,
    receivingTd: after.receivingTd - before.receivingTd,
    tackles: after.tackles - before.tackles,
    sacks: after.sacks - before.sacks,
    interceptions: after.interceptions - before.interceptions,
    pancakes: after.pancakes - before.pancakes,
    fieldGoals: after.fieldGoals - before.fieldGoals,
    fieldGoalAttempts: after.fieldGoalAttempts - before.fieldGoalAttempts,
  };
}

function sumStats(stats: PlayerStats[]): PlayerStats {
  return stats.reduce((total, line) => {
    for (const key of Object.keys(total) as (keyof PlayerStats)[]) {
      total[key] += line[key];
    }
    return total;
  }, emptyStats());
}

function statImpact(stats: PlayerStats): number {
  return (
    stats.passYards * 0.05 +
    stats.passTd * 12 +
    stats.rushYards * 0.08 +
    stats.rushTd * 12 +
    stats.receivingYards * 0.08 +
    stats.receivingTd * 12 +
    stats.tackles * 1.5 +
    stats.sacks * 8 +
    stats.interceptions * 10 +
    stats.pancakes * 2 +
    stats.fieldGoals * 5
  );
}
