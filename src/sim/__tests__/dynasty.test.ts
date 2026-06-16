import { describe, expect, it } from "vitest";
import { createDynasty } from "../generate";
import { advanceWeek, forceUserAward, forceUserPlayoff, simulateSeasons } from "../dynasty";

describe("dynasty flow", () => {
  it("simulates weekly games and creates weekly awards", () => {
    const state = createDynasty(7891);
    const advanced = advanceWeek(state);
    expect(advanced.week).toBe(2);
    expect(advanced.weeklyAwards.length).toBe(1);
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
  });

  it("can smoke simulate multiple seasons", () => {
    const state = createDynasty(9123);
    const advanced = simulateSeasons(state, 3);
    expect(advanced.year).toBe(4);
    expect(advanced.history.length).toBeGreaterThanOrEqual(3);
    expect(advanced.phase).toBe("regular");
  }, 20_000);
});
