import { createSeasonAwards, createWeeklyAwards, rankTeams, recruitingClassRankings, selectPlayoffSeeds } from "./awards";
import { calculateSeasonRecruitingBudget, calculateWeeklyRecruitingPoints, createRecruitClass, freshTeamSeason, resetPlayerStats } from "./generate";
import { simulateGame } from "./game";
import { applyPositionCaps, calculateOverall } from "./ratings";
import { clamp, Rng } from "./rng";
import { createNextPlayoffRound, createPlayoffGames, createSchedule } from "./schedule";
import { advanceRecruitingWeek, autoRecruit, signRecruitingClass } from "./recruiting";
import type { Coach, CollegeYear, DynastyState, Game, OffseasonReport, Phase, Player, PlayerDeparture, ProgramRatings, Recruit, SeasonAwards, Team } from "./types";

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
  return {
    ...state,
    teams,
    debugLog: [`Spent a coach point on ${spentCoachName} ${skill}.`, ...state.debugLog].slice(0, 20),
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
  const weeklyAward = createWeeklyAwards(teams, state.conferences, state.calendarYear, state.week, playedGames);
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

  const rankedTeams = rankTeams(teams);

  return {
    ...state,
    rngState: rng.currentState(),
    teams: rankedTeams,
    playoff: nextPlayoff,
    offseasonReport: phase === "offseason" ? createOffseasonReport(rankedTeams, state.calendarYear) : state.offseasonReport,
    phase,
    week: nextWeek,
    debugLog: debug,
  };
}

function runOffseason(state: DynastyState): DynastyState {
  const signedState = signRecruitingClass(state);
  const rng = new Rng(signedState.rngState);
  const fullClassRankings = recruitingClassRankings(signedState.teams, signedClassCounts(signedState.recruits), signedState.teams.length);
  const topClasses = fullClassRankings.slice(0, 10);
  const recruitingRankByTeam = new Map(fullClassRankings.map((entry, index) => [entry.teamId, index + 1]));
  const baseReport = signedState.offseasonReport ?? createOffseasonReport(signedState.teams, signedState.calendarYear);
  const offseasonReport = enrichOffseasonReport(baseReport, topClasses, recruitingRankByTeam, signedState.userTeamId);
  const departuresByTeam = new Map(offseasonReport.teams.map((teamReport) => [teamReport.teamId, teamReport.departures]));
  const champion = signedState.playoff?.championTeamId ? signedState.teams.find((team) => team.id === signedState.playoff?.championTeamId) : undefined;
  const historyEntry = {
    year: signedState.calendarYear,
    championTeamId: champion?.id,
    championName: champion?.name,
    playoffTeams: signedState.playoff?.seeds ?? [],
    awardWinners: signedState.seasonAwards?.nationalAwards ?? [],
    topClasses,
    userRecruitingRank: recruitingRankByTeam.get(signedState.userTeamId),
  };
  const withHistoryTeams = signedState.teams.map((team) =>
    recordAndDevelopTeam(rng, team, signedState.calendarYear, champion?.id === team.id, departuresByTeam.get(team.id) ?? [], recruitingRankByTeam.get(team.id)),
  );
  const carousel = runCoachCarousel(rng, withHistoryTeams, signedState.coachPool);
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
  const teams = resetForNextSeason(carousel.teams);
  const userTeam = teams.find((team) => team.id === signedState.userTeamId) ?? teams[0]!;
  const seasonBudget = calculateSeasonRecruitingBudget(userTeam);
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
      seasonBudget,
      pointsRemaining: seasonBudget,
      pointsSpent: 0,
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
    history: [historyEntry, ...signedState.history],
    debugFlags: {
      ...signedState.debugFlags,
      forceUserPlayoff: false,
    },
    debugLog: [`Advanced to Year ${nextYear}. Recruiting class ranked #${offseasonReport.userRecruitingRank ?? "-"}. Coach carousel made ${carousel.moves} moves.`, ...signedState.debugLog].slice(0, 20),
  };
}

function advanceRecruitingAndKeepClock(state: DynastyState): DynastyState {
  return advanceRecruitingWeek(state);
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

function recordAndDevelopTeam(rng: Rng, team: Team, year: number, champion: boolean, departures: PlayerDeparture[], recruitingClassRank?: number): Team {
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
    roster: developAndGraduate(rng, team, year, departures),
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
  };
}

function developAndGraduate(rng: Rng, team: Team, year: number, departures: PlayerDeparture[]): Player[] {
  const departingIds = new Set(departures.map((departure) => departure.playerId));
  return team.roster
    .filter((player) => !departingIds.has(player.id))
    .map((player) => {
      const traitBoost = player.development === "elite" ? 4 : player.development === "starter" ? 3 : player.development === "rotation" ? 2 : player.development === "depth" ? 1 : 0;
      const coachBoost = (team.coaches.head.development + team.coaches.offense.development + team.coaches.defense.development + team.program.training + team.program.facilities) / 170;
      const growth = clamp(Math.round(rng.nextInt(0, 3) + traitBoost * 0.65 + coachBoost), 0, Math.max(0, player.potential - player.overall));
      const attributes = applyPositionCaps(
        player.position,
        Object.fromEntries(Object.entries(player.attributes).map(([key, value]) => [key, clamp(value + Math.round(growth * rng.next()), 20, 99)])) as typeof player.attributes,
        99,
      );
      const nextYear: CollegeYear = player.year === "FR" ? "SO" : player.year === "SO" ? "JR" : "SR";
      const nextOverall = calculateOverall(player.position, attributes);
      return {
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
        overall: clamp(Math.max(player.overall + growth, nextOverall), 35, player.potential),
      };
    });
}

function createOffseasonReport(teams: Team[], year: number): OffseasonReport {
  return {
    year,
    teams: teams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      departures: team.roster.map((player) => playerDeparture(player, team)).filter((departure): departure is PlayerDeparture => Boolean(departure)),
    })),
    topClasses: [],
  };
}

function enrichOffseasonReport(report: OffseasonReport, topClasses: OffseasonReport["topClasses"], recruitingRankByTeam: Map<string, number>, userTeamId: string): OffseasonReport {
  return {
    ...report,
    topClasses,
    userRecruitingRank: recruitingRankByTeam.get(userTeamId),
    teams: report.teams.map((teamReport) => ({
      ...teamReport,
      recruitingRank: recruitingRankByTeam.get(teamReport.teamId),
    })),
  };
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
  const proThreshold = player.year === "SR" ? 87 : player.year === "JR" ? 91 : 96;
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
