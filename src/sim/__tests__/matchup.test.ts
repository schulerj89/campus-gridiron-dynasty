import { describe, expect, it } from "vitest";
import { advanceWeek, simulateSeasons } from "../dynasty";
import { createDynasty } from "../generate";
import { buildMatchupPreview } from "../matchup";

describe("matchup preview", () => {
  it("finds the next pending user game and compares unit edges", () => {
    const state = createDynasty(12121);
    const preview = buildMatchupPreview(state);
    expect(preview).toBeDefined();
    expect(preview?.game.played).toBe(false);
    expect(preview?.opponent.id).not.toBe(state.userTeamId);
    expect(preview?.unitEdges.length).toBeGreaterThanOrEqual(6);
    expect(preview?.stakes.length).toBeGreaterThan(0);
  });

  it("returns no preview when the user has no pending game", () => {
    let state = createDynasty(12122);
    for (let index = 0; index < 16; index += 1) {
      state = advanceWeek(state);
    }
    const preview = buildMatchupPreview({
      ...state,
      schedule: state.schedule.map((game) => (game.homeTeamId === state.userTeamId || game.awayTeamId === state.userTeamId ? { ...game, played: true } : game)),
      playoff: state.playoff
        ? {
            ...state.playoff,
            games: state.playoff.games.map((game) => (game.homeTeamId === state.userTeamId || game.awayTeamId === state.userTeamId ? { ...game, played: true } : game)),
          }
        : undefined,
    });
    expect(preview).toBeUndefined();
  });

  it("only treats Top 25 poll entries as ranked matchup teams", () => {
    const state = createDynasty(12124);
    const nextGame = state.schedule.find((game) => game.homeTeamId === state.userTeamId || game.awayTeamId === state.userTeamId)!;
    const opponentId = nextGame.homeTeamId === state.userTeamId ? nextGame.awayTeamId : nextGame.homeTeamId;
    const poll = state.rankings[0]!;
    const prepared = {
      ...state,
      rankings: [
        {
          ...poll,
          entries: poll.entries.filter((entry) => entry.teamId !== state.userTeamId && entry.teamId !== opponentId),
          allEntries: poll.allEntries.map((entry) => {
            if (entry.teamId === state.userTeamId) return { ...entry, rank: 45 };
            if (entry.teamId === opponentId) return { ...entry, rank: 46 };
            return entry;
          }),
        },
      ],
    };

    const preview = buildMatchupPreview(prepared);

    expect(preview?.userRank).toBeUndefined();
    expect(preview?.opponentRank).toBeUndefined();
    expect(preview?.stakes).not.toContain("Ranked opponent #46");
    expect(preview?.stakes).toContain("Poll statement chance");
  });

  it("survives multi-season sim states", () => {
    const state = simulateSeasons(createDynasty(12123), 2);
    const preview = buildMatchupPreview(state);
    expect(preview?.userTeam.id).toBe(state.userTeamId);
  }, 20_000);
});
