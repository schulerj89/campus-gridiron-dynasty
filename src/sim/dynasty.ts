import { createSeasonAwards, createWeeklyAwards, rankTeams, recruitingClassRankings, selectPlayoffSeeds } from "./awards";
import { calculateSeasonRecruitingBudget, calculateWeeklyRecruitingPoints, createRecruitClass, createWalkOnPlayer, freshTeamSeason, resetPlayerStats, signedPlayerIdForRecruit } from "./generate";
import { simulateGame } from "./game";
import { applyPositionCaps, calculateOverall, TARGET_ROSTER } from "./ratings";
import { clamp, Rng } from "./rng";
import { createPollSnapshot } from "./polls";
import { createNextPlayoffRound, createPlayoffGames, createSchedule } from "./schedule";
import { advanceRecruitingWeek, autoRecruit, OFFER_COST, signRecruitingClass } from "./recruiting";
import {
  MAX_BLUEPRINT_CATEGORY_POINTS,
  autoBlueprintAllocations,
  blueprintAllocation,
  blueprintCoachRetention,
  blueprintDevelopmentBonus,
  blueprintRetentionBonus,
  createProgramBlueprint,
  completeBlueprintAllocations,
  ensureProgramBlueprint,
  resolveProgramBlueprint,
  blueprintRemaining,
} from "./blueprint";
import {
  ATTRIBUTE_KEYS,
  type AttributeKey,
  type Attributes,
  type BlueprintCategory,
  type BlueprintFocus,
  type Coach,
  type CollegeYear,
  type DynastyState,
  type Game,
  type OffseasonReport,
  type Phase,
  type Player,
  type PlayerDeparture,
  type PlayerProgression,
  type Position,
  type ProgramChange,
  type ProgramRatings,
  type OffensiveStrategy,
  type Recruit,
  type RecruitSigning,
  type RecruitTrait,
  type SeasonAwards,
  type Team,
  type WalkOnAddition,
} from "./types";

const PROGRESSION_FOCUS: Record<Position, AttributeKey[]> = {
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

const DEVELOPMENT_PROFILES: Record<RecruitTrait, { base: number; breakoutChance: number; breakoutMin: number; breakoutMax: number; maxBudget: number; focusGainCap: number; maxOverallGain: number }> = {
  elite: { base: 5.2, breakoutChance: 0.24, breakoutMin: 2, breakoutMax: 5, maxBudget: 14, focusGainCap: 8, maxOverallGain: 7 },
  starter: { base: 3.4, breakoutChance: 0.12, breakoutMin: 1, breakoutMax: 3, maxBudget: 11, focusGainCap: 6, maxOverallGain: 5 },
  rotation: { base: 2.3, breakoutChance: 0.07, breakoutMin: 1, breakoutMax: 2, maxBudget: 9, focusGainCap: 5, maxOverallGain: 4 },
  depth: { base: 1.4, breakoutChance: 0.04, breakoutMin: 1, breakoutMax: 2, maxBudget: 7, focusGainCap: 4, maxOverallGain: 3 },
  project: { base: 0.9, breakoutChance: 0.05, breakoutMin: 1, breakoutMax: 3, maxBudget: 8, focusGainCap: 5, maxOverallGain: 4 },
};

const OFFSEASON_RECRUITING_START_WEEK = 16;
const OFFSEASON_RECRUITING_END_WEEK = 19;
const PRESEASON_DEVELOPMENT_WEEK = 21;
const ROSTER_FLOOR = Object.values(TARGET_ROSTER).reduce((sum, count) => sum + count, 0);

export function advanceWeek(input: DynastyState): DynastyState {
  if (input.phase === "complete") return input;
  const kickoffReady = input.phase === "regular" && input.week === 1 ? finalizeProgramBlueprintForKickoff(input) : input;
  const withAuto = kickoffReady.phase === "regular" && kickoffReady.recruiting.autoEnabled && kickoffReady.recruiting.pointsRemaining > 0 ? autoRecruit(kickoffReady) : kickoffReady;
  let state = { ...withAuto, updatedAt: new Date().toISOString() };
  if (state.phase === "regular") return advanceRegularWeek(state);
  if (state.phase === "postseason") return advancePostseasonWeek(state);
  if (state.phase === "offseason") return advanceOffseasonWeek(state);
  if (state.phase === "preseason") return startRegularSeason(state);
  return state;
}

export function simulateSeasons(input: DynastyState, seasons: number): DynastyState {
  let state = input;
  const targetHistoryLength = Math.min(state.maxYears, state.history.length + Math.max(0, seasons));
  let guard = 0;
  while (state.phase !== "complete" && guard < Math.max(1, seasons) * 44 + 100) {
    const reachedTargetHistory = state.history.length >= targetHistoryLength;
    if (targetHistoryLength < state.maxYears && reachedTargetHistory && state.phase === "regular") break;
    state = advanceWeek(state);
    guard += 1;
  }
  return state;
}

export function forceUserPlayoff(state: DynastyState): DynastyState {
  return {
    ...state,
    debugFlags: { ...state.debugFlags, forceUserPlayoff: true },
    debugLog: [`Debug: user team will be placed in the next playoff field.`, ...state.debugLog].slice(0, 20),
  };
}

export function forceUserAward(state: DynastyState): DynastyState {
  return {
    ...state,
    debugFlags: { ...state.debugFlags, forceUserAward: true },
    debugLog: [`Debug: user-team QB will be forced into the next top national award slot.`, ...state.debugLog].slice(0, 20),
  };
}

export function forceUserWalkOnNeed(state: DynastyState): DynastyState {
  const keepCounts: Partial<Record<Position, number>> = {
    QB: 2,
    HB: 3,
    WR: 5,
    TE: 2,
    OL: 7,
    DL: 7,
    LB: 5,
    CB: 4,
    S: 4,
    K: 1,
    P: 1,
  };
  let keptCount = 0;
  const teams = state.teams.map((team) => {
    if (team.id !== state.userTeamId) return team;
    const roster = (Object.entries(keepCounts) as [Position, number][])
      .flatMap(([position, count]) =>
        team.roster
          .filter((player) => player.position === position)
          .sort((a, b) => b.overall - a.overall)
          .slice(0, count),
      )
      .sort((a, b) => b.overall - a.overall);
    keptCount = roster.length;
    return {
      ...team,
      roster,
      depthChart: {},
    };
  });
  return {
    ...state,
    teams,
    debugLog: [`Debug: user roster trimmed to ${keptCount} players so walk-on floor logic can be verified.`, ...state.debugLog].slice(0, 20),
  };
}

export function investProgramPoint(state: DynastyState, key: keyof ProgramRatings): DynastyState {
  let changed = false;
  const teams = state.teams.map((team) => {
    if (team.id !== state.userTeamId || team.programPoints <= 0) return team;
    changed = true;
    return {
      ...team,
      programPoints: team.programPoints - 1,
      program: {
        ...team.program,
        [key]: clamp(Math.round((team.program[key] ?? 50) + 2), 1, 99),
      },
    };
  });
  if (!changed) return state;
  return refreshRecruitingBudget({
    ...state,
    teams,
    debugLog: [`Invested a program point into ${String(key)}.`, ...state.debugLog].slice(0, 20),
  });
}

export function setUserOffensiveStrategy(state: DynastyState, strategy: OffensiveStrategy): DynastyState {
  const teams = state.teams.map((team) =>
    team.id === state.userTeamId
      ? {
          ...team,
          offensiveStrategy: strategy,
        }
      : team,
  );
  return {
    ...state,
    teams,
    debugLog: [`Set offensive strategy to ${strategy}.`, ...state.debugLog].slice(0, 20),
  };
}

export function canEditProgramBlueprint(state: DynastyState): boolean {
  if (state.phase === "preseason") return true;
  if (state.phase !== "regular" || state.week !== 1) return false;
  return !state.schedule.some((game) => game.week === 1 && game.played);
}

export function allocateBlueprintPoint(state: DynastyState, key: BlueprintCategory): DynastyState {
  if (!canEditProgramBlueprint(state)) return state;
  let changed = false;
  const teams = state.teams.map((team) => {
    if (team.id !== state.userTeamId) return team;
    const blueprint = ensureProgramBlueprint(team, state.calendarYear);
    if (blueprintRemaining(blueprint) <= 0 || blueprint.allocations[key] >= MAX_BLUEPRINT_CATEGORY_POINTS) return team;
    changed = true;
    const allocations = {
      ...blueprint.allocations,
      [key]: blueprint.allocations[key] + 1,
    };
    return {
      ...team,
      blueprint: {
        ...blueprint,
        focus: "custom" as BlueprintFocus,
        allocations,
        resolved: false,
      },
    };
  });
  if (!changed) return state;
  return refreshRecruitingBudget({
    ...state,
    teams,
    debugLog: [`Assigned one Program Blueprint point to ${String(key)}.`, ...state.debugLog].slice(0, 20),
  });
}

export function autoAllocateProgramBlueprint(state: DynastyState): DynastyState {
  if (!canEditProgramBlueprint(state)) return state;
  let changed = false;
  const teams = state.teams.map((team) => {
    if (team.id !== state.userTeamId) return team;
    const blueprint = ensureProgramBlueprint(team, state.calendarYear);
    const focus: BlueprintFocus = blueprint.focus === "custom" ? "balanced" : blueprint.focus;
    changed = true;
    return {
      ...team,
      blueprint: {
        ...blueprint,
        focus,
        allocations: autoBlueprintAllocations(team, blueprint.totalPoints, focus),
        resolved: false,
      },
    };
  });
  if (!changed) return state;
  return refreshRecruitingBudget({
    ...state,
    teams,
    debugLog: [`Auto-built the annual Program Blueprint.`, ...state.debugLog].slice(0, 20),
  });
}

export function setProgramBlueprintFocus(state: DynastyState, focus: BlueprintFocus): DynastyState {
  if (!canEditProgramBlueprint(state)) return state;
  let changed = false;
  const teams = state.teams.map((team) => {
    if (team.id !== state.userTeamId) return team;
    const blueprint = ensureProgramBlueprint(team, state.calendarYear);
    changed = true;
    return {
      ...team,
      blueprint: {
        ...blueprint,
        focus,
        allocations: focus === "custom" ? blueprint.allocations : autoBlueprintAllocations(team, blueprint.totalPoints, focus),
        resolved: false,
      },
    };
  });
  if (!changed) return state;
  return refreshRecruitingBudget({
    ...state,
    teams,
    debugLog: [`Set Program Blueprint focus to ${focus}.`, ...state.debugLog].slice(0, 20),
  });
}

function finalizeProgramBlueprintForKickoff(state: DynastyState): DynastyState {
  if (!canEditProgramBlueprint(state)) return state;
  let autoAssigned = 0;
  const teams = state.teams.map((team) => {
    if (team.id !== state.userTeamId) return team;
    const blueprint = ensureProgramBlueprint(team, state.calendarYear);
    const remaining = blueprintRemaining(blueprint);
    if (remaining <= 0) return team;
    autoAssigned = remaining;
    return {
      ...team,
      blueprint: {
        ...blueprint,
        allocations: completeBlueprintAllocations(team, blueprint),
        resolved: false,
      },
    };
  });
  if (autoAssigned <= 0) return state;
  return refreshRecruitingBudget({
    ...state,
    teams,
    debugLog: [`Auto-assigned ${autoAssigned} remaining Program Blueprint point${autoAssigned === 1 ? "" : "s"} at Week 1 kickoff.`, ...state.debugLog].slice(0, 20),
  });
}

export function spendCoachPoint(state: DynastyState, coachRole: Coach["role"], skill: "recruiting" | "development" | "tactics" | "culture"): DynastyState {
  let spentCoachName: string | undefined;
  const teams = state.teams.map((team) => {
    if (team.id !== state.userTeamId) return team;
    const coach = team.coaches[coachRole];
    if (!coach || coach.points <= 0) return team;
    spentCoachName = coach.name;
    return {
      ...team,
      coaches: {
        ...team.coaches,
        [coachRole]: {
          ...coach,
          points: coach.points - 1,
          [skill]: clamp(coach[skill] + 2, 1, 99),
        },
      },
    };
  });
  if (!spentCoachName) return state;
  const updatedState = {
    ...state,
    teams,
    debugLog: [`Spent a coach point on ${spentCoachName} ${skill}.`, ...state.debugLog].slice(0, 20),
  };
  return skill === "recruiting" ? refreshRecruitingBudget(updatedState) : updatedState;
}

export function hireCoach(state: DynastyState, coachId: string): DynastyState {
  if (state.phase !== "postseason" && state.phase !== "offseason") return state;
  const coach = state.coachPool.find((candidate) => candidate.id === coachId);
  if (!coach) return state;
  const userTeam = state.teams.find((team) => team.id === state.userTeamId);
  if (!userTeam) return state;
  const displacedCoach = userTeam.coaches[coach.role];
  const teams = state.teams.map((team) => {
    if (team.id !== state.userTeamId) return team;
    return {
      ...team,
      coaches: {
        ...team.coaches,
        [coach.role]: { ...coach, hiredBy: team.id },
      },
    };
  });
  return {
    ...state,
    teams,
    coachPool: [
      ...state.coachPool.filter((candidate) => candidate.id !== coachId && candidate.id !== displacedCoach.id),
      { ...displacedCoach, hiredBy: undefined },
    ],
    debugLog: [`Hired ${coach.name} as ${coach.role} coach.`, ...state.debugLog].slice(0, 20),
  };
}

export function getUserTeam(state: DynastyState): Team {
  const team = state.teams.find((candidate) => candidate.id === state.userTeamId);
  if (!team) throw new Error("User team not found.");
  return team;
}

export function topTeams(state: DynastyState, count = 25): Team[] {
  return rankTeams(state.teams).slice(0, count);
}

function advanceRegularWeek(state: DynastyState): DynastyState {
  const rng = new Rng(state.rngState);
  const gamesThisWeek = state.schedule.filter((game) => game.week === state.week && !game.played);
  let teams = state.teams;
  const playedGames: Game[] = [];
  for (const game of gamesThisWeek) {
    const result = simulateGame(rng, game, teams);
    teams = result.teams;
    playedGames.push(result.game);
  }
  const schedule = state.schedule.map((game) => playedGames.find((played) => played.id === game.id) ?? game);
  const pollUpdate = createPollSnapshot(teams, state.calendarYear, state.week, "regular", (state.rankings ?? [])[0]);
  teams = pollUpdate.teams;
  const weeklyAward = createWeeklyAwards(teams, state.conferences, state.calendarYear, state.week, playedGames);
  let nextState: DynastyState = {
    ...state,
    rngState: rng.currentState(),
    teams,
    schedule,
    weeklyAwards: [weeklyAward, ...state.weeklyAwards].slice(0, 24),
    rankings: [pollUpdate.poll, ...(state.rankings ?? [])].slice(0, 320),
  };

  if (state.week < 12) {
    nextState = {
      ...advanceRecruitingAndKeepClock(nextState),
      week: state.week + 1,
    };
    return nextState;
  }

  const seasonAwards = createSeasonAwards(teams, state.conferences, state.calendarYear, state.debugFlags.forceUserAward ? state.userTeamId : undefined);
  teams = applySeasonAwardsToPlayers(teams, seasonAwards);
  const seeds = selectPlayoffSeeds(teams, state.userTeamId, state.debugFlags.forceUserPlayoff);
  const playoffGames = createPlayoffGames(state.calendarYear, seeds);
  return {
    ...nextState,
    teams,
    phase: "postseason",
    week: 13,
    seasonAwards,
    playoff: {
      year: state.calendarYear,
      seeds,
      games: playoffGames,
    },
    debugFlags: {
      ...state.debugFlags,
      forceUserAward: false,
    },
    debugLog: [`Regular season complete. Summit Four playoff field selected.`, ...state.debugLog].slice(0, 20),
  };
}

function advancePostseasonWeek(state: DynastyState): DynastyState {
  if (!state.playoff) return { ...state, phase: "offseason" };
  if (state.playoff.championTeamId) return openOffseasonAfterChampionship(state);
  const rng = new Rng(state.rngState);
  const gamesThisWeek = state.playoff.games.filter((game) => game.week === state.week && !game.played);
  let teams = state.teams;
  const playedGames: Game[] = [];
  for (const game of gamesThisWeek) {
    const result = simulateGame(rng, game, teams);
    teams = result.teams;
    playedGames.push(result.game);
  }
  const playoffGames = state.playoff.games.map((game) => playedGames.find((played) => played.id === game.id) ?? game);
  const winners = playedGames.map((game) => game.result!.winnerTeamId);
  let nextPlayoff = {
    ...state.playoff,
    games: playoffGames,
  };
  let phase: Phase = "postseason";
  let nextWeek = state.week + 1;
  let debug = state.debugLog;

  if (state.week === 13) {
    nextPlayoff = { ...nextPlayoff, games: [...playoffGames, ...createNextPlayoffRound(state.calendarYear, "semi", winners)] };
    debug = [`Quarterfinal bowls complete.`, ...debug].slice(0, 20);
  } else if (state.week === 14) {
    nextPlayoff = { ...nextPlayoff, games: [...playoffGames, ...createNextPlayoffRound(state.calendarYear, "final", winners)] };
    debug = [`Summit semifinal bowls complete.`, ...debug].slice(0, 20);
  } else {
    nextPlayoff = { ...nextPlayoff, championTeamId: winners[0] };
    nextWeek = 16;
    const champion = teams.find((team) => team.id === winners[0]);
    debug = [`${champion?.name ?? "A program"} won the Crown Bowl championship.`, ...debug].slice(0, 20);
  }

  const pollUpdate = createPollSnapshot(teams, state.calendarYear, state.week, phase, (state.rankings ?? [])[0]);
  const rankedTeams = pollUpdate.teams;

  return {
    ...state,
    rngState: rng.currentState(),
    teams: rankedTeams,
    playoff: nextPlayoff,
    offseasonReport: state.offseasonReport,
    recruiting: state.recruiting,
    rankings: [pollUpdate.poll, ...(state.rankings ?? [])].slice(0, 320),
    phase,
    week: nextWeek,
    debugLog: debug,
  };
}

function openOffseasonAfterChampionship(state: DynastyState): DynastyState {
  const pollUpdate = createPollSnapshot(state.teams, state.calendarYear, 16, "offseason", (state.rankings ?? [])[0]);
  const rankedTeams = pollUpdate.teams;
  return {
    ...state,
    teams: rankedTeams,
    phase: "offseason",
    week: 16,
    offseasonReport: createOffseasonReport(rankedTeams, state.calendarYear),
    recruiting: addOffseasonRecruitingBonus(state, rankedTeams),
    rankings: [pollUpdate.poll, ...(state.rankings ?? [])].slice(0, 320),
    debugLog: [`Offseason departures opened after the Crown Bowl celebration.`, ...state.debugLog].slice(0, 20),
  };
}

function advanceOffseasonWeek(state: DynastyState): DynastyState {
  if (!state.offseasonReport?.signingComplete) {
    if (state.week <= OFFSEASON_RECRUITING_END_WEEK) return advanceOffseasonRecruitingWeek(state);
    return runSigningDay(state);
  }
  return runPreseasonDevelopment(state);
}

function runSigningDay(state: DynastyState): DynastyState {
  const signedState = signRecruitingClass(state);
  const { fullClassRankings, recruitingRankByTeam } = classRankingContext(signedState);
  const baseReport = signedState.offseasonReport ?? createOffseasonReport(signedState.teams, signedState.calendarYear);
  const offseasonReport = enrichOffseasonReport(baseReport, fullClassRankings, recruitingRankByTeam, signedState.userTeamId, signedState.recruits, signedState.year);
  return {
    ...signedState,
    week: PRESEASON_DEVELOPMENT_WEEK,
    offseasonReport: {
      ...offseasonReport,
      signingComplete: true,
      developmentComplete: false,
    },
    debugLog: [`Signing day complete. ${offseasonReport.topClasses.length} team classes are available in the offseason report.`, ...signedState.debugLog].slice(0, 20),
  };
}

function advanceOffseasonRecruitingWeek(state: DynastyState): DynastyState {
  const beforeWeek = state.week;
  const withAuto = state.recruiting.autoEnabled && state.recruiting.pointsRemaining >= OFFER_COST ? autoRecruit(state, "Auto-recruit attacked offseason needs before the next signing window.") : state;
  const advanced = advanceRecruitingAndKeepClock(withAuto);
  return {
    ...advanced,
    week: beforeWeek + 1,
    debugLog: [`Offseason recruiting week ${Math.max(1, beforeWeek - OFFSEASON_RECRUITING_START_WEEK + 1)} of 4 completed.`, ...advanced.debugLog].slice(0, 20),
  };
}

function runPreseasonDevelopment(state: DynastyState): DynastyState {
  const signedState = state.offseasonReport?.signingComplete ? state : runSigningDay(state);
  const rng = new Rng(signedState.rngState);
  const { fullClassRankings, recruitingRankByTeam } = classRankingContext(signedState);
  const baseReport =
    signedState.offseasonReport ?? enrichOffseasonReport(createOffseasonReport(signedState.teams, signedState.calendarYear), fullClassRankings, recruitingRankByTeam, signedState.userTeamId, signedState.recruits, signedState.year);
  const departuresByTeam = new Map(baseReport.teams.map((teamReport) => [teamReport.teamId, teamReport.departures]));
  const champion = signedState.playoff?.championTeamId ? signedState.teams.find((team) => team.id === signedState.playoff?.championTeamId) : undefined;
  const historyEntry = {
    year: signedState.calendarYear,
    championTeamId: champion?.id,
    championName: champion?.name,
    playoffTeams: signedState.playoff?.seeds ?? [],
    awardWinners: signedState.seasonAwards?.nationalAwards ?? [],
    topClasses: fullClassRankings.slice(0, 10),
    userRecruitingRank: recruitingRankByTeam.get(signedState.userTeamId),
  };
  const currentAwardsByTeam = seasonAwardNamesByTeam(signedState.seasonAwards);
  const developmentResults = signedState.teams.map((team) =>
    recordAndDevelopTeam(rng, team, signedState.calendarYear, champion?.id === team.id, departuresByTeam.get(team.id) ?? [], recruitingRankByTeam.get(team.id), currentAwardsByTeam.get(team.id) ?? []),
  );
  const rosterFloorResults = developmentResults.map((result) => {
    const filled = ensureRosterFloor(rng, result.team, signedState.calendarYear);
    return {
      ...result,
      team: filled.team,
      walkOns: filled.walkOns,
    };
  });
  const reportUpdates = new Map(rosterFloorResults.map((result) => [result.team.id, { progressions: result.progressions, programChanges: result.programChanges, walkOns: result.walkOns }]));
  const offseasonReport = completeDevelopmentReport(baseReport, reportUpdates);
  const carousel = runCoachCarousel(rng, rosterFloorResults.map((result) => result.team), signedState.coachPool);
  if (signedState.year >= signedState.maxYears) {
    return {
      ...signedState,
      rngState: rng.currentState(),
      teams: carousel.teams,
      coachPool: carousel.pool,
      history: [historyEntry, ...signedState.history],
      offseasonReport,
      phase: "complete",
      debugLog: [`20-year dynasty complete.`, ...signedState.debugLog].slice(0, 20),
    };
  }
  const nextYear = signedState.year + 1;
  const nextCalendarYear = signedState.calendarYear + 1;
  const preseasonTeams = resetForNextSeason(carousel.teams).map((team) => ({
    ...team,
    blueprint: createProgramBlueprint(team, nextCalendarYear, team.id !== signedState.userTeamId),
  }));
  const preseasonPollUpdate = createPollSnapshot(preseasonTeams, nextCalendarYear, 0, "preseason", (signedState.rankings ?? [])[0]);
  const teams = preseasonPollUpdate.teams;
  const userTeam = teams.find((team) => team.id === signedState.userTeamId) ?? teams[0]!;
  const seasonBudget = calculateSeasonRecruitingBudget(userTeam);
  const weeklyPoints = calculateWeeklyRecruitingPoints(userTeam);
  return {
    ...signedState,
    rngState: rng.currentState(),
    year: nextYear,
    calendarYear: nextCalendarYear,
    phase: "preseason",
    week: 0,
    teams,
    coachPool: carousel.pool,
    recruits: createRecruitClass(rng, teams, 2600),
    recruiting: {
      weeklyPoints,
      seasonBudget,
      pointsRemaining: seasonBudget,
      pointsSpent: 0,
      investedByRecruit: {},
      boardLimit: signedState.recruiting.boardLimit ?? 35,
      board: [],
      autoEnabled: signedState.recruiting.autoEnabled,
      profile: signedState.recruiting.profile,
      lastActions: [`New recruiting cycle opened with ${seasonBudget.toLocaleString()} season points after a #${offseasonReport.userRecruitingRank ?? "-"} class.`],
    },
    schedule: createSchedule(rng, teams, nextYear),
    weeklyAwards: [],
    seasonAwards: undefined,
    playoff: undefined,
    offseasonReport,
    rankings: [preseasonPollUpdate.poll, ...(signedState.rankings ?? [])].slice(0, 320),
    history: [historyEntry, ...signedState.history],
    debugFlags: {
      ...signedState.debugFlags,
      forceUserPlayoff: false,
    },
    debugLog: [`Preseason opened for Year ${nextYear}. Recruiting class ranked #${offseasonReport.userRecruitingRank ?? "-"}. Coach carousel made ${carousel.moves} moves.`, ...signedState.debugLog].slice(0, 20),
  };
}

function startRegularSeason(state: DynastyState): DynastyState {
  return {
    ...state,
    teams: state.teams.map((team) => ({
      ...team,
      roster: team.roster.map((player) => ({
        ...player,
        incomingFreshman: undefined,
      })),
    })),
    phase: "regular",
    week: 1,
    offseasonReport: undefined,
    debugLog: [`Kickoff week opened. Offseason reports are archived in dynasty history.`, ...state.debugLog].slice(0, 20),
  };
}

function advanceRecruitingAndKeepClock(state: DynastyState): DynastyState {
  const advanced = advanceRecruitingWeek(state);
  return advanced.recruiting.autoEnabled && advanced.recruiting.pointsRemaining >= OFFER_COST
    ? autoRecruit(advanced, "Auto-recruit reallocated freed points after commitments.")
    : advanced;
}

function refreshRecruitingBudget(state: DynastyState): DynastyState {
  const userTeam = getUserTeam(state);
  const previousBudget = state.recruiting.seasonBudget ?? calculateSeasonRecruitingBudget(userTeam);
  const seasonBudget = calculateSeasonRecruitingBudget(userTeam);
  const priorSpent = state.recruiting.pointsSpent ?? Math.max(0, previousBudget - state.recruiting.pointsRemaining);
  const pointsSpent = clamp(priorSpent, 0, seasonBudget);
  const pointsRemaining = seasonBudget - pointsSpent;
  return {
    ...state,
    recruiting: {
      ...state.recruiting,
      weeklyPoints: calculateWeeklyRecruitingPoints(userTeam),
      seasonBudget,
      pointsRemaining,
      pointsSpent,
    },
  };
}

function addOffseasonRecruitingBonus(state: DynastyState, teams: Team[]): DynastyState["recruiting"] {
  const userTeam = teams.find((team) => team.id === state.userTeamId) ?? getUserTeam(state);
  const bonus = calculateWeeklyRecruitingPoints(userTeam) * 4;
  const currentBudget = state.recruiting.seasonBudget ?? calculateSeasonRecruitingBudget(userTeam);
  const seasonBudget = currentBudget + bonus;
  return {
    ...state.recruiting,
    weeklyPoints: calculateWeeklyRecruitingPoints(userTeam),
    seasonBudget,
    pointsRemaining: Math.min(state.recruiting.pointsRemaining + bonus, seasonBudget),
    lastActions: [`Offseason recruiting opened with ${bonus.toLocaleString()} bonus points and four late-cycle weeks.`, ...state.recruiting.lastActions].slice(0, 10),
  };
}

function ensureRosterFloor(rng: Rng, team: Team, year: number): { team: Team; walkOns: WalkOnAddition[] } {
  const roster = [...team.roster];
  const walkOns: WalkOnAddition[] = [];
  while (roster.length < ROSTER_FLOOR) {
    const position = mostNeededWalkOnPosition(roster);
    const player = createWalkOnPlayer(rng, team.id, position, year, walkOns.length + 1);
    roster.push(player);
    walkOns.push({
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      overall: player.overall,
      potential: player.potential,
    });
  }
  return {
    team: {
      ...team,
      roster,
    },
    walkOns,
  };
}

function mostNeededWalkOnPosition(roster: Player[]): Position {
  return (Object.entries(TARGET_ROSTER) as [Position, number][])
    .map(([position, target]) => ({
      position,
      deficit: target - roster.filter((player) => player.position === position).length,
    }))
    .sort((a, b) => b.deficit - a.deficit || TARGET_ROSTER[b.position] - TARGET_ROSTER[a.position])[0]!.position;
}

function applySeasonAwardsToPlayers(teams: Team[], seasonAwards: SeasonAwards): Team[] {
  const awardsByPlayer = new Map<string, Set<string>>();
  const awardGroups = [
    seasonAwards.nationalAwards,
    seasonAwards.allAmericans.first,
    seasonAwards.allAmericans.second,
    seasonAwards.allAmericans.freshman,
    ...Object.values(seasonAwards.allConference).flatMap((group) => [group.first, group.second, group.freshman]),
  ];
  for (const award of awardGroups.flat()) {
    const awards = awardsByPlayer.get(award.playerId) ?? new Set<string>();
    awards.add(award.awardName);
    awardsByPlayer.set(award.playerId, awards);
  }
  return teams.map((team) => ({
    ...team,
    roster: team.roster.map((player) => {
      const awards = awardsByPlayer.get(player.id);
      if (!awards) return player;
      return {
        ...player,
        awards: Array.from(new Set([...player.awards, ...awards])),
      };
    }),
  }));
}

function signedClassCounts(recruits: Recruit[]): Record<string, number> {
  return recruits.reduce<Record<string, number>>((counts, recruit) => {
    if (!recruit.committedTeamId) return counts;
    counts[recruit.committedTeamId] = (counts[recruit.committedTeamId] ?? 0) + 1;
    return counts;
  }, {});
}

function recordAndDevelopTeam(
  rng: Rng,
  team: Team,
  year: number,
  champion: boolean,
  departures: PlayerDeparture[],
  recruitingClassRank?: number,
  currentSeasonAwards: string[] = [],
): { team: Team; progressions: PlayerProgression[]; programChanges: ProgramChange[] } {
  const awards = currentSeasonAwards;
  const conferencePeers = 10;
  const conferenceFinish = Math.min(conferencePeers, team.season.confLosses + 1);
  const postseason = champion ? "Crown Bowl Champion" : team.season.rank && team.season.rank <= 8 ? "Summit Four" : team.season.wins >= 7 ? "Bowl Eligible" : "Missed Bowls";
  const pointsEarned = 2 + Math.floor(team.season.wins / 3) + (champion ? 5 : 0) + (team.season.rank && team.season.rank <= 10 ? 2 : 0);
  const resolvedBlueprint = resolveProgramBlueprint(team, year, recruitingClassRank);
  const developed = developAndGraduate(rng, team, year, departures);
  const review = reviewProgramPerformance(team, champion);
  return {
    team: {
      ...team,
      blueprint: resolvedBlueprint,
      lastBlueprint: resolvedBlueprint,
      programPoints: team.programPoints + pointsEarned,
      coachPoints: team.coachPoints + Math.floor(pointsEarned / 2),
      program: review.program,
      roster: developed.roster,
      history: [
        {
          year,
          record: `${team.season.wins}-${team.season.losses}`,
          finalRank: team.season.rank,
          conferenceFinish,
          postseason,
          awards,
          recruitingClassRank,
        },
        ...team.history,
      ].slice(0, 20),
    },
    progressions: developed.progressions,
    programChanges: review.changes,
  };
}

function seasonAwardNamesByTeam(seasonAwards?: SeasonAwards): Map<string, string[]> {
  const awardsByTeam = new Map<string, string[]>();
  if (!seasonAwards) return awardsByTeam;
  const awardGroups = [
    seasonAwards.nationalAwards,
    seasonAwards.allAmericans.first,
    seasonAwards.allAmericans.second,
    seasonAwards.allAmericans.freshman,
    ...Object.values(seasonAwards.allConference).flatMap((group) => [group.first, group.second, group.freshman]),
  ];
  for (const award of awardGroups.flat()) {
    const awards = awardsByTeam.get(award.teamId) ?? [];
    awards.push(award.awardName);
    awardsByTeam.set(award.teamId, awards);
  }
  return awardsByTeam;
}

function developAndGraduate(rng: Rng, team: Team, year: number, departures: PlayerDeparture[]): { roster: Player[]; progressions: PlayerProgression[] } {
  const departingIds = new Set(departures.map((departure) => departure.playerId));
  const progressions: PlayerProgression[] = [];
  const roster = team.roster
    .filter((player) => !departingIds.has(player.id))
    .map((player) => {
      const result = developPlayer(rng, team, player, year);
      if (result.progression) progressions.push(result.progression);
      return result.player;
    });
  return { roster, progressions };
}

function developPlayer(rng: Rng, team: Team, player: Player, year: number): { player: Player; progression?: PlayerProgression } {
  if (player.incomingFreshman) {
    return {
      player: resetPlayerStats(player),
    };
  }
  const developmentProfile = DEVELOPMENT_PROFILES[player.development];
  const potentialGap = Math.max(0, player.potential - player.overall);
  const staffDevelopment = (team.coaches.head.development + team.coaches.offense.development + team.coaches.defense.development) / 3;
  const infrastructureBoost = (team.program.training - 60) / 18 + (team.program.facilities - 60) / 20;
  const coachBoost = clamp(staffDevelopment / 55 + infrastructureBoost + blueprintDevelopmentBonus(team), -1.5, 7);
  const breakoutChance = clamp(developmentProfile.breakoutChance + potentialGap / 160 + coachBoost / 80, developmentProfile.breakoutChance, 0.46);
  const breakout = potentialGap >= 3 && rng.chance(breakoutChance) ? rng.nextInt(developmentProfile.breakoutMin, developmentProfile.breakoutMax) : 0;
  const highPotentialBonus = player.potential >= 92 ? 1.2 : player.potential >= 88 ? 0.6 : 0;
  const growthBudget = clamp(
    Math.round(rng.nextInt(0, 2) + developmentProfile.base + coachBoost * 0.9 + potentialGap / 13 + highPotentialBonus + breakout),
    0,
    Math.min(developmentProfile.maxBudget, Math.max(0, potentialGap + 3)),
  );
  const focus = PROGRESSION_FOCUS[player.position];
  const orderedKeys = [...rng.shuffle(focus), ...rng.shuffle(ATTRIBUTE_KEYS.filter((key) => !focus.includes(key)))].slice(0, player.development === "elite" ? 9 : 7);
  let attributes: Attributes = { ...player.attributes };
  const attributeGains: Partial<Record<AttributeKey, number>> = {};
  const applyAttributeGain = (key: AttributeKey, gain: number) => {
    if (gain <= 0) return;
    const nextAttributes = applyPositionCaps(player.position, { ...attributes, [key]: clamp(attributes[key] + gain, 20, 99) }, 99);
    const actualGain = nextAttributes[key] - attributes[key];
    if (actualGain <= 0) return;
    attributes = nextAttributes;
    attributeGains[key] = (attributeGains[key] ?? 0) + actualGain;
  };

  if (breakout > 0) {
    for (const key of rng.shuffle(focus).slice(0, 2)) {
      applyAttributeGain(key, rng.nextInt(1, Math.min(developmentProfile.focusGainCap, breakout + 2)));
    }
  }

  for (const key of orderedKeys) {
    const isFocus = focus.includes(key);
    const maxGain = isFocus ? Math.max(1, Math.ceil(growthBudget * 0.9)) : Math.ceil(growthBudget / 2);
    const gain = growthBudget > 0 ? rng.nextInt(0, Math.min(isFocus ? developmentProfile.focusGainCap : 4, maxGain)) : 0;
    applyAttributeGain(key, gain);
  }

  const nextYear: CollegeYear = player.year === "FR" ? "SO" : player.year === "SO" ? "JR" : "SR";
  const recalculatedOverall = calculateOverall(player.position, attributes);
  const focusGainTotal = focus.reduce((sum, key) => sum + (attributeGains[key] ?? 0), 0);
  const supportGainTotal = Object.entries(attributeGains).reduce((sum, [key, value]) => sum + (focus.includes(key as AttributeKey) ? 0 : value ?? 0), 0);
  const attributeDrivenOverallGain = clamp(Math.round(focusGainTotal / 6 + supportGainTotal / 16 + breakout * 0.45), 0, developmentProfile.maxOverallGain);
  const afterOverall = clamp(Math.max(player.overall, recalculatedOverall, player.overall + attributeDrivenOverallGain), 35, player.potential);
  const nextPlayer = {
    ...resetPlayerStats({
      ...player,
      careerStats: [
        ...(player.careerStats ?? []),
        {
          year,
          teamName: team.name,
          collegeYear: player.year,
          stats: player.stats,
        },
      ],
    }),
    year: nextYear,
    attributes,
    overall: afterOverall,
  };
  const didImprove = afterOverall > player.overall || Object.keys(attributeGains).length > 0;
  return {
    player: nextPlayer,
    progression: didImprove
      ? {
          playerId: player.id,
          playerName: player.name,
          position: player.position,
          fromYear: player.year,
          toYear: nextYear,
          beforeOverall: player.overall,
          afterOverall,
          potential: player.potential,
          attributeGains,
        }
      : undefined,
  };
}

function reviewProgramPerformance(team: Team, champion: boolean): { program: ProgramRatings; changes: ProgramChange[] } {
  const coachCulture = (team.coaches.head.culture + team.coaches.offense.culture + team.coaches.defense.culture) / 3;
  const developmentStaff = (team.coaches.head.development + team.coaches.offense.development + team.coaches.defense.development) / 3;
  const changes: ProgramChange[] = [];
  let program = { ...team.program };
  const applyChange = (key: keyof ProgramRatings, delta: number, reason: string) => {
    if (!delta) return;
    const before = program[key] ?? 50;
    const after = clamp(before + delta, 1, 99);
    if (after === before) return;
    program = { ...program, [key]: after };
    changes.push({ key, before, after, delta: after - before, reason });
  };

  applyChange("prestige", (team.season.wins >= 10 ? 2 : team.season.wins >= 8 ? 1 : team.season.losses >= 8 ? -2 : team.season.losses >= 6 ? -1 : 0) + (champion ? 4 : 0), champion ? "Championship season lifted national profile" : "Season record moved perception");
  applyChange("fanSupport", team.season.wins >= 9 ? 2 : team.season.wins >= 7 ? 1 : team.season.losses >= 8 ? -2 : team.season.losses >= 6 ? -1 : 0, "Fan response to wins and losses");
  applyChange("facilities", champion || team.season.wins >= 10 ? 1 : team.season.losses >= 9 ? -1 : 0, "Donor momentum affected facility support");
  applyChange("training", developmentStaff >= 76 && team.season.wins >= 6 ? 1 : team.season.losses >= 9 ? -1 : 0, "Staff development reputation changed");
  applyChange("recruitingReach", team.season.rank && team.season.rank <= 10 ? 2 : team.season.rank && team.season.rank <= 25 ? 1 : team.season.losses >= 8 ? -1 : 0, "Poll visibility affected recruiting reach");
  applyChange("academics", coachCulture >= 80 && team.season.wins >= 6 ? 1 : team.season.losses >= 10 ? -1 : 0, "Culture and stability affected academic support");
  applyChange("facilities", blueprintAllocation(team, "facilities") >= 4 ? 1 : 0, "Program Blueprint facilities funding carried into donor planning");
  applyChange("training", blueprintAllocation(team, "trainingStaff") >= 4 ? 1 : 0, "Program Blueprint training staff funding improved development support");
  applyChange("recruitingReach", blueprintAllocation(team, "recruitingReach") >= 4 ? 1 : 0, "Program Blueprint recruiting reach expanded the footprint");
  applyChange("academics", blueprintAllocation(team, "academicSupport") >= 4 ? 1 : 0, "Program Blueprint academic support strengthened standards");
  applyChange("fanSupport", blueprintAllocation(team, "playerTrust") >= 4 ? 1 : 0, "Program Blueprint player trust stabilized public confidence");
  return { program, changes };
}

function createOffseasonReport(teams: Team[], year: number): OffseasonReport {
  return {
    year,
    teams: teams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      departures: team.roster.map((player) => playerDeparture(player, team)).filter((departure): departure is PlayerDeparture => Boolean(departure)),
      signees: [],
      walkOns: [],
      progressions: [],
      programChanges: [],
    })),
    topClasses: [],
  };
}

function enrichOffseasonReport(
  report: OffseasonReport,
  topClasses: OffseasonReport["topClasses"],
  recruitingRankByTeam: Map<string, number>,
  userTeamId: string,
  recruits: Recruit[] = [],
  classYear = report.year,
): OffseasonReport {
  const signeesByTeam = signeesForTeams(recruits, classYear);
  return {
    ...report,
    topClasses,
    userRecruitingRank: recruitingRankByTeam.get(userTeamId),
    teams: report.teams.map((teamReport) => ({
      ...teamReport,
      signees: signeesByTeam.get(teamReport.teamId) ?? teamReport.signees ?? [],
      walkOns: teamReport.walkOns ?? [],
      recruitingRank: recruitingRankByTeam.get(teamReport.teamId),
    })),
  };
}

function completeDevelopmentReport(report: OffseasonReport, updates: Map<string, { progressions: PlayerProgression[]; programChanges: ProgramChange[]; walkOns: WalkOnAddition[] }>): OffseasonReport {
  return {
    ...report,
    signingComplete: true,
    developmentComplete: true,
    teams: report.teams.map((teamReport) => {
      const update = updates.get(teamReport.teamId);
      return {
        ...teamReport,
        progressions: update?.progressions ?? teamReport.progressions ?? [],
        programChanges: update?.programChanges ?? teamReport.programChanges ?? [],
        walkOns: update?.walkOns ?? teamReport.walkOns ?? [],
      };
    }),
  };
}

function classRankingContext(state: DynastyState): { fullClassRankings: OffseasonReport["topClasses"]; recruitingRankByTeam: Map<string, number> } {
  const fullClassRankings = recruitingClassRankings(state.teams, signedClassCounts(state.recruits), state.teams.length);
  return {
    fullClassRankings,
    recruitingRankByTeam: new Map(fullClassRankings.map((entry, index) => [entry.teamId, index + 1])),
  };
}

function signeesForTeams(recruits: Recruit[], classYear: number): Map<string, RecruitSigning[]> {
  const byTeam = new Map<string, RecruitSigning[]>();
  for (const recruit of recruits) {
    if (!recruit.committedTeamId || recruit.stage !== "signed") continue;
    const signed = byTeam.get(recruit.committedTeamId) ?? [];
    signed.push({
      recruitId: recruit.id,
      playerId: signedPlayerIdForRecruit(recruit, classYear),
      playerName: recruit.name,
      position: recruit.position,
      stars: recruit.stars,
      nationalRank: recruit.nationalRank,
      overall: recruit.overall,
      potential: recruit.potential,
      trait: recruit.hiddenTrait,
    });
    byTeam.set(recruit.committedTeamId, signed);
  }
  for (const [teamId, signees] of byTeam) {
    byTeam.set(
      teamId,
      signees.sort((a, b) => b.stars - a.stars || a.nationalRank - b.nationalRank),
    );
  }
  return byTeam;
}

function playerDeparture(player: Player, team: Team): PlayerDeparture | undefined {
  const production =
    player.stats.passYards / 850 +
    player.stats.rushYards / 300 +
    player.stats.receivingYards / 300 +
    player.stats.tackles / 28 +
    player.stats.sacks * 1.7 +
    player.stats.interceptions * 2.1 +
    player.stats.pancakes / 9 +
    player.stats.fieldGoals / 8;
  const awardBoost = player.awards.length * 2.4;
  const rankBoost = team.season.rank && team.season.rank <= 8 ? 2.5 : team.season.rank && team.season.rank <= 25 ? 1.2 : 0;
  const proScore = player.overall + production + awardBoost + rankBoost;
  const proThreshold = (player.year === "SR" ? 87 : player.year === "JR" ? 91 : 96) + blueprintRetentionBonus(team);
  if ((player.year === "SR" || player.year === "JR" || player.year === "SO") && proScore >= proThreshold) {
    return {
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      year: player.year,
      overall: player.overall,
      reason: "pro",
      note: `${player.overall} OVR declared after ${team.season.wins}-${team.season.losses}`,
    };
  }
  if (player.year === "SR") {
    return {
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      year: player.year,
      overall: player.overall,
      reason: "graduated",
      note: `${player.position} completed eligibility`,
    };
  }
  return undefined;
}

function resetForNextSeason(teams: Team[]): Team[] {
  return teams.map((team) => ({
    ...team,
    season: freshTeamSeason(),
    roster: team.roster.map(resetPlayerStats),
  }));
}

function runCoachCarousel(rng: Rng, teams: Team[], pool: Coach[]): { teams: Team[]; pool: Coach[]; moves: number } {
  let moves = 0;
  const openPool = [...pool];
  const updatedTeams = teams.map((team) => {
    const retention = blueprintCoachRetention(team);
    const underPressure = team.season.wins < Math.max(4, Math.round((team.expectations - 55) / 8)) && rng.chance(clamp(0.38 - retention * 0.035, 0.1, 0.38));
    if (!underPressure) {
      return {
        ...team,
        coaches: {
          head: { ...team.coaches.head, jobSecurity: clamp(team.coaches.head.jobSecurity + (team.season.wins >= 8 ? 5 : -2) + retention, 1, 99) },
          offense: maybeCoordinatorMove(rng, team.coaches.offense, openPool, team.id, retention),
          defense: maybeCoordinatorMove(rng, team.coaches.defense, openPool, team.id, retention),
        },
      };
    }
    const replacement = bestCoach(openPool, "head");
    if (!replacement) return team;
    moves += 1;
    openPool.push({ ...team.coaches.head, hiredBy: undefined, jobSecurity: 55 });
    removeCoach(openPool, replacement.id);
    return {
      ...team,
      coaches: {
        ...team.coaches,
        head: { ...replacement, hiredBy: team.id, jobSecurity: 70 },
      },
    };
  });
  return { teams: updatedTeams, pool: openPool.slice(0, 72), moves };
}

function maybeCoordinatorMove(rng: Rng, coach: Coach, pool: Coach[], teamId: string, retention: number): Coach {
  const promoted = coach.tactics + coach.recruiting + coach.development > 245 && rng.chance(clamp(0.12 - retention * 0.012, 0.03, 0.12));
  if (!promoted) return { ...coach, jobSecurity: clamp(coach.jobSecurity + rng.nextInt(-3, 4), 1, 99) };
  const replacement = bestCoach(pool, coach.role);
  if (!replacement) return coach;
  pool.push({ ...coach, role: "head", hiredBy: undefined, jobSecurity: 64 });
  removeCoach(pool, replacement.id);
  return { ...replacement, hiredBy: teamId, jobSecurity: 70 };
}

function bestCoach(pool: Coach[], role: Coach["role"]): Coach | undefined {
  return pool.filter((coach) => coach.role === role).sort((a, b) => coachScore(b) - coachScore(a))[0];
}

function removeCoach(pool: Coach[], coachId: string): void {
  const index = pool.findIndex((coach) => coach.id === coachId);
  if (index >= 0) pool.splice(index, 1);
}

function coachScore(coach: Coach): number {
  return coach.recruiting * 0.25 + coach.development * 0.28 + coach.tactics * 0.32 + coach.culture * 0.15 + coach.points * 1.5;
}
