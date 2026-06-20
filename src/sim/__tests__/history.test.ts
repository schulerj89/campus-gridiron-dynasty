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

  it("aggregates repeat player winners on the award shelf", () => {
    const state = createDynasty(14503);
    const userTeam = state.teams.find((team) => team.id === state.userTeamId)!;
    const awardName = "Iron Lantern Trophy - Atlas Vale";
    const prepared = {
      ...state,
      teams: state.teams.map((team) =>
        team.id === state.userTeamId
          ? {
              ...team,
              history: [
                { year: 2028, record: "9-3", conferenceFinish: 2, postseason: "Bowl Eligible", awards: [awardName], recruitingClassRank: 18 },
                { year: 2027, record: "8-4", conferenceFinish: 3, postseason: "Bowl Eligible", awards: ["All-American First Team - Signal Caller Crown - Jalen Crew"], recruitingClassRank: 22 },
                { year: 2026, record: "10-2", conferenceFinish: 1, postseason: "Summit Eight", awards: [awardName], recruitingClassRank: 12 },
                ...userTeam.history,
              ],
            }
          : team,
      ),
    };

    const recordBook = buildProgramRecordBook(prepared);
    expect(recordBook?.awardLeaders[0]).toEqual({ awardName, count: 2 });
  });
});
