import { clamp, Rng } from "./rng";
import { calculateSeasonRecruitingBudget, calculateWeeklyRecruitingPoints, createSignedPlayerFromRecruit } from "./generate";
import { ATTRIBUTE_KEYS, type AttributeKey, type DynastyState, type Position, type Recruit, type Team } from "./types";
import { TARGET_ROSTER } from "./ratings";

export const OFFER_COST = 50;
export const SCOUT_COST = 40;
export const PITCH_COST = 75;
const BOARD_LIMIT = 35;
const PIPELINE_BONUS = 8;
const MIN_SIGNING_CLASS = 22;
const MAX_SIGNING_CLASS = 28;

export function addRecruitToBoard(state: DynastyState, recruitId: string): DynastyState {
  const recruit = state.recruits.find((candidate) => candidate.id === recruitId);
  const limit = recruitingBoardLimit(state);
  if (!recruit || recruit.stage === "signed" || recruit.committedTeamId || state.recruiting.board.includes(recruitId) || state.recruiting.board.length >= limit) return state;
  return {
    ...state,
    recruiting: {
      ...state.recruiting,
      board: [...state.recruiting.board, recruitId],
      lastActions: [`Added ${recruit.name} to recruiting board.`, ...state.recruiting.lastActions].slice(0, 8),
    },
  };
}

export function offerScholarship(state: DynastyState, recruitId: string): DynastyState {
  const target = state.recruits.find((recruit) => recruit.id === recruitId);
  const team = getUserTeam(state);
  const limit = recruitingBoardLimit(state);
  if (!target || target.stage === "signed" || target.committedTeamId || target.offers?.includes(team.id)) return state;
  if (state.recruiting.board.length >= limit && !state.recruiting.board.includes(recruitId)) return state;
  if (state.recruiting.pointsRemaining < OFFER_COST) return state;
  const rng = new Rng(state.rngState);
  const recruits = state.recruits.map((recruit) => {
    if (recruit.id !== recruitId) return recruit;
    const boost = 12 + pipelineBonus(team, recruit) + Math.round(team.program.prestige / 20) + rng.nextInt(0, 6);
    return narrowTopSchools(
      rng,
      {
        ...recruit,
        offers: Array.from(new Set([...(recruit.offers ?? []), team.id])),
        interest: {
          ...recruit.interest,
          [team.id]: clamp((recruit.interest[team.id] ?? 1) + boost, 1, 150),
        },
      },
      state.week,
    );
  });
  const recruit = recruits.find((candidate) => candidate.id === recruitId);
  return {
    ...state,
    rngState: rng.currentState(),
    recruits,
    recruiting: {
      ...state.recruiting,
      pointsRemaining: state.recruiting.pointsRemaining - OFFER_COST,
      pointsSpent: (state.recruiting.pointsSpent ?? 0) + OFFER_COST,
      investedByRecruit: addRecruitInvestment(state.recruiting.investedByRecruit, recruitId, OFFER_COST),
      board: boardWithRecruit(state.recruiting.board, recruitId, limit),
      lastActions: [`Offered ${recruit?.name ?? "recruit"} a scholarship for ${OFFER_COST} points.`, ...state.recruiting.lastActions].slice(0, 8),
    },
  };
}

export function scoutRecruit(state: DynastyState, recruitId: string): DynastyState {
  const target = state.recruits.find((recruit) => recruit.id === recruitId);
  if (!target || target.stage === "signed" || target.committedTeamId) return state;
  if (state.recruiting.pointsRemaining < SCOUT_COST) return state;
  const rng = new Rng(state.rngState);
  const recruits = state.recruits.map((recruit) => {
    if (recruit.id !== recruitId || recruit.stage === "signed") return recruit;
    return revealRecruitAttributes(rng, recruit, rng.nextInt(24, 38));
  });
  const recruit = recruits.find((candidate) => candidate.id === recruitId);
  return {
    ...state,
    rngState: rng.currentState(),
    recruits,
    recruiting: {
      ...state.recruiting,
      pointsRemaining: state.recruiting.pointsRemaining - SCOUT_COST,
      pointsSpent: (state.recruiting.pointsSpent ?? 0) + SCOUT_COST,
      investedByRecruit: addRecruitInvestment(state.recruiting.investedByRecruit, recruitId, SCOUT_COST),
      board: boardWithRecruit(state.recruiting.board, recruitId, recruitingBoardLimit(state)),
      lastActions: [`Scouted ${recruit?.name ?? "recruit"} for ${SCOUT_COST} points.`, ...state.recruiting.lastActions].slice(0, 8),
    },
  };
}

export function pitchRecruit(state: DynastyState, recruitId: string): DynastyState {
  const target = state.recruits.find((recruit) => recruit.id === recruitId);
  if (!target || target.stage === "signed" || target.committedTeamId) return state;
  const team = getUserTeam(state);
  if (!target.offers?.includes(team.id) || target.lastPitchWeek === state.week) return state;
  if (state.recruiting.pointsRemaining < PITCH_COST) return state;
  const rng = new Rng(state.rngState);
  const recruits = state.recruits.map((recruit) => {
    if (recruit.id !== recruitId || recruit.stage === "signed") return recruit;
    const needBoost = positionNeedScore(team, recruit.position) * 0.7;
    const pitch = Math.round(8 + pipelineBonus(team, recruit) + team.program.prestige * 0.04 + team.program.facilities * 0.035 + team.coaches.head.recruiting * 0.04 + needBoost + rng.nextInt(0, 8));
    const updated = {
      ...recruit,
      lastPitchWeek: state.week,
      interest: {
        ...recruit.interest,
        [team.id]: clamp((recruit.interest[team.id] ?? 1) + pitch, 1, 150),
      },
    };
    return narrowTopSchools(rng, updated, state.week);
  });
  const recruit = recruits.find((candidate) => candidate.id === recruitId);
  return {
    ...state,
    rngState: rng.currentState(),
    recruits,
    recruiting: {
      ...state.recruiting,
      pointsRemaining: state.recruiting.pointsRemaining - PITCH_COST,
      pointsSpent: (state.recruiting.pointsSpent ?? 0) + PITCH_COST,
      investedByRecruit: addRecruitInvestment(state.recruiting.investedByRecruit, recruitId, PITCH_COST),
      board: boardWithRecruit(state.recruiting.board, recruitId, recruitingBoardLimit(state)),
      lastActions: [`Pitched ${recruit?.name ?? "recruit"} for ${PITCH_COST} points.`, ...state.recruiting.lastActions].slice(0, 8),
    },
  };
}

export function autoRecruit(state: DynastyState, reason = "Auto-recruit filled unused weekly points."): DynastyState {
  const team = getUserTeam(state);
  const rng = new Rng(state.rngState);
  let points = state.recruiting.pointsRemaining;
  let spent = state.recruiting.pointsSpent ?? 0;
  let investedByRecruit = { ...(state.recruiting.investedByRecruit ?? {}) };
  let board = ensureSmartBoard(state.recruits, activeBoard(state.recruiting.board, state.recruits), team, recruitingBoardLimit(state), recruitingBoardLimit(state));
  let recruits = state.recruits;
  const actions: string[] = [];
  const skipped = new Set<string>();

  while (points >= Math.min(OFFER_COST, SCOUT_COST, PITCH_COST) && board.length > 0 && skipped.size < board.length) {
    const target = pickAutoTarget(recruits, board, team, points, skipped);
    if (!target) break;
    const offered = target.offers?.includes(team.id);
    const pitchedThisWeek = target.lastPitchWeek === state.week;
    if (!offered && points >= OFFER_COST) {
      recruits = recruits.map((recruit) => {
        if (recruit.id !== target.id) return recruit;
        const pressure = 11 + pipelineBonus(team, recruit) + Math.round(team.program.prestige / 24);
        return narrowTopSchools(
          rng,
          {
            ...recruit,
            offers: Array.from(new Set([...(recruit.offers ?? []), team.id])),
            interest: {
              ...recruit.interest,
              [team.id]: clamp((recruit.interest[team.id] ?? 1) + pressure + positionNeedScore(team, recruit.position), 1, 150),
            },
          },
          state.week,
        );
      });
      points -= OFFER_COST;
      spent += OFFER_COST;
      investedByRecruit = addRecruitInvestment(investedByRecruit, target.id, OFFER_COST);
      actions.push(`Auto-offered ${target.name}.`);
    } else if (target.scoutProgress < 65 && points >= SCOUT_COST) {
      recruits = recruits.map((recruit) => (recruit.id === target.id ? revealRecruitAttributes(rng, recruit, 22) : recruit));
      points -= SCOUT_COST;
      spent += SCOUT_COST;
      investedByRecruit = addRecruitInvestment(investedByRecruit, target.id, SCOUT_COST);
      actions.push(`Auto-scouted ${target.name}.`);
    } else if (!pitchedThisWeek && points >= PITCH_COST && (target.interest[team.id] ?? 0) < topInterest(target) + 18) {
      recruits = recruits.map((recruit) => {
        if (recruit.id !== target.id) return recruit;
        const pressure = target.stars >= 5 ? 8 : 11;
        return narrowTopSchools(
          rng,
          {
            ...recruit,
            lastPitchWeek: state.week,
            interest: {
              ...recruit.interest,
              [team.id]: clamp((recruit.interest[team.id] ?? 1) + pressure + positionNeedScore(team, recruit.position), 1, 150),
            },
          },
          state.week,
        );
      });
      points -= PITCH_COST;
      spent += PITCH_COST;
      investedByRecruit = addRecruitInvestment(investedByRecruit, target.id, PITCH_COST);
      actions.push(`Auto-pitched ${target.name}.`);
    } else if (target.scoutProgress < 100 && points >= SCOUT_COST) {
      recruits = recruits.map((recruit) => (recruit.id === target.id ? revealRecruitAttributes(rng, recruit, 18) : recruit));
      points -= SCOUT_COST;
      spent += SCOUT_COST;
      investedByRecruit = addRecruitInvestment(investedByRecruit, target.id, SCOUT_COST);
      actions.push(`Auto-scouted ${target.name}.`);
    } else {
      skipped.add(target.id);
    }
    board = ensureSmartBoard(recruits, activeBoard(board, recruits), team, recruitingBoardLimit(state), recruitingBoardLimit(state));
  }

  return {
    ...state,
    rngState: rng.currentState(),
    recruits,
    recruiting: {
      ...state.recruiting,
      pointsRemaining: points,
      pointsSpent: spent,
      investedByRecruit,
      board,
      lastActions: [reason, ...actions, ...state.recruiting.lastActions].slice(0, 10),
    },
  };
}

export function advanceRecruitingWeek(state: DynastyState): DynastyState {
  const rng = new Rng(state.rngState);
  const recruits = state.recruits.map((recruit) => {
    if (recruit.stage === "signed") return recruit;
    const moved = simulateOtherSchools(rng, recruit, state.teams);
    return maybeCommit(rng, narrowTopSchools(rng, moved, state.week), state.week);
  });
  const userTeam = getUserTeam(state);
  const seasonBudget = state.recruiting.seasonBudget ?? calculateSeasonRecruitingBudget(userTeam);
  const weeklyPoints = calculateWeeklyRecruitingPoints(userTeam);
  const resolvedBoardIds = state.recruiting.board.filter((id) => recruits.find((recruit) => recruit.id === id)?.committedTeamId);
  const refund = resolvedBoardIds.reduce((sum, id) => sum + (state.recruiting.investedByRecruit?.[id] ?? 0), 0);
  const investedByRecruit = { ...(state.recruiting.investedByRecruit ?? {}) };
  for (const id of resolvedBoardIds) {
    delete investedByRecruit[id];
  }
  const board = activeBoard(state.recruiting.board, recruits);
  const commitAction =
    resolvedBoardIds.length && refund > 0
      ? [`Freed ${refund.toLocaleString()} recruiting points after ${resolvedBoardIds.length} board commitment${resolvedBoardIds.length === 1 ? "" : "s"}.`]
      : [];
  return {
    ...state,
    rngState: rng.currentState(),
    recruits,
    recruiting: {
      ...state.recruiting,
      weeklyPoints,
      seasonBudget,
      pointsRemaining: Math.min(state.recruiting.pointsRemaining + refund, seasonBudget),
      pointsSpent: Math.max(0, (state.recruiting.pointsSpent ?? Math.max(0, seasonBudget - state.recruiting.pointsRemaining)) - refund),
      investedByRecruit,
      boardLimit: recruitingBoardLimit(state),
      board,
      lastActions: [...commitAction, ...state.recruiting.lastActions].slice(0, 10),
    },
  };
}

export function signRecruitingClass(state: DynastyState): DynastyState {
  const rng = new Rng(state.rngState);
  const userTeam = getUserTeam(state);
  const preparedRecruits = state.recruits.map((recruit) => {
    if (recruit.stage === "signed") return recruit;
    const committedTeamId = recruit.committedTeamId ?? chooseSigningTeam(rng, recruit);
    return {
      ...recruit,
      stage: "signed" as const,
      committedTeamId,
    };
  });
  const signedByTeam = new Map<string, Recruit[]>();
  const assignments = new Map<string, string>();
  const overflow: Recruit[] = [];
  for (const recruit of preparedRecruits) {
    if (!recruit.committedTeamId) continue;
    const group = signedByTeam.get(recruit.committedTeamId) ?? [];
    if (group.length < MAX_SIGNING_CLASS) {
      group.push(recruit);
      assignments.set(recruit.id, recruit.committedTeamId);
    } else {
      overflow.push(recruit);
    }
    signedByTeam.set(recruit.committedTeamId, group);
  }

  const fallbackPool = [...overflow].sort((a, b) => a.stars - b.stars || b.nationalRank - a.nationalRank);
  const teamsByNeed = [...state.teams].sort((a, b) => estimatedClassTarget(b) - estimatedClassTarget(a));
  for (const team of teamsByNeed) {
    const group = signedByTeam.get(team.id) ?? [];
    const target = estimatedClassTarget(team);
    while (group.length < target && fallbackPool.length > 0) {
      const pickIndex = pickFallbackRecruitIndex(fallbackPool, team, group);
      const [recruit] = fallbackPool.splice(pickIndex, 1);
      if (!recruit) break;
      group.push(recruit);
      assignments.set(recruit.id, team.id);
    }
    signedByTeam.set(team.id, group);
  }

  const recruits = preparedRecruits.map((recruit) => {
    const committedTeamId = assignments.get(recruit.id);
    return {
      ...recruit,
      committedTeamId,
      traitRevealed: committedTeamId === userTeam.id ? true : recruit.traitRevealed,
      knownAttributes: committedTeamId === userTeam.id ? [...ATTRIBUTE_KEYS] : recruit.knownAttributes,
      scoutProgress: committedTeamId === userTeam.id ? 100 : recruit.scoutProgress,
      gemBust: committedTeamId === userTeam.id ? gemBustFor(recruit) : recruit.gemBust,
    };
  });
  const finalSignedByTeam = new Map<string, Recruit[]>();
  for (const recruit of recruits) {
    if (!recruit.committedTeamId) continue;
    const group = finalSignedByTeam.get(recruit.committedTeamId) ?? [];
    group.push(recruit);
    finalSignedByTeam.set(recruit.committedTeamId, group);
  }

  const teams = state.teams.map((team) => {
    const signees = finalSignedByTeam.get(team.id) ?? [];
    const roster = trimRoster([...team.roster, ...signees.map(createSignedPlayerFromRecruit)]);
    return {
      ...team,
      roster,
    };
  });

  return {
    ...state,
    rngState: rng.currentState(),
    teams,
    recruits,
    recruiting: {
      ...state.recruiting,
      lastActions: [`Signing day complete: ${finalSignedByTeam.get(userTeam.id)?.length ?? 0} recruits joined ${userTeam.name}.`, ...state.recruiting.lastActions].slice(0, 10),
    },
  };
}

export function revealRecruitAttributes(rng: Rng, recruit: Recruit, progressGain: number): Recruit {
  const scoutProgress = clamp(recruit.scoutProgress + progressGain, 0, 100);
  const revealCount = Math.min(ATTRIBUTE_KEYS.length, Math.max(recruit.knownAttributes.length, Math.floor((scoutProgress / 100) * ATTRIBUTE_KEYS.length)));
  const important = importantAttributes(recruit.position);
  const ordered = [...important, ...rng.shuffle(ATTRIBUTE_KEYS.filter((key) => !important.includes(key)))];
  const knownAttributes = Array.from(new Set([...recruit.knownAttributes, ...ordered.slice(0, revealCount)]));
  return {
    ...recruit,
    scoutProgress,
    knownAttributes,
    gemBust: scoutProgress >= 100 ? gemBustFor(recruit) : recruit.gemBust,
  };
}

export function positionNeeds(team: Team): { position: Position; need: number; target: number; current: number }[] {
  return (Object.entries(TARGET_ROSTER) as [Position, number][])
    .map(([position, target]) => {
      const current = team.roster.filter((player) => player.position === position && player.year !== "SR").length;
      return {
        position,
        need: Math.max(0, target - current),
        target,
        current,
      };
    })
    .sort((a, b) => b.need - a.need);
}

export function gemBustFor(recruit: Recruit): "gem" | "solid" | "bust" {
  const expected = recruit.stars === 5 ? 84 : recruit.stars === 4 ? 79 : recruit.stars === 3 ? 72 : recruit.stars === 2 ? 66 : 60;
  const grade = recruit.overall * 0.55 + recruit.potential * 0.45;
  if (grade >= expected + 6) return "gem";
  if (grade <= expected - 8) return "bust";
  return "solid";
}

export function isPipelineRecruit(team: Team, recruit: Recruit): boolean {
  return recruit.state === team.state;
}

function ensureSmartBoard(recruits: Recruit[], existingBoard: string[], team: Team, minimum: number, boardLimit = BOARD_LIMIT): string[] {
  const board = [...existingBoard];
  const needs = positionNeeds(team);
  const available = recruits
    .filter((recruit) => recruit.stage !== "signed" && !recruit.committedTeamId && !board.includes(recruit.id))
    .sort((a, b) => {
      const needA = needs.find((need) => need.position === a.position)?.need ?? 0;
      const needB = needs.find((need) => need.position === b.position)?.need ?? 0;
      const interestA = a.interest[team.id] ?? 0;
      const interestB = b.interest[team.id] ?? 0;
      return needB * 20 + b.stars * 12 + interestB + b.overall - (needA * 20 + a.stars * 12 + interestA + a.overall);
    });
  for (const recruit of available) {
    if (board.length >= Math.max(minimum, boardLimit)) break;
    if (board.length >= boardLimit) break;
    board.push(recruit.id);
  }
  return board.slice(0, boardLimit);
}

function pickAutoTarget(recruits: Recruit[], board: string[], team: Team, points: number, skipped = new Set<string>()): Recruit | undefined {
  return board
    .map((id) => recruits.find((recruit) => recruit.id === id))
    .filter((recruit): recruit is Recruit => recruit !== undefined && recruit.stage !== "signed" && !skipped.has(recruit.id))
    .sort((a, b) => autoScore(b, team, points) - autoScore(a, team, points))[0];
}

function autoScore(recruit: Recruit, team: Team, points: number): number {
  const need = positionNeedScore(team, recruit.position);
  const interest = recruit.interest[team.id] ?? 0;
  const scoutNeed = recruit.scoutProgress < 100 && points < PITCH_COST ? 18 : 0;
  const gemBoost = recruit.gemBust === "gem" ? 22 : recruit.gemBust === "bust" ? -32 : 0;
  const knownFit = recruit.knownAttributes.reduce((sum, key) => sum + recruit.attributes[key], 0) / Math.max(1, recruit.knownAttributes.length);
  const scoutFit = recruit.knownAttributes.length ? knownFit * 0.15 : 0;
  return need * 12 + recruit.stars * 14 + interest * 0.8 + recruit.overall * 0.3 + pipelineBonus(team, recruit) + scoutNeed + gemBoost + scoutFit;
}

function positionNeedScore(team: Team, position: Position): number {
  return positionNeeds(team).find((entry) => entry.position === position)?.need ?? 0;
}

function pipelineBonus(team: Team, recruit: Recruit): number {
  return isPipelineRecruit(team, recruit) ? PIPELINE_BONUS : 0;
}

function simulateOtherSchools(rng: Rng, recruit: Recruit, teams: Team[]): Recruit {
  const interest = { ...recruit.interest };
  const offers = new Set(recruit.offers ?? []);
  const activeSchools = recruit.topSchools.length ? recruit.topSchools : Object.keys(interest);
  for (const teamId of activeSchools) {
    const team = teams.find((candidate) => candidate.id === teamId);
    if (!team) continue;
    const hasOffer = offers.has(teamId);
    const offerOdds = clamp(0.08 + recruit.stars * 0.035 + team.program.prestige / 900 + (interest[teamId] ?? 0) / 1200, 0.06, 0.42);
    if (!hasOffer && rng.chance(offerOdds)) offers.add(teamId);
    const pressure = 1 + recruit.stars + Math.round(team.program.prestige / 35) + (offers.has(teamId) ? 3 : 0) + rng.nextInt(0, 5);
    interest[teamId] = clamp((interest[teamId] ?? 1) + pressure, 1, 150);
  }
  return { ...recruit, interest, offers: Array.from(offers) };
}

function narrowTopSchools(rng: Rng, recruit: Recruit, week: number): Recruit {
  const sorted = Object.entries(recruit.interest)
    .sort((a, b) => b[1] - a[1])
    .map(([teamId]) => teamId);
  const slowTopFive = recruit.stars === 5 && recruit.nationalRank <= 10;
  let size = 10;
  let stage = recruit.stage;
  if (week >= 4 && !slowTopFive) {
    size = 5;
    stage = "top5";
  }
  if (week >= 6 && recruit.stars <= 3) {
    size = 3;
    stage = "top3";
  }
  if (week >= 7 && !slowTopFive) {
    size = 3;
    stage = "top3";
  }
  if (week >= 9 && slowTopFive) {
    size = 5;
    stage = "top5";
  }
  if (week >= 10) {
    size = 3;
    stage = "top3";
  }
  const jitter = rng.chance(0.04) ? 1 : 0;
  return { ...recruit, topSchools: sorted.slice(0, size + jitter), stage };
}

function maybeCommit(rng: Rng, recruit: Recruit, week: number): Recruit {
  if (recruit.stage === "signed" || recruit.committedTeamId) return recruit;
  const sorted = Object.entries(recruit.interest).sort((a, b) => b[1] - a[1]);
  const offeredSchools = sorted.filter(([teamId]) => recruit.offers?.includes(teamId));
  const candidates = offeredSchools.length ? offeredSchools : sorted;
  const leader = candidates[0];
  const second = candidates[1];
  if (!leader) return recruit;
  const lead = leader[1] - (second?.[1] ?? 0);
  const patience = recruit.stars === 5 && recruit.nationalRank <= 10 ? 10 : recruit.stars >= 4 ? 7 : 4;
  const offerBonus = recruit.offers?.includes(leader[0]) ? 0.09 : -0.02;
  const earlyOfferOdds = week >= 4 && recruit.offers?.includes(leader[0]) ? 0.035 : 0.006;
  const odds = week >= patience ? clamp(0.1 + lead / 72 + (week - patience) * 0.065 + offerBonus, 0.04, 0.72) : earlyOfferOdds;
  if (!rng.chance(odds)) return recruit;
  return {
    ...recruit,
    stage: "softPledge",
    committedTeamId: leader[0],
    topSchools: recruit.topSchools.includes(leader[0]) ? recruit.topSchools : [leader[0], ...recruit.topSchools].slice(0, 3),
  };
}

function addRecruitInvestment(investedByRecruit: Record<string, number> | undefined, recruitId: string, amount: number): Record<string, number> {
  return {
    ...(investedByRecruit ?? {}),
    [recruitId]: (investedByRecruit?.[recruitId] ?? 0) + amount,
  };
}

function chooseSigningTeam(rng: Rng, recruit: Recruit): string {
  if (recruit.committedTeamId && !rng.chance(recruit.stars >= 4 ? 0.1 : 0.04)) return recruit.committedTeamId;
  const sorted = Object.entries(recruit.interest).sort((a, b) => b[1] - a[1]);
  const offeredSchools = sorted.filter(([teamId]) => recruit.offers?.includes(teamId));
  const top = (offeredSchools.length ? offeredSchools : sorted).slice(0, 3);
  const total = top.reduce((sum, [, score]) => sum + score, 0);
  let roll = rng.next() * total;
  for (const [teamId, score] of top) {
    roll -= score;
    if (roll <= 0) return teamId;
  }
  return top[0]?.[0] ?? Object.keys(recruit.interest)[0]!;
}

function estimatedClassTarget(team: Team): number {
  const seniorCount = team.roster.filter((player) => player.year === "SR").length;
  const earlyExitRisk = team.roster.filter((player) => player.year === "JR" && player.overall >= 89).length;
  return clamp(seniorCount + Math.ceil(earlyExitRisk / 2) + 3, MIN_SIGNING_CLASS, MAX_SIGNING_CLASS);
}

function pickFallbackRecruitIndex(pool: Recruit[], team: Team, signees: Recruit[]): number {
  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < pool.length; index += 1) {
    const recruit = pool[index]!;
    const score = fallbackRecruitScore(recruit, team, signees);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function fallbackRecruitScore(recruit: Recruit, team: Team, signees: Recruit[]): number {
  const target = TARGET_ROSTER[recruit.position];
  const current =
    team.roster.filter((player) => player.position === recruit.position && player.year !== "SR").length +
    signees.filter((signee) => signee.position === recruit.position).length;
  const need = Math.max(0, target - current);
  const interest = recruit.interest[team.id] ?? 0;
  return need * 42 + interest * 0.3 + pipelineBonus(team, recruit) + (3 - recruit.stars) * 8 - recruit.nationalRank * 0.001;
}

function topInterest(recruit: Recruit): number {
  return Math.max(...Object.values(recruit.interest));
}

function importantAttributes(position: Position): AttributeKey[] {
  if (position === "QB") return ["throwPower", "accuracy", "awareness"];
  if (position === "HB") return ["speed", "catching", "awareness"];
  if (position === "WR") return ["speed", "catching", "routeRunning"];
  if (position === "TE") return ["catching", "routeRunning", "runBlock"];
  if (position === "OL") return ["runBlock", "passBlock", "awareness"];
  if (position === "DL") return ["tackle", "defAwareness", "speed"];
  if (position === "LB") return ["tackle", "defAwareness", "interception"];
  if (position === "CB" || position === "S") return ["interception", "defAwareness", "speed"];
  return ["kickPower", "kickAccuracy", "awareness"];
}

function trimRoster(players: ReturnType<typeof createSignedPlayerFromRecruit>[]): ReturnType<typeof createSignedPlayerFromRecruit>[] {
  return players
    .sort((a, b) => {
      const seniorA = a.year === "SR" ? -20 : 0;
      const seniorB = b.year === "SR" ? -20 : 0;
      return b.overall + seniorB - (a.overall + seniorA);
    })
    .slice(0, 92);
}

function getUserTeam(state: DynastyState): Team {
  const team = state.teams.find((candidate) => candidate.id === state.userTeamId);
  if (!team) throw new Error("User team not found.");
  return team;
}

function boardWithRecruit(board: string[], recruitId: string, limit = BOARD_LIMIT): string[] {
  if (board.includes(recruitId) || board.length >= limit) return board;
  return [...board, recruitId];
}

function recruitingBoardLimit(state: DynastyState): number {
  return state.recruiting.boardLimit ?? BOARD_LIMIT;
}

function activeBoard(board: string[], recruits: Recruit[]): string[] {
  const recruitById = new Map(recruits.map((recruit) => [recruit.id, recruit]));
  return board.filter((id) => {
    const recruit = recruitById.get(id);
    return recruit && recruit.stage !== "signed" && !recruit.committedTeamId;
  });
}
