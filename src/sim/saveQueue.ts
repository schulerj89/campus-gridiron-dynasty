import type { DynastyState } from "./types";

export interface QueuedSaveResult {
  state: DynastyState;
  sequence: number;
  saved: boolean;
}

interface PendingSave {
  state: DynastyState;
  sequence: number;
  resolve: (result: QueuedSaveResult) => void;
  reject: (error: unknown) => void;
}

export function createDynastySaveQueue(save: (state: DynastyState) => Promise<void>) {
  let sequence = 0;
  let active = false;
  let pending: PendingSave | undefined;

  const drain = async () => {
    if (active) return;
    active = true;
    try {
      while (pending) {
        const current = pending;
        pending = undefined;
        try {
          await save(current.state);
          current.resolve({ state: current.state, sequence: current.sequence, saved: true });
        } catch (error) {
          current.reject(error);
        }
      }
    } finally {
      active = false;
      if (pending) void drain();
    }
  };

  return {
    enqueue(state: DynastyState): Promise<QueuedSaveResult> {
      const request: PendingSave = {
        state,
        sequence: ++sequence,
        resolve: () => undefined,
        reject: () => undefined,
      };
      const promise = new Promise<QueuedSaveResult>((resolve, reject) => {
        request.resolve = resolve;
        request.reject = reject;
      });
      if (pending) {
        pending.resolve({ state: pending.state, sequence: pending.sequence, saved: false });
      }
      pending = request;
      void drain();
      return promise;
    },
  };
}
