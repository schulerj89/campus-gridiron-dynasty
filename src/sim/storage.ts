import type { DynastyState } from "./types";
import { createPollSnapshot } from "./polls";

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
  const raw = input as DynastyState & { rankings?: DynastyState["rankings"] };
  const teams = raw.teams.map((team, index) => ({
    ...team,
    helmetIndex: Number.isFinite((team as typeof team & { helmetIndex?: number }).helmetIndex) ? team.helmetIndex : fallbackHelmetIndex(team.id, index),
  }));
  const rankings = raw.rankings?.length ? raw.rankings : [createPollSnapshot(teams, raw.calendarYear, raw.week, raw.phase).poll];
  return {
    ...raw,
    teams,
    rankings,
  };
}

function fallbackHelmetIndex(teamId: string, index: number): number {
  const numeric = Number(teamId.replace(/\D/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? (numeric - 1) % 14 : index % 14;
}
