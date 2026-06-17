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
});
