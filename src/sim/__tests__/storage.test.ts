import { describe, expect, it } from "vitest";
import { createDynasty } from "../generate";
import { normalizeDynastyState } from "../storage";

describe("storage migration", () => {
  it("fills rankings and helmet indexes for older saves", () => {
    const oldSave = createDynasty(4242) as any;
    delete oldSave.rankings;
    delete oldSave.teams[0].helmetIndex;

    const normalized = normalizeDynastyState(oldSave);

    expect(normalized.rankings[0]?.entries).toHaveLength(25);
    expect(normalized.teams[0]?.helmetIndex).toBeGreaterThanOrEqual(0);
    expect(normalized.teams[0]?.helmetIndex).toBeLessThan(14);
  });
});
