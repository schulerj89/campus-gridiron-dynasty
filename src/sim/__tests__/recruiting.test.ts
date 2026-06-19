import { describe, expect, it } from "vitest";
import { createDynasty, signedPlayerIdForRecruit } from "../generate";
import { advanceWeek } from "../dynasty";
import {
  addRecruitToBoard,
  advanceRecruitingWeek,
  autoRecruit,
  OFFER_COST,
  offerScholarship,
  PITCH_COST,
  isPipelineRecruit,
  liveOfferCountForPosition,
  pitchRecruit,
  removeRecruitFromBoard,
  rescindScholarship,
  SCOUT_COST,
  scoutRecruit,
  signRecruitingClass,
  positionNeedsWithPledges,
  rankedRecruitSchoolInterests,
} from "../recruiting";

describe("recruiting", () => {
  it("fills a smart board from team needs when auto recruit runs", () => {
    const state = createDynasty(4567);
    const recruited = autoRecruit(state, "test auto");
    expect(recruited.recruiting.board.length).toBeGreaterThan(0);
    expect(recruited.recruiting.pointsRemaining).toBeLessThan(state.recruiting.pointsRemaining);
  });

  it("uses a scout-sized point remainder when auto recruit cannot afford an offer", () => {
    const state = createDynasty(4566);
    const recruit = state.recruits.find((candidate) => !candidate.committedTeamId && candidate.scoutProgress < 65)!;
    const prepared = {
      ...state,
      recruiting: {
        ...state.recruiting,
        board: [recruit.id],
        investedByRecruit: {},
        lastActions: [],
        pointsRemaining: SCOUT_COST,
        pointsSpent: 0,
      },
    };

    const recruited = autoRecruit(prepared, "test auto");

    expect(recruited.recruiting.pointsRemaining).toBe(0);
    expect(recruited.recruiting.pointsSpent).toBe(SCOUT_COST);
    expect(Object.values(recruited.recruiting.investedByRecruit)).toContain(SCOUT_COST);
    expect(recruited.recruiting.lastActions.join(" ")).toContain("Auto-scouted");
  });

  it("balances auto-recruit board targets across positions instead of only chasing the largest need", () => {
    const state = createDynasty(4568);
    const teams = state.teams.map((team) =>
      team.id === state.userTeamId
        ? {
            ...team,
            roster: team.roster.map((player) => ({
              ...player,
              year: player.position === "OL" ? ("SR" as const) : ("FR" as const),
            })),
          }
        : team,
    );
    const recruited = autoRecruit(
      {
        ...state,
        teams,
        recruiting: {
          ...state.recruiting,
          board: [],
          investedByRecruit: {},
          pointsRemaining: state.recruiting.seasonBudget,
          pointsSpent: 0,
        },
      },
      "test auto",
    );
    const boardRecruits = recruited.recruiting.board.map((id) => recruited.recruits.find((recruit) => recruit.id === id)!);
    const positions = boardRecruits.map((recruit) => recruit.position);
    const positionCounts = positions.reduce<Record<string, number>>((counts, position) => {
      counts[position] = (counts[position] ?? 0) + 1;
      return counts;
    }, {});

    expect(new Set(positions).size).toBeGreaterThanOrEqual(8);
    expect(positionCounts.OL).toBeGreaterThan(0);
    expect(positionCounts.OL).toBeLessThan(boardRecruits.length / 2);
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

  it("does not spend scouting points on a fully scouted recruit", () => {
    const state = createDynasty(5674);
    const recruit = state.recruits[0]!;
    const prepared = {
      ...state,
      recruits: state.recruits.map((candidate) => (candidate.id === recruit.id ? { ...candidate, scoutProgress: 100 } : candidate)),
      recruiting: {
        ...state.recruiting,
        board: [recruit.id],
        investedByRecruit: {},
        lastActions: ["existing action"],
        pointsRemaining: SCOUT_COST,
        pointsSpent: 0,
      },
    };

    const attempted = scoutRecruit(prepared, recruit.id);

    expect(attempted.recruiting.pointsRemaining).toBe(SCOUT_COST);
    expect(attempted.recruiting.pointsSpent).toBe(0);
    expect(attempted.recruiting.investedByRecruit).toEqual({});
    expect(attempted.recruiting.lastActions).toEqual(["existing action"]);
    expect(attempted.recruits.find((candidate) => candidate.id === recruit.id)?.scoutProgress).toBe(100);
  });

  it("adds an off-board recruit when scouting if the board has room", () => {
    const state = createDynasty(5677);
    const recruit = state.recruits[0]!;
    const beforePoints = state.recruiting.pointsRemaining;
    const scouted = scoutRecruit({
      ...state,
      recruiting: {
        ...state.recruiting,
        board: [],
        investedByRecruit: {},
      },
    }, recruit.id);

    expect(scouted.recruiting.board).toContain(recruit.id);
    expect(scouted.recruiting.pointsRemaining).toBe(beforePoints - SCOUT_COST);
    expect(scouted.recruiting.pointsSpent).toBe(state.recruiting.pointsSpent + SCOUT_COST);
    expect(scouted.recruiting.investedByRecruit[recruit.id]).toBe(SCOUT_COST);
  });

  it("does not spend scouting points for an off-board recruit when the board is full", () => {
    const state = createDynasty(5676);
    const boardLimit = state.recruiting.boardLimit ?? 35;
    const board = state.recruits.slice(0, boardLimit).map((recruit) => recruit.id);
    const recruit = state.recruits.find((candidate) => !board.includes(candidate.id))!;
    const prepared = {
      ...state,
      recruiting: {
        ...state.recruiting,
        board,
        investedByRecruit: {},
        lastActions: ["existing action"],
      },
    };

    const attempted = scoutRecruit(prepared, recruit.id);

    expect(attempted.recruiting.board).toEqual(board);
    expect(attempted.recruiting.pointsRemaining).toBe(prepared.recruiting.pointsRemaining);
    expect(attempted.recruiting.pointsSpent).toBe(prepared.recruiting.pointsSpent);
    expect(attempted.recruiting.investedByRecruit).toEqual({});
    expect(attempted.recruiting.lastActions).toEqual(["existing action"]);
  });

  it("does not spend pitch points for an offered off-board recruit when the board is full", () => {
    const state = createDynasty(5675);
    const boardLimit = state.recruiting.boardLimit ?? 35;
    const board = state.recruits.slice(0, boardLimit).map((recruit) => recruit.id);
    const recruit = state.recruits.find((candidate) => !board.includes(candidate.id) && !candidate.offers.includes(state.userTeamId))!;
    const prepared = {
      ...state,
      recruits: state.recruits.map((candidate) =>
        candidate.id === recruit.id
          ? {
              ...candidate,
              offers: [...candidate.offers, state.userTeamId],
            }
          : candidate,
      ),
      recruiting: {
        ...state.recruiting,
        board,
        investedByRecruit: {},
        lastActions: ["existing action"],
        pointsRemaining: PITCH_COST,
        pointsSpent: 0,
      },
    };

    const attempted = pitchRecruit(prepared, recruit.id);

    expect(attempted.recruiting.board).toEqual(board);
    expect(attempted.recruiting.pointsRemaining).toBe(PITCH_COST);
    expect(attempted.recruiting.pointsSpent).toBe(0);
    expect(attempted.recruiting.investedByRecruit).toEqual({});
    expect(attempted.recruiting.lastActions).toEqual(["existing action"]);
    expect(attempted.recruits.find((candidate) => candidate.id === recruit.id)?.lastPitchWeek).toBeUndefined();
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

  it("can rescind scholarships and remove recruits from the board without refunding sunk points", () => {
    let state = createDynasty(5684);
    const recruit = state.recruits.find((candidate) => !candidate.offers.includes(state.userTeamId))!;

    state = offerScholarship(state, recruit.id);
    state = scoutRecruit(state, recruit.id);
    const beforeRescindPoints = state.recruiting.pointsRemaining;
    const beforeRescindSpent = state.recruiting.pointsSpent;

    state = rescindScholarship(state, recruit.id);
    const rescinded = state.recruits.find((candidate) => candidate.id === recruit.id)!;
    expect(rescinded.offers).not.toContain(state.userTeamId);
    expect(state.recruiting.pointsRemaining).toBe(beforeRescindPoints);
    expect(state.recruiting.pointsSpent).toBe(beforeRescindSpent);
    expect(state.recruiting.investedByRecruit[recruit.id]).toBe(OFFER_COST + SCOUT_COST);

    state = removeRecruitFromBoard(state, recruit.id);
    expect(state.recruiting.board).not.toContain(recruit.id);
    expect(state.recruiting.investedByRecruit[recruit.id]).toBeUndefined();
    expect(state.recruiting.pointsRemaining).toBe(beforeRescindPoints);
    expect(state.recruiting.pointsSpent).toBe(beforeRescindSpent);
  });

  it("counts only open live offers for recruiting need coverage", () => {
    const state = createDynasty(5685);
    const position = "WR";
    const prospects = state.recruits.filter((candidate) => candidate.position === position).slice(0, 3);
    const otherTeam = state.teams.find((team) => team.id !== state.userTeamId)!;
    const sanitized = state.recruits.map((candidate) =>
      candidate.position === position
        ? {
            ...candidate,
            offers: candidate.offers.filter((teamId) => teamId !== state.userTeamId),
            committedTeamId: undefined,
            stage: "open" as const,
          }
        : candidate,
    );
    const recruits = sanitized.map((candidate) => {
      if (candidate.id === prospects[0]?.id) return { ...candidate, offers: [...candidate.offers, state.userTeamId] };
      if (candidate.id === prospects[1]?.id) return { ...candidate, offers: [...candidate.offers, state.userTeamId], committedTeamId: otherTeam.id, stage: "softPledge" as const };
      if (candidate.id === prospects[2]?.id) return { ...candidate, offers: [...candidate.offers, state.userTeamId], committedTeamId: state.userTeamId, stage: "softPledge" as const };
      return candidate;
    });

    expect(liveOfferCountForPosition(recruits, state.userTeamId, position)).toBe(1);
  });

  it("counts user pledges against recruiting position needs", () => {
    const state = createDynasty(5687);
    const userTeam = state.teams.find((team) => team.id === state.userTeamId)!;
    const baseNeed = positionNeedsWithPledges(userTeam, state.recruits).find((need) => need.position === "QB")!;
    const targetNeed = Math.max(1, baseNeed.need);
    const roster = userTeam.roster
      .filter((player) => player.position !== "QB")
      .concat(userTeam.roster.filter((player) => player.position === "QB").slice(0, Math.max(0, baseNeed.target - targetNeed)));
    const trimmedTeam = { ...userTeam, roster };
    const trimmedBaseNeed = positionNeedsWithPledges(trimmedTeam, state.recruits).find((need) => need.position === "QB")!;
    const recruit = state.recruits.find((candidate) => candidate.position === "QB" && candidate.stage !== "signed")!;
    const pledgedRecruits = state.recruits.map((candidate) =>
      candidate.id === recruit.id
        ? {
            ...candidate,
            committedTeamId: state.userTeamId,
            stage: "softPledge" as const,
          }
        : candidate,
    );

    const pledgedNeed = positionNeedsWithPledges(trimmedTeam, pledgedRecruits).find((need) => need.position === "QB")!;

    expect(trimmedBaseNeed.need).toBeGreaterThan(0);
    expect(pledgedNeed.pledged).toBe(1);
    expect(pledgedNeed.projected).toBe(pledgedNeed.current + 1);
    expect(pledgedNeed.need).toBe(Math.max(0, trimmedBaseNeed.need - 1));
  });

  it("uses the recruit cut list when ranking modal school interests", () => {
    const state = createDynasty(5688);
    const recruit = {
      ...state.recruits[0]!,
      topSchools: ["team-b", "team-c", "missing-team"],
      interest: {
        "team-a": 150,
        "team-b": 90,
        "team-c": 80,
      },
    };

    expect(rankedRecruitSchoolInterests(recruit)).toEqual([
      ["team-b", 90],
      ["team-c", 80],
    ]);
  });

  it("falls back to sorted interest when a recruit cut list is empty or invalid", () => {
    const state = createDynasty(5689);
    const recruit = {
      ...state.recruits[0]!,
      topSchools: ["missing-team"],
      interest: {
        "team-a": 75,
        "team-b": 120,
        "team-c": 95,
      },
    };

    expect(rankedRecruitSchoolInterests(recruit, 2)).toEqual([
      ["team-b", 120],
      ["team-c", 95],
    ]);
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
      week: 7,
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
      week: 7,
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

  it("keeps committed recruits as soft pledges during weekly recruiting updates", () => {
    let state = createDynasty(5686);
    const otherTeam = state.teams.find((team) => team.id !== state.userTeamId)!;
    const recruit = state.recruits.find((candidate) => !candidate.offers.includes(state.userTeamId))!;
    const signedRecruit = state.recruits.find((candidate) => candidate.id !== recruit.id)!;
    state = offerScholarship(state, recruit.id);
    const invested = state.recruiting.investedByRecruit[recruit.id] ?? 0;
    const beforePoints = state.recruiting.pointsRemaining;

    const prepared = {
      ...state,
      week: 7,
      recruits: state.recruits.map((candidate) => {
        if (candidate.id === recruit.id) {
          return {
            ...candidate,
            committedTeamId: otherTeam.id,
            stage: "softPledge" as const,
          };
        }
        if (candidate.id === signedRecruit.id) {
          return {
            ...candidate,
            committedTeamId: otherTeam.id,
            stage: "signed" as const,
          };
        }
        return candidate;
      }),
    };

    const advanced = advanceRecruitingWeek(prepared);
    expect(advanced.recruits.find((candidate) => candidate.id === recruit.id)?.stage).toBe("softPledge");
    expect(advanced.recruits.find((candidate) => candidate.id === signedRecruit.id)?.stage).toBe("signed");
    expect(advanced.recruiting.board).not.toContain(recruit.id);
    expect(advanced.recruiting.pointsRemaining).toBe(beforePoints + invested);
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
    const signedRecruit = signed.recruits.find((candidate) => candidate.id === recruit.id)!;
    const signedPlayer = signed.teams.find((team) => team.id === state.userTeamId)?.roster.find((player) => player.id === signedPlayerIdForRecruit(signedRecruit, state.year));
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
