import { describe, expect, it } from "vitest";
import { createDynasty } from "../generate";
import { advanceWeek } from "../dynasty";
import { addRecruitToBoard, autoRecruit, OFFER_COST, offerScholarship, PITCH_COST, isPipelineRecruit, pitchRecruit, SCOUT_COST, scoutRecruit, signRecruitingClass } from "../recruiting";

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

  it("offers a scholarship once, adds the recruit to the board, and spends points", () => {
    let state = createDynasty(5679);
    const recruit = state.recruits.find((candidate) => !candidate.offers.includes(state.userTeamId))!;
    const beforePoints = state.recruiting.pointsRemaining;

    state = offerScholarship(state, recruit.id);
    const offered = state.recruits.find((candidate) => candidate.id === recruit.id)!;
    expect(offered.offers).toContain(state.userTeamId);
    expect(state.recruiting.board).toContain(recruit.id);
    expect(state.recruiting.pointsRemaining).toBe(beforePoints - OFFER_COST);

    const duplicate = offerScholarship(state, recruit.id);
    expect(duplicate.recruiting.pointsRemaining).toBe(state.recruiting.pointsRemaining);
  });

  it("requires an offer before pitching and blocks repeat pitches until the next week", () => {
    let state = createDynasty(5681);
    const recruit = state.recruits.find((candidate) => !candidate.offers.includes(state.userTeamId))!;
    const noOfferPitch = pitchRecruit(state, recruit.id);
    expect(noOfferPitch.recruiting.pointsRemaining).toBe(state.recruiting.pointsRemaining);

    state = offerScholarship(state, recruit.id);
    const beforePitch = state.recruiting.pointsRemaining;
    state = pitchRecruit(state, recruit.id);
    expect(state.recruiting.pointsRemaining).toBe(beforePitch - PITCH_COST);
    expect(state.recruits.find((candidate) => candidate.id === recruit.id)?.lastPitchWeek).toBe(state.week);

    const repeatPitch = pitchRecruit(state, recruit.id);
    expect(repeatPitch.recruiting.pointsRemaining).toBe(state.recruiting.pointsRemaining);

    const advanced = advanceWeek({ ...state, recruiting: { ...state.recruiting, autoEnabled: false } });
    const resetCommit = {
      ...advanced,
      recruits: advanced.recruits.map((candidate) => (candidate.id === recruit.id ? { ...candidate, committedTeamId: undefined, stage: "open" as const } : candidate)),
    };
    const nextPitch = pitchRecruit(resetCommit, recruit.id);
    expect(nextPitch.recruiting.pointsRemaining).toBe(resetCommit.recruiting.pointsRemaining - PITCH_COST);
  });

  it("uses a season-long recruiting budget instead of refilling every week", () => {
    let state = createDynasty(5680);
    const recruit = state.recruits[0]!;
    state = addRecruitToBoard(state, recruit.id);
    state = scoutRecruit(state, recruit.id);
    const afterSpend = state.recruiting.pointsRemaining;
    state = advanceWeek(state);
    expect(state.recruiting.pointsRemaining).toBeLessThanOrEqual(afterSpend);
    expect(state.recruiting.pointsSpent).toBeGreaterThanOrEqual(SCOUT_COST);
    expect(state.recruiting.seasonBudget).toBeGreaterThan(state.recruiting.weeklyPoints);
  });

  it("returns invested recruiting points when a board recruit commits", () => {
    let state = createDynasty(5682);
    const recruit = state.recruits.find((candidate) => !candidate.offers.includes(state.userTeamId))!;
    state = offerScholarship(state, recruit.id);
    state = pitchRecruit(state, recruit.id);
    const beforeRefund = state.recruiting.pointsRemaining;
    const invested = state.recruiting.investedByRecruit[recruit.id] ?? 0;
    state = {
      ...state,
      recruits: state.recruits.map((candidate) =>
        candidate.id === recruit.id
          ? {
              ...candidate,
              committedTeamId: state.userTeamId,
              stage: "softPledge" as const,
            }
          : candidate,
      ),
    };

    state = advanceWeek({ ...state, recruiting: { ...state.recruiting, autoEnabled: false } });
    expect(state.recruiting.board).not.toContain(recruit.id);
    expect(state.recruiting.investedByRecruit[recruit.id]).toBeUndefined();
    expect(state.recruiting.pointsRemaining).toBe(beforeRefund + invested);
  });

  it("auto-recruit immediately reallocates refunded points after commitments", () => {
    let state = createDynasty(5683);
    const otherTeam = state.teams.find((team) => team.id !== state.userTeamId)!;
    const recruit = state.recruits.find((candidate) => !candidate.offers.includes(state.userTeamId))!;
    state = offerScholarship(state, recruit.id);
    state = pitchRecruit(state, recruit.id);
    const invested = state.recruiting.investedByRecruit[recruit.id] ?? 0;
    state = {
      ...state,
      recruiting: {
        ...state.recruiting,
        pointsRemaining: 0,
        autoEnabled: true,
      },
      recruits: state.recruits.map((candidate) =>
        candidate.id === recruit.id
          ? {
              ...candidate,
              committedTeamId: otherTeam.id,
              stage: "softPledge" as const,
            }
          : candidate,
      ),
    };

    const advanced = advanceWeek(state);
    expect(advanced.recruiting.board).not.toContain(recruit.id);
    expect(advanced.recruiting.investedByRecruit[recruit.id]).toBeUndefined();
    expect(advanced.recruiting.pointsSpent).toBeGreaterThan(0);
    expect(advanced.recruiting.pointsRemaining).toBeLessThan(invested);
    expect(advanced.recruiting.lastActions.join(" ")).toContain("reallocated");
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

  it("identifies user-state recruits as pipeline prospects", () => {
    const state = createDynasty(5793);
    const userTeam = state.teams.find((team) => team.id === state.userTeamId)!;
    const pipelineRecruit = state.recruits.find((candidate) => candidate.state === userTeam.state)!;
    const outOfStateRecruit = state.recruits.find((candidate) => candidate.state !== userTeam.state)!;
    expect(isPipelineRecruit(userTeam, pipelineRecruit)).toBe(true);
    expect(isPipelineRecruit(userTeam, outOfStateRecruit)).toBe(false);
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

  it("blocks board, scout, and pitch actions once a recruit commits elsewhere", () => {
    const state = createDynasty(5794);
    const otherTeam = state.teams.find((team) => team.id !== state.userTeamId)!;
    const committedRecruit = { ...state.recruits[0]!, committedTeamId: otherTeam.id, stage: "softPledge" as const };
    const prepared = {
      ...state,
      recruits: [committedRecruit, ...state.recruits.slice(1)],
    };
    const addAttempt = addRecruitToBoard(prepared, committedRecruit.id);
    const scoutAttempt = scoutRecruit(prepared, committedRecruit.id);
    const pitchAttempt = pitchRecruit(prepared, committedRecruit.id);
    expect(addAttempt.recruiting.board).toEqual(prepared.recruiting.board);
    expect(scoutAttempt.recruiting.pointsRemaining).toBe(prepared.recruiting.pointsRemaining);
    expect(pitchAttempt.recruiting.pointsRemaining).toBe(prepared.recruiting.pointsRemaining);
    expect(scoutAttempt.recruiting.lastActions).toEqual(prepared.recruiting.lastActions);
    expect(pitchAttempt.recruiting.lastActions).toEqual(prepared.recruiting.lastActions);
  });

  it("reveals hidden traits for user-team signees after signing day", () => {
    let state = createDynasty(6789);
    const recruit = state.recruits.find((candidate) => candidate.interest[state.userTeamId] > 60)!;
    state = addRecruitToBoard(state, recruit.id);
    state = offerScholarship(state, recruit.id);
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
    const signedPlayer = signed.teams.find((team) => team.id === state.userTeamId)?.roster.find((player) => player.id === `player-${recruit.id}-${state.userTeamId}`);
    expect(userSignees.length).toBeGreaterThan(0);
    expect(userSignees.every((candidate) => candidate.traitRevealed)).toBe(true);
    expect(signedPlayer?.incomingFreshman).toBe(true);
    expect(signedPlayer?.year).toBe("FR");
  });

  it("distributes enough signing day recruits for every team to sustain roster turnover", () => {
    const state = createDynasty(6791);
    const signed = signRecruitingClass(state);
    const classSizes = signed.teams.map((team) => signed.recruits.filter((recruit) => recruit.committedTeamId === team.id).length);
    expect(Math.min(...classSizes)).toBeGreaterThanOrEqual(22);
    expect(Math.max(...classSizes)).toBeLessThanOrEqual(28);
  });
});
