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
  const teams = raw.teams.map((team, index) => ({
    ...team,
    helmetIndex: Number.isFinite((team as typeof team & { helmetIndex?: number }).helmetIndex) ? team.helmetIndex : fallbackHelmetIndex(team.id, index),
    depthChart: team.depthChart ?? {},
    history: team.history ?? [],
    blueprint: ensureProgramBlueprint(team, raw.calendarYear, team.id !== raw.userTeamId),
    roster: team.roster.map((player) => ({
      ...player,
      streak: player.streak && player.streak.weeks > 0 ? player.streak : undefined,
      incomingFreshman: raw.phase !== "regular" && Boolean(player.incomingFreshman) ? true : undefined,
      walkOn: Boolean(player.walkOn) ? true : undefined,
    })),
  }));
  const recruits = raw.recruits.map((recruit) => ({
    ...recruit,
    offers: Array.isArray((recruit as typeof recruit & { offers?: string[] }).offers) ? recruit.offers : [],
    lastPitchWeek: Number.isFinite((recruit as typeof recruit & { lastPitchWeek?: number }).lastPitchWeek) ? recruit.lastPitchWeek : undefined,
  }));
  const rankings = normalizeRankings(raw.rankings, teams, raw);
  const recruiting = normalizeRecruiting(raw.recruiting, teams.find((team) => team.id === raw.userTeamId) ?? teams[0]);
  const debugFlags = raw.debugFlags ?? {};
  return {
    ...raw,
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

function normalizeRecruiting(recruiting: Partial<DynastyState["recruiting"]> | undefined, team: DynastyState["teams"][number] | undefined): DynastyState["recruiting"] {
  const seasonBudget = finiteNumber(recruiting?.seasonBudget) ?? (team ? calculateSeasonRecruitingBudget(team) : 0);
  const weeklyPoints = finiteNumber(recruiting?.weeklyPoints) ?? (team ? calculateWeeklyRecruitingPoints(team) : 0);
  const pointsRemaining = clampNumber(finiteNumber(recruiting?.pointsRemaining) ?? seasonBudget, 0, seasonBudget);
  const pointsSpent = clampNumber(finiteNumber(recruiting?.pointsSpent) ?? Math.max(0, seasonBudget - pointsRemaining), 0, seasonBudget);
  return {
    weeklyPoints,
    seasonBudget,
    pointsRemaining,
    pointsSpent,
    investedByRecruit: recruiting?.investedByRecruit ?? {},
    boardLimit: finiteNumber(recruiting?.boardLimit) ?? 35,
    board: Array.isArray(recruiting?.board) ? recruiting.board : [],
    autoEnabled: typeof recruiting?.autoEnabled === "boolean" ? recruiting.autoEnabled : true,
    profile: recruiting?.profile ?? "balanced",
    lastActions: Array.isArray(recruiting?.lastActions) ? recruiting.lastActions : [],
  };
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
