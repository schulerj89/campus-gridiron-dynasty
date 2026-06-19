import { describe, expect, it } from "vitest";
import { createDynasty } from "../generate";
import { forceUserAward, forceUserPlayoff, simulateSeasons } from "../dynasty";
import { buildProgramRecordBook } from "../history";

describe("program record book", () => {
  it("returns an empty program history before a completed season", () => {
    const recordBook = buildProgramRecordBook(createDynasty(14501));
    expect(recordBook?.seasonsLogged).toBe(0);
    expect(recordBook?.recentSeasons).toHaveLength(0);
    expect(recordBook?.bestRecord).toBeUndefined();
    expect(recordBook?.bestRecruitingClass).toBeUndefined();
  });

  it("summarizes user program history after multiple seasons", () => {
    const state = simulateSeasons(forceUserPlayoff(forceUserAward(createDynasty(14502))), 3);
    const recordBook = buildProgramRecordBook(state);
    expect(recordBook?.seasonsLogged).toBeGreaterThanOrEqual(3);
    expect(recordBook?.recentSeasons.length).toBeGreaterThanOrEqual(3);
    expect(recordBook?.bestRecord?.wins).toBeGreaterThanOrEqual(0);
    expect(recordBook?.bestRecord?.losses).toBeGreaterThanOrEqual(0);
    expect(recordBook?.summitFourTrips).toBeGreaterThanOrEqual(recordBook?.crownBowlTitles ?? 0);
    expect(recordBook?.bowlTrips).toBeGreaterThanOrEqual(recordBook?.summitFourTrips ?? 0);
    expect(recordBook?.bestRecruitingClass?.rank).toBeGreaterThan(0);
  }, 60_000);
});
