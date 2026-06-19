import { describe, expect, it } from "vitest";
import { createDynasty } from "../../sim/generate";
import { POSITIONS } from "../../sim/types";
import { buildRecruitingViewModel } from "../recruitingViewModel";

describe("recruiting view model", () => {
  it("filters active board targets and position-scoped database results", () => {
    const state = createDynasty(21703);
    const userTeam = state.teams.find((team) => team.id === state.userTeamId)!;
    const committedElsewhere = state.recruits[0]!;
    const activeTarget = state.recruits[1]!;
    const recruits = state.recruits.map((recruit) =>
      recruit.id === committedElsewhere.id ? { ...recruit, committedTeamId: state.teams.find((team) => team.id !== userTeam.id)!.id } : recruit,
    );

    const model = buildRecruitingViewModel({
      userTeam,
      teams: state.teams,
      recruits,
      boardIds: [committedElsewhere.id, activeTarget.id],
      boardLimit: 35,
      positionFilter: "QB",
      stateFilter: "ALL",
      starsFilter: "ALL",
      commitmentFilter: "open",
      pipelineOnly: false,
      sortBy: "rank",
    });

    expect(model.board.map((recruit) => recruit.id)).toEqual([activeTarget.id]);
    expect(model.boardFull).toBe(false);
    expect(model.needCommandRows).toHaveLength(POSITIONS.length);
    expect(model.matchingRecruits.every((recruit) => recruit.position === "QB" && !recruit.committedTeamId)).toBe(true);
    expect(model.matchingRecruits.map((recruit) => recruit.nationalRank)).toEqual([...model.matchingRecruits.map((recruit) => recruit.nationalRank)].sort((a, b) => a - b));
  });
});
