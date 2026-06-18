import { describe, expect, it } from "vitest";
import { createDynasty } from "../generate";
import { normalizeDynastyState } from "../storage";

describe("storage migration", () => {
  it("fills rankings and helmet indexes for older saves", () => {
    const oldSave = createDynasty(4242) as any;
    delete oldSave.rankings;
    delete oldSave.teams[0].helmetIndex;
    delete oldSave.teams[0].depthChart;
    delete oldSave.teams[0].offensiveStrategy;
    delete oldSave.teams[0].blueprint.focus;
    delete oldSave.teams[0].roster[0].stats.receivingTargets;
    delete oldSave.teams[0].roster[0].stats.extraPoints;
    delete oldSave.teams[0].roster[0].stats.extraPointAttempts;
    oldSave.teams[0].roster[0].incomingFreshman = true;
    delete oldSave.recruiting.investedByRecruit;
    delete oldSave.recruits[0].offers;

    const normalized = normalizeDynastyState(oldSave);

    expect(normalized.rankings[0]?.entries).toHaveLength(25);
    expect(normalized.rankings[0]?.allEntries).toHaveLength(normalized.teams.length);
    expect(normalized.recruits[0]?.offers).toEqual([]);
    expect(normalized.recruiting.investedByRecruit).toEqual({});
    expect(normalized.teams[0]?.depthChart).toEqual({});
    expect(normalized.teams[0]?.offensiveStrategy).toBeTruthy();
    expect(normalized.teams[0]?.blueprint?.focus).toBe("custom");
    expect(normalized.teams[0]?.roster[0]?.stats.receivingTargets).toBe(0);
    expect(normalized.teams[0]?.roster[0]?.stats.extraPoints).toBe(0);
    expect(normalized.teams[0]?.roster[0]?.stats.extraPointAttempts).toBe(0);
    expect(normalized.teams[0]?.roster[0]?.incomingFreshman).toBeUndefined();
    expect(normalized.teams[0]?.helmetIndex).toBeGreaterThanOrEqual(0);
    expect(normalized.teams[0]?.helmetIndex).toBeLessThan(14);
  });

  it("fills top-level and recruiting defaults for older saves", () => {
    const oldSave = createDynasty(4343) as any;
    delete oldSave.debugFlags;
    delete oldSave.debugLog;
    delete oldSave.weeklyAwards;
    delete oldSave.history;
    delete oldSave.recruiting.lastActions;
    delete oldSave.recruiting.profile;
    delete oldSave.recruiting.autoEnabled;
    delete oldSave.recruiting.board;
    delete oldSave.recruiting.boardLimit;
    delete oldSave.recruiting.pointsSpent;
    delete oldSave.teams[0].history;

    const normalized = normalizeDynastyState(oldSave);

    expect(normalized.debugFlags).toEqual({ forceUserPlayoff: false, forceUserAward: false, fastSimSeasons: 0 });
    expect(normalized.debugLog).toEqual([]);
    expect(normalized.weeklyAwards).toEqual([]);
    expect(normalized.history).toEqual([]);
    expect(normalized.recruiting.lastActions).toEqual([]);
    expect(normalized.recruiting.profile).toBe("balanced");
    expect(normalized.recruiting.autoEnabled).toBe(true);
    expect(normalized.recruiting.board).toEqual([]);
    expect(normalized.recruiting.boardLimit).toBe(35);
    expect(normalized.recruiting.pointsSpent).toBeGreaterThanOrEqual(0);
    expect(normalized.teams[0]?.history).toEqual([]);
  });

  it("adds full ranking entries to older poll snapshots", () => {
    const oldSave = createDynasty(5252) as any;
    delete oldSave.rankings[0].allEntries;
    delete oldSave.rankings[0].movedIn;
    delete oldSave.rankings[0].movedOut;

    const normalized = normalizeDynastyState(oldSave);

    expect(normalized.rankings[0]?.entries).toHaveLength(25);
    expect(normalized.rankings[0]?.allEntries).toHaveLength(normalized.teams.length);
    expect(normalized.rankings[0]?.movedIn).toEqual([]);
    expect(normalized.rankings[0]?.movedOut).toEqual([]);
  });

  it("sanitizes stale team and recruit relationship ids from older saves", () => {
    const oldSave = createDynasty(5353) as any;
    const validTeamId = oldSave.teams[0].id;
    const otherTeamId = oldSave.teams[1].id;
    const missingTeamId = "team-missing";
    const activeRecruitId = oldSave.recruits[0].id;
    const signedRecruitId = oldSave.recruits[1].id;
    const committedRecruitId = oldSave.recruits[2].id;

    oldSave.userTeamId = missingTeamId;
    oldSave.recruits[0] = {
      ...oldSave.recruits[0],
      stage: "softPledge",
      committedTeamId: missingTeamId,
      offers: [validTeamId, missingTeamId, validTeamId],
      topSchools: [missingTeamId, validTeamId],
      interest: {
        [missingTeamId]: 150,
        [validTeamId]: 95,
        [otherTeamId]: Number.NaN,
      },
    };
    oldSave.recruits[1] = {
      ...oldSave.recruits[1],
      stage: "signed",
      committedTeamId: validTeamId,
    };
    oldSave.recruits[2] = {
      ...oldSave.recruits[2],
      stage: "softPledge",
      committedTeamId: otherTeamId,
    };
    oldSave.recruiting.board = [activeRecruitId, signedRecruitId, committedRecruitId, "missing-recruit", activeRecruitId];
    oldSave.recruiting.investedByRecruit = {
      [activeRecruitId]: 120,
      [signedRecruitId]: 80,
      [committedRecruitId]: 40,
      "missing-recruit": 90,
      "nan-recruit": Number.NaN,
    };

    const normalized = normalizeDynastyState(oldSave);
    const activeRecruit = normalized.recruits.find((recruit) => recruit.id === activeRecruitId);

    expect(normalized.userTeamId).toBe(validTeamId);
    expect(activeRecruit?.committedTeamId).toBeUndefined();
    expect(activeRecruit?.stage).toBe("open");
    expect(activeRecruit?.offers).toEqual([validTeamId]);
    expect(activeRecruit?.topSchools).toEqual([validTeamId]);
    expect(activeRecruit?.interest).toEqual({ [validTeamId]: 95 });
    expect(normalized.recruiting.board).toEqual([activeRecruitId]);
    expect(normalized.recruiting.investedByRecruit).toEqual({ [activeRecruitId]: 120 });
  });

  it("fills missing offseason report arrays for older saves", () => {
    const oldSave = createDynasty(5454) as any;
    const team = oldSave.teams[0];
    oldSave.phase = "offseason";
    oldSave.week = 20;
    oldSave.offseasonReport = {
      year: oldSave.calendarYear,
      teams: [
        {
          teamId: team.id,
          teamName: team.name,
        },
      ],
    };

    const normalized = normalizeDynastyState(oldSave);
    const reportTeam = normalized.offseasonReport?.teams[0];

    expect(normalized.offseasonReport?.topClasses).toEqual([]);
    expect(reportTeam?.departures).toEqual([]);
    expect(reportTeam?.signees).toEqual([]);
    expect(reportTeam?.walkOns).toEqual([]);
    expect(reportTeam?.progressions).toEqual([]);
    expect(reportTeam?.programChanges).toEqual([]);
  });

  it("normalizes older completed box scores for new strategy, play, target, and XP fields", () => {
    const oldSave = createDynasty(5656) as any;
    const game = oldSave.schedule[0];
    game.played = true;
    game.result = {
      homeScore: 24,
      awayScore: 17,
      winnerTeamId: game.homeTeamId,
      summary: "Legacy result",
      boxScore: {
        home: legacyTeamBox(game.homeTeamId),
        away: legacyTeamBox(game.awayTeamId),
      },
    };

    const normalized = normalizeDynastyState(oldSave);
    const box = normalized.schedule[0]?.result?.boxScore?.home;

    expect(box?.strategy).toBe("balanced");
    expect(box?.plays).toBeGreaterThan(0);
    expect(box?.passAttempts).toBeGreaterThan(0);
    expect(box?.totals.receivingTargets).toBe(0);
    expect(box?.totals.extraPoints).toBe(0);
    expect(box?.players[0]?.stats.extraPointAttempts).toBe(0);
    expect(normalized.schedule[0]?.result?.playByPlay).toEqual([]);
  });
});

function legacyTeamBox(teamId: string) {
  return {
    teamId,
    teamName: teamId,
    score: 24,
    totals: {
      games: 0,
      passYards: 210,
      passTd: 2,
      interceptionsThrown: 1,
      rushYards: 120,
      rushTd: 1,
      receivingYards: 210,
      receivingTd: 2,
      tackles: 66,
      sacks: 2,
      interceptions: 1,
      pancakes: 3,
      fieldGoals: 1,
      fieldGoalAttempts: 1,
    },
    players: [
      {
        playerId: "legacy-qb",
        playerName: "Legacy QB",
        position: "QB",
        stats: {
          games: 0,
          passYards: 210,
          passTd: 2,
          interceptionsThrown: 1,
          rushYards: 12,
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
      },
    ],
  };
}
