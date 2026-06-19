import { isPipelineRecruit, liveOfferCountForPosition, positionNeedsWithPledges, recruitingNeedCoveragePercent, userPledgeCountForPosition } from "../sim/recruiting";
import { POSITIONS, type Position, type Recruit, type Team } from "../sim/types";

export type RecruitPositionFilter = "ALL" | Position;
export type RecruitStarsFilter = "ALL" | "1" | "2" | "3" | "4" | "5";
export type RecruitSort = "rank" | "interest" | "stars" | "need";
export type RecruitCommitmentFilter = "all" | "open" | "committed";

export interface RecruitingNeedCommandRow {
  position: Position;
  need: number;
  target: number;
  current: number;
  pledged: number;
  projected: number;
  boardCount: number;
  offerCount: number;
  committedCount: number;
  meterPercent: number;
}

export interface RecruitingViewModelInput {
  userTeam: Team;
  teams: Team[];
  recruits: Recruit[];
  boardIds: string[];
  boardLimit: number;
  positionFilter: RecruitPositionFilter;
  stateFilter: string;
  starsFilter: RecruitStarsFilter;
  commitmentFilter: RecruitCommitmentFilter;
  pipelineOnly: boolean;
  sortBy: RecruitSort;
}

export function buildRecruitingViewModel({
  userTeam,
  teams,
  recruits,
  boardIds,
  boardLimit,
  positionFilter,
  stateFilter,
  starsFilter,
  commitmentFilter,
  pipelineOnly,
  sortBy,
}: RecruitingViewModelInput) {
  const recruitById = new Map(recruits.map((recruit) => [recruit.id, recruit]));
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  const needs = positionNeedsWithPledges(userTeam, recruits);
  const board = boardIds
    .map((id) => recruitById.get(id))
    .filter((recruit): recruit is Recruit => recruit !== undefined)
    .filter((recruit) => recruit.stage !== "signed" && !recruit.committedTeamId);
  const boardFull = board.length >= boardLimit;
  const needsByPosition = new Map(needs.map((need) => [need.position, need]));
  const needCommandRows: RecruitingNeedCommandRow[] = POSITIONS.map((position) => {
    const need = {
      position,
      need: 0,
      target: 0,
      current: 0,
      pledged: 0,
      projected: 0,
      ...needsByPosition.get(position),
    };
    const boardCount = board.filter((recruit) => recruit.position === position).length;
    const offerCount = liveOfferCountForPosition(recruits, userTeam.id, position);
    const committedCount = userPledgeCountForPosition(recruits, userTeam.id, position);
    return {
      ...need,
      boardCount,
      offerCount,
      committedCount,
      meterPercent: recruitingNeedCoveragePercent({ target: need.target, current: need.current, boardCount, committedCount }),
    };
  });
  const stateOptions = Array.from(new Set(recruits.map((recruit) => recruit.state))).sort();
  const matchingRecruits = recruits
    .filter((recruit) => recruit.stage !== "signed" && !boardIds.includes(recruit.id))
    .filter((recruit) => positionFilter === "ALL" || recruit.position === positionFilter)
    .filter((recruit) => stateFilter === "ALL" || recruit.state === stateFilter)
    .filter((recruit) => starsFilter === "ALL" || recruit.stars === Number(starsFilter))
    .filter((recruit) => commitmentFilter === "all" || (commitmentFilter === "open" ? !recruit.committedTeamId : Boolean(recruit.committedTeamId)))
    .filter((recruit) => !pipelineOnly || isPipelineRecruit(userTeam, recruit))
    .sort((a, b) => {
      const needA = needs.find((need) => need.position === a.position)?.need ?? 0;
      const needB = needs.find((need) => need.position === b.position)?.need ?? 0;
      if (sortBy === "interest") return (b.interest[userTeam.id] ?? 0) - (a.interest[userTeam.id] ?? 0) || a.nationalRank - b.nationalRank;
      if (sortBy === "stars") return b.stars - a.stars || a.nationalRank - b.nationalRank;
      if (sortBy === "need") return needB - needA || a.nationalRank - b.nationalRank;
      return a.nationalRank - b.nationalRank;
    });

  return {
    teamNameById,
    board,
    boardFull,
    needCommandRows,
    stateOptions,
    matchingRecruits,
  };
}
