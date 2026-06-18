import { describe, expect, it } from "vitest";
import { createDynasty } from "../generate";
import { createDynastySaveQueue } from "../saveQueue";

describe("dynasty save queue", () => {
  it("serializes saves and skips superseded pending states", async () => {
    const base = createDynasty(6161);
    const first = { ...base, week: 1 };
    const second = { ...base, week: 2 };
    const third = { ...base, week: 3 };
    const savedWeeks: number[] = [];
    let markFirstStarted!: () => void;
    let releaseFirst!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const holdFirst = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const queue = createDynastySaveQueue(async (state) => {
      savedWeeks.push(state.week);
      if (state.week === 1) {
        markFirstStarted();
        await holdFirst;
      }
    });

    const firstSave = queue.enqueue(first);
    await firstStarted;
    const secondSave = queue.enqueue(second);
    const thirdSave = queue.enqueue(third);

    expect(await secondSave).toMatchObject({ state: second, saved: false });
    releaseFirst();
    expect(await firstSave).toMatchObject({ state: first, saved: true });
    expect(await thirdSave).toMatchObject({ state: third, saved: true });
    expect(savedWeeks).toEqual([1, 3]);
  });
});
