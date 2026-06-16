import { createSeasonAwards, createWeeklyAwards, rankTeams, recruitingClassRankings, selectPlayoffSeeds } from "./awards";
import { calculateWeeklyRecruitingPoints, createRecruitClass, freshTeamSeason, resetPlayerStats } from "./generate";
import { simulateGame } from "./game";
import { clamp, Rng } from "./rng";
import { createNextPlayoffRound, createPlayoffGames, createSchedule } from "./schedule";
import { advanceRecruitingWeek, autoRecruit, signRecruitingClass } from "./recruiting";
import type { Coach, CollegeYear, DynastyState, Game, Phase, Player, ProgramRatings, Team } from "./types";

export function advanceWeek(input: DynastyState): DynastyState {
  if (input.phase === "complete") return input;
  const withAuto = input.phase === "regular" && input.recruiting.autoEnabled && input.recruiting.pointsRemaining > 0 ? autoRecruit(input) : input;
  let state = { ...withAuto, updatedAt: new Date().toISOString() };
  if (state.phase === "regular") return advanceRegularWeek(state);
  if (state.phase === "postseason") return advancePostseasonWeek(state);
  if (state.phase === "offseason") return runOffseason(state);
  if (state.phase === "preseason") return { ...state, phase: "regular", week: 1 };
  return state;
}

export function simulateSeasons(input: DynastyState, seasons: number): DynastyState {
  let state = input;
  let completed = 0;
  const targetYear = Math.min(state.maxYears, state.year + seasons);
  let guard = 0;
  while (state.phase !== "complete" && (state.year < targetYear || (state.phase !== "regular" && completed < seasons)) && guard < seasons * 40 + 80) {
    const beforeYear = state.year;
    state = advanceWeek(state);
    if (state.year > beforeYear) completed += 1;
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

export function investProgramPoint(state: DynastyState, key: keyof ProgramRatings): DynastyState {
  const teams = state.teams.map((team) => {
    if (team.id !== state.userTeamId || team.programPoints <= 0) return team;
    return {
      ...team,
      programPoints: team.programPoints - 1,
      program: {
        ...team.program,
        [key]: clamp(Math.round((team.program[key] ?? 50) + 2), 1, 99),
      },
    };
  });
  return {
    ...state,
    teams,
    debugLog: [`Invested a program point into ${String(key)}.`, ...state.debugLog].slice(0, 20),
  };
}

export function spendCoachPoint(state: DynastyState, coachRole: Coach["role"], skill: "recruiting" | "development" | "tactics" | "culture"): DynastyState {
  const teams = state.teams.map((team) => {
    if (team.id !== state.userTeamId) return team;
    const coach = team.coaches[coachRole];
    if (!coach || coach.points <= 0) return team;
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
  return {
    ...state,
    teams,
    debugLog: [`Spent a coach point on ${coachRole} ${skill}.`, ...state.debugLog].slice(0, 20),
  };
}

export function hireCoach(state: DynastyState, coachId: string): DynastyState {
  const coach = state.coachPool.find((candidate) => candidate.id === coachId);
  if (!coach) return state;
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
    coachPool: state.coachPool.filter((candidate) => candidate.id !== coachId),
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
  teams = rankTeams(teams);
  const weeklyAward = createWeeklyAwards(teams, state.conferences, state.calendarYear, state.week);
  let nextState: DynastyState = {
    ...state,
    rngState: rng.currentState(),
    teams,
    schedule,
    weeklyAwards: [weeklyAward, ...state.weeklyAwards].slice(0, 24),
  };

  if (state.week < 12) {
    nextState = {
      ...advanceRecruitingAndKeepClock(nextState),
      week: state.week + 1,
    };
    return nextState;
  }

  const seasonAwards = createSeasonAwards(teams, state.conferences, state.calendarYear, state.debugFlags.forceUserAward ? state.userTeamId : undefined);
  const seeds = selectPlayoffSeeds(teams, state.userTeamId, state.debugFlags.forceUserPlayoff);
  const playoffGames = createPlayoffGames(state.calendarYear, seeds);
  return {
    ...nextState,
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
    phase = "offseason";
    nextWeek = 16;
    const champion = teams.find((team) => team.id === winners[0]);
    debug = [`${champion?.name ?? "A program"} won the Crown Bowl championship.`, ...debug].slice(0, 20);
  }

  return {
    ...state,
    rngState: rng.currentState(),
    teams: rankTeams(teams),
    playoff: nextPlayoff,
    phase,
    week: nextWeek,
    debugLog: debug,
  };
}

function runOffseason(state: DynastyState): DynastyState {
  const signedState = signRecruitingClass(state);
  const rng = new Rng(signedState.rngState);
  const topClasses = recruitingClassRankings(signedState.teams);
  const champion = signedState.playoff?.championTeamId ? signedState.teams.find((team) => team.id === signedState.playoff?.championTeamId) : undefined;
  const historyEntry = {
    year: signedState.calendarYear,
    championTeamId: champion?.id,
    championName: champion?.name,
    playoffTeams: signedState.playoff?.seeds ?? [],
    awardWinners: signedState.seasonAwards?.nationalAwards ?? [],
    topClasses,
  };
  const withHistoryTeams = signedState.teams.map((team) => recordAndDevelopTeam(rng, team, signedState.calendarYear, champion?.id === team.id));
  const carousel = runCoachCarousel(rng, withHistoryTeams, signedState.coachPool);
  if (signedState.year >= signedState.maxYears) {
    return {
      ...signedState,
      rngState: rng.currentState(),
      teams: carousel.teams,
      coachPool: carousel.pool,
      history: [historyEntry, ...signedState.history],
      phase: "complete",
      debugLog: [`20-year dynasty complete.`, ...signedState.debugLog].slice(0, 20),
    };
  }
  const nextYear = signedState.year + 1;
  const teams = resetForNextSeason(carousel.teams);
  const userTeam = teams.find((team) => team.id === signedState.userTeamId) ?? teams[0]!;
  const weeklyPoints = calculateWeeklyRecruitingPoints(userTeam);
  return {
    ...signedState,
    rngState: rng.currentState(),
    year: nextYear,
    calendarYear: signedState.calendarYear + 1,
    phase: "regular",
    week: 1,
    teams,
    coachPool: carousel.pool,
    recruits: createRecruitClass(rng, teams, 2600),
    recruiting: {
      weeklyPoints,
      pointsRemaining: weeklyPoints,
      board: [],
      autoEnabled: signedState.recruiting.autoEnabled,
      profile: signedState.recruiting.profile,
      lastActions: [`New recruiting cycle opened with ${weeklyPoints} weekly points.`],
    },
    schedule: createSchedule(rng, teams, nextYear),
    weeklyAwards: [],
    seasonAwards: undefined,
    playoff: undefined,
    history: [historyEntry, ...signedState.history],
    debugFlags: {
      ...signedState.debugFlags,
      forceUserPlayoff: false,
    },
    debugLog: [`Advanced to Year ${nextYear}. Coach carousel made ${carousel.moves} moves.`, ...signedState.debugLog].slice(0, 20),
  };
}

function advanceRecruitingAndKeepClock(state: DynastyState): DynastyState {
  return advanceRecruitingWeek(state);
}

function recordAndDevelopTeam(rng: Rng, team: Team, year: number, champion: boolean): Team {
  const awards = team.roster.flatMap((player) => player.awards);
  const conferencePeers = 10;
  const conferenceFinish = Math.min(conferencePeers, team.season.confLosses + 1);
  const postseason = champion ? "Crown Bowl Champion" : team.season.rank && team.season.rank <= 8 ? "Summit Four" : team.season.wins >= 7 ? "Bowl Eligible" : "Missed Bowls";
  const pointsEarned = 2 + Math.floor(team.season.wins / 3) + (champion ? 5 : 0) + (team.season.rank && team.season.rank <= 10 ? 2 : 0);
  return {
    ...team,
    programPoints: team.programPoints + pointsEarned,
    coachPoints: team.coachPoints + Math.floor(pointsEarned / 2),
    program: {
      ...team.program,
      prestige: clamp(team.program.prestige + (team.season.wins >= 9 ? 2 : team.season.losses >= 8 ? -2 : 0) + (champion ? 4 : 0), 1, 99),
      fanSupport: clamp(team.program.fanSupport + (team.season.wins >= 8 ? 2 : -1), 1, 99),
    },
    roster: developAndGraduate(rng, team),
    history: [
      {
        year,
        record: `${team.season.wins}-${team.season.losses}`,
        finalRank: team.season.rank,
        conferenceFinish,
        postseason,
        awards,
      },
      ...team.history,
    ].slice(0, 20),
  };
}

function developAndGraduate(rng: Rng, team: Team): Player[] {
  return team.roster
    .filter((player) => player.year !== "SR")
    .map((player) => {
      const traitBoost = player.development === "elite" ? 4 : player.development === "starter" ? 3 : player.development === "rotation" ? 2 : player.development === "depth" ? 1 : 0;
      const coachBoost = (team.coaches.head.development + team.coaches.offense.development + team.coaches.defense.development + team.program.training + team.program.facilities) / 170;
      const growth = clamp(Math.round(rng.nextInt(0, 3) + traitBoost * 0.65 + coachBoost), 0, Math.max(0, player.potential - player.overall));
      const attributes = Object.fromEntries(Object.entries(player.attributes).map(([key, value]) => [key, clamp(value + Math.round(growth * rng.next()), 35, 99)])) as typeof player.attributes;
      const nextYear: CollegeYear = player.year === "FR" ? "SO" : player.year === "SO" ? "JR" : "SR";
      return {
        ...resetPlayerStats(player),
        year: nextYear,
        attributes,
        overall: clamp(player.overall + growth, 35, player.potential),
      };
    });
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
    const underPressure = team.season.wins < Math.max(4, Math.round((team.expectations - 55) / 8)) && rng.chance(0.38);
    if (!underPressure) {
      return {
        ...team,
        coaches: {
          head: { ...team.coaches.head, jobSecurity: clamp(team.coaches.head.jobSecurity + (team.season.wins >= 8 ? 5 : -2), 1, 99) },
          offense: maybeCoordinatorMove(rng, team.coaches.offense, openPool, team.id),
          defense: maybeCoordinatorMove(rng, team.coaches.defense, openPool, team.id),
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
  return { teams: updatedTeams, pool: openPool.slice(0, 36), moves };
}

function maybeCoordinatorMove(rng: Rng, coach: Coach, pool: Coach[], teamId: string): Coach {
  const promoted = coach.tactics + coach.recruiting + coach.development > 245 && rng.chance(0.12);
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
