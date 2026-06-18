import { describe, expect, it } from "vitest";
import { calculateSeasonRecruitingBudget, calculateWeeklyRecruitingPoints, createDynasty } from "../generate";
import { advanceWeek, allocateBlueprintPoint, autoAllocateProgramBlueprint, canEditProgramBlueprint, forceUserAward, forceUserPlayoff, forceUserWalkOnNeed, hireCoach, investProgramPoint, setProgramBlueprintFocus, setUserOffensiveStrategy, simulateSeasons, spendCoachPoint } from "../dynasty";
import { buildDepthChart, moveDepthChartPlayer } from "../depthChart";
import { TARGET_ROSTER } from "../ratings";
import { blueprintRemaining, blueprintSpent, emptyBlueprintAllocations } from "../blueprint";
import { scoutRecruit } from "../recruiting";
import { ATTRIBUTE_KEYS, type Attributes, type DynastyState, type Team } from "../types";

const ROSTER_FLOOR = Object.values(TARGET_ROSTER).reduce((sum, count) => sum + count, 0);

describe("dynasty flow", () => {
  it("simulates weekly games and creates weekly awards", () => {
    const state = createDynasty(7891);
    const advanced = advanceWeek(state);
    const playedGame = advanced.schedule.find((game) => game.result?.boxScore);
    expect(advanced.week).toBe(2);
    expect(advanced.rankings.length).toBe(2);
    expect(advanced.rankings[0]?.entries).toHaveLength(25);
    expect(advanced.rankings[0]?.allEntries).toHaveLength(advanced.teams.length);
    expect(advanced.rankings[0]?.allEntries.at(-1)?.rank).toBe(advanced.teams.length);
    expect(advanced.rankings[0]?.entries.reduce((sum, entry) => sum + entry.firstPlaceVotes, 0)).toBe(62);
    expect(advanced.rankings[0]?.entries.some((entry) => entry.previousRank !== undefined)).toBe(true);
    expect(advanced.weeklyAwards.length).toBe(1);
    expect(advanced.weeklyAwards[0]?.national[0]?.awardName).toBe("National Offensive Player of the Week");
    expect(advanced.weeklyAwards[0]?.national[1]?.awardName).toBe("National Defensive Player of the Week");
    const userConferenceId = advanced.teams.find((team) => team.id === advanced.userTeamId)?.conferenceId;
    expect(advanced.weeklyAwards[0]?.conference[userConferenceId ?? ""]?.[0]?.awardName).toContain("Offensive Player of the Week");
    expect(advanced.weeklyAwards[0]?.conference[userConferenceId ?? ""]?.[1]?.awardName).toContain("Defensive Player of the Week");
    expect(playedGame?.result?.boxScore?.home.players.length).toBeGreaterThan(0);
    expect(playedGame?.result?.boxScore?.away.totals.passYards).toBeGreaterThanOrEqual(0);
    expect(playedGame?.result?.boxScore?.home.totals.receivingTd).toBe(playedGame?.result?.boxScore?.home.totals.passTd);
    expect(playedGame?.result?.boxScore?.away.totals.receivingTd).toBe(playedGame?.result?.boxScore?.away.totals.passTd);
    expect(playedGame?.result?.boxScore?.home.totals.receivingTargets).toBeGreaterThan(0);
    expect(playedGame?.result?.boxScore?.home.totals.extraPointAttempts).toBe((playedGame?.result?.boxScore?.home.totals.passTd ?? 0) + (playedGame?.result?.boxScore?.home.totals.rushTd ?? 0));
    expect(playedGame?.result?.playByPlay?.at(-1)?.homeScore).toBe(playedGame?.result?.homeScore);
    expect(playedGame?.result?.playByPlay?.at(-1)?.awayScore).toBe(playedGame?.result?.awayScore);
    expect(playedGame?.result?.boxScore?.home.totals.interceptions).toBe(playedGame?.result?.boxScore?.away.totals.interceptionsThrown);
    expect(playedGame?.result?.boxScore?.away.totals.interceptions).toBe(playedGame?.result?.boxScore?.home.totals.interceptionsThrown);
    expect(playedGame?.result?.boxScore?.home.totals.tackles).toBeGreaterThanOrEqual(50);
    expect(playedGame?.result?.boxScore?.home.totals.tackles).toBeLessThanOrEqual(85);
    expect(playedGame?.result?.boxScore?.home.players.find((line) => line.stats.tackles > 0)?.stats.tackles).toBeGreaterThan(2);
    const homeTeam = advanced.teams.find((team) => team.id === playedGame?.homeTeamId)!;
    const activeHomePlayers = homeTeam.roster.filter((player) => player.stats.games > 0);
    expect(activeHomePlayers.length).toBeGreaterThan(25);
    expect(activeHomePlayers.length).toBeLessThan(homeTeam.roster.length);
    expect(advanced.teams.some((team) => team.season.wins + team.season.losses > 0)).toBe(true);
  });

  it("forms playoffs and season awards after the regular season", () => {
    let state = forceUserPlayoff(forceUserAward(createDynasty(8912)));
    for (let week = 1; week <= 12; week += 1) {
      state = advanceWeek(state);
    }
    expect(state.phase).toBe("postseason");
    expect(state.playoff?.seeds).toContain(state.userTeamId);
    expect(state.seasonAwards?.nationalAwards[0]?.teamId).toBe(state.userTeamId);
    const userTeam = state.teams.find((team) => team.id === state.userTeamId)!;
    expect(userTeam.roster.some((player) => player.awards.length > 0)).toBe(true);
  });

  it("keeps the Crown Bowl champion on a recap step before offseason opens", () => {
    let state = forceUserPlayoff(createDynasty(8913));
    for (let week = 1; week <= 12; week += 1) {
      state = advanceWeek(state);
    }
    for (let round = 0; round < 3; round += 1) {
      state = advanceWeek(state);
    }

    const finalGame = state.playoff?.games.find((game) => game.playoffRound === "final");
    expect(state.phase).toBe("postseason");
    expect(state.week).toBe(16);
    expect(state.offseasonReport).toBeUndefined();
    expect(state.playoff?.championTeamId).toBeDefined();
    expect(finalGame?.played).toBe(true);
    expect(finalGame?.result?.winnerTeamId).toBe(state.playoff?.championTeamId);

    state = advanceWeek(state);
    expect(state.phase).toBe("offseason");
    expect(state.week).toBe(16);
    expect(state.offseasonReport).toBeDefined();
    expect(state.playoff?.championTeamId).toBe(finalGame?.result?.winnerTeamId);
  });

  it("allocates the annual program blueprint before kickoff and locks it after games begin", () => {
    let state = createDynasty(8921);
    const beforeBudget = state.recruiting.seasonBudget;
    expect(canEditProgramBlueprint(state)).toBe(true);

    state = allocateBlueprintPoint(state, "recruitingReach");
    let userTeam = state.teams.find((team) => team.id === state.userTeamId)!;
    expect(userTeam.blueprint?.allocations.recruitingReach).toBe(1);
    expect(state.recruiting.seasonBudget).toBeGreaterThan(beforeBudget);

    state = autoAllocateProgramBlueprint(state);
    userTeam = state.teams.find((team) => team.id === state.userTeamId)!;
    expect(userTeam.blueprint ? blueprintRemaining(userTeam.blueprint) : 1).toBe(0);
    expect(userTeam.blueprint ? blueprintSpent(userTeam.blueprint) : 0).toBe(userTeam.blueprint?.totalPoints);

    const advanced = advanceWeek({
      ...state,
      recruiting: {
        ...state.recruiting,
        autoEnabled: false,
      },
    });
    expect(canEditProgramBlueprint(advanced)).toBe(false);
    const lockedAttempt = allocateBlueprintPoint(advanced, "scoutingNetwork");
    const lockedTeam = lockedAttempt.teams.find((team) => team.id === state.userTeamId)!;
    expect(lockedTeam.blueprint?.allocations.scoutingNetwork).toBe(userTeam.blueprint?.allocations.scoutingNetwork);
  });

  it("auto-fills unspent blueprint points at Week 1 kickoff without replacing manual choices", () => {
    let state = createDynasty(8924);
    state = allocateBlueprintPoint(state, "recruitingReach");
    const beforeAdvanceTeam = state.teams.find((team) => team.id === state.userTeamId)!;
    const manualRecruitingReach = beforeAdvanceTeam.blueprint?.allocations.recruitingReach ?? 0;
    expect(beforeAdvanceTeam.blueprint ? blueprintRemaining(beforeAdvanceTeam.blueprint) : 0).toBeGreaterThan(0);

    const advanced = advanceWeek({
      ...state,
      recruiting: {
        ...state.recruiting,
        autoEnabled: false,
      },
    });
    const afterAdvanceTeam = advanced.teams.find((team) => team.id === state.userTeamId)!;

    expect(canEditProgramBlueprint(advanced)).toBe(false);
    expect(afterAdvanceTeam.blueprint?.allocations.recruitingReach).toBeGreaterThanOrEqual(manualRecruitingReach);
    expect(afterAdvanceTeam.blueprint ? blueprintRemaining(afterAdvanceTeam.blueprint) : 1).toBe(0);
    expect(afterAdvanceTeam.blueprint ? blueprintSpent(afterAdvanceTeam.blueprint) : 0).toBe(afterAdvanceTeam.blueprint?.totalPoints);
    expect(advanced.debugLog[0]).toContain("Auto-assigned");
  });

  it("keeps recruiting budget accounting balanced after blueprint changes", () => {
    let state = createDynasty(8922);
    state = scoutRecruit(state, state.recruits[0]!.id);

    const allocated = allocateBlueprintPoint(state, "recruitingReach");
    expect(allocated.recruiting.pointsRemaining + allocated.recruiting.pointsSpent).toBe(allocated.recruiting.seasonBudget);

    const autoBuilt = autoAllocateProgramBlueprint(state);
    expect(autoBuilt.recruiting.pointsRemaining + autoBuilt.recruiting.pointsSpent).toBe(autoBuilt.recruiting.seasonBudget);
  });

  it("refreshes active recruiting budget when program investments change recruiting strength", () => {
    const state = createDynasty(8928);
    const preparedTeams = state.teams.map((team) =>
      team.id === state.userTeamId
        ? {
            ...team,
            programPoints: 2,
            program: {
              ...team.program,
              prestige: 55,
              recruitingReach: 55,
              facilities: 55,
              academics: 55,
              fanSupport: 55,
              NIL: 55,
            },
          }
        : team,
    );
    const preparedUserTeam = preparedTeams.find((team) => team.id === state.userTeamId)!;
    const seasonBudget = calculateSeasonRecruitingBudget(preparedUserTeam);
    const prepared = {
      ...state,
      teams: preparedTeams,
      recruiting: {
        ...state.recruiting,
        seasonBudget,
        weeklyPoints: calculateWeeklyRecruitingPoints(preparedUserTeam),
        pointsRemaining: seasonBudget - 120,
        pointsSpent: 120,
      },
    };

    const invested = investProgramPoint(prepared, "recruitingReach");
    const investedTeam = invested.teams.find((team) => team.id === state.userTeamId)!;

    expect(investedTeam.program.recruitingReach).toBe(57);
    expect(investedTeam.programPoints).toBe(1);
    expect(invested.recruiting.seasonBudget).toBeGreaterThan(seasonBudget);
    expect(invested.recruiting.weeklyPoints).toBe(calculateWeeklyRecruitingPoints(investedTeam));
    expect(invested.recruiting.pointsSpent).toBe(120);
    expect(invested.recruiting.pointsRemaining + invested.recruiting.pointsSpent).toBe(invested.recruiting.seasonBudget);
  });

  it("refreshes active recruiting budget when coach recruiting improves", () => {
    const state = createDynasty(8929);
    const preparedTeams = state.teams.map((team) =>
      team.id === state.userTeamId
        ? {
            ...team,
            coaches: {
              ...team.coaches,
              head: {
                ...team.coaches.head,
                recruiting: 52,
                points: 1,
              },
            },
          }
        : team,
    );
    const preparedUserTeam = preparedTeams.find((team) => team.id === state.userTeamId)!;
    const seasonBudget = calculateSeasonRecruitingBudget(preparedUserTeam);
    const prepared = {
      ...state,
      teams: preparedTeams,
      recruiting: {
        ...state.recruiting,
        seasonBudget,
        weeklyPoints: calculateWeeklyRecruitingPoints(preparedUserTeam),
        pointsRemaining: seasonBudget - 150,
        pointsSpent: 150,
      },
    };

    const updated = spendCoachPoint(prepared, "head", "recruiting");
    const updatedUserTeam = updated.teams.find((team) => team.id === state.userTeamId)!;

    expect(updatedUserTeam.coaches.head.recruiting).toBe(54);
    expect(updatedUserTeam.coaches.head.points).toBe(0);
    expect(updated.recruiting.seasonBudget).toBeGreaterThan(seasonBudget);
    expect(updated.recruiting.weeklyPoints).toBe(calculateWeeklyRecruitingPoints(updatedUserTeam));
    expect(updated.recruiting.pointsSpent).toBe(150);
    expect(updated.recruiting.pointsRemaining + updated.recruiting.pointsSpent).toBe(updated.recruiting.seasonBudget);
  });

  it("lets training and facilities investments improve preseason development outcomes", () => {
    const base = createDynasty(8955);
    const userTeam = base.teams.find((team) => team.id === base.userTeamId)!;
    const breakoutIds = userTeam.roster
      .filter((player) => player.year !== "SR")
      .slice(0, 8)
      .map((player) => player.id);
    const lowTeams = base.teams.map((team) => (team.id === base.userTeamId ? tuneDevelopmentTeam(team, new Set(breakoutIds), 45, 45, 72) : team));
    const highTeams = base.teams.map((team) => (team.id === base.userTeamId ? tuneDevelopmentTeam(team, new Set(breakoutIds), 95, 95, 72) : team));
    const lowState: DynastyState = {
      ...base,
      rngState: 77,
      phase: "offseason",
      week: 21,
      teams: lowTeams,
      offseasonReport: developmentReadyReport(base, lowTeams),
    };
    const highState: DynastyState = {
      ...lowState,
      teams: highTeams,
      offseasonReport: developmentReadyReport(base, highTeams),
    };

    const lowReport = advanceWeek(lowState).offseasonReport?.teams.find((teamReport) => teamReport.teamId === base.userTeamId)!;
    const highReport = advanceWeek(highState).offseasonReport?.teams.find((teamReport) => teamReport.teamId === base.userTeamId)!;
    const lowGain = totalProgressionGain(lowReport.progressions, new Set(breakoutIds));
    const highGain = totalProgressionGain(highReport.progressions, new Set(breakoutIds));

    expect(highGain).toBeGreaterThan(lowGain);
  }, 20_000);

  it("applies blueprint focus presets and marks manual edits as custom", () => {
    let state = createDynasty(8925);
    state = setProgramBlueprintFocus(state, "development");
    let userTeam = state.teams.find((team) => team.id === state.userTeamId)!;

    expect(userTeam.blueprint?.focus).toBe("development");
    expect(userTeam.blueprint?.allocations.trainingStaff).toBeGreaterThan(0);
    expect(userTeam.blueprint?.allocations.facilities).toBeGreaterThan(0);

    state = setProgramBlueprintFocus(state, "custom");
    userTeam = state.teams.find((team) => team.id === state.userTeamId)!;
    expect(userTeam.blueprint?.focus).toBe("custom");

    const manual = allocateBlueprintPoint(createDynasty(8927), "recruitingReach");
    expect(manual.teams.find((team) => team.id === manual.userTeamId)?.blueprint?.focus).toBe("custom");
  });

  it("updates user offensive strategy without changing other teams", () => {
    const state = createDynasty(8926);
    const updated = setUserOffensiveStrategy(state, "airRaid");
    expect(updated.teams.find((team) => team.id === state.userTeamId)?.offensiveStrategy).toBe("airRaid");
    expect(updated.teams.filter((team) => team.id !== state.userTeamId).every((team, index) => team.offensiveStrategy === state.teams.filter((candidate) => candidate.id !== state.userTeamId)[index]?.offensiveStrategy)).toBe(true);
  });

  it("keeps spent recruiting points sunk when blueprint changes lower the budget", () => {
    let state = createDynasty(8923);
    state = {
      ...state,
      teams: state.teams.map((team) =>
        team.id === state.userTeamId
          ? {
              ...team,
              blueprint: {
                ...team.blueprint!,
                totalPoints: 6,
                allocations: emptyBlueprintAllocations(),
              },
            }
          : team,
      ),
    };
    for (let index = 0; index < 6; index += 1) {
      state = allocateBlueprintPoint(state, "recruitingReach");
    }
    const boostedBudget = state.recruiting.seasonBudget;
    state = scoutRecruit(state, state.recruits[0]!.id);
    const spentBeforeRebuild = state.recruiting.pointsSpent;

    const rebuilt = autoAllocateProgramBlueprint(state);

    expect(rebuilt.recruiting.seasonBudget).toBeLessThan(boostedBudget);
    expect(rebuilt.recruiting.pointsSpent).toBe(spentBeforeRebuild);
    expect(rebuilt.recruiting.pointsRemaining).toBe(rebuilt.recruiting.seasonBudget - spentBeforeRebuild);
  });

  it("creates offseason departures and records recruiting class rank", () => {
    let state = forceUserPlayoff(forceUserAward(createDynasty(8933)));
    for (let week = 1; week <= 16; week += 1) {
      state = advanceWeek(state);
    }
    expect(state.phase).toBe("offseason");
    const userReport = state.offseasonReport?.teams.find((team) => team.teamId === state.userTeamId);
    expect(userReport?.departures.some((departure) => departure.reason === "graduated" || departure.reason === "pro")).toBe(true);
    for (let week = 0; week < 4; week += 1) {
      state = advanceWeek(state);
      expect(state.phase).toBe("offseason");
      expect(state.offseasonReport?.signingComplete).toBeFalsy();
    }
    expect(state.week).toBe(20);

    state = advanceWeek(state);
    expect(state.phase).toBe("offseason");
    expect(state.week).toBe(21);
    expect(state.offseasonReport?.signingComplete).toBe(true);
    expect(state.offseasonReport?.topClasses.length).toBeGreaterThan(0);
    expect(state.offseasonReport?.teams.some((report) => report.signees.length > 0)).toBe(true);

    state = advanceWeek(state);
    expect(state.phase).toBe("preseason");
    expect(state.offseasonReport?.developmentComplete).toBe(true);
    const preseasonReport = state.offseasonReport?.teams.find((team) => team.teamId === state.userTeamId);
    const preseasonTeam = state.teams.find((team) => team.id === state.userTeamId)!;
    expect(preseasonReport?.progressions.every((progression) => progression.afterOverall >= progression.beforeOverall)).toBe(true);
    expect(state.offseasonReport?.teams.every((report) => report.walkOns.length >= 0)).toBe(true);
    expect(state.teams.every((team) => team.roster.length >= ROSTER_FLOOR)).toBe(true);
    expect(preseasonTeam.lastBlueprint?.resolved).toBe(true);
    expect(preseasonTeam.lastBlueprint?.goals).toHaveLength(3);
    expect(preseasonTeam.blueprint?.year).toBe(state.calendarYear);
    expect(preseasonTeam.blueprint?.resolved).toBe(false);
    const incomingFreshmen = state.teams.flatMap((team) => team.roster.filter((player) => player.incomingFreshman));
    expect(incomingFreshmen.length).toBeGreaterThan(0);
    expect(incomingFreshmen.every((player) => player.year === "FR" && player.careerStats.length === 0)).toBe(true);
    const incomingIds = new Set(incomingFreshmen.map((player) => player.id));
    expect(state.offseasonReport?.teams.flatMap((teamReport) => teamReport.progressions).some((progression) => incomingIds.has(progression.playerId))).toBe(false);
    expect(state.history[0]?.userRecruitingRank).toBeGreaterThan(0);
    expect(state.teams.find((team) => team.id === state.userTeamId)?.history[0]?.recruitingClassRank).toBe(state.history[0]?.userRecruitingRank);

    state = advanceWeek(state);
    expect(state.phase).toBe("regular");
    expect(state.offseasonReport).toBeUndefined();
    expect(state.teams.flatMap((team) => team.roster).some((player) => player.incomingFreshman)).toBe(false);
  }, 20_000);

  it("preserves non-departing returning players through signing day and preseason development", () => {
    let state = createDynasty(8900);
    let guard = 0;
    while (state.phase !== "offseason" && guard < 20) {
      state = advanceWeek(state);
      guard += 1;
    }
    expect(state.phase).toBe("offseason");
    const targetTeamId = "team-16";
    const teamBeforeSigning = state.teams.find((team) => team.id === targetTeamId)!;
    const reportBeforeSigning = state.offseasonReport?.teams.find((teamReport) => teamReport.teamId === targetTeamId)!;
    const departingIds = new Set(reportBeforeSigning.departures.map((departure) => departure.playerId));
    const returningIds = teamBeforeSigning.roster.filter((player) => !departingIds.has(player.id)).map((player) => player.id);

    guard = 0;
    while (state.phase !== "preseason" && guard < 8) {
      state = advanceWeek(state);
      guard += 1;
    }
    expect(state.phase).toBe("preseason");

    const preseasonRosterIds = new Set(state.teams.find((team) => team.id === targetTeamId)!.roster.map((player) => player.id));
    expect(returningIds.every((playerId) => preseasonRosterIds.has(playerId))).toBe(true);
  }, 30_000);

  it("lets elite high-potential returners make breakout jumps into the 90s", () => {
    const base = createDynasty(8952);
    const userTeam = base.teams.find((team) => team.id === base.userTeamId)!;
    const breakoutIds = userTeam.roster
      .filter((player) => player.year !== "SR")
      .slice(0, 16)
      .map((player) => player.id);
    const tunedTeams = base.teams.map((team) => (team.id === base.userTeamId ? tuneDevelopmentTeam(team, new Set(breakoutIds), 99, 99, 99) : team));
    const state: DynastyState = {
      ...base,
      rngState: 42,
      phase: "offseason",
      week: 21,
      teams: tunedTeams,
      offseasonReport: developmentReadyReport(base, tunedTeams),
    };

    const advanced = advanceWeek(state);
    const advancedTeam = advanced.teams.find((team) => team.id === base.userTeamId)!;
    const report = advanced.offseasonReport?.teams.find((teamReport) => teamReport.teamId === base.userTeamId)!;
    const breakoutProgressions = report.progressions.filter((progression) => breakoutIds.includes(progression.playerId));

    expect(advanced.phase).toBe("preseason");
    expect(advancedTeam.roster.some((player) => breakoutIds.includes(player.id) && player.overall >= 90)).toBe(true);
    expect(breakoutProgressions.some((progression) => progression.afterOverall - progression.beforeOverall >= 5)).toBe(true);
    expect(breakoutProgressions.every((progression) => progression.afterOverall <= progression.potential)).toBe(true);
  }, 20_000);

  it("adds labeled walk-ons when the user roster drops below the floor", () => {
    let state = forceUserPlayoff(forceUserWalkOnNeed(createDynasty(8934)));
    expect(state.teams.find((team) => team.id === state.userTeamId)?.roster.length).toBeLessThan(ROSTER_FLOOR);
    for (let week = 1; week <= 16; week += 1) {
      state = advanceWeek(state);
    }
    for (let week = 0; week < 4; week += 1) {
      state = advanceWeek(state);
    }
    state = advanceWeek(state);
    state = advanceWeek(state);
    const userTeam = state.teams.find((team) => team.id === state.userTeamId)!;
    const userReport = state.offseasonReport?.teams.find((report) => report.teamId === state.userTeamId);
    expect(userTeam.roster.length).toBeGreaterThanOrEqual(ROSTER_FLOOR);
    expect(userTeam.roster.some((player) => player.walkOn)).toBe(true);
    expect(userReport?.walkOns.length).toBeGreaterThan(0);
    expect(userReport?.walkOns.every((walkOn) => walkOn.overall <= 60)).toBe(true);
  }, 20_000);

  it("keeps signing-day report player ids linked to roster players", () => {
    let state = forceUserPlayoff(createDynasty(8936));
    for (let week = 1; week <= 16; week += 1) {
      state = advanceWeek(state);
    }
    for (let week = 0; week < 4; week += 1) {
      state = advanceWeek(state);
    }
    state = advanceWeek(state);

    expect(state.offseasonReport?.signingComplete).toBe(true);
    for (const teamReport of state.offseasonReport?.teams ?? []) {
      const team = state.teams.find((candidate) => candidate.id === teamReport.teamId)!;
      const rosterIds = new Set(team.roster.map((player) => player.id));
      expect(teamReport.signees.every((signee) => rosterIds.has(signee.playerId))).toBe(true);
    }
  }, 30_000);

  it("records only current-season awards in team history", () => {
    const state = createDynasty(8935);
    const prepared = {
      ...state,
      phase: "offseason" as const,
      week: 21,
      seasonAwards: undefined,
      offseasonReport: {
        year: state.calendarYear,
        signingComplete: true,
        developmentComplete: false,
        topClasses: [],
        teams: state.teams.map((team) => ({
          teamId: team.id,
          teamName: team.name,
          departures: [],
          signees: [],
          walkOns: [],
          progressions: [],
          programChanges: [],
        })),
      },
      teams: state.teams.map((team) =>
        team.id === state.userTeamId
          ? {
              ...team,
              roster: team.roster.map((player, index) => (index === 0 ? { ...player, awards: ["Legacy Honor"] } : player)),
            }
          : team,
      ),
    };

    const advanced = advanceWeek(prepared);
    const userHistory = advanced.teams.find((team) => team.id === state.userTeamId)?.history[0];
    expect(userHistory?.awards).toEqual([]);
  });

  it("does not log a coach point spend when no point is available", () => {
    const state = createDynasty(9021);
    const prepared = {
      ...state,
      teams: state.teams.map((team) =>
        team.id === state.userTeamId
          ? {
              ...team,
              coaches: {
                ...team.coaches,
                head: {
                  ...team.coaches.head,
                  points: 0,
                },
              },
            }
          : team,
      ),
    };
    const updated = spendCoachPoint(prepared, "head", "recruiting");
    expect(updated).toBe(prepared);
  });

  it("blocks coach pool hiring during the regular season", () => {
    const state = createDynasty(9031);
    const coach = state.coachPool[0]!;
    const updated = hireCoach(state, coach.id);
    expect(updated).toBe(state);
  });

  it("returns the displaced user coach to the pool when hiring staff", () => {
    const state = { ...createDynasty(9032), phase: "postseason" as const };
    const hiredCoach = state.coachPool.find((coach) => coach.role === "head")!;
    const userTeam = state.teams.find((team) => team.id === state.userTeamId)!;
    const displacedCoach = userTeam.coaches.head;

    const updated = hireCoach(state, hiredCoach.id);
    const updatedTeam = updated.teams.find((team) => team.id === state.userTeamId)!;

    expect(updatedTeam.coaches.head.id).toBe(hiredCoach.id);
    expect(updatedTeam.coaches.head.hiredBy).toBe(state.userTeamId);
    expect(updated.coachPool.some((coach) => coach.id === hiredCoach.id)).toBe(false);
    expect(updated.coachPool.find((coach) => coach.id === displacedCoach.id)?.hiredBy).toBeUndefined();
    expect(updated.coachPool).toHaveLength(state.coachPool.length);
  });

  it("can smoke simulate multiple seasons", () => {
    const state = createDynasty(9123);
    const advanced = simulateSeasons(state, 3);
    expect(advanced.year).toBe(4);
    expect(advanced.history.length).toBeGreaterThanOrEqual(3);
    expect(advanced.phase).toBe("regular");
    expect(advanced.teams[0]?.roster.some((player) => player.careerStats.length > 0)).toBe(true);
    expect(advanced.teams.every((team) => team.roster.length >= ROSTER_FLOOR)).toBe(true);
  }, 20_000);

  it("can fast-sim through the full 20-year dynasty", () => {
    const state = createDynasty(9124);
    const advanced = simulateSeasons(state, 20);
    expect(advanced.phase).toBe("complete");
    expect(advanced.history).toHaveLength(20);
    expect(advanced.year).toBe(20);
  }, 120_000);

  it("keeps signed recruit player ids unique across multiple recruiting classes", () => {
    const state = createDynasty(9123);
    const advanced = simulateSeasons(state, 5);
    const playerIds = advanced.teams.flatMap((team) => team.roster.map((player) => player.id));
    expect(new Set(playerIds).size).toBe(playerIds.length);
  }, 30_000);

  it("builds a sorted depth chart for every position", () => {
    const state = createDynasty(10101);
    const team = state.teams[0]!;
    const depthChart = buildDepthChart(team, 3);
    expect(depthChart).toHaveLength(11);
    expect(depthChart.every((slot) => slot.players.length > 0 && slot.players.length <= 3)).toBe(true);
    for (const slot of depthChart) {
      expect(slot.players.every((player) => player.position === slot.position)).toBe(true);
      for (let index = 1; index < slot.players.length; index += 1) {
        expect(slot.players[index - 1]!.overall).toBeGreaterThanOrEqual(slot.players[index]!.overall);
      }
    }
  });

  it("persists manual depth chart moves", () => {
    const state = createDynasty(10102);
    const team = state.teams[0]!;
    const hbSlot = buildDepthChart(team, 3).find((slot) => slot.position === "HB")!;
    const secondBack = hbSlot.players[1]!;
    const moved = moveDepthChartPlayer(team, "HB", secondBack.id, "up");
    expect(buildDepthChart(moved, 3).find((slot) => slot.position === "HB")?.players[0]?.id).toBe(secondBack.id);
  });
});

function tuneDevelopmentTeam(team: Team, breakoutIds: Set<string>, training = 95, facilities = 95, coachDevelopment = 95): Team {
  return {
    ...team,
    program: {
      ...team.program,
      training,
      facilities,
    },
    coaches: {
      head: { ...team.coaches.head, development: coachDevelopment },
      offense: { ...team.coaches.offense, development: coachDevelopment },
      defense: { ...team.coaches.defense, development: coachDevelopment },
    },
    roster: team.roster.map((player) =>
      breakoutIds.has(player.id)
        ? {
            ...player,
            year: "SO",
            overall: 85,
            potential: 96,
            development: "elite",
            incomingFreshman: false,
            attributes: eliteDevelopmentAttributes(),
          }
        : player,
    ),
  };
}

function totalProgressionGain(progressions: { playerId: string; beforeOverall: number; afterOverall: number }[], playerIds: Set<string>): number {
  return progressions.filter((progression) => playerIds.has(progression.playerId)).reduce((sum, progression) => sum + progression.afterOverall - progression.beforeOverall, 0);
}

function eliteDevelopmentAttributes(): Attributes {
  return Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, 85])) as Attributes;
}

function developmentReadyReport(base: DynastyState, teams: Team[]): DynastyState["offseasonReport"] {
  return {
    year: base.calendarYear,
    teams: teams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      departures: [],
      signees: [],
      walkOns: [],
      progressions: [],
      programChanges: [],
    })),
    topClasses: [],
    userRecruitingRank: 1,
    signingComplete: true,
    developmentComplete: false,
  };
}
