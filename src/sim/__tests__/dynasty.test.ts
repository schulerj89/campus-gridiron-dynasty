import { describe, expect, it } from "vitest";
import { createDynasty } from "../generate";
import { advanceWeek, allocateBlueprintPoint, autoAllocateProgramBlueprint, canEditProgramBlueprint, forceUserAward, forceUserPlayoff, forceUserWalkOnNeed, hireCoach, simulateSeasons, spendCoachPoint } from "../dynasty";
import { buildDepthChart, moveDepthChartPlayer } from "../depthChart";
import { TARGET_ROSTER } from "../ratings";
import { blueprintRemaining, blueprintSpent } from "../blueprint";

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

  it("creates offseason departures and records recruiting class rank", () => {
    let state = forceUserPlayoff(forceUserAward(createDynasty(8933)));
    for (let week = 1; week <= 15; week += 1) {
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

  it("adds labeled walk-ons when the user roster drops below the floor", () => {
    let state = forceUserPlayoff(forceUserWalkOnNeed(createDynasty(8934)));
    expect(state.teams.find((team) => team.id === state.userTeamId)?.roster.length).toBeLessThan(ROSTER_FLOOR);
    for (let week = 1; week <= 15; week += 1) {
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

  it("can smoke simulate multiple seasons", () => {
    const state = createDynasty(9123);
    const advanced = simulateSeasons(state, 3);
    expect(advanced.year).toBe(4);
    expect(advanced.history.length).toBeGreaterThanOrEqual(3);
    expect(advanced.phase).toBe("regular");
    expect(advanced.teams[0]?.roster.some((player) => player.careerStats.length > 0)).toBe(true);
    expect(advanced.teams.every((team) => team.roster.length >= ROSTER_FLOOR)).toBe(true);
  }, 20_000);

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
