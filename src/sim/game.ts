import { Rng, clamp } from "./rng";
import { effectiveAttributes, effectiveOverall, teamPower, teamUnitRatings } from "./ratings";
import { emptyStats, type AttributeKey, type Game, type OffensiveStrategy, type PlayByPlayEvent, type PlayEventType, type Player, type PlayerGameStats, type PlayerStats, type PlayerStreakStatus, type Position, type Team, type TeamBoxScore } from "./types";

interface TeamGameProfile {
  strategy: OffensiveStrategy;
  plays: number;
  passAttempts: number;
  rushAttempts: number;
  passTd: number;
  rushTd: number;
  fieldGoals: number;
  fieldGoalAttempts: number;
  extraPoints: number;
  extraPointAttempts: number;
  missedFieldGoals: number;
  missedExtraPoints: number;
  turnovers: number;
  scoringEvents: ScoringEvent[];
  extraPointEvents: ScoringEvent[];
  missedExtraPointEvents: ScoringEvent[];
}

interface ScoringEvent {
  type: PlayEventType;
  points: number;
  description: string;
  sequence?: string;
}

interface TeamUpdateResult {
  team: Team;
  profile: TeamGameProfile;
}

interface ScoringPlan {
  score: number;
  offensiveTd: number;
  fieldGoals: number;
  extraPoints: number;
  extraPointAttempts: number;
}

const STREAK_FOCUS: Record<Position, AttributeKey[]> = {
  QB: ["throwPower", "accuracy", "awareness"],
  HB: ["speed", "awareness", "catching"],
  WR: ["catching", "routeRunning", "speed"],
  TE: ["catching", "routeRunning", "runBlock"],
  OL: ["runBlock", "passBlock", "awareness"],
  DL: ["tackle", "defAwareness", "speed"],
  LB: ["tackle", "defAwareness", "interception"],
  CB: ["interception", "defAwareness", "speed"],
  S: ["interception", "defAwareness", "tackle"],
  K: ["kickPower", "kickAccuracy", "awareness"],
  P: ["kickPower", "kickAccuracy", "awareness"],
};

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
  let homePlan = scoringPlan(clamp(Math.round(homeExpected + rng.nextInt(-11, 17)), 3, 63));
  let awayPlan = scoringPlan(clamp(Math.round(awayExpected + rng.nextInt(-11, 17)), 3, 63));
  let homeScore = homePlan.score;
  let awayScore = awayPlan.score;
  if (homeScore === awayScore) {
    if (rng.chance(homePower / (homePower + awayPower))) homePlan = scoringPlan(homeScore + 3);
    else awayPlan = scoringPlan(awayScore + 3);
    homeScore = homePlan.score;
    awayScore = awayPlan.score;
  }

  const homeWon = homeScore > awayScore;
  const homeInterceptionsThrown = passingInterceptions(rng, homeUnits.passing, awayUnits.coverage);
  const awayInterceptionsThrown = passingInterceptions(rng, awayUnits.passing, homeUnits.coverage);
  const homeUpdate = updateTeamAfterGame(rng, home, away, homePlan, awayScore, homeWon, game.conferenceGame, homeInterceptionsThrown, awayInterceptionsThrown);
  const awayUpdate = updateTeamAfterGame(rng, away, home, awayPlan, homeScore, !homeWon, game.conferenceGame, awayInterceptionsThrown, homeInterceptionsThrown);
  const updatedHome = homeUpdate.team;
  const updatedAway = awayUpdate.team;
  const playByPlay = buildPlayByPlay(rng, home, away, homeUpdate.profile, awayUpdate.profile);
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
          home: buildTeamBoxScore(home, updatedHome, homeScore, homeUpdate.profile),
          away: buildTeamBoxScore(away, updatedAway, awayScore, awayUpdate.profile),
        },
        playByPlay,
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
      stats: emptyStats(),
      awards: [],
    })),
  }));
}

function updateTeamAfterGame(
  rng: Rng,
  team: Team,
  opponent: Team,
  scoring: ScoringPlan,
  pointsAgainst: number,
  won: boolean,
  conferenceGame: boolean,
  interceptionsThrown: number,
  defensiveInterceptions: number,
): TeamUpdateResult {
  const pointsFor = scoring.score;
  const result = applyPlayerStats(rng, team, opponent, scoring, pointsAgainst, interceptionsThrown, defensiveInterceptions);
  const wins = team.season.wins + (won ? 1 : 0);
  const losses = team.season.losses + (won ? 0 : 1);
  return {
    team: {
      ...team,
      roster: result.roster,
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
    },
    profile: result.profile,
  };
}

function applyPlayerStats(rng: Rng, team: Team, opponent: Team, scoring: ScoringPlan, pointsAgainst: number, interceptionsThrown: number, defensiveInterceptions: number): { roster: Player[]; profile: TeamGameProfile } {
  const pointsFor = scoring.score;
  const roster = team.roster;
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
  const strategy = team.offensiveStrategy ?? "balanced";
  const passRate = offensivePassRate(strategy, units.passing, units.rushing, pointsFor < pointsAgainst);
  const plays = clamp(rng.nextInt(58, 74) + (strategy === "spreadTempo" ? rng.nextInt(2, 5) : strategy === "runHeavy" ? -rng.nextInt(0, 3) : 0), 56, 78);
  const passAttempts = Math.round(plays * passRate);
  const rushAttempts = Math.max(18, plays - passAttempts);
  const passYards = clamp(Math.round(passAttempts * (5.7 + (units.passing + units.receiving - opponentUnits.coverage) / 70) + rng.nextInt(-30, 52)), 95, 450);
  const rushYards = clamp(Math.round(rushAttempts * (3.6 + (units.rushing + units.blocking - opponentUnits.defense) / 80) + rng.nextInt(-24, 42)), 40, 320);
  const offensiveTd = scoring.offensiveTd;
  const passTd = clamp(Math.round(offensiveTd * clamp(passRate + (units.passing - units.rushing) / 210, 0.28, 0.78) + rng.nextInt(-1, 1)), 0, Math.min(6, offensiveTd));
  const rushTd = clamp(offensiveTd - passTd, 0, 6);
  const kickLine = kickingLine(rng, kicker, scoring);
  const picks = interceptionsThrown;
  const updated = roster.map((player) => ({ ...player, stats: { ...player.stats } }));
  const appeared = new Set<string>();
  const scoringEvents: ScoringEvent[] = [];
  const extraPointEvents: ScoringEvent[] = [];
  const missedExtraPointEvents: ScoringEvent[] = [];

  mutateActivePlayer(updated, appeared, qb?.id, (player) => {
    player.stats.passYards += passYards;
    player.stats.passTd += passTd;
    player.stats.interceptionsThrown += picks;
  });
  const qbAttributes = qb ? effectiveAttributes(qb) : undefined;
  const qbRushYards = qbAttributes ? clamp(Math.round(Math.max(0, qbAttributes.speed - 45) * rng.next() * 0.45), 0, Math.min(85, Math.round(rushYards * 0.28))) : 0;
  const qbRushTd = qbAttributes && rushTd > 0 && rng.chance(clamp((qbAttributes.speed - 50) / 170, 0.03, 0.28)) ? 1 : 0;
  mutateActivePlayer(updated, appeared, qb?.id, (player) => {
    player.stats.rushYards += qbRushYards;
    player.stats.rushTd += qbRushTd;
    if (qbRushTd > 0) {
      scoringEvents.push({
        type: "rushTd",
        points: 6,
        description: `${player.name} kept it for a rushing touchdown.`,
      });
    }
  });
  for (const [playerId, value] of splitAmount(backs, Math.max(0, rushYards - qbRushYards), (player) => effectiveOverall(player) + effectiveAttributes(player).speed * 0.4 + effectiveAttributes(player).awareness * 0.2)) {
    mutateActivePlayer(updated, appeared, playerId, (player) => {
      player.stats.rushYards += value;
    });
  }
  for (const [playerId, value] of splitScores(rng, backs, Math.max(0, rushTd - qbRushTd), (player) => effectiveOverall(player) + effectiveAttributes(player).speed * 0.35)) {
    mutateActivePlayer(updated, appeared, playerId, (player) => {
      player.stats.rushTd += value;
      for (let index = 0; index < value; index += 1) {
        scoringEvents.push({
          type: "rushTd",
          points: 6,
          description: `${player.name} punched in a rushing touchdown.`,
        });
      }
    });
  }
  const receivingWeights = receivingUsageWeights(targets);
  const targetWeights = targetUsageWeights(targets);
  const targetAttempts = clamp(passAttempts - picks - rng.nextInt(0, 3), Math.min(passAttempts, targets.length), passAttempts);
  for (const [playerId, value] of splitAmount(targets, targetAttempts, (player) => targetWeights.get(player.id) ?? receivingSkill(player))) {
    mutateActivePlayer(updated, appeared, playerId, (player) => {
      player.stats.receivingTargets += value;
    });
  }
  for (const [playerId, value] of splitAmount(targets, passYards, (player) => receivingWeights.get(player.id) ?? receivingSkill(player))) {
    mutateActivePlayer(updated, appeared, playerId, (player) => {
      player.stats.receivingYards += value;
    });
  }
  for (const [playerId, value] of splitScores(rng, targets, passTd, (player) => receivingWeights.get(player.id) ?? receivingSkill(player))) {
    mutateActivePlayer(updated, appeared, playerId, (player) => {
      player.stats.receivingTd += value;
      for (let index = 0; index < value; index += 1) {
        scoringEvents.push({
          type: "passTd",
          points: 6,
          description: `${qb?.name ?? "The quarterback"} found ${player.name} for a passing touchdown.`,
        });
      }
    });
  }
  for (const [playerId, value] of splitAmount(blockers, Math.round(pointsFor + rushYards / 9), (player) => effectiveOverall(player) + effectiveAttributes(player).runBlock + effectiveAttributes(player).passBlock)) {
    mutateActivePlayer(updated, appeared, playerId, (player) => {
      player.stats.pancakes += Math.round(value / 26);
    });
  }
  const tacklePool = clamp(56 + Math.round(pointsAgainst * 0.28) + Math.round((opponentUnits.rushing + opponentUnits.passing) / 45) + rng.nextInt(-5, 9), 50, 85);
  for (const [playerId, value] of splitAmount(defenders, tacklePool, (player) => (effectiveOverall(player) + effectiveAttributes(player).tackle * 0.55 + effectiveAttributes(player).defAwareness * 0.35) * defenderTackleShare(player))) {
    mutateActivePlayer(updated, appeared, playerId, (player) => {
      player.stats.tackles += value;
    });
  }
  const sackTargets = defenders.filter((player) => player.position === "DL" || player.position === "LB");
  const sackCount = clamp(Math.round(1.3 + (units.defense - opponentUnits.blocking) / 26 + rng.nextInt(-1, 3)), 0, 5);
  for (const [playerId, value] of splitScores(rng, sackTargets, sackCount, (player) => effectiveOverall(player) + effectiveAttributes(player).tackle * 0.6)) {
    mutateActivePlayer(updated, appeared, playerId, (player) => {
      player.stats.sacks += value;
    });
  }
  const interceptionTargets = defenders.filter((player) => player.position === "CB" || player.position === "S" || player.position === "LB");
  for (const [playerId, value] of splitScores(rng, interceptionTargets, defensiveInterceptions, (player) => effectiveOverall(player) + effectiveAttributes(player).interception * 0.7 + effectiveAttributes(player).defAwareness * 0.25)) {
    mutateActivePlayer(updated, appeared, playerId, (player) => {
      player.stats.interceptions += value;
    });
  }
  mutateActivePlayer(updated, appeared, kicker?.id, (player) => {
    player.stats.fieldGoalAttempts += kickLine.fieldGoalAttempts;
    player.stats.fieldGoals += kickLine.fieldGoals;
    player.stats.extraPointAttempts += kickLine.extraPointAttempts;
    player.stats.extraPoints += kickLine.extraPoints;
    for (let index = 0; index < kickLine.fieldGoals; index += 1) {
      scoringEvents.push({
        type: "fieldGoal",
        points: 3,
        description: `${player.name} made a field goal.`,
      });
    }
    for (let index = 0; index < kickLine.missedFieldGoals; index += 1) {
      scoringEvents.push({
        type: "missedFieldGoal",
        points: 0,
        description: `${player.name} missed a field goal try.`,
      });
    }
    for (let index = 0; index < kickLine.extraPoints; index += 1) {
      extraPointEvents.push({ type: "extraPoint", points: 1, description: `${player.name} added the extra point.` });
    }
    for (let index = 0; index < kickLine.missedExtraPoints; index += 1) {
      missedExtraPointEvents.push({ type: "missedExtraPoint", points: 0, description: `${player.name} missed the extra point.` });
    }
  });
  for (let index = 0; index < picks; index += 1) {
    scoringEvents.push({
      type: "turnover",
      points: 0,
      description: `${qb?.name ?? "The quarterback"} threw an interception.`,
    });
  }

  const withGames = updated.map((player) =>
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
  const rosterWithStreaks = withGames.map((player) => {
    const previous = roster.find((candidate) => candidate.id === player.id);
    if (!previous) return player;
    if (!appeared.has(player.id)) return decayPlayerStreak(player);
    return updatePlayerStreak(rng, previous, player, diffStats(previous.stats, player.stats));
  });
  return {
    roster: rosterWithStreaks,
    profile: {
      strategy,
      plays,
      passAttempts,
      rushAttempts,
      passTd,
      rushTd,
      fieldGoals: kickLine.fieldGoals,
      fieldGoalAttempts: kickLine.fieldGoalAttempts,
      extraPoints: kickLine.extraPoints,
      extraPointAttempts: kickLine.extraPointAttempts,
      missedFieldGoals: kickLine.missedFieldGoals,
      missedExtraPoints: kickLine.missedExtraPoints,
      turnovers: picks,
      scoringEvents,
      extraPointEvents,
      missedExtraPointEvents,
    },
  };
}

function topAt(roster: Player[], positions: string[], count: number): Player[] {
  return roster
    .filter((player) => positions.includes(player.position))
      .sort((a, b) => effectiveOverall(b) - effectiveOverall(a))
    .slice(0, count);
}

function rotationAt(rng: Rng, roster: Player[], positions: string[], count: number): Player[] {
  const ranked = roster.filter((player) => positions.includes(player.position)).sort((a, b) => effectiveOverall(b) - effectiveOverall(a));
  const core = ranked.slice(0, Math.max(1, count - 1));
  const rotationPool = ranked.slice(core.length, Math.min(ranked.length, count + 3));
  const extra = rotationPool.length ? rng.shuffle(rotationPool).slice(0, Math.max(0, count - core.length)) : [];
  return uniquePlayers([...core, ...extra]).slice(0, count);
}

function receivingUsageWeights(targets: Player[]): Map<string, number> {
  const roleMultipliers = [1.85, 1.35, 1, 0.78, 0.62, 0.5, 0.42];
  const ranked = [...targets].sort((a, b) => receivingSkill(b) - receivingSkill(a));
  return new Map(
    ranked.map((player, index) => {
      const eliteBonus = player.position === "WR" && effectiveOverall(player) >= 90 ? 1.12 : 1;
      return [player.id, receivingSkill(player) * (roleMultipliers[index] ?? 0.42) * eliteBonus];
    }),
  );
}

function targetUsageWeights(targets: Player[]): Map<string, number> {
  const roleMultipliers = [1.58, 1.28, 1, 0.86, 0.72, 0.6, 0.52];
  const ranked = [...targets].sort((a, b) => receivingSkill(b) - receivingSkill(a));
  return new Map(
    ranked.map((player, index) => {
      const eliteBonus = player.position === "WR" && effectiveOverall(player) >= 90 ? 1.04 : 1;
      return [player.id, receivingSkill(player) * (roleMultipliers[index] ?? 0.52) * eliteBonus];
    }),
  );
}

function receivingSkill(player: Player): number {
  const attributes = effectiveAttributes(player);
  return effectiveOverall(player) + attributes.catching * 0.55 + attributes.routeRunning * 0.5 + attributes.speed * 0.25 + attributes.awareness * 0.15;
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
  const edge = defenseCoverage - offensePassing;
  const firstPick = clamp(0.68 + edge / 110, 0.32, 0.92);
  const secondPick = clamp(0.1 + edge / 180, 0.03, 0.3);
  const thirdPick = clamp((edge - 18) / 220, 0, 0.12);
  let picks = 0;
  if (rng.chance(firstPick)) picks += 1;
  if (rng.chance(secondPick)) picks += 1;
  if (picks >= 2 && rng.chance(thirdPick)) picks += 1;
  return picks;
}

function updatePlayerStreak(rng: Rng, before: Player, after: Player, gameStats: PlayerStats): Player {
  const decayed = decayPlayerStreak(after);
  const hot = hotPerformanceScore(before, gameStats);
  const cold = coldPerformanceScore(before, gameStats);
  const potentialGap = clamp(before.potential - before.overall, 0, 30);
  const hotChance = clamp(0.06 + hot * 0.045 + potentialGap / 180, 0.04, 0.28);
  const coldChance = clamp(0.04 + cold * 0.055 - potentialGap / 260, 0.02, 0.2);
  if (hot > 0 && rng.chance(hotChance)) return withNewStreak(rng, decayed, "hot", hot);
  if (cold > 0 && rng.chance(coldChance)) return withNewStreak(rng, decayed, "cold", cold);
  return decayed;
}

function decayPlayerStreak(player: Player): Player {
  if (!player.streak) return player;
  const weeks = player.streak.weeks - 1;
  if (weeks <= 0) return { ...player, streak: undefined };
  return { ...player, streak: { ...player.streak, weeks } };
}

function withNewStreak(rng: Rng, player: Player, status: PlayerStreakStatus, score: number): Player {
  const focus = STREAK_FOCUS[player.position];
  const magnitude = status === "hot" ? clamp(2 + Math.floor(score / 2) + rng.nextInt(0, 1), 2, 5) : -clamp(2 + Math.floor(score / 2), 2, 4);
  const selected = rng.shuffle(focus).slice(0, status === "hot" ? 3 : 2);
  const attributeBoosts = Object.fromEntries(selected.map((key) => [key, magnitude])) as Partial<Record<AttributeKey, number>>;
  return {
    ...player,
    streak: {
      status,
      weeks: status === "hot" ? rng.nextInt(2, 4) : rng.nextInt(1, 3),
      attributeBoosts,
      note: status === "hot" ? "Surging after a strong performance" : "Confidence dipped after a rough outing",
    },
  };
}

function hotPerformanceScore(player: Player, stats: PlayerStats): number {
  if (player.position === "QB") return stats.passYards >= 275 && stats.passTd >= 2 && stats.interceptionsThrown === 0 ? 2.5 + stats.passTd * 0.35 : 0;
  if (player.position === "HB") return stats.rushYards >= 105 || stats.rushTd >= 2 ? 1.8 + stats.rushYards / 160 + stats.rushTd * 0.55 : 0;
  if (player.position === "WR" || player.position === "TE") return stats.receivingYards >= 85 || stats.receivingTd >= 2 ? 1.7 + stats.receivingYards / 140 + stats.receivingTd * 0.55 : 0;
  if (player.position === "OL") return stats.pancakes >= 2 ? 1.4 + stats.pancakes * 0.35 : 0;
  if (["DL", "LB", "CB", "S"].includes(player.position)) return stats.tackles >= 8 || stats.sacks > 0 || stats.interceptions > 0 ? 1.4 + stats.tackles / 12 + stats.sacks * 0.8 + stats.interceptions : 0;
  if (player.position === "K" || player.position === "P") return stats.fieldGoalAttempts >= 2 && stats.fieldGoals === stats.fieldGoalAttempts ? 1.5 : 0;
  return 0;
}

function coldPerformanceScore(player: Player, stats: PlayerStats): number {
  if (player.position === "QB") return stats.interceptionsThrown >= 2 || (stats.passTd === 0 && stats.passYards < 170) ? 1.8 + stats.interceptionsThrown * 0.7 : 0;
  if (["DL", "LB", "CB", "S"].includes(player.position)) return stats.tackles <= 2 && stats.sacks === 0 && stats.interceptions === 0 ? 0.9 : 0;
  if (player.position === "K") return stats.fieldGoalAttempts >= 2 && stats.fieldGoals < stats.fieldGoalAttempts ? 1.2 : 0;
  return 0;
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

function offensivePassRate(strategy: OffensiveStrategy, passing: number, rushing: number, trailing: boolean): number {
  const bias: Record<OffensiveStrategy, number> = {
    balanced: 0,
    airRaid: 0.1,
    runHeavy: -0.11,
    proStyle: 0.03,
    spreadTempo: 0.06,
  };
  const bounds: Record<OffensiveStrategy, [number, number]> = {
    balanced: [0.46, 0.58],
    airRaid: [0.58, 0.68],
    runHeavy: [0.34, 0.46],
    proStyle: [0.48, 0.61],
    spreadTempo: [0.54, 0.66],
  };
  const [min, max] = bounds[strategy];
  return clamp(0.51 + bias[strategy] + (passing - rushing) / 190 + (trailing ? 0.055 : -0.015), min, max);
}

function scoringPlan(rawScore: number): ScoringPlan {
  const target = clamp(rawScore, 3, 66);
  let best: ScoringPlan = { score: 3, offensiveTd: 0, fieldGoals: 1, extraPoints: 0, extraPointAttempts: 0 };
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let touchdowns = 0; touchdowns <= 8; touchdowns += 1) {
    for (let extraPoints = 0; extraPoints <= touchdowns; extraPoints += 1) {
      for (let fieldGoals = 0; fieldGoals <= 5; fieldGoals += 1) {
        const score = touchdowns * 6 + extraPoints + fieldGoals * 3;
        if (score < 3 || score > 66) continue;
        const distance = Math.abs(score - target);
        if (distance < bestDistance || (distance === bestDistance && score > best.score)) {
          best = {
            score,
            offensiveTd: touchdowns,
            fieldGoals,
            extraPoints,
            extraPointAttempts: touchdowns,
          };
          bestDistance = distance;
        }
      }
    }
  }
  return best;
}

function kickingLine(rng: Rng, kicker: Player | undefined, scoring: ScoringPlan): { fieldGoals: number; fieldGoalAttempts: number; extraPoints: number; extraPointAttempts: number; missedFieldGoals: number; missedExtraPoints: number } {
  const kickAccuracy = kicker ? effectiveAttributes(kicker).kickAccuracy : 68;
  const missedFieldGoals = rng.chance(clamp(0.14 - kickAccuracy / 900, 0.03, 0.12)) ? 1 : 0;
  const extraPointAttempts = scoring.extraPointAttempts;
  const extraPoints = scoring.extraPoints;
  return {
    fieldGoals: scoring.fieldGoals,
    fieldGoalAttempts: scoring.fieldGoals + missedFieldGoals,
    extraPoints,
    extraPointAttempts,
    missedFieldGoals,
    missedExtraPoints: extraPointAttempts - extraPoints,
  };
}

function buildPlayByPlay(rng: Rng, home: Team, away: Team, homeProfile: TeamGameProfile, awayProfile: TeamGameProfile): PlayByPlayEvent[] {
  const events = [
    ...sequencedTeamEvents(homeProfile, "home").map((event) => ({ event, team: home, side: "home" as const })),
    ...sequencedTeamEvents(awayProfile, "away").map((event) => ({ event, team: away, side: "away" as const })),
  ];
  const driveTimes = new Map<string, { quarter: number; tick: number }>();
  const weighted = events.map((entry, index) => {
    const sequence = entry.event.sequence ?? `fallback-${index}`;
    const driveTime =
      driveTimes.get(sequence) ??
      {
        quarter: rng.nextInt(1, 4),
        tick: rng.nextInt(1, 900),
      };
    driveTimes.set(sequence, driveTime);
    return {
      ...entry,
      quarter: driveTime.quarter,
      tick: Math.max(1, driveTime.tick - (entry.event.type === "extraPoint" || entry.event.type === "missedExtraPoint" ? 1 : 0)),
      sequence,
    };
  });
  weighted.sort((a, b) => a.quarter - b.quarter || b.tick - a.tick || a.sequence.localeCompare(b.sequence));
  let homeScore = 0;
  let awayScore = 0;
  return weighted.map((entry) => {
    if (entry.side === "home") homeScore += entry.event.points;
    else awayScore += entry.event.points;
    return {
      quarter: entry.quarter,
      clock: formatClock(entry.tick),
      teamId: entry.team.id,
      teamName: entry.team.name,
      type: entry.event.type,
      description: entry.event.description,
      homeScore,
      awayScore,
    };
  });
}

function sequencedTeamEvents(profile: TeamGameProfile, prefix: string): ScoringEvent[] {
  const xpQueue = [...profile.extraPointEvents, ...profile.missedExtraPointEvents];
  const events: ScoringEvent[] = [];
  let sequence = 0;
  for (const event of profile.scoringEvents) {
    const tag = `${prefix}-${sequence}`;
    const tagged = { ...event, sequence: tag };
    events.push(tagged);
    if ((event.type === "passTd" || event.type === "rushTd") && xpQueue.length) events.push({ ...xpQueue.shift()!, sequence: tag });
    sequence += 1;
  }
  return [...events, ...xpQueue];
}

function formatClock(tick: number): string {
  const minutes = Math.floor(tick / 60);
  const seconds = tick % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function mutateActivePlayer(players: Player[], appeared: Set<string>, playerId: string | undefined, mutate: (player: Player) => void): void {
  const player = players.find((candidate) => candidate.id === playerId);
  if (!player) return;
  appeared.add(player.id);
  mutate(player);
}

function buildTeamBoxScore(before: Team, after: Team, score: number, profile: TeamGameProfile): TeamBoxScore {
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
    strategy: profile.strategy,
    plays: profile.plays,
    passAttempts: profile.passAttempts,
    rushAttempts: profile.rushAttempts,
    totals: sumStats(allPlayers.map((player) => player.stats)),
    players: allPlayers.sort((a, b) => statImpact(b.stats) - statImpact(a.stats)).slice(0, 18),
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
    receivingTargets: after.receivingTargets - before.receivingTargets,
    receivingYards: after.receivingYards - before.receivingYards,
    receivingTd: after.receivingTd - before.receivingTd,
    tackles: after.tackles - before.tackles,
    sacks: after.sacks - before.sacks,
    interceptions: after.interceptions - before.interceptions,
    pancakes: after.pancakes - before.pancakes,
    fieldGoals: after.fieldGoals - before.fieldGoals,
    fieldGoalAttempts: after.fieldGoalAttempts - before.fieldGoalAttempts,
    extraPoints: after.extraPoints - before.extraPoints,
    extraPointAttempts: after.extraPointAttempts - before.extraPointAttempts,
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
    stats.receivingTargets * 0.6 +
    stats.receivingYards * 0.08 +
    stats.receivingTd * 12 +
    stats.tackles * 1.5 +
    stats.sacks * 8 +
    stats.interceptions * 14 +
    stats.pancakes * 2 +
    stats.fieldGoals * 5 +
    stats.fieldGoalAttempts * 0.5 +
    stats.extraPointAttempts * 0.25 +
    stats.extraPoints
  );
}
