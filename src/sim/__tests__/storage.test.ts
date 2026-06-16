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
    expect(normalized.rankings[0]?.allEntries).toHaveLength(normalized.teams.length);
    expect(normalized.teams[0]?.helmetIndex).toBeGreaterThanOrEqual(0);
    expect(normalized.teams[0]?.helmetIndex).toBeLessThan(14);
  });

  it("adds full ranking entries to older poll snapshots", () => {
    const oldSave = createDynasty(5252) as any;
    delete oldSave.rankings[0].allEntries;

    const normalized = normalizeDynastyState(oldSave);

    expect(normalized.rankings[0]?.entries).toHaveLength(25);
    expect(normalized.rankings[0]?.allEntries).toHaveLength(normalized.teams.length);
  });
});
