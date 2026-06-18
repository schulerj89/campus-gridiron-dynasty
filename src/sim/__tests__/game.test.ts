import { describe, expect, it } from "vitest";
import { createDynasty } from "../generate";
import { simulateGame } from "../game";
import { Rng } from "../rng";
import type { Game, Player, Team } from "../types";

describe("game simulation stat pacing", () => {
  it("features an elite receiver while preserving receiving totals and target participation", () => {
    const { teams, game, userTeamId, eliteReceiverId } = controlledReceivingSetup(7101);
    const result = simulateGame(new Rng(7102), game, teams);
    const box = result.game.result?.boxScore;
    const teamBox = box?.home.teamId === userTeamId ? box.home : box?.away;
    const updatedUserTeam = result.teams.find((team) => team.id === userTeamId)!;
    expect(teamBox).toBeDefined();

    const receivingLines = updatedUserTeam.roster.filter((player) => ["WR", "TE"].includes(player.position) && player.stats.receivingYards > 0);
    const eliteReceiver = receivingLines.find((player) => player.id === eliteReceiverId);
    const eliteShare = (eliteReceiver?.stats.receivingYards ?? 0) / teamBox!.totals.receivingYards;

    expect(teamBox!.totals.receivingYards).toBe(teamBox!.totals.passYards);
    expect(teamBox!.totals.receivingTd).toBe(teamBox!.totals.passTd);
    expect(receivingLines.length).toBeGreaterThanOrEqual(5);
    expect(eliteReceiver?.stats.receivingYards).toBe(Math.max(...receivingLines.map((player) => player.stats.receivingYards)));
    expect(eliteShare).toBeGreaterThanOrEqual(0.28);
    expect(eliteShare).toBeLessThanOrEqual(0.46);
  });

  it("lets an elite receiver produce a realistic 12-game season without changing team passing totals", () => {
    const setup = controlledReceivingSetup(7103);
    let teams = setup.teams;

    for (const [index, game] of setup.userGames.entries()) {
      const result = simulateGame(new Rng(7200 + index), game, teams);
      teams = result.teams;
    }

    const userTeam = teams.find((team) => team.id === setup.userTeamId)!;
    const eliteReceiver = userTeam.roster.find((player) => player.id === setup.eliteReceiverId)!;
    const quarterback = userTeam.roster.find((player) => player.position === "QB" && player.stats.passYards > 0)!;

    expect(setup.userGames).toHaveLength(12);
    expect(eliteReceiver.stats.receivingYards).toBeGreaterThanOrEqual(950);
    expect(eliteReceiver.stats.receivingYards).toBeLessThanOrEqual(1650);
    expect(eliteReceiver.stats.receivingYards / quarterback.stats.passYards).toBeGreaterThanOrEqual(0.28);
    expect(quarterback.stats.passYards / setup.userGames.length).toBeGreaterThanOrEqual(180);
    expect(quarterback.stats.passYards / setup.userGames.length).toBeLessThanOrEqual(420);
  });
});

function controlledReceivingSetup(seed: number): { teams: Team[]; game: Game; userGames: Game[]; userTeamId: string; eliteReceiverId: string } {
  const state = createDynasty(seed, "team-1");
  const userTeamId = state.userTeamId;
  const userGames = state.schedule.filter((game) => game.homeTeamId === userTeamId || game.awayTeamId === userTeamId);
  const userTeam = state.teams.find((team) => team.id === userTeamId)!;
  const eliteReceiverId = userTeam.roster.find((player) => player.position === "WR")!.id;
  const opponentIds = new Set(userGames.flatMap((game) => [game.homeTeamId, game.awayTeamId]).filter((teamId) => teamId !== userTeamId));

  const teams = state.teams.map((team) => {
    if (team.id === userTeamId) {
      return {
        ...team,
        roster: team.roster.map((player) => tuneUserPlayer(player, eliteReceiverId)),
      };
    }
    if (opponentIds.has(team.id)) {
      return {
        ...team,
        roster: team.roster.map(tuneOpponentPlayer),
      };
    }
    return team;
  });

  return { teams, game: userGames[0]!, userGames, userTeamId, eliteReceiverId };
}

function tuneUserPlayer(player: Player, eliteReceiverId: string): Player {
  if (player.id === eliteReceiverId) {
    return {
      ...player,
      overall: 92,
      potential: Math.max(player.potential, 95),
      attributes: {
        ...player.attributes,
        speed: 94,
        catching: 94,
        routeRunning: 94,
        awareness: 90,
      },
    };
  }
  if (player.position === "QB") {
    return {
      ...player,
      overall: 91,
      attributes: {
        ...player.attributes,
        throwPower: 92,
        accuracy: 92,
        awareness: 90,
      },
    };
  }
  if (player.position === "WR" || player.position === "TE") {
    return {
      ...player,
      overall: 73,
      attributes: {
        ...player.attributes,
        speed: 72,
        catching: 72,
        routeRunning: 72,
        awareness: 72,
      },
    };
  }
  return player;
}

function tuneOpponentPlayer(player: Player): Player {
  if (player.position === "CB" || player.position === "S" || player.position === "LB") {
    return {
      ...player,
      overall: Math.min(player.overall, 68),
      attributes: {
        ...player.attributes,
        defAwareness: Math.min(player.attributes.defAwareness, 66),
        interception: Math.min(player.attributes.interception, 62),
      },
    };
  }
  return player;
}
