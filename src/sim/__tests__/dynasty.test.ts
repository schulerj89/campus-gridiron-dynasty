import { describe, expect, it } from "vitest";
import { createDynasty } from "../generate";
import { advanceWeek, forceUserAward, forceUserPlayoff, simulateSeasons, spendCoachPoint } from "../dynasty";
import { buildDepthChart } from "../depthChart";

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
    const userTeam = state.teams.find((team) => team.id === state.userTeamId)!;
    expect(userTeam.roster.some((player) => player.awards.length > 0)).toBe(true);
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

  it("can smoke simulate multiple seasons", () => {
    const state = createDynasty(9123);
    const advanced = simulateSeasons(state, 3);
    expect(advanced.year).toBe(4);
    expect(advanced.history.length).toBeGreaterThanOrEqual(3);
    expect(advanced.phase).toBe("regular");
    expect(advanced.teams[0]?.roster.some((player) => player.careerStats.length > 0)).toBe(true);
  }, 20_000);

  it("builds a sorted depth chart for every position", () => {
    const state = createDynasty(10101);
    const team = state.teams[0]!;
    const depthChart = buildDepthChart(team.roster, 3);
    expect(depthChart).toHaveLength(11);
    expect(depthChart.every((slot) => slot.players.length > 0 && slot.players.length <= 3)).toBe(true);
    for (const slot of depthChart) {
      expect(slot.players.every((player) => player.position === slot.position)).toBe(true);
      for (let index = 1; index < slot.players.length; index += 1) {
        expect(slot.players[index - 1]!.overall).toBeGreaterThanOrEqual(slot.players[index]!.overall);
      }
    }
  });
});
