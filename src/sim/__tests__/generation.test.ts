import { describe, expect, it } from "vitest";
import { createDynasty } from "../generate";
import { POSITION_ATTRIBUTE_CAPS } from "../ratings";

describe("world generation", () => {
  it("creates a fictional 70-team world with average college-sized rosters", () => {
    const state = createDynasty(1234);
    expect(state.teams).toHaveLength(70);
    expect(state.conferences).toHaveLength(7);
    const rosterAverage = state.teams.reduce((sum, team) => sum + team.roster.length, 0) / state.teams.length;
    expect(rosterAverage).toBe(85);
    expect(state.teams.every((team) => team.roster.length === 85)).toBe(true);
  });

  it("caps initial player and recruit ratings", () => {
    const state = createDynasty(2345);
    const playerMax = Math.max(...state.teams.flatMap((team) => team.roster.map((player) => Math.max(player.overall, ...Object.values(player.attributes)))));
    const recruitMax = Math.max(...state.recruits.map((recruit) => Math.max(recruit.overall, ...Object.values(recruit.attributes))));
    expect(playerMax).toBeLessThanOrEqual(93);
    expect(recruitMax).toBeLessThanOrEqual(83);
    expect(state.recruits.every((recruit) => !recruit.traitRevealed)).toBe(true);
  });

  it("generates thousands of recruits with expected star scarcity", () => {
    const state = createDynasty(3456);
    const total = state.recruits.length;
    const fiveStarRate = state.recruits.filter((recruit) => recruit.stars === 5).length / total;
    const fourStarRate = state.recruits.filter((recruit) => recruit.stars === 4).length / total;
    expect(total).toBeGreaterThanOrEqual(2000);
    expect(fiveStarRate).toBeGreaterThanOrEqual(0.02);
    expect(fiveStarRate).toBeLessThanOrEqual(0.04);
    expect(fourStarRate).toBeGreaterThanOrEqual(0.1);
    expect(fourStarRate).toBeLessThanOrEqual(0.2);
  });

  it("applies position-specific caps to off-skill attributes", () => {
    const state = createDynasty(4567);
    const playersAndRecruits = [
      ...state.teams.flatMap((team) => team.roster.map((player) => ({ position: player.position, attributes: player.attributes }))),
      ...state.recruits.map((recruit) => ({ position: recruit.position, attributes: recruit.attributes })),
    ];

    for (const item of playersAndRecruits) {
      const caps = POSITION_ATTRIBUTE_CAPS[item.position];
      for (const [key, cap] of Object.entries(caps)) {
        expect(item.attributes[key as keyof typeof item.attributes]).toBeLessThanOrEqual(cap);
      }
    }

    const quarterbacks = playersAndRecruits.filter((item) => item.position === "QB");
    expect(quarterbacks.every((item) => item.attributes.interception <= 44 && item.attributes.runBlock <= 46)).toBe(true);
  });
});
