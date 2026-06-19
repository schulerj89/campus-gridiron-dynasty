import { describe, expect, it } from "vitest";
import { createSeasonAwards } from "../awards";
import { createDynasty } from "../generate";
import type { AwardWinner } from "../types";

describe("season awards", () => {
  it("keeps first and second honor teams disjoint", () => {
    const state = createDynasty(9201);
    const awards = createSeasonAwards(state.teams, state.conferences, state.calendarYear);

    expectDisjointHonorTeams(awards.allAmericans.first, awards.allAmericans.second);
    for (const conferenceAwards of Object.values(awards.allConference)) {
      expectDisjointHonorTeams(conferenceAwards.first, conferenceAwards.second);
    }
  });
});

function expectDisjointHonorTeams(first: AwardWinner[], second: AwardWinner[]): void {
  const firstIds = first.map((award) => award.playerId);
  const secondIds = second.map((award) => award.playerId);

  expect(new Set(firstIds).size).toBe(firstIds.length);
  expect(new Set(secondIds).size).toBe(secondIds.length);
  for (const playerId of secondIds) {
    expect(firstIds).not.toContain(playerId);
  }
}
