import { describe, expect, it } from "vitest";
import { createSeasonAwardCandidateBoards, createSeasonAwards, SEASON_AWARD_DEFINITIONS } from "../awards";
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

  it("builds top-eight candidate boards for each national season award", () => {
    const state = createDynasty(9202);
    const boards = createSeasonAwardCandidateBoards(state.teams);

    expect(boards).toHaveLength(SEASON_AWARD_DEFINITIONS.length);
    for (const definition of SEASON_AWARD_DEFINITIONS) {
      const board = boards.find((entry) => entry.key === definition.key);
      expect(board?.awardName).toBe(definition.awardName);
      expect(board?.candidates.length).toBeGreaterThan(0);
      expect(board?.candidates.length).toBeLessThanOrEqual(8);
      expect(board?.candidates.map((candidate) => candidate.rank)).toEqual(board?.candidates.map((_, index) => index + 1));
    }
  });

  it("stores locked candidate boards with season award winners first", () => {
    const state = createDynasty(9204);
    const awards = createSeasonAwards(state.teams, state.conferences, state.calendarYear);

    expect(awards.candidateBoards).toHaveLength(SEASON_AWARD_DEFINITIONS.length);
    for (const award of awards.nationalAwards) {
      const board = awards.candidateBoards?.find((entry) => entry.awardName === award.awardName);
      expect(board?.candidates[0]?.playerId).toBe(award.playerId);
      expect(board?.candidates[0]?.playerName).toBe(award.playerName);
    }
  });

  it("pins forced season award winners at the top of their candidate board", () => {
    const state = createDynasty(9205);
    const awards = createSeasonAwards(state.teams, state.conferences, state.calendarYear, state.userTeamId);
    const overallAward = awards.nationalAwards.find((award) => award.awardName === SEASON_AWARD_DEFINITIONS[0]?.awardName);
    const overallBoard = awards.candidateBoards?.find((board) => board.key === "overall");

    expect(overallAward?.teamId).toBe(state.userTeamId);
    expect(overallBoard?.candidates[0]?.playerId).toBe(overallAward?.playerId);
  });

  it("honors position and freshman filters on candidate boards", () => {
    const state = createDynasty(9203);
    const boards = createSeasonAwardCandidateBoards(state.teams);
    const qbBoard = boards.find((board) => board.key === "qb");
    const freshmanBoard = boards.find((board) => board.key === "freshman");
    const dbBoard = boards.find((board) => board.key === "db");

    expect(qbBoard?.candidates.every((candidate) => candidate.position === "QB")).toBe(true);
    expect(freshmanBoard?.candidates.every((candidate) => candidate.year === "FR")).toBe(true);
    expect(dbBoard?.candidates.every((candidate) => candidate.position === "CB" || candidate.position === "S")).toBe(true);
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
