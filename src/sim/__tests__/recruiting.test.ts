import { describe, expect, it } from "vitest";
import { createDynasty } from "../generate";
import { addRecruitToBoard, autoRecruit, pitchRecruit, scoutRecruit, signRecruitingClass } from "../recruiting";

describe("recruiting", () => {
  it("fills a smart board from team needs when auto recruit runs", () => {
    const state = createDynasty(4567);
    const recruited = autoRecruit(state, "test auto");
    expect(recruited.recruiting.board.length).toBeGreaterThan(0);
    expect(recruited.recruiting.pointsRemaining).toBeLessThan(state.recruiting.pointsRemaining);
  });

  it("spends points to unlock attributes and gem or bust information", () => {
    let state = createDynasty(5678);
    const recruit = state.recruits[0]!;
    state = addRecruitToBoard(state, recruit.id);
    for (let index = 0; index < 5; index += 1) {
      state = scoutRecruit(state, recruit.id);
    }
    const scouted = state.recruits.find((candidate) => candidate.id === recruit.id)!;
    expect(scouted.knownAttributes.length).toBeGreaterThan(0);
    expect(scouted.scoutProgress).toBeGreaterThanOrEqual(100);
    expect(scouted.gemBust).toMatch(/gem|solid|bust/);
  });

  it("does not spend points or log actions for invalid recruit targets", () => {
    const state = createDynasty(5791);
    const scouted = scoutRecruit(state, "missing-recruit");
    const pitched = pitchRecruit(state, "missing-recruit");
    expect(scouted.recruiting.pointsRemaining).toBe(state.recruiting.pointsRemaining);
    expect(pitched.recruiting.pointsRemaining).toBe(state.recruiting.pointsRemaining);
    expect(scouted.recruiting.lastActions).toEqual(state.recruiting.lastActions);
    expect(pitched.recruiting.lastActions).toEqual(state.recruiting.lastActions);
  });

  it("does not add signed recruits or overflow the recruiting board", () => {
    const state = createDynasty(5792);
    const signedRecruit = { ...state.recruits[0]!, stage: "signed" as const };
    const board = state.recruits.slice(1, 36).map((recruit) => recruit.id);
    const prepared = {
      ...state,
      recruits: [signedRecruit, ...state.recruits.slice(1)],
      recruiting: {
        ...state.recruiting,
        board,
      },
    };
    const signedAttempt = addRecruitToBoard(prepared, signedRecruit.id);
    const overflowAttempt = addRecruitToBoard(prepared, state.recruits[36]!.id);
    expect(signedAttempt.recruiting.board).toEqual(board);
    expect(overflowAttempt.recruiting.board).toHaveLength(35);
    expect(overflowAttempt.recruiting.lastActions).toEqual(prepared.recruiting.lastActions);
  });

  it("reveals hidden traits for user-team signees after signing day", () => {
    let state = createDynasty(6789);
    const recruit = state.recruits.find((candidate) => candidate.interest[state.userTeamId] > 60)!;
    state = addRecruitToBoard(state, recruit.id);
    for (let index = 0; index < 10; index += 1) {
      state = pitchRecruit(state, recruit.id);
    }
    state = {
      ...state,
      recruits: state.recruits.map((candidate) =>
        candidate.id === recruit.id
          ? {
              ...candidate,
              committedTeamId: state.userTeamId,
            }
          : candidate,
      ),
    };
    const signed = signRecruitingClass(state);
    const userSignees = signed.recruits.filter((candidate) => candidate.committedTeamId === state.userTeamId);
    expect(userSignees.length).toBeGreaterThan(0);
    expect(userSignees.every((candidate) => candidate.traitRevealed)).toBe(true);
  });
});
