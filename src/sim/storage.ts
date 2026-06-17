import type { DynastyState, PollSnapshot } from "./types";
import { createPollSnapshot } from "./polls";
import { ensureProgramBlueprint } from "./blueprint";
import { calculateSeasonRecruitingBudget, calculateWeeklyRecruitingPoints } from "./generate";

const DB_NAME = "campus-gridiron-dynasty";
const STORE_NAME = "dynasties";
const ACTIVE_KEY = "campus-gridiron-active-save";

export async function saveDynasty(state: DynastyState): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  await requestToPromise(db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({ ...state, updatedAt: new Date().toISOString() }));
  localStorage.setItem(ACTIVE_KEY, state.id);
  db.close();
}

export async function loadActiveDynasty(): Promise<DynastyState | undefined> {
  if (!hasIndexedDb()) return undefined;
  const activeId = localStorage.getItem(ACTIVE_KEY);
  if (!activeId) return undefined;
  const db = await openDb();
  const result = await requestToPromise<DynastyState | undefined>(db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(activeId));
  db.close();
  return result ? normalizeDynastyState(result) : undefined;
}

export async function clearDynasty(): Promise<void> {
  localStorage.removeItem(ACTIVE_KEY);
  if (!hasIndexedDb()) return;
  const db = await openDb();
  await requestToPromise(db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).clear());
  db.close();
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function normalizeDynastyState(input: DynastyState): DynastyState {
  const raw = input as DynastyState & {
    rankings?: DynastyState["rankings"];
    recruiting?: Partial<DynastyState["recruiting"]>;
    debugFlags?: Partial<DynastyState["debugFlags"]>;
    debugLog?: DynastyState["debugLog"];
    weeklyAwards?: DynastyState["weeklyAwards"];
    history?: DynastyState["history"];
  };
  const rawTeamIds = new Set(raw.teams.map((team) => team.id));
  const userTeamId = rawTeamIds.has(raw.userTeamId) ? raw.userTeamId : raw.teams[0]?.id ?? raw.userTeamId;
  const teams = raw.teams.map((team, index) => ({
    ...team,
    helmetIndex: Number.isFinite((team as typeof team & { helmetIndex?: number }).helmetIndex) ? team.helmetIndex : fallbackHelmetIndex(team.id, index),
    depthChart: team.depthChart ?? {},
    history: team.history ?? [],
    blueprint: ensureProgramBlueprint(team, raw.calendarYear, team.id !== userTeamId),
    roster: team.roster.map((player) => ({
      ...player,
      streak: player.streak && player.streak.weeks > 0 ? player.streak : undefined,
      incomingFreshman: raw.phase !== "regular" && Boolean(player.incomingFreshman) ? true : undefined,
      walkOn: Boolean(player.walkOn) ? true : undefined,
    })),
  }));
  const teamIds = new Set(teams.map((team) => team.id));
  const recruits = normalizeRecruits(raw.recruits, teamIds);
  const rankings = normalizeRankings(raw.rankings, teams, { ...raw, userTeamId });
  const recruiting = normalizeRecruiting(raw.recruiting, teams.find((team) => team.id === userTeamId) ?? teams[0], recruits);
  const debugFlags = raw.debugFlags ?? {};
  return {
    ...raw,
    userTeamId,
    teams,
    recruits,
    rankings,
    weeklyAwards: raw.weeklyAwards ?? [],
    history: raw.history ?? [],
    debugFlags: {
      forceUserPlayoff: debugFlags.forceUserPlayoff ?? false,
      forceUserAward: debugFlags.forceUserAward ?? false,
      fastSimSeasons: debugFlags.fastSimSeasons ?? 0,
    },
    debugLog: raw.debugLog ?? [],
    offseasonReport: raw.phase === "regular" ? undefined : normalizeOffseasonReport(raw.offseasonReport),
    recruiting,
  };
}

function normalizeRecruits(recruits: DynastyState["recruits"], teamIds: Set<string>): DynastyState["recruits"] {
  const fallbackTeamId = teamIds.values().next().value;
  return recruits.map((recruit) => {
    const interest = normalizeInterest(recruit.interest, teamIds, fallbackTeamId);
    const sortedInterestTeamIds = Object.entries(interest)
      .sort((a, b) => b[1] - a[1])
      .map(([teamId]) => teamId);
    const topSchools = uniqueValidIds((recruit as typeof recruit & { topSchools?: string[] }).topSchools, teamIds);
    const committedTeamId = recruit.committedTeamId && teamIds.has(recruit.committedTeamId) ? recruit.committedTeamId : undefined;
    const hadInvalidCommit = Boolean(recruit.committedTeamId && !committedTeamId);
    return {
      ...recruit,
      offers: uniqueValidIds((recruit as typeof recruit & { offers?: string[] }).offers, teamIds),
      topSchools: topSchools.length ? topSchools : sortedInterestTeamIds.slice(0, recruit.stars === 5 ? 14 : 10),
      interest,
      stage: hadInvalidCommit && recruit.stage === "softPledge" ? "open" : recruit.stage,
      committedTeamId,
      lastPitchWeek: Number.isFinite((recruit as typeof recruit & { lastPitchWeek?: number }).lastPitchWeek) ? recruit.lastPitchWeek : undefined,
    };
  });
}

function normalizeRecruiting(
  recruiting: Partial<DynastyState["recruiting"]> | undefined,
  team: DynastyState["teams"][number] | undefined,
  recruits: DynastyState["recruits"],
): DynastyState["recruiting"] {
  const seasonBudget = finiteNumber(recruiting?.seasonBudget) ?? (team ? calculateSeasonRecruitingBudget(team) : 0);
  const weeklyPoints = finiteNumber(recruiting?.weeklyPoints) ?? (team ? calculateWeeklyRecruitingPoints(team) : 0);
  const pointsRemaining = clampNumber(finiteNumber(recruiting?.pointsRemaining) ?? seasonBudget, 0, seasonBudget);
  const pointsSpent = clampNumber(finiteNumber(recruiting?.pointsSpent) ?? Math.max(0, seasonBudget - pointsRemaining), 0, seasonBudget);
  const boardLimit = Math.max(1, Math.floor(finiteNumber(recruiting?.boardLimit) ?? 35));
  const activeRecruitIds = new Set(recruits.filter((recruit) => recruit.stage !== "signed" && !recruit.committedTeamId).map((recruit) => recruit.id));
  const board = uniqueValidIds(recruiting?.board, activeRecruitIds).slice(0, boardLimit);
  const boardIds = new Set(board);
  return {
    weeklyPoints,
    seasonBudget,
    pointsRemaining,
    pointsSpent,
    investedByRecruit: normalizeInvestments(recruiting?.investedByRecruit, boardIds),
    boardLimit,
    board,
    autoEnabled: typeof recruiting?.autoEnabled === "boolean" ? recruiting.autoEnabled : true,
    profile: recruiting?.profile ?? "balanced",
    lastActions: Array.isArray(recruiting?.lastActions) ? recruiting.lastActions : [],
  };
}

function normalizeInterest(value: unknown, teamIds: Set<string>, fallbackTeamId: string | undefined): Record<string, number> {
  const interest: Record<string, number> = {};
  if (value && typeof value === "object") {
    for (const [teamId, score] of Object.entries(value as Record<string, unknown>)) {
      const normalizedScore = finiteNumber(score);
      if (!teamIds.has(teamId) || normalizedScore === undefined) continue;
      interest[teamId] = clampNumber(Math.round(normalizedScore), 1, 150);
    }
  }
  if (!Object.keys(interest).length && fallbackTeamId) {
    interest[fallbackTeamId] = 1;
  }
  return interest;
}

function normalizeInvestments(value: unknown, recruitIds: Set<string>): Record<string, number> {
  const investments: Record<string, number> = {};
  if (!value || typeof value !== "object") return investments;
  for (const [recruitId, amount] of Object.entries(value as Record<string, unknown>)) {
    const normalizedAmount = finiteNumber(amount);
    if (!recruitIds.has(recruitId) || normalizedAmount === undefined || normalizedAmount <= 0) continue;
    investments[recruitId] = normalizedAmount;
  }
  return investments;
}

function uniqueValidIds(value: unknown, validIds: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const id of value) {
    if (typeof id !== "string" || !validIds.has(id) || ids.includes(id)) continue;
    ids.push(id);
  }
  return ids;
}

function normalizeOffseasonReport(report: DynastyState["offseasonReport"]): DynastyState["offseasonReport"] {
  if (!report) return undefined;
  return {
    ...report,
    signingComplete: Boolean(report.signingComplete),
    developmentComplete: Boolean(report.developmentComplete),
    teams: report.teams.map((teamReport) => ({
      ...teamReport,
      signees: teamReport.signees ?? [],
      walkOns: teamReport.walkOns ?? [],
      progressions: teamReport.progressions ?? [],
      programChanges: teamReport.programChanges ?? [],
    })),
  };
}

function normalizeRankings(rankings: DynastyState["rankings"] | undefined, teams: DynastyState["teams"], state: DynastyState): PollSnapshot[] {
  if (!rankings?.length) return [createPollSnapshot(teams, state.calendarYear, state.week, state.phase).poll];
  return rankings.map((poll) => {
    const movedIn = poll.movedIn ?? [];
    const movedOut = poll.movedOut ?? [];
    if (poll.allEntries?.length === teams.length) return { ...poll, movedIn, movedOut };
    const rebuilt = createPollSnapshot(teams, poll.year, poll.week, poll.phase).poll;
    return {
      ...rebuilt,
      entries: poll.entries ?? rebuilt.entries,
      movedIn,
      movedOut: movedOut.map((entry) => rebuilt.allEntries.find((candidate) => candidate.teamId === entry.teamId) ?? entry),
    };
  });
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fallbackHelmetIndex(teamId: string, index: number): number {
  const numeric = Number(teamId.replace(/\D/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? (numeric - 1) % 14 : index % 14;
}
