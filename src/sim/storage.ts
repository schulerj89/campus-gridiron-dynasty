import { emptyStats, type DynastyState, type Game, type GameBoxScore, type OffensiveStrategy, type PlayerStats, type PollSnapshot, type TeamBoxScore } from "./types";
import { createPollSnapshot } from "./polls";
import { ensureProgramBlueprint } from "./blueprint";
import { calculateSeasonRecruitingBudget, calculateWeeklyRecruitingPoints } from "./generate";

const DB_NAME = "campus-gridiron-dynasty";
const DB_VERSION = 2;
const STORE_NAME = "dynasties";
const UPDATED_AT_INDEX = "updatedAt";
const ACTIVE_KEY = "campus-gridiron-active-save";
const ACTIVE_SUMMARY_KEY = "campus-gridiron-active-save-summary";

export interface DynastySaveSummary {
  id: string;
  userTeamName: string;
  year: number;
  calendarYear: number;
  maxYears: number;
  phase: DynastyState["phase"];
  week: number;
  updatedAt: string;
}

export async function saveDynasty(state: DynastyState): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  try {
    const savedAt = new Date().toISOString();
    const savedState = { ...state, updatedAt: savedAt };
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(savedState);
    await transactionToPromise(transaction);
    saveActiveDynastyMetadata(savedState);
  } finally {
    db.close();
  }
}

export async function loadActiveDynasty(): Promise<DynastyState | undefined> {
  if (!hasIndexedDb()) return undefined;
  const activeId = hasLocalStorage() ? localStorage.getItem(ACTIVE_KEY) : undefined;
  const db = await openDb();
  try {
    const activeSave = activeId ? await requestToPromise<DynastyState | undefined>(db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(activeId)) : undefined;
    if (activeSave) {
      const normalized = normalizeDynastyState(activeSave);
      saveActiveDynastyMetadata(normalized);
      return normalized;
    }
    const fallback = await loadLatestDynastyState(db);
    if (!fallback) {
      clearActiveDynastySummary();
      return undefined;
    }
    const normalized = normalizeDynastyState(fallback);
    saveActiveDynastyMetadata(normalized);
    return normalized;
  } finally {
    db.close();
  }
}

export function loadActiveDynastySummary(): DynastySaveSummary | undefined {
  if (!hasLocalStorage()) return undefined;
  const raw = localStorage.getItem(ACTIVE_SUMMARY_KEY);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<DynastySaveSummary>;
    if (!isValidSummary(parsed)) {
      clearActiveDynastySummary();
      return undefined;
    }
    return parsed;
  } catch {
    clearActiveDynastySummary();
    return undefined;
  }
}

export async function clearDynasty(): Promise<void> {
  if (!hasIndexedDb()) {
    if (hasLocalStorage()) localStorage.removeItem(ACTIVE_KEY);
    clearActiveDynastySummary();
    return;
  }
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).clear();
    await transactionToPromise(transaction);
    if (hasLocalStorage()) localStorage.removeItem(ACTIVE_KEY);
    clearActiveDynastySummary();
  } finally {
    db.close();
  }
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function hasLocalStorage(): boolean {
  return typeof localStorage !== "undefined" && typeof localStorage.getItem === "function" && typeof localStorage.setItem === "function" && typeof localStorage.removeItem === "function";
}

export function summarizeDynastyState(state: DynastyState): DynastySaveSummary {
  const userTeam = state.teams.find((team) => team.id === state.userTeamId) ?? state.teams[0];
  return {
    id: state.id,
    userTeamName: userTeam?.name ?? "Saved Dynasty",
    year: state.year,
    calendarYear: state.calendarYear,
    maxYears: state.maxYears,
    phase: state.phase,
    week: state.week,
    updatedAt: state.updatedAt,
  };
}

export function pickLatestDynastyState(states: DynastyState[]): DynastyState | undefined {
  return [...states].sort((a, b) => saveTimestamp(b) - saveTimestamp(a))[0];
}

function saveActiveDynastyMetadata(state: DynastyState): void {
  if (hasLocalStorage()) localStorage.setItem(ACTIVE_KEY, state.id);
  saveActiveDynastySummary(summarizeDynastyState(state));
}

function saveActiveDynastySummary(summary: DynastySaveSummary): void {
  if (!hasLocalStorage()) return;
  localStorage.setItem(ACTIVE_SUMMARY_KEY, JSON.stringify(summary));
}

function clearActiveDynastySummary(): void {
  if (!hasLocalStorage()) return;
  localStorage.removeItem(ACTIVE_SUMMARY_KEY);
}

function isValidSummary(value: Partial<DynastySaveSummary>): value is DynastySaveSummary {
  return (
    typeof value.id === "string" &&
    typeof value.userTeamName === "string" &&
    typeof value.year === "number" &&
    Number.isFinite(value.year) &&
    typeof value.calendarYear === "number" &&
    Number.isFinite(value.calendarYear) &&
    typeof value.maxYears === "number" &&
    Number.isFinite(value.maxYears) &&
    typeof value.phase === "string" &&
    typeof value.week === "number" &&
    Number.isFinite(value.week) &&
    typeof value.updatedAt === "string"
  );
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(STORE_NAME)
        ? request.transaction?.objectStore(STORE_NAME)
        : db.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (store && !store.indexNames.contains(UPDATED_AT_INDEX)) {
        store.createIndex(UPDATED_AT_INDEX, "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadLatestDynastyState(db: IDBDatabase): Promise<DynastyState | undefined> {
  const store = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME);
  if (store.indexNames.contains(UPDATED_AT_INDEX)) {
    const indexedLatest = await latestDynastyFromUpdatedAtIndex(store);
    if (indexedLatest) return indexedLatest;
  }
  return pickLatestDynastyState(await requestToPromise<DynastyState[]>(store.getAll()));
}

function latestDynastyFromUpdatedAtIndex(store: IDBObjectStore): Promise<DynastyState | undefined> {
  return new Promise((resolve, reject) => {
    const request = store.index(UPDATED_AT_INDEX).openCursor(null, "prev");
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(undefined);
        return;
      }
      const state = cursor.value as DynastyState;
      if (Number.isFinite(Date.parse(state.updatedAt))) {
        resolve(state);
        return;
      }
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
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
    offensiveStrategy: normalizeOffensiveStrategy((team as typeof team & { offensiveStrategy?: unknown }).offensiveStrategy, team.coaches.offense.scheme),
    depthChart: team.depthChart ?? {},
    history: team.history ?? [],
    blueprint: ensureProgramBlueprint(team, raw.calendarYear, team.id !== userTeamId),
    roster: team.roster.map((player) => ({
      ...player,
      stats: normalizeStats(player.stats),
      careerStats: (player.careerStats ?? []).map((entry) => ({
        ...entry,
        stats: normalizeStats(entry.stats),
      })),
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
    schedule: normalizeGames(raw.schedule ?? []),
    playoff: raw.playoff
      ? {
          ...raw.playoff,
          games: normalizeGames(raw.playoff.games ?? []),
        }
      : undefined,
  };
}

function normalizeGames(games: Game[]): Game[] {
  return games.map((game) => {
    if (!game.result?.boxScore) return game;
    return {
      ...game,
      result: {
        ...game.result,
        boxScore: normalizeGameBoxScore(game.result.boxScore),
        playByPlay: game.result.playByPlay ?? [],
      },
    };
  });
}

function normalizeGameBoxScore(boxScore: GameBoxScore): GameBoxScore {
  return {
    home: normalizeTeamBoxScore(boxScore.home),
    away: normalizeTeamBoxScore(boxScore.away),
  };
}

function normalizeTeamBoxScore(box: TeamBoxScore): TeamBoxScore {
  const players = (box.players ?? []).map((line) => ({
    ...line,
    stats: normalizeStats(line.stats),
  }));
  const totals = normalizeStats(box.totals);
  const passAttempts = Number.isFinite(box.passAttempts) ? box.passAttempts : totals.passYards > 0 ? Math.max(1, Math.round(totals.passYards / 7)) : 0;
  const rushAttempts = Number.isFinite(box.rushAttempts) ? box.rushAttempts : totals.rushYards > 0 ? Math.max(1, Math.round(totals.rushYards / 4)) : 0;
  return {
    ...box,
    strategy: box.strategy ?? "balanced",
    plays: Number.isFinite(box.plays) ? box.plays : passAttempts + rushAttempts,
    passAttempts,
    rushAttempts,
    totals,
    players,
  };
}

function normalizeStats(stats: Partial<PlayerStats> | undefined): PlayerStats {
  return {
    ...emptyStats(),
    ...(stats ?? {}),
  };
}

function normalizeOffensiveStrategy(value: unknown, scheme?: string): OffensiveStrategy {
  if (value === "balanced" || value === "airRaid" || value === "runHeavy" || value === "proStyle" || value === "spreadTempo") return value;
  if (scheme === "Air Raid") return "airRaid";
  if (scheme === "Tempo Spread") return "spreadTempo";
  if (scheme === "Power Option") return "runHeavy";
  if (scheme === "Balanced Pro") return "proStyle";
  return "balanced";
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
  const seasonBudget = Math.max(0, Math.round(finiteNumber(recruiting?.seasonBudget) ?? (team ? calculateSeasonRecruitingBudget(team) : 0)));
  const weeklyPoints = Math.max(0, Math.round(finiteNumber(recruiting?.weeklyPoints) ?? (team ? calculateWeeklyRecruitingPoints(team) : 0)));
  const rawPointsRemaining = finiteNumber(recruiting?.pointsRemaining);
  const rawPointsSpent = finiteNumber(recruiting?.pointsSpent);
  const pointsSpent = clampNumber(Math.round(rawPointsSpent ?? (rawPointsRemaining === undefined ? 0 : seasonBudget - rawPointsRemaining)), 0, seasonBudget);
  const pointsRemaining = seasonBudget - pointsSpent;
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
  const reportTeams = Array.isArray(report.teams) ? report.teams : [];
  return {
    ...report,
    topClasses: Array.isArray(report.topClasses) ? report.topClasses : [],
    signingComplete: Boolean(report.signingComplete),
    developmentComplete: Boolean(report.developmentComplete),
    teams: reportTeams.map((teamReport) => ({
      ...teamReport,
      departures: teamReport.departures ?? [],
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

function saveTimestamp(state: DynastyState): number {
  const updatedAt = Date.parse(state.updatedAt);
  if (Number.isFinite(updatedAt)) return updatedAt;
  const createdAt = Date.parse(state.createdAt);
  return Number.isFinite(createdAt) ? createdAt : 0;
}

function fallbackHelmetIndex(teamId: string, index: number): number {
  const numeric = Number(teamId.replace(/\D/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? (numeric - 1) % 14 : index % 14;
}
