import { describe, expect, it } from "vitest";
import { createDynasty } from "../generate";
import { POSITION_ATTRIBUTE_CAPS } from "../ratings";

describe("world generation", () => {
  it("creates a fictional 70-team world with average college-sized rosters", () => {
    const state = createDynasty(1234);
    expect(state.teams).toHaveLength(70);
    expect(state.conferences).toHaveLength(7);
    const rosterAverage = state.teams.reduce((sum, team) => sum + team.roster.length, 0) / state.teams.length;
    expect(rosterAverage).toBe(85);
    expect(state.teams.every((team) => team.roster.length === 85)).toBe(true);
    expect(state.teams.every((team) => team.coaches.head && team.coaches.offense && team.coaches.defense)).toBe(true);
    expect(state.teams.every((team) => team.helmetIndex >= 0 && team.helmetIndex < 14)).toBe(true);
    expect(new Set(state.teams.map((team) => team.city)).size).toBe(state.teams.length);
    expect(state.coachPool.length).toBeGreaterThanOrEqual(60);
  });

  it("uses expanded player and recruit name pools to reduce duplicate names", () => {
    const state = createDynasty(1235);
    const generatedNames = [
      ...state.teams.flatMap((team) => team.roster.map((player) => player.name)),
      ...state.recruits.map((recruit) => recruit.name),
    ];
    const uniqueNameRate = new Set(generatedNames).size / generatedNames.length;

    expect(uniqueNameRate).toBeGreaterThan(0.6);
  });

  it("creates an initial national poll with votes and first-place votes", () => {
    const state = createDynasty(1357);
    const poll = state.rankings[0]!;
    expect(poll.entries).toHaveLength(25);
    expect(poll.allEntries).toHaveLength(state.teams.length);
    expect(poll.allEntries.at(-1)?.rank).toBe(state.teams.length);
    expect(poll.entries.reduce((sum, entry) => sum + entry.firstPlaceVotes, 0)).toBe(62);
    expect(poll.entries[0]!.votes).toBeGreaterThan(poll.entries[1]!.votes);
    expect(poll.movedIn).toHaveLength(0);
    expect(poll.movedOut).toHaveLength(0);
  });

  it("caps initial player and recruit ratings", () => {
    const state = createDynasty(2345);
    const playerMax = Math.max(...state.teams.flatMap((team) => team.roster.map((player) => Math.max(player.overall, ...Object.values(player.attributes)))));
    const recruitOverallMax = Math.max(...state.recruits.map((recruit) => recruit.overall));
    const recruitNonSpeedMax = Math.max(
      ...state.recruits.flatMap((recruit) =>
        Object.entries(recruit.attributes)
          .filter(([key]) => !(key === "speed" && (recruit.position === "WR" || recruit.position === "CB")))
          .map(([, value]) => value),
      ),
    );
    const recruitAthleticSpeedMax = Math.max(...state.recruits.filter((recruit) => recruit.position === "WR" || recruit.position === "CB").map((recruit) => recruit.attributes.speed));
    expect(playerMax).toBeLessThanOrEqual(93);
    expect(recruitOverallMax).toBeLessThanOrEqual(83);
    expect(recruitNonSpeedMax).toBeLessThanOrEqual(83);
    expect(recruitAthleticSpeedMax).toBeLessThanOrEqual(93);
    expect(state.recruits.every((recruit) => !recruit.traitRevealed)).toBe(true);
  });

  it("creates wide receiver speed archetypes while preserving recruit caps", () => {
    const state = createDynasty(2346);
    const rosterReceiverSpeeds = state.teams.flatMap((team) => team.roster.filter((player) => player.position === "WR").map((player) => player.attributes.speed));
    const recruitReceiverSpeeds = state.recruits.filter((recruit) => recruit.position === "WR").map((recruit) => recruit.attributes.speed);
    const recruitCornerSpeeds = state.recruits.filter((recruit) => recruit.position === "CB").map((recruit) => recruit.attributes.speed);

    expect(Math.max(...rosterReceiverSpeeds)).toBeGreaterThanOrEqual(90);
    expect(rosterReceiverSpeeds.filter((speed) => speed >= 85).length).toBeGreaterThan(20);
    expect(Math.max(...recruitReceiverSpeeds)).toBeGreaterThanOrEqual(88);
    expect(Math.max(...recruitCornerSpeeds)).toBeGreaterThanOrEqual(88);
    expect(Math.max(...recruitReceiverSpeeds, ...recruitCornerSpeeds)).toBeLessThanOrEqual(93);
  });

  it("normalizes invalid selected team ids to an existing team", () => {
    const state = createDynasty(2468, "missing-team");
    expect(state.userTeamId).not.toBe("missing-team");
    expect(state.teams.some((team) => team.id === state.userTeamId)).toBe(true);
  });

  it("generates thousands of recruits with expected star scarcity", () => {
    const state = createDynasty(3456);
    const total = state.recruits.length;
    const fiveStarRate = state.recruits.filter((recruit) => recruit.stars === 5).length / total;
    const fourStarRate = state.recruits.filter((recruit) => recruit.stars === 4).length / total;
    expect(total).toBeGreaterThanOrEqual(2000);
    expect(fiveStarRate).toBeGreaterThanOrEqual(0.02);
    expect(fiveStarRate).toBeLessThanOrEqual(0.04);
    expect(fourStarRate).toBeGreaterThanOrEqual(0.1);
    expect(fourStarRate).toBeLessThanOrEqual(0.2);
    expect(Math.min(...state.recruits.filter((recruit) => recruit.stars === 4).map((recruit) => recruit.overall))).toBeGreaterThanOrEqual(68);
    expect(Math.min(...state.recruits.filter((recruit) => recruit.stars === 5).map((recruit) => recruit.overall))).toBeGreaterThanOrEqual(74);
  });

  it("creates regular-season schedules without duplicate opponent pairs", () => {
    for (const seed of [6101, 6102, 6103]) {
      const state = createDynasty(seed);
      const gameCounts = new Map(state.teams.map((team) => [team.id, 0]));
      const pairs = new Set<string>();

      for (const game of state.schedule) {
        gameCounts.set(game.homeTeamId, (gameCounts.get(game.homeTeamId) ?? 0) + 1);
        gameCounts.set(game.awayTeamId, (gameCounts.get(game.awayTeamId) ?? 0) + 1);
        const pair = [game.homeTeamId, game.awayTeamId].sort().join("-");
        expect(pairs.has(pair)).toBe(false);
        pairs.add(pair);
      }

      expect(state.schedule).toHaveLength(35 * 12);
      expect([...gameCounts.values()].every((count) => count === 12)).toBe(true);
    }
  });

  it("applies position-specific caps to off-skill attributes", () => {
    const state = createDynasty(4567);
    const playersAndRecruits = [
      ...state.teams.flatMap((team) => team.roster.map((player) => ({ position: player.position, attributes: player.attributes }))),
      ...state.recruits.map((recruit) => ({ position: recruit.position, attributes: recruit.attributes })),
    ];

    for (const item of playersAndRecruits) {
      const caps = POSITION_ATTRIBUTE_CAPS[item.position];
      for (const [key, cap] of Object.entries(caps)) {
        expect(item.attributes[key as keyof typeof item.attributes]).toBeLessThanOrEqual(cap);
      }
    }

    const quarterbacks = playersAndRecruits.filter((item) => item.position === "QB");
    expect(quarterbacks.every((item) => item.attributes.interception <= 44 && item.attributes.runBlock <= 46)).toBe(true);
  });
});
