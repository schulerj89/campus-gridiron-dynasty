import { describe, expect, it } from "vitest";
import { createDynasty } from "../generate";
import { normalizeDynastyState } from "../storage";

describe("storage migration", () => {
  it("fills rankings and helmet indexes for older saves", () => {
    const oldSave = createDynasty(4242) as any;
    delete oldSave.rankings;
    delete oldSave.teams[0].helmetIndex;
    delete oldSave.teams[0].depthChart;
    oldSave.teams[0].roster[0].incomingFreshman = true;
    delete oldSave.recruiting.investedByRecruit;
    delete oldSave.recruits[0].offers;

    const normalized = normalizeDynastyState(oldSave);

    expect(normalized.rankings[0]?.entries).toHaveLength(25);
    expect(normalized.rankings[0]?.allEntries).toHaveLength(normalized.teams.length);
    expect(normalized.recruits[0]?.offers).toEqual([]);
    expect(normalized.recruiting.investedByRecruit).toEqual({});
    expect(normalized.teams[0]?.depthChart).toEqual({});
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
});
