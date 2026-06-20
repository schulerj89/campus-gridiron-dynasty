import { describe, expect, it } from "vitest";
import { blueprintDevelopmentBonus, blueprintRetentionBonus } from "../blueprint";
import { advanceWeek, setProgramBlueprintFocus } from "../dynasty";
import { calculateSeasonRecruitingBudget, createDynasty } from "../generate";
import { ATTRIBUTE_KEYS, type Attributes, type BlueprintFocus, type DynastyState, type OffseasonReport, type PlayerDeparture, type Team } from "../types";

describe("offseason systems", () => {
  it("requires an 88 overall floor before players can declare for the pro draft", () => {
    const base = createDynasty(9101);
    const userTeam = getUserTeam(base);
    const target = userTeam.roster.find((player) => player.year !== "SR")!;
    const prepared: DynastyState = {
      ...base,
      phase: "postseason",
      week: 16,
      playoff: {
        year: base.calendarYear,
        seeds: [base.userTeamId],
        games: [],
        championTeamId: base.userTeamId,
      },
      teams: base.teams.map((team) =>
        team.id === base.userTeamId
          ? {
              ...team,
              season: {
                ...team.season,
                wins: 12,
                losses: 1,
                rank: 1,
              },
              roster: team.roster.map((player) =>
                player.id === target.id
                  ? {
                      ...player,
                      year: "JR" as const,
                      overall: 87,
                      potential: 99,
                      awards: ["National Player of the Year", "All-American First Team", "Position Award"],
                      stats: {
                        ...player.stats,
                        games: 13,
                        passYards: 5600,
                        passTd: 52,
                        rushYards: 1200,
                        rushTd: 18,
                        receivingYards: 1800,
                        receivingTd: 19,
                        tackles: 110,
                        sacks: 18,
                        interceptions: 8,
                      },
                    }
                  : player,
              ),
            }
          : team,
      ),
    };

    const advanced = advanceWeek(prepared);
    const userReport = advanced.offseasonReport?.teams.find((report) => report.teamId === base.userTeamId);
    const departure = userReport?.departures.find((candidate) => candidate.playerId === target.id);

    expect(advanced.phase).toBe("offseason");
    expect(departure?.reason).not.toBe("pro");
  });

  it("rewards pro departures with program points and visible program lift", () => {
    const base = createDynasty(9102);
    const userTeam = normalizeProgramTeam(getUserTeam(base));
    const pro = userTeam.roster.find((player) => player.year === "SR") ?? userTeam.roster[0]!;
    const proDeparture: PlayerDeparture = {
      playerId: pro.id,
      playerName: pro.name,
      position: pro.position,
      year: "SR",
      overall: 91,
      reason: "pro",
      note: "91 OVR declared after a standout year",
    };
    const teams = base.teams.map((team) =>
      team.id === base.userTeamId
        ? {
            ...userTeam,
            programPoints: 0,
            season: {
              ...userTeam.season,
              wins: 8,
              losses: 4,
            },
          }
        : team,
    );
    const state: DynastyState = {
      ...base,
      rngState: 1902,
      phase: "offseason",
      week: 21,
      teams,
      offseasonReport: offseasonReport(base, teams, new Map([[base.userTeamId, [proDeparture]]])),
    };

    const advanced = advanceWeek(state);
    const advancedTeam = getUserTeam(advanced);
    const userReport = advanced.offseasonReport?.teams.find((report) => report.teamId === base.userTeamId)!;
    const proChanges = userReport.programChanges.filter((change) => change.reason.includes("Pro "));

    expect(advanced.phase).toBe("preseason");
    expect(advancedTeam.programPoints).toBeGreaterThanOrEqual(5);
    expect(proChanges.some((change) => change.key === "recruitingReach")).toBe(true);
    expect(proChanges.some((change) => change.key === "prestige")).toBe(true);
  });

  it("makes recruiting focus produce a larger recruiting budget than development focus", () => {
    const recruitingState = focusedProgramState(9103, "recruiting");
    const developmentState = focusedProgramState(9103, "development");
    const recruitingTeam = getUserTeam(recruitingState);
    const developmentTeam = getUserTeam(developmentState);

    expect(recruitingTeam.blueprint?.allocations.recruitingReach).toBeGreaterThan(developmentTeam.blueprint?.allocations.recruitingReach ?? 0);
    expect(calculateSeasonRecruitingBudget(recruitingTeam)).toBeGreaterThan(calculateSeasonRecruitingBudget(developmentTeam));
    expect(recruitingState.recruiting.seasonBudget).toBeGreaterThan(developmentState.recruiting.seasonBudget);
  });

  it("makes development focus create more preseason attribute growth than recruiting focus", () => {
    const developmentRun = developmentFocusRun("development");
    const recruitingRun = developmentFocusRun("recruiting");

    const developed = advanceWeek(developmentRun.state);
    const recruited = advanceWeek(recruitingRun.state);
    const developedReport = developed.offseasonReport?.teams.find((report) => report.teamId === developed.userTeamId)!;
    const recruitedReport = recruited.offseasonReport?.teams.find((report) => report.teamId === recruited.userTeamId)!;
    const developedGain = totalAttributeGain(developedReport.progressions, developmentRun.playerIds);
    const recruitedGain = totalAttributeGain(recruitedReport.progressions, recruitingRun.playerIds);

    expect(blueprintDevelopmentBonus(getUserTeam(developmentRun.state))).toBeGreaterThan(blueprintDevelopmentBonus(getUserTeam(recruitingRun.state)));
    expect(developedGain).toBeGreaterThan(recruitedGain);
  });

  it("makes academics focus useful for retention and program review support", () => {
    const academicState = focusedProgramState(9105, "academics");
    const recruitingState = focusedProgramState(9105, "recruiting");
    const academicTeam = getUserTeam(academicState);
    const recruitingTeam = getUserTeam(recruitingState);
    const teams = academicState.teams.map((team) => (team.id === academicState.userTeamId ? normalizeProgramTeam(team) : team));
    const reviewReady: DynastyState = {
      ...academicState,
      rngState: 1905,
      phase: "offseason",
      week: 21,
      teams,
      offseasonReport: offseasonReport(academicState, teams),
    };

    const advanced = advanceWeek(reviewReady);
    const userReport = advanced.offseasonReport?.teams.find((report) => report.teamId === academicState.userTeamId)!;

    expect(academicTeam.blueprint?.allocations.academicSupport).toBeGreaterThanOrEqual(4);
    expect(blueprintRetentionBonus(academicTeam)).toBeGreaterThan(blueprintRetentionBonus(recruitingTeam));
    expect(userReport.programChanges.some((change) => change.key === "academics" && change.reason.includes("Program Blueprint academic support"))).toBe(true);
  });

  it("skips all four offseason recruiting weeks when auto-recruit is enabled", () => {
    const base = focusedProgramState(9106, "recruiting");
    const state: DynastyState = {
      ...base,
      phase: "offseason",
      week: 16,
      recruiting: {
        ...base.recruiting,
        autoEnabled: true,
      },
      offseasonReport: offseasonReport(base, base.teams, undefined, false),
    };

    const advanced = advanceWeek(state);

    expect(advanced.phase).toBe("offseason");
    expect(advanced.week).toBe(21);
    expect(advanced.offseasonReport?.signingComplete).toBe(true);
    expect(advanced.offseasonReport?.topClasses.length).toBeGreaterThan(0);
    expect(advanced.recruits.every((recruit) => recruit.stage === "signed")).toBe(true);
    expect(advanced.debugLog[0]).toContain("Auto-recruit completed 4 offseason recruiting weeks");
  });
});

function focusedProgramState(seed: number, focus: BlueprintFocus): DynastyState {
  const base = createDynasty(seed);
  const normalized = {
    ...base,
    teams: base.teams.map((team) => (team.id === base.userTeamId ? normalizeProgramTeam(team) : team)),
  };
  return setProgramBlueprintFocus(normalized, focus);
}

function developmentFocusRun(focus: BlueprintFocus): { state: DynastyState; playerIds: Set<string> } {
  const focused = focusedProgramState(9104, focus);
  const userTeam = getUserTeam(focused);
  const playerIds = new Set(
    userTeam.roster
      .filter((player) => player.year !== "SR" && player.position !== "K" && player.position !== "P")
      .slice(0, 30)
      .map((player) => player.id),
  );
  const teams = focused.teams.map((team) => (team.id === focused.userTeamId ? tuneDevelopmentTeam(team, playerIds) : team));
  return {
    playerIds,
    state: {
      ...focused,
      rngState: 1904,
      phase: "offseason",
      week: 21,
      teams,
      offseasonReport: offseasonReport(focused, teams),
    },
  };
}

function normalizeProgramTeam(team: Team): Team {
  return {
    ...team,
    program: {
      prestige: 62,
      academics: 62,
      facilities: 62,
      training: 62,
      recruitingReach: 62,
      fanSupport: 62,
      NIL: 62,
    },
    coaches: {
      head: { ...team.coaches.head, recruiting: 62, development: 62, culture: 62, jobSecurity: 80 },
      offense: { ...team.coaches.offense, recruiting: 62, development: 62, culture: 62, jobSecurity: 80 },
      defense: { ...team.coaches.defense, recruiting: 62, development: 62, culture: 62, jobSecurity: 80 },
    },
  };
}

function tuneDevelopmentTeam(team: Team, playerIds: Set<string>): Team {
  return {
    ...normalizeProgramTeam(team),
    roster: team.roster.map((player) =>
      playerIds.has(player.id)
        ? {
            ...player,
            year: "SO",
            overall: 78,
            potential: 88,
            development: "rotation",
            incomingFreshman: undefined,
            attributes: fixedAttributes(68),
          }
        : player,
    ),
  };
}

function fixedAttributes(value: number): Attributes {
  return ATTRIBUTE_KEYS.reduce((attrs, key) => {
    attrs[key] = value;
    return attrs;
  }, {} as Attributes);
}

function totalAttributeGain(progressions: { playerId: string; attributeGains: Partial<Record<keyof Attributes, number>> }[], playerIds: Set<string>): number {
  return progressions
    .filter((progression) => playerIds.has(progression.playerId))
    .reduce((sum, progression) => sum + Object.values(progression.attributeGains).reduce((gainSum, value) => gainSum + (value ?? 0), 0), 0);
}

function offseasonReport(base: DynastyState, teams: Team[], departuresByTeam = new Map<string, PlayerDeparture[]>(), signingComplete = true): OffseasonReport {
  return {
    year: base.calendarYear,
    teams: teams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      departures: departuresByTeam.get(team.id) ?? [],
      signees: [],
      walkOns: [],
      cuts: [],
      progressions: [],
      programChanges: [],
    })),
    topClasses: [],
    userRecruitingRank: 1,
    departuresReviewed: true,
    signingComplete,
    developmentComplete: false,
    programReviewComplete: false,
  };
}

function getUserTeam(state: DynastyState): Team {
  return state.teams.find((team) => team.id === state.userTeamId)!;
}
