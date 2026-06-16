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
  const homeInterceptionsThrown = passingInterceptions(rng, homeUnits.passing, awayUnits.coverage);
  const awayInterceptionsThrown = passingInterceptions(rng, awayUnits.passing, homeUnits.coverage);
  const updatedHome = updateTeamAfterGame(rng, home, away, homeScore, awayScore, homeWon, game.conferenceGame, homeInterceptionsThrown, awayInterceptionsThrown);
  const updatedAway = updateTeamAfterGame(rng, away, home, awayScore, homeScore, !homeWon, game.conferenceGame, awayInterceptionsThrown, homeInterceptionsThrown);
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

function updateTeamAfterGame(
  rng: Rng,
  team: Team,
  opponent: Team,
  pointsFor: number,
  pointsAgainst: number,
  won: boolean,
  conferenceGame: boolean,
  interceptionsThrown: number,
  defensiveInterceptions: number,
): Team {
  const roster = applyPlayerStats(rng, team.roster, opponent, pointsFor, pointsAgainst, interceptionsThrown, defensiveInterceptions);
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

function applyPlayerStats(rng: Rng, roster: Player[], opponent: Team, pointsFor: number, pointsAgainst: number, interceptionsThrown: number, defensiveInterceptions: number): Player[] {
  const units = teamUnitRatings(roster);
  const opponentUnits = teamUnitRatings(opponent.roster);
  const qb = topAt(roster, ["QB"], 1)[0];
  const backs = rotationAt(rng, roster, ["HB"], rng.nextInt(2, 3));
  const targets = rotationAt(rng, roster, ["WR", "TE"], rng.nextInt(5, 7));
  const blockers = uniquePlayers([...topAt(roster, ["OL"], 5), ...topAt(roster, ["TE"], 1)]);
  const defenders = uniquePlayers([
    ...rotationAt(rng, roster, ["DL"], 4),
    ...rotationAt(rng, roster, ["LB"], 4),
    ...rotationAt(rng, roster, ["CB"], 4),
    ...rotationAt(rng, roster, ["S"], 3),
  ]);
  const kicker = topAt(roster, ["K"], 1)[0];
  const passRate = clamp(0.5 + (units.passing - units.rushing) / 180 + (pointsFor < pointsAgainst ? 0.04 : -0.02), 0.38, 0.64);
  const plays = rng.nextInt(58, 74);
  const passAttempts = Math.round(plays * passRate);
  const rushAttempts = Math.max(18, plays - passAttempts);
  const passYards = clamp(Math.round(passAttempts * (5.7 + (units.passing + units.receiving - opponentUnits.coverage) / 70) + rng.nextInt(-30, 52)), 70, 455);
  const rushYards = clamp(Math.round(rushAttempts * (3.6 + (units.rushing + units.blocking - opponentUnits.defense) / 80) + rng.nextInt(-24, 42)), 25, 330);
  const offensiveTd = clamp(Math.round(pointsFor / 7 - (pointsFor % 7 >= 3 ? 0.45 : 0) + rng.nextInt(-1, 1)), 0, 8);
  const passTd = clamp(Math.round(offensiveTd * clamp(0.53 + (units.passing - units.rushing) / 150, 0.34, 0.72) + rng.nextInt(-1, 1)), 0, Math.min(6, offensiveTd));
  const rushTd = clamp(offensiveTd - passTd, 0, 6);
  const picks = interceptionsThrown;
  const updated = roster.map((player) => ({ ...player, stats: { ...player.stats } }));
  const appeared = new Set<string>();

  mutateActivePlayer(updated, appeared, qb?.id, (player) => {
    player.stats.passYards += passYards;
    player.stats.passTd += passTd;
    player.stats.interceptionsThrown += picks;
  });
  const qbRushYards = qb ? clamp(Math.round(Math.max(0, qb.attributes.speed - 45) * rng.next() * 0.45), 0, Math.min(85, Math.round(rushYards * 0.28))) : 0;
  const qbRushTd = qb && rushTd > 0 && rng.chance(clamp((qb.attributes.speed - 50) / 170, 0.03, 0.28)) ? 1 : 0;
  mutateActivePlayer(updated, appeared, qb?.id, (player) => {
    player.stats.rushYards += qbRushYards;
    player.stats.rushTd += qbRushTd;
  });
  for (const [playerId, value] of splitAmount(backs, Math.max(0, rushYards - qbRushYards), (player) => player.overall + player.attributes.speed * 0.4 + player.attributes.awareness * 0.2)) {
    mutateActivePlayer(updated, appeared, playerId, (player) => {
      player.stats.rushYards += value;
    });
  }
  for (const [playerId, value] of splitScores(rng, backs, Math.max(0, rushTd - qbRushTd), (player) => player.overall + player.attributes.speed * 0.35)) {
    mutateActivePlayer(updated, appeared, playerId, (player) => {
      player.stats.rushTd += value;
    });
  }
  for (const [playerId, value] of splitAmount(targets, passYards, (player) => player.overall + player.attributes.catching * 0.5 + player.attributes.routeRunning * 0.45)) {
    mutateActivePlayer(updated, appeared, playerId, (player) => {
      player.stats.receivingYards += value;
    });
  }
  for (const [playerId, value] of splitScores(rng, targets, passTd, (player) => player.overall + player.attributes.catching * 0.5 + player.attributes.routeRunning * 0.4)) {
    mutateActivePlayer(updated, appeared, playerId, (player) => {
      player.stats.receivingTd += value;
    });
  }
  for (const [playerId, value] of splitAmount(blockers, Math.round(pointsFor + rushYards / 9), (player) => player.overall + player.attributes.runBlock + player.attributes.passBlock)) {
    mutateActivePlayer(updated, appeared, playerId, (player) => {
      player.stats.pancakes += Math.round(value / 26);
    });
  }
  const tacklePool = clamp(56 + Math.round(pointsAgainst * 0.28) + Math.round((opponentUnits.rushing + opponentUnits.passing) / 45) + rng.nextInt(-5, 9), 48, 86);
  for (const [playerId, value] of splitAmount(defenders, tacklePool, (player) => (player.overall + player.attributes.tackle * 0.55 + player.attributes.defAwareness * 0.35) * defenderTackleShare(player))) {
    mutateActivePlayer(updated, appeared, playerId, (player) => {
      player.stats.tackles += value;
    });
  }
  const sackTargets = defenders.filter((player) => player.position === "DL" || player.position === "LB");
  const sackCount = clamp(Math.round(1.3 + (units.defense - opponentUnits.blocking) / 26 + rng.nextInt(-1, 3)), 0, 5);
  for (const [playerId, value] of splitScores(rng, sackTargets, sackCount, (player) => player.overall + player.attributes.tackle * 0.6)) {
    mutateActivePlayer(updated, appeared, playerId, (player) => {
      player.stats.sacks += value;
    });
  }
  const interceptionTargets = defenders.filter((player) => player.position === "CB" || player.position === "S" || player.position === "LB");
  for (const [playerId, value] of splitScores(rng, interceptionTargets, defensiveInterceptions, (player) => player.overall + player.attributes.interception * 0.7 + player.attributes.defAwareness * 0.25)) {
    mutateActivePlayer(updated, appeared, playerId, (player) => {
      player.stats.interceptions += value;
    });
  }
  mutateActivePlayer(updated, appeared, kicker?.id, (player) => {
    const attempts = clamp(Math.round((pointsFor - offensiveTd * 7) / 3 + rng.nextInt(0, 1)), pointsFor >= 3 ? 1 : 0, 5);
    player.stats.fieldGoalAttempts += attempts;
    player.stats.fieldGoals += clamp(attempts - (rng.chance(player.attributes.kickAccuracy / 118) ? 0 : 1), 0, attempts);
  });

  return updated.map((player) =>
    appeared.has(player.id)
      ? {
          ...player,
          stats: {
            ...player.stats,
            games: player.stats.games + 1,
          },
        }
      : player,
  );
}

function topAt(roster: Player[], positions: string[], count: number): Player[] {
  return roster
    .filter((player) => positions.includes(player.position))
    .sort((a, b) => b.overall - a.overall)
    .slice(0, count);
}

function rotationAt(rng: Rng, roster: Player[], positions: string[], count: number): Player[] {
  const ranked = roster.filter((player) => positions.includes(player.position)).sort((a, b) => b.overall - a.overall);
  const core = ranked.slice(0, Math.max(1, count - 1));
  const rotationPool = ranked.slice(core.length, Math.min(ranked.length, count + 3));
  const extra = rotationPool.length ? rng.shuffle(rotationPool).slice(0, Math.max(0, count - core.length)) : [];
  return uniquePlayers([...core, ...extra]).slice(0, count);
}

function uniquePlayers(players: Player[]): Player[] {
  const seen = new Set<string>();
  return players.filter((player) => {
    if (seen.has(player.id)) return false;
    seen.add(player.id);
    return true;
  });
}

function splitAmount(targets: Player[], amount: number, weightFor: (player: Player) => number): Map<string, number> {
  const values = new Map<string, number>();
  if (!targets.length || amount <= 0) return values;
  const weighted = targets.map((player) => ({ player, weight: Math.max(1, weightFor(player)) }));
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let assigned = 0;
  const fractions: { playerId: string; fraction: number }[] = [];
  for (const entry of weighted) {
    const exact = (amount * entry.weight) / totalWeight;
    const value = Math.floor(exact);
    assigned += value;
    values.set(entry.player.id, value);
    fractions.push({ playerId: entry.player.id, fraction: exact - value });
  }
  fractions.sort((a, b) => b.fraction - a.fraction);
  for (let index = 0; assigned < amount && fractions.length; index += 1) {
    const target = fractions[index % fractions.length]!;
    values.set(target.playerId, (values.get(target.playerId) ?? 0) + 1);
    assigned += 1;
  }
  return values;
}

function splitScores(rng: Rng, targets: Player[], count: number, weightFor: (player: Player) => number): Map<string, number> {
  const values = new Map<string, number>();
  if (!targets.length || count <= 0) return values;
  const weighted = targets.map((player) => ({ value: player, weight: Math.max(1, weightFor(player)) }));
  for (let index = 0; index < count; index += 1) {
    const scorer = rng.weighted(weighted);
    values.set(scorer.id, (values.get(scorer.id) ?? 0) + 1);
  }
  return values;
}

function passingInterceptions(rng: Rng, offensePassing: number, defenseCoverage: number): number {
  return clamp(Math.round(0.6 + (defenseCoverage - offensePassing) / 30 + rng.nextInt(-1, 2)), 0, 3);
}

function defenderTackleShare(player: Player): number {
  if (player.position === "LB") return 1.35;
  if (player.position === "S") return 1.15;
  if (player.position === "CB") return 0.9;
  if (player.position === "DL") return 0.75;
  return 1;
}

function coachTactics(team: Team): number {
  return (team.coaches.head.tactics + team.coaches.offense.tactics + team.coaches.defense.tactics) / 3;
}

function mutateActivePlayer(players: Player[], appeared: Set<string>, playerId: string | undefined, mutate: (player: Player) => void): void {
  const player = players.find((candidate) => candidate.id === playerId);
  if (!player) return;
  appeared.add(player.id);
  mutate(player);
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
