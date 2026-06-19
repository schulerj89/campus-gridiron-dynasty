import { Rng, clamp } from "./rng";
import { orderPositionPlayers } from "./depthChart";
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
  pancakeBlockers: string[];
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

interface PlayContext {
  team: Team;
  opponent: Team;
  side: "home" | "away";
  profile: TeamGameProfile;
  qb?: Player;
  backs: Player[];
  targets: Player[];
  punter?: Player;
  kicker?: Player;
  returners: Player[];
  defenders: Player[];
  receiverMatchups: Map<string, ReceiverMatchup>;
  pancakeBlockers: string[];
  passProtectionEdge: number;
  passRemaining: number;
  rushRemaining: number;
  scoringEvents: ScoringEvent[];
  xpEvents: ScoringEvent[];
}

interface DriveState {
  down: 1 | 2 | 3 | 4;
  distance: number;
  yardLine: number;
}

interface GameFlow {
  homeScore: number;
  awayScore: number;
  playIndex: number;
  totalPlaysEstimate: number;
}

interface ScriptedPlay {
  teamId: string;
  teamName: string;
  side: "home" | "away";
  type: PlayEventType;
  description: string;
  points: number;
  down?: 1 | 2 | 3 | 4;
  distance?: number;
  yardLine?: string;
  yards?: number;
}

interface ReceiverMatchup {
  defender?: Player;
  edge: number;
  targetMultiplier: number;
  yardMultiplier: number;
  completionModifier: number;
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
  const qb = topAt(team, ["QB"], 1)[0];
  const backs = rotationAt(rng, team, ["HB"], rng.nextInt(2, 3));
  const targets = rotationAt(rng, team, ["WR", "TE"], rng.nextInt(5, 7));
  const blockers = uniquePlayers([...topAt(team, ["OL"], 5), ...topAt(team, ["TE"], 1)]);
  const defenders = uniquePlayers([
    ...rotationAt(rng, team, ["DL"], 4),
    ...rotationAt(rng, team, ["LB"], 4),
    ...rotationAt(rng, team, ["CB"], 4),
    ...rotationAt(rng, team, ["S"], 3),
  ]);
  const kicker = topAt(team, ["K"], 1)[0];
  const strategy = team.offensiveStrategy ?? "balanced";
  const passRate = offensivePassRate(strategy, units.passing, units.rushing, pointsFor < pointsAgainst);
  const plays = clamp(rng.nextInt(58, 74) + (strategy === "spreadTempo" ? rng.nextInt(2, 5) : strategy === "runHeavy" ? -rng.nextInt(0, 3) : 0), 56, 78);
  const passAttempts = Math.round(plays * passRate);
  const rushAttempts = Math.max(18, plays - passAttempts);
  const passProtectionEdge = units.blocking - opponentUnits.defense;
  const passYards = clamp(Math.round(passAttempts * (5.7 + (units.passing + units.receiving - opponentUnits.coverage) / 70 + passProtectionEdge / 85) + rng.nextInt(-30, 52)), 95, 450);
  const rushYards = clamp(Math.round(rushAttempts * (3.6 + (units.rushing + units.blocking - opponentUnits.defense) / 80) + rng.nextInt(-24, 42)), 40, 320);
  const offensiveTd = scoring.offensiveTd;
  const passTdShare = passingTouchdownShare(strategy, passRate, units, opponentUnits);
  const passTdFloor = strategy === "airRaid" && offensiveTd >= 3 && units.passing + units.receiving >= units.rushing + opponentUnits.coverage * 0.75 ? 1 : 0;
  const passTd = clamp(Math.round(offensiveTd * passTdShare + rng.nextInt(-1, 1)), passTdFloor, Math.min(6, offensiveTd));
  const rushTd = clamp(offensiveTd - passTd, 0, 6);
  const kickLine = kickingLine(rng, kicker, scoring);
  const picks = interceptionsThrown;
  const updated = roster.map((player) => ({ ...player, stats: { ...player.stats } }));
  const appeared = new Set<string>();
  const scoringEvents: ScoringEvent[] = [];
  const extraPointEvents: ScoringEvent[] = [];
  const missedExtraPointEvents: ScoringEvent[] = [];
  const targetAttempts = clamp(passAttempts - picks - rng.nextInt(0, 3), Math.min(passAttempts, targets.length), passAttempts);
  const passerAttributes = qb ? effectiveAttributes(qb) : undefined;
  const completionRate = quarterbackCompletionRate(rng, strategy, passerAttributes, units, opponentUnits);
  const minimumCompletions = Math.min(targetAttempts, Math.max(passTd, passYards > 0 ? 1 : 0));
  const passCompletions = clamp(Math.round(targetAttempts * completionRate), minimumCompletions, targetAttempts);
  const pancakeBlockers: string[] = [];

  mutateActivePlayer(updated, appeared, qb?.id, (player) => {
    player.stats.passAttempts += passAttempts;
    player.stats.passCompletions += passCompletions;
    player.stats.passYards += passYards;
    player.stats.passTd += passTd;
    player.stats.interceptionsThrown += picks;
  });
  const qbAttributes = qb ? effectiveAttributes(qb) : undefined;
  const qbRushYards = qbAttributes ? clamp(Math.round(Math.max(0, qbAttributes.speed - 45) * rng.next() * 0.45), 0, Math.min(85, Math.round(rushYards * 0.28))) : 0;
  const qbRushTd = qbAttributes && rushTd > 0 && rng.chance(clamp((qbAttributes.speed - 50) / 170, 0.03, 0.28)) ? 1 : 0;
  const qbRushAttempts = qbRushYards > 0 || qbRushTd > 0 ? clamp(Math.round(rushAttempts * clamp((qbAttributes?.speed ?? 50) / 650, 0.03, 0.14)) + rng.nextInt(0, 2), 1, Math.min(8, rushAttempts)) : 0;
  mutateActivePlayer(updated, appeared, qb?.id, (player) => {
    player.stats.rushAttempts += qbRushAttempts;
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
  for (const [playerId, value] of splitAmount(backs, Math.max(0, rushAttempts - qbRushAttempts), (player) => effectiveOverall(player) + effectiveAttributes(player).speed * 0.35 + effectiveAttributes(player).awareness * 0.25)) {
    mutateActivePlayer(updated, appeared, playerId, (player) => {
      player.stats.rushAttempts += value;
    });
  }
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
  const receiverMatchups = receiverCoverageMatchups(targets, opponent);
  const receivingWeights = receivingUsageWeights(targets, receiverMatchups);
  const targetWeights = targetUsageWeights(targets, receiverMatchups);
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
  const pancakeCount = clamp(Math.round(0.8 + rushYards / 64 + pointsFor / 28 + (units.blocking - opponentUnits.defense) / 38 + rng.nextInt(-2, 2)), 0, 10);
  for (const [playerId, value] of splitScores(rng, blockers, pancakeCount, (player) => effectiveOverall(player) + effectiveAttributes(player).runBlock * 0.8 + effectiveAttributes(player).passBlock * 0.35)) {
    mutateActivePlayer(updated, appeared, playerId, (player) => {
      player.stats.pancakes += value;
      for (let index = 0; index < value; index += 1) pancakeBlockers.push(player.name);
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
      pancakeBlockers,
    },
  };
}

function topAt(teamOrRoster: Team | Player[], positions: Position[], count: number): Player[] {
  return orderedPlayers(teamOrRoster, positions).slice(0, count);
}

function rotationAt(rng: Rng, teamOrRoster: Team | Player[], positions: Position[], count: number): Player[] {
  const ranked = orderedPlayers(teamOrRoster, positions);
  const core = ranked.slice(0, Math.max(1, count - 1));
  const rotationPool = ranked.slice(core.length, Math.min(ranked.length, count + 3));
  const extra = rotationPool.length ? rng.shuffle(rotationPool).slice(0, Math.max(0, count - core.length)) : [];
  return uniquePlayers([...core, ...extra]).slice(0, count);
}

function orderedPlayers(teamOrRoster: Team | Player[], positions: Position[]): Player[] {
  const team = Array.isArray(teamOrRoster) ? undefined : teamOrRoster;
  const roster = Array.isArray(teamOrRoster) ? teamOrRoster : teamOrRoster.roster;
  const depthRank = new Map<string, number>();
  if (team) {
    for (const position of positions) {
      const savedOrder = team.depthChart?.[position];
      if (!savedOrder?.length) continue;
      orderPositionPlayers(roster, position, savedOrder).forEach((player, index) => {
        depthRank.set(player.id, index);
      });
    }
  }
  return roster
    .filter((player) => positions.includes(player.position))
    .sort((a, b) => {
      if (a.position === b.position) {
        const aDepth = depthRank.get(a.id);
        const bDepth = depthRank.get(b.id);
        if (aDepth !== undefined || bDepth !== undefined) return (aDepth ?? Number.MAX_SAFE_INTEGER) - (bDepth ?? Number.MAX_SAFE_INTEGER);
      }
      return effectiveOverall(b) - effectiveOverall(a);
    });
}

function receivingUsageWeights(targets: Player[], matchups = new Map<string, ReceiverMatchup>()): Map<string, number> {
  const roleMultipliers = [1.85, 1.35, 1, 0.78, 0.62, 0.5, 0.42];
  const ranked = [...targets].sort((a, b) => receivingSkill(b) - receivingSkill(a));
  return new Map(
    ranked.map((player, index) => {
      const eliteBonus = player.position === "WR" && effectiveOverall(player) >= 90 ? 1.12 : 1;
      const matchup = matchups.get(player.id);
      return [player.id, receivingSkill(player) * (roleMultipliers[index] ?? 0.42) * eliteBonus * (matchup?.yardMultiplier ?? 1)];
    }),
  );
}

function targetUsageWeights(targets: Player[], matchups = new Map<string, ReceiverMatchup>()): Map<string, number> {
  const roleMultipliers = [1.58, 1.28, 1, 0.86, 0.72, 0.6, 0.52];
  const ranked = [...targets].sort((a, b) => receivingSkill(b) - receivingSkill(a));
  return new Map(
    ranked.map((player, index) => {
      const eliteBonus = player.position === "WR" && effectiveOverall(player) >= 90 ? 1.04 : 1;
      const matchup = matchups.get(player.id);
      return [player.id, receivingSkill(player) * (roleMultipliers[index] ?? 0.52) * eliteBonus * (matchup?.targetMultiplier ?? 1)];
    }),
  );
}

function receivingSkill(player: Player): number {
  const attributes = effectiveAttributes(player);
  return effectiveOverall(player) + attributes.catching * 0.55 + attributes.routeRunning * 0.5 + attributes.speed * 0.25 + attributes.awareness * 0.15;
}

function receiverCoverageMatchups(targets: Player[], opponent: Team | Player[]): Map<string, ReceiverMatchup> {
  const receivers = [...targets].sort((a, b) => receivingSkill(b) - receivingSkill(a));
  const corners = topAt(opponent, ["CB"], 5).sort((a, b) => coverageSkill(b) - coverageSkill(a));
  const safeties = topAt(opponent, ["S"], 4).sort((a, b) => coverageSkill(b) - coverageSkill(a));
  const linebackers = topAt(opponent, ["LB"], 4).sort((a, b) => coverageSkill(b) - coverageSkill(a));
  const fallback = uniquePlayers([...corners, ...safeties, ...linebackers]).sort((a, b) => coverageSkill(b) - coverageSkill(a));
  let wideoutIndex = 0;
  let tightEndIndex = 0;

  return new Map(
    receivers.map((receiver) => {
      const defender =
        receiver.position === "WR"
          ? corners[Math.min(wideoutIndex++, Math.max(0, corners.length - 1))] ?? fallback[0]
          : safeties[tightEndIndex++] ?? linebackers[0] ?? fallback[0];
      const edge = clamp(receiverMatchupSkill(receiver) - (defender ? coverageSkill(defender) : 65), -70, 70);
      return [
        receiver.id,
        {
          defender,
          edge,
          targetMultiplier: clamp(1 + edge / 175, 0.68, 1.38),
          yardMultiplier: clamp(1 + edge / 165, 0.68, 1.42),
          completionModifier: clamp(edge / 520, -0.1, 0.1),
        },
      ];
    }),
  );
}

function receiverMatchupSkill(player: Player): number {
  const attributes = effectiveAttributes(player);
  return effectiveOverall(player) * 0.32 + attributes.speed * 0.36 + attributes.routeRunning * 0.38 + attributes.catching * 0.22 + attributes.awareness * 0.12;
}

function coverageSkill(player: Player): number {
  const attributes = effectiveAttributes(player);
  return effectiveOverall(player) * 0.32 + attributes.speed * 0.36 + attributes.defAwareness * 0.36 + attributes.interception * 0.24 + attributes.tackle * 0.06;
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

function quarterbackCompletionRate(
  rng: Rng,
  strategy: OffensiveStrategy,
  attributes: ReturnType<typeof effectiveAttributes> | undefined,
  units: ReturnType<typeof teamUnitRatings>,
  opponentUnits: ReturnType<typeof teamUnitRatings>,
): number {
  const accuracy = attributes?.accuracy ?? units.passing;
  const awareness = attributes?.awareness ?? units.passing;
  const strategyAdjustment: Record<OffensiveStrategy, number> = {
    balanced: 0,
    airRaid: -0.018,
    runHeavy: 0.012,
    proStyle: 0.006,
    spreadTempo: -0.01,
  };
  const passerQuality = (accuracy - 70) / 460 + (awareness - 70) / 760;
  const support = (units.receiving - 70) / 560 + (units.blocking - opponentUnits.defense) / 720;
  const coveragePressure = (opponentUnits.coverage - 70) / 360;
  const gameNoise = rng.nextInt(-7, 8) / 100;
  return clamp(0.565 + strategyAdjustment[strategy] + passerQuality + support - coveragePressure + gameNoise, 0.41, 0.73);
}

function passingTouchdownShare(
  strategy: OffensiveStrategy,
  passRate: number,
  units: ReturnType<typeof teamUnitRatings>,
  opponentUnits: ReturnType<typeof teamUnitRatings>,
): number {
  const strategyAdjustment: Record<OffensiveStrategy, number> = {
    balanced: 0,
    airRaid: 0.12,
    runHeavy: -0.12,
    proStyle: 0.045,
    spreadTempo: 0.075,
  };
  const rosterFit = (units.passing + units.receiving - units.rushing * 1.2 - 50) / 260;
  const matchupFit = (units.passing + units.receiving - opponentUnits.coverage - opponentUnits.defense * 0.35) / 300;
  const minShare = strategy === "airRaid" ? 0.46 : strategy === "runHeavy" ? 0.18 : 0.26;
  const maxShare = strategy === "runHeavy" ? 0.62 : strategy === "airRaid" ? 0.9 : 0.82;
  return clamp(passRate + strategyAdjustment[strategy] + rosterFit + matchupFit, minShare, maxShare);
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
  const homeContext = createPlayContext(rng, home, away, homeProfile, "home");
  const awayContext = createPlayContext(rng, away, home, awayProfile, "away");
  const scripted: ScriptedPlay[] = [];
  const totalPlaysEstimate = estimatedPlayCount(homeProfile, awayProfile);
  let homeScore = 0;
  let awayScore = 0;
  let offense = rng.chance(0.5) ? homeContext : awayContext;
  let driveGuard = 0;

  while ((hasPlayableEvents(homeContext) || hasPlayableEvents(awayContext)) && driveGuard < 420) {
    if (!hasPlayableEvents(offense)) offense = offense.side === "home" ? awayContext : homeContext;
    if (!hasPlayableEvents(offense)) break;
    const drive = buildDrive(rng, offense, { homeScore, awayScore, playIndex: scripted.length, totalPlaysEstimate });
    scripted.push(...drive);
    for (const play of drive) {
      if (play.side === "home") homeScore += play.points;
      else awayScore += play.points;
    }
    offense = offense.side === "home" ? awayContext : homeContext;
    driveGuard += 1;
  }

  return stampScriptedPlays(scripted);
}

function createPlayContext(rng: Rng, team: Team, opponent: Team, profile: TeamGameProfile, side: "home" | "away"): PlayContext {
  const units = teamUnitRatings(team.roster);
  const opponentUnits = teamUnitRatings(opponent.roster);
  const targets = rotationAt(rng, team, ["WR", "TE"], 7);
  return {
    team,
    opponent,
    side,
    profile,
    qb: topAt(team, ["QB"], 1)[0],
    backs: rotationAt(rng, team, ["HB"], 3),
    targets,
    punter: topAt(team, ["P"], 1)[0],
    kicker: topAt(team, ["K"], 1)[0],
    returners: uniquePlayers([...topAt(opponent, ["WR"], 3), ...topAt(opponent, ["CB"], 2), ...topAt(opponent, ["HB"], 1)]),
    defenders: uniquePlayers([...topAt(opponent, ["CB"], 3), ...topAt(opponent, ["S"], 3), ...topAt(opponent, ["LB"], 3), ...topAt(opponent, ["DL"], 3)]),
    receiverMatchups: receiverCoverageMatchups(targets, opponent),
    pancakeBlockers: [...profile.pancakeBlockers],
    passProtectionEdge: units.blocking - opponentUnits.defense,
    passRemaining: profile.passAttempts,
    rushRemaining: profile.rushAttempts,
    scoringEvents: rng.shuffle(profile.scoringEvents),
    xpEvents: [...profile.extraPointEvents, ...profile.missedExtraPointEvents],
  };
}

function estimatedPlayCount(homeProfile: TeamGameProfile, awayProfile: TeamGameProfile): number {
  const profileTotal = (profile: TeamGameProfile) => profile.passAttempts + profile.rushAttempts + profile.scoringEvents.length + profile.extraPointEvents.length + profile.missedExtraPointEvents.length;
  return Math.max(1, profileTotal(homeProfile) + profileTotal(awayProfile) + 14);
}

function hasPlayableEvents(context: PlayContext): boolean {
  return context.passRemaining + context.rushRemaining + context.scoringEvents.length > 0;
}

function buildDrive(rng: Rng, context: PlayContext, flow: GameFlow): ScriptedPlay[] {
  const events: ScriptedPlay[] = [];
  let state: DriveState = {
    down: 1,
    distance: 10,
    yardLine: rng.nextInt(18, 35),
  };
  let snaps = 0;
  const minimumDriveSnaps = rng.nextInt(2, 5);

  while (hasPlayableEvents(context) && snaps < 16) {
    const openAttempts = openPassAttempts(context) + openRushAttempts(context);
    const nextScore = context.scoringEvents[0];
    const canUseScoringEvent = Boolean(nextScore && (!isFieldGoalEvent(nextScore) || state.down === 4));
    const shouldUseScoringEvent =
      canUseScoringEvent &&
      (snaps >= minimumDriveSnaps || openAttempts === 0 || state.yardLine >= rng.nextInt(62, 82) || attemptsRemaining(context) <= context.scoringEvents.length + 1);

    if (shouldUseScoringEvent) {
      events.push(...consumeScoringPlay(rng, context, state));
      break;
    }

    if (state.down === 4) {
      if (nextScore?.type === "fieldGoal" || nextScore?.type === "missedFieldGoal") {
        events.push(...consumeScoringPlay(rng, context, state));
      } else if (shouldAttemptFourthDown(context, state, flow, events.length)) {
        events.push(buildFourthDownAttempt(rng, context, state, flow, events.length));
      } else {
        events.push(buildPuntPlay(rng, context, state));
      }
      break;
    }

    const normalPlay = buildNormalPlay(rng, context, state);
    if (!normalPlay) {
      const nextScore = context.scoringEvents[0];
      if (nextScore) {
        events.push(...(isFieldGoalEvent(nextScore) ? consumeFieldGoalAfterStall(rng, context, state) : consumeScoringPlay(rng, context, state)));
      }
      break;
    }
    events.push(normalPlay);
    state = advanceDriveState(state, normalPlay.yards ?? 0);
    snaps += 1;
  }

  if (!events.length && context.scoringEvents.length) {
    const nextScore = context.scoringEvents[0];
    return isFieldGoalEvent(nextScore) && state.down !== 4 ? consumeFieldGoalAfterStall(rng, context, state) : consumeScoringPlay(rng, context, state);
  }
  return finishDriveIfNeeded(rng, context, state, events, flow);
}

function isFieldGoalEvent(event: ScoringEvent | undefined): boolean {
  return event?.type === "fieldGoal" || event?.type === "missedFieldGoal";
}

function consumeFieldGoalAfterStall(rng: Rng, context: PlayContext, state: DriveState): ScriptedPlay[] {
  const plays: ScriptedPlay[] = [];
  const stalled = appendDriveStallsToFourth(context, state, plays);
  plays.push(...consumeScoringPlay(rng, context, stalled));
  return plays;
}

function finishDriveIfNeeded(rng: Rng, context: PlayContext, state: DriveState, events: ScriptedPlay[], flow: GameFlow): ScriptedPlay[] {
  const last = events.at(-1);
  if (!last || isTerminalPlay(last)) return events;
  events.push(...terminalDriveSequence(rng, context, state, events, flow));
  return events;
}

function terminalDriveSequence(rng: Rng, context: PlayContext, state: DriveState, events: ScriptedPlay[], flow: GameFlow): ScriptedPlay[] {
  const nextScore = context.scoringEvents[0];
  if (nextScore) {
    return isFieldGoalEvent(nextScore) && state.down !== 4 ? consumeFieldGoalAfterStall(rng, context, state) : consumeScoringPlay(rng, context, state);
  }
  const plays: ScriptedPlay[] = [];
  const fourthDownState = appendDriveStallsToFourth(context, state, plays);
  plays.push(shouldAttemptFourthDown(context, fourthDownState, flow, events.length + plays.length) ? buildFourthDownAttempt(rng, context, fourthDownState, flow, events.length + plays.length) : buildPuntPlay(rng, context, fourthDownState));
  return plays;
}

function appendDriveStallsToFourth(context: PlayContext, state: DriveState, plays: ScriptedPlay[]): DriveState {
  let stalled = state;
  while (stalled.down < 4) {
    plays.push(buildDriveStallPlay(context, stalled));
    stalled = advanceDriveState(stalled, 0);
  }
  return stalled;
}

function buildDriveStallPlay(context: PlayContext, state: DriveState): ScriptedPlay {
  const shouldPass = context.profile.strategy === "airRaid" || context.profile.strategy === "spreadTempo" || state.down === 3 || state.distance >= 7;
  if (shouldPass) {
    const passer = context.qb?.name ?? "The quarterback";
    const target = context.targets[0]?.name ?? "the receiver";
    return {
      ...basePlay(context, "driveStall", 0, state, 0),
      description: `${passer} threw incomplete for ${target}.`,
    };
  }
  const runner = context.backs[0]?.name ?? context.qb?.name ?? "The runner";
  return {
    ...basePlay(context, "driveStall", 0, state, 0),
    description: `${runner} was bottled up for no gain.`,
  };
}

function shouldAttemptFourthDown(context: PlayContext, state: DriveState, flow: GameFlow, additionalPlays: number): boolean {
  if (state.yardLine >= 65) return true;
  if (state.yardLine >= 50 && state.distance <= 2) return true;
  const margin = scoreMargin(context, flow);
  const clock = projectedGameClock(flow, additionalPlays);
  const remainingInventory = context.passRemaining + context.rushRemaining + context.scoringEvents.length;
  const endGamePressure = margin < 0 && (clock.quarter === 4 || flow.playIndex + additionalPlays >= flow.totalPlaysEstimate * 0.68 || remainingInventory <= 16);
  const lateTrailing = margin < 0 && clock.quarter === 4 && clock.secondsRemaining <= 300;
  const urgentTrailing = margin <= -8 && clock.quarter === 4 && clock.secondsRemaining <= 480;
  if ((lateTrailing || urgentTrailing || endGamePressure) && state.distance <= 20) return true;
  return context.profile.strategy === "airRaid" && margin < 0 && clock.quarter === 4 && state.distance <= 7;
}

function buildFourthDownAttempt(rng: Rng, context: PlayContext, state: DriveState, flow: GameFlow, additionalPlays: number): ScriptedPlay {
  const shouldPass = fourthDownPassCall(context, state, flow, additionalPlays);
  if (shouldPass) {
    const passer = context.qb?.name ?? "The quarterback";
    const target = selectTarget(rng, context)?.name ?? "the receiver";
    return {
      ...basePlay(context, "turnoverOnDowns", 0, { ...state, down: 4 }, 0),
      description: `${passer}'s fourth-down throw for ${target} fell incomplete.`,
    };
  }
  const runner = selectRunner(rng, context)?.name ?? context.qb?.name ?? "The runner";
  const yards = state.distance <= 1 ? 0 : rng.nextInt(0, Math.max(0, state.distance - 1));
  return {
    ...basePlay(context, "turnoverOnDowns", 0, { ...state, down: 4 }, yards),
    description: `${runner} was stopped ${yards > 0 ? `${state.distance - yards} ${state.distance - yards === 1 ? "yard" : "yards"} short` : "at the line"} on fourth down.`,
  };
}

function fourthDownPassCall(context: PlayContext, state: DriveState, flow: GameFlow, additionalPlays: number): boolean {
  const margin = scoreMargin(context, flow);
  const clock = projectedGameClock(flow, additionalPlays);
  if (context.profile.strategy === "airRaid") return true;
  if (state.distance >= 3) return true;
  if (margin < 0 && (clock.quarter === 4 || context.passRemaining + context.rushRemaining + context.scoringEvents.length <= 16) && clock.secondsRemaining <= 420) return true;
  return context.profile.strategy === "spreadTempo" && state.yardLine >= 80;
}

function scoreMargin(context: PlayContext, flow: GameFlow): number {
  return context.side === "home" ? flow.homeScore - flow.awayScore : flow.awayScore - flow.homeScore;
}

function projectedGameClock(flow: GameFlow, additionalPlays: number): { quarter: number; secondsRemaining: number } {
  const total = Math.max(1, flow.totalPlaysEstimate);
  const index = clamp(flow.playIndex + additionalPlays, 0, total - 1);
  const progress = index / total;
  const quarter = clamp(Math.floor(progress * 4) + 1, 1, 4);
  const quarterProgress = progress * 4 - (quarter - 1);
  return {
    quarter,
    secondsRemaining: clamp(895 - Math.floor(quarterProgress * 850), 5, 895),
  };
}

function isTerminalPlay(play: ScriptedPlay): boolean {
  return ["punt", "passTd", "rushTd", "fieldGoal", "missedFieldGoal", "extraPoint", "missedExtraPoint", "turnover", "turnoverOnDowns"].includes(play.type);
}

function consumeScoringPlay(rng: Rng, context: PlayContext, state: DriveState): ScriptedPlay[] {
  const event = context.scoringEvents.shift();
  if (!event) return [];
  const plays: ScriptedPlay[] = [];

  if (event.type === "passTd") {
    const yards = Math.max(1, 100 - state.yardLine);
    const { passer, receiver } = passTouchdownNames(event.description, context);
    context.passRemaining = Math.max(0, context.passRemaining - 1);
    plays.push({
      ...basePlay(context, "passTd", event.points, state, yards),
      description: `${passer} found ${receiver} for a ${yards}-yard touchdown.`,
    });
    plays.push(...consumeExtraPoint(context));
    return plays;
  }

  if (event.type === "rushTd") {
    const yards = Math.max(1, 100 - state.yardLine);
    const runner = nameBeforeAny(event.description, [" kept", " punched"], selectRunner(rng, context)?.name ?? "The runner");
    context.rushRemaining = Math.max(0, context.rushRemaining - 1);
    plays.push({
      ...basePlay(context, "rushTd", event.points, state, yards),
      description: `${runner} ran for a ${yards}-yard touchdown.`,
    });
    plays.push(...consumeExtraPoint(context));
    return plays;
  }

  if (event.type === "fieldGoal" || event.type === "missedFieldGoal") {
    const kickDistance = fieldGoalDistance(state);
    const kicker = nameBeforeAny(event.description, [" made", " missed"], context.kicker?.name ?? "The kicker");
    plays.push({
      ...basePlay(context, event.type, event.points, { ...state, down: 4 }, kickDistance),
      description: event.type === "fieldGoal" ? `${kicker} made a ${kickDistance}-yard field goal.` : `${kicker} missed a ${kickDistance}-yard field goal.`,
    });
    return plays;
  }

  if (event.type === "turnover") {
    const passer = nameBeforeAny(event.description, [" threw"], context.qb?.name ?? "The quarterback");
    const defender = selectDefender(rng, context)?.name ?? "the defender";
    const returnYards = rng.nextInt(0, 38);
    context.passRemaining = Math.max(0, context.passRemaining - 1);
    plays.push({
      ...basePlay(context, "turnover", event.points, state, returnYards),
      description: `${passer} was intercepted by ${defender}, returned ${returnYards} yards.`,
    });
    return plays;
  }

  plays.push({
    ...basePlay(context, event.type, event.points, state, 0),
    description: event.description,
  });
  return plays;
}

function consumeExtraPoint(context: PlayContext): ScriptedPlay[] {
  const event = context.xpEvents.shift();
  if (!event) return [];
  const kicker = nameBeforeAny(event.description, [" added", " missed"], context.kicker?.name ?? "The kicker");
  return [
    {
      teamId: context.team.id,
      teamName: context.team.name,
      side: context.side,
      type: event.type,
      description: event.type === "extraPoint" ? `${kicker} made the extra point.` : `${kicker} missed the extra point.`,
      points: event.points,
      yards: 0,
    },
  ];
}

function buildNormalPlay(rng: Rng, context: PlayContext, state: DriveState): ScriptedPlay | undefined {
  const openPasses = openPassAttempts(context);
  const openRushes = openRushAttempts(context);
  if (openPasses + openRushes <= 0) return undefined;
  const passBias = normalPlayPassBias(context, state);
  const passRate = openPasses / (openPasses + openRushes);
  const [minPass, maxPass] = normalPlayPassBounds(context.profile.strategy);
  const shouldPass = openPasses > 0 && (openRushes === 0 || rng.chance(clamp(passRate + passBias, minPass, maxPass)));
  return shouldPass ? buildPassPlay(rng, context, state) : buildRushPlay(rng, context, state);
}

function normalPlayPassBias(context: PlayContext, state: DriveState): number {
  const strategyBias: Record<OffensiveStrategy, number> = {
    balanced: 0,
    airRaid: 0.18,
    runHeavy: -0.14,
    proStyle: 0.04,
    spreadTempo: 0.1,
  };
  const downBias = state.down === 3 || state.distance >= 8 ? 0.14 : state.down === 1 && state.distance <= 10 ? -0.04 : 0;
  const redZoneBias = state.yardLine >= 80 && context.profile.strategy === "airRaid" ? 0.16 : state.yardLine >= 90 && state.distance <= 3 && context.profile.strategy !== "runHeavy" ? 0.08 : 0;
  return strategyBias[context.profile.strategy] + downBias + redZoneBias;
}

function normalPlayPassBounds(strategy: OffensiveStrategy): [number, number] {
  if (strategy === "airRaid") return [0.5, 0.92];
  if (strategy === "spreadTempo") return [0.42, 0.86];
  if (strategy === "runHeavy") return [0.16, 0.58];
  return [0.28, 0.8];
}

function buildPassPlay(rng: Rng, context: PlayContext, state: DriveState): ScriptedPlay {
  context.passRemaining = Math.max(0, context.passRemaining - 1);
  const quarterback = context.qb?.name ?? "The quarterback";
  const targetPlayer = selectTarget(rng, context);
  const target = targetPlayer?.name ?? "the receiver";
  const matchup = targetPlayer ? context.receiverMatchups.get(targetPlayer.id) : undefined;
  const qbAccuracy = context.qb ? effectiveAttributes(context.qb).accuracy : 70;
  const pressurePenalty = -context.passProtectionEdge / 420;

  if (rng.chance(clamp(0.058 - qbAccuracy / 1800 + pressurePenalty, 0.015, 0.13))) {
    const defender = selectDefender(rng, context)?.name ?? "the pass rush";
    const loss = rng.nextInt(3, 10);
    return {
      ...basePlay(context, "sack", 0, state, -loss),
      description: `${defender} sacked ${quarterback} for a loss of ${loss} ${loss === 1 ? "yard" : "yards"}.`,
    };
  }

  const completionChance = clamp(0.58 + (qbAccuracy - 70) / 180 + context.passProtectionEdge / 560 + (matchup?.completionModifier ?? 0) - (state.distance >= 10 ? 0.04 : 0), 0.42, 0.8);
  if (!rng.chance(completionChance)) {
    const coveragePhrase = matchup?.defender ? ` under coverage from ${matchup.defender.name}` : "";
    return {
      ...basePlay(context, "pass", 0, state, 0),
      description: `${quarterback} threw incomplete for ${target}${coveragePhrase}.`,
    };
  }

  const maxGain = maxNormalGain(state, 46);
  const baseGain = state.distance <= 3 ? rng.nextInt(2, 9) : rng.nextInt(4, 18);
  const explosive = rng.chance(0.14) ? rng.nextInt(10, 28) : 0;
  const conversionBoost = state.down === 3 && baseGain < state.distance && rng.chance(0.42) ? state.distance - baseGain + rng.nextInt(0, 7) : 0;
  const matchupYards = matchup ? Math.round(matchup.edge / 12) : 0;
  const yards = clamp(baseGain + explosive + conversionBoost + matchupYards, 0, maxGain);
  return {
    ...basePlay(context, "pass", 0, state, yards),
    description: `${quarterback} completed to ${target} for ${yardPhrase(yards)}.`,
  };
}

function buildRushPlay(rng: Rng, context: PlayContext, state: DriveState): ScriptedPlay {
  context.rushRemaining = Math.max(0, context.rushRemaining - 1);
  const runner = selectRunner(rng, context)?.name ?? context.qb?.name ?? "The runner";
  const maxGain = maxNormalGain(state, 34);
  const shortYardageBoost = state.distance <= 2 ? 1 : 0;
  const explosive = rng.chance(0.09) ? rng.nextInt(8, 21) : 0;
  const yards = clamp(rng.nextInt(-3, 8) + shortYardageBoost + explosive, -5, maxGain);
  const pancakeBlocker = yards > 0 ? context.pancakeBlockers.shift() : undefined;
  return {
    ...basePlay(context, "rush", 0, state, yards),
    description: `${runner} rushed for ${yardPhrase(yards)}${pancakeBlocker ? ` behind ${pancakeBlocker}'s pancake block` : ""}.`,
  };
}

function buildPuntPlay(rng: Rng, context: PlayContext, state: DriveState): ScriptedPlay {
  const punter = context.punter?.name ?? "The punter";
  const returner = rng.chance(0.82) ? selectReturner(rng, context)?.name : undefined;
  const kickPower = context.punter ? effectiveAttributes(context.punter).kickPower : 70;
  const puntYards = clamp(rng.nextInt(38, 52) + Math.round((kickPower - 70) / 5), 32, 62);
  const returnYards = returner ? rng.nextInt(0, 19) : 0;
  return {
    ...basePlay(context, "punt", 0, state, puntYards),
    description: returner ? `${punter} punted ${puntYards} yards to ${returner}, returned ${returnYards} yards.` : `${punter} punted ${puntYards} yards with no return.`,
  };
}

function basePlay(context: PlayContext, type: PlayEventType, points: number, state: DriveState, yards: number): ScriptedPlay {
  return {
    teamId: context.team.id,
    teamName: context.team.name,
    side: context.side,
    type,
    description: "",
    points,
    down: state.down,
    distance: state.distance,
    yardLine: formatYardLine(context, state.yardLine),
    yards,
  };
}

function stampScriptedPlays(scripted: ScriptedPlay[]): PlayByPlayEvent[] {
  let homeScore = 0;
  let awayScore = 0;
  const total = Math.max(1, scripted.length);
  return scripted.map((play, index) => {
    if (play.side === "home") homeScore += play.points;
    else awayScore += play.points;
    const quarter = Math.min(4, Math.floor((index / total) * 4) + 1);
    const quarterStart = Math.floor(((quarter - 1) * total) / 4);
    const quarterEnd = Math.max(quarterStart + 1, Math.floor((quarter * total) / 4));
    const quarterCount = Math.max(1, quarterEnd - quarterStart);
    const quarterIndex = index - quarterStart;
    const tick = clamp(895 - Math.floor((quarterIndex / quarterCount) * 850), 5, 895);
    return {
      quarter,
      clock: formatClock(tick),
      teamId: play.teamId,
      teamName: play.teamName,
      type: play.type,
      description: play.description,
      playNumber: index + 1,
      down: play.down,
      distance: play.distance,
      yardLine: play.yardLine,
      yards: play.yards,
      homeScore,
      awayScore,
    };
  });
}

function advanceDriveState(state: DriveState, yards: number): DriveState {
  const cappedYards = yards > 0 ? Math.min(yards, maxNormalGain(state, yards)) : yards;
  const yardLine = clamp(state.yardLine + cappedYards, 1, 99);
  if (cappedYards >= state.distance) {
    return {
      down: 1,
      distance: firstDownDistance(yardLine),
      yardLine,
    };
  }
  return {
    down: Math.min(4, state.down + 1) as 1 | 2 | 3 | 4,
    distance: clamp(state.distance - cappedYards, 1, 32),
    yardLine,
  };
}

function maxNormalGain(state: DriveState, cap: number): number {
  return Math.max(0, Math.min(cap, 99 - state.yardLine));
}

function firstDownDistance(yardLine: number): number {
  return clamp(100 - yardLine, 1, 10);
}

function fieldGoalDistance(state: DriveState): number {
  return clamp(100 - state.yardLine + 17, 24, 58);
}

function attemptsRemaining(context: PlayContext): number {
  return context.passRemaining + context.rushRemaining;
}

function openPassAttempts(context: PlayContext): number {
  const reserved = context.scoringEvents.filter((event) => event.type === "passTd" || event.type === "turnover").length;
  return Math.max(0, context.passRemaining - reserved);
}

function openRushAttempts(context: PlayContext): number {
  const reserved = context.scoringEvents.filter((event) => event.type === "rushTd").length;
  return Math.max(0, context.rushRemaining - reserved);
}

function selectRunner(rng: Rng, context: PlayContext): Player | undefined {
  const options = context.qb && rng.chance(0.12) ? [...context.backs, context.qb] : context.backs;
  return weightedPlayer(rng, options, (player) => effectiveOverall(player) + effectiveAttributes(player).speed * 0.45 + effectiveAttributes(player).awareness * 0.2);
}

function selectTarget(rng: Rng, context: PlayContext): Player | undefined {
  return weightedPlayer(rng, context.targets, (player) => receivingSkill(player) * (context.receiverMatchups.get(player.id)?.targetMultiplier ?? 1));
}

function selectDefender(rng: Rng, context: PlayContext): Player | undefined {
  return weightedPlayer(rng, context.defenders, (player) => effectiveOverall(player) + effectiveAttributes(player).defAwareness * 0.45 + effectiveAttributes(player).interception * 0.3 + effectiveAttributes(player).tackle * 0.2);
}

function selectReturner(rng: Rng, context: PlayContext): Player | undefined {
  return weightedPlayer(rng, context.returners, (player) => effectiveOverall(player) + effectiveAttributes(player).speed * 0.65 + effectiveAttributes(player).awareness * 0.2);
}

function weightedPlayer(rng: Rng, players: Player[], weightFor: (player: Player) => number): Player | undefined {
  if (!players.length) return undefined;
  return rng.weighted(players.map((player) => ({ value: player, weight: Math.max(1, weightFor(player)) })));
}

function passTouchdownNames(description: string, context: PlayContext): { passer: string; receiver: string } {
  const match = description.match(/^(.+?) found (.+?) for/);
  return {
    passer: match?.[1]?.trim() || context.qb?.name || "The quarterback",
    receiver: match?.[2]?.trim() || selectFallbackName(context.targets, "the receiver"),
  };
}

function nameBeforeAny(description: string, markers: string[], fallback: string): string {
  for (const marker of markers) {
    const index = description.indexOf(marker);
    if (index > 0) return description.slice(0, index).trim();
  }
  return fallback;
}

function selectFallbackName(players: Player[], fallback: string): string {
  return players[0]?.name ?? fallback;
}

function formatYardLine(context: PlayContext, yardLine: number): string {
  if (yardLine === 50) return "50";
  if (yardLine < 50) return `${context.team.abbreviation} ${yardLine}`;
  return `${context.opponent.abbreviation} ${100 - yardLine}`;
}

function yardPhrase(yards: number): string {
  if (yards === 0) return "no gain";
  if (yards < 0) return `a loss of ${Math.abs(yards)} ${Math.abs(yards) === 1 ? "yard" : "yards"}`;
  return `${yards} ${yards === 1 ? "yard" : "yards"}`;
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
    passAttempts: after.passAttempts - before.passAttempts,
    passCompletions: after.passCompletions - before.passCompletions,
    passYards: after.passYards - before.passYards,
    passTd: after.passTd - before.passTd,
    interceptionsThrown: after.interceptionsThrown - before.interceptionsThrown,
    rushAttempts: after.rushAttempts - before.rushAttempts,
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
    stats.passCompletions * 0.25 +
    stats.passTd * 12 +
    stats.rushAttempts * 0.08 +
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
