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
    const eliteTargetShare = (eliteReceiver?.stats.receivingTargets ?? 0) / teamBox!.totals.receivingTargets;

    expect(teamBox!.totals.receivingYards).toBe(teamBox!.totals.passYards);
    expect(teamBox!.totals.receivingTd).toBe(teamBox!.totals.passTd);
    expect(teamBox!.totals.passAttempts).toBe(teamBox!.passAttempts);
    expect(teamBox!.totals.passCompletions).toBeGreaterThan(0);
    expect(teamBox!.totals.passCompletions).toBeLessThanOrEqual(teamBox!.totals.passAttempts);
    expect(teamBox!.totals.rushAttempts).toBe(teamBox!.rushAttempts);
    expect(teamBox!.totals.receivingTargets).toBeGreaterThanOrEqual(5);
    expect(teamBox!.totals.receivingTargets).toBeLessThanOrEqual(teamBox!.passAttempts);
    expect(receivingLines.length).toBeGreaterThanOrEqual(5);
    expect(eliteReceiver?.stats.receivingYards).toBe(Math.max(...receivingLines.map((player) => player.stats.receivingYards)));
    expect(eliteShare).toBeGreaterThanOrEqual(0.28);
    expect(eliteShare).toBeLessThanOrEqual(0.46);
    expect(eliteTargetShare).toBeGreaterThanOrEqual(0.25);
    expect(eliteTargetShare).toBeLessThanOrEqual(0.4);
  });

  it("separates scoring kicks and records full down-by-down play-by-play totals", () => {
    const { teams, game } = controlledReceivingSetup(7104);
    let result = simulateGame(new Rng(7105), game, teams);
    for (let seed = 7106; seed < 7130 && !result.game.result?.playByPlay?.some((event) => event.type === "turnover"); seed += 1) {
      result = simulateGame(new Rng(seed), game, teams);
    }
    const box = result.game.result!.boxScore!;

    for (const teamBox of [box.home, box.away]) {
      const offensiveTd = teamBox.totals.passTd + teamBox.totals.rushTd;
      expect(teamBox.totals.extraPointAttempts).toBe(offensiveTd);
      expect(teamBox.totals.extraPoints).toBeLessThanOrEqual(teamBox.totals.extraPointAttempts);
      expect(teamBox.totals.fieldGoals).toBeLessThanOrEqual(teamBox.totals.fieldGoalAttempts);
      expect(offensiveTd * 6 + teamBox.totals.extraPoints + teamBox.totals.fieldGoals * 3).toBe(teamBox.score);
      expect(teamBox.totals.passAttempts).toBe(teamBox.passAttempts);
      expect(teamBox.totals.passCompletions).toBeLessThanOrEqual(teamBox.totals.passAttempts);
      expect(teamBox.totals.rushAttempts).toBe(teamBox.rushAttempts);
    }
    expect(box.home.totals.pancakes + box.away.totals.pancakes).toBeGreaterThan(0);

    const finalEvent = result.game.result!.playByPlay?.at(-1);
    expect(result.game.result!.playByPlay?.length).toBeGreaterThan(0);
    expect(finalEvent?.homeScore).toBe(result.game.result!.homeScore);
    expect(finalEvent?.awayScore).toBe(result.game.result!.awayScore);
    const events = result.game.result!.playByPlay ?? [];
    const offensiveSnaps = box.home.passAttempts + box.home.rushAttempts + box.away.passAttempts + box.away.rushAttempts;
    expect(events.length).toBeGreaterThanOrEqual(offensiveSnaps);
    expect(events.some((event) => event.type === "pass" || event.type === "rush" || event.type === "sack")).toBe(true);
    expect(events.some((event) => event.down && event.distance !== undefined && event.yardLine)).toBe(true);
    expect(events.some((event) => event.type === "punt" && /punted \d+ yards (to .+, returned \d+ yards|with no return)/.test(event.description))).toBe(true);
    expect(events.some((event) => event.type === "turnover" && /intercepted by .+, returned \d+ yards/.test(event.description))).toBe(true);
    expect(events.some((event) => event.type === "rush" && event.description.includes("pancake block"))).toBe(true);
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index]!;
      if (event.type !== "extraPoint" && event.type !== "missedExtraPoint") continue;
      expect(events[index - 1]?.type === "passTd" || events[index - 1]?.type === "rushTd").toBe(true);
    }
  });

  it("uses offensive strategy to shift pass and run volume", () => {
    const setup = controlledReceivingSetup(7106);
    const airTeams = withUserStrategy(setup.teams, setup.userTeamId, "airRaid");
    const runTeams = withUserStrategy(setup.teams, setup.userTeamId, "runHeavy");

    const airResult = simulateGame(new Rng(7107), setup.game, airTeams);
    const runResult = simulateGame(new Rng(7107), setup.game, runTeams);
    const airBox = teamBoxFor(airResult.game, setup.userTeamId)!;
    const runBox = teamBoxFor(runResult.game, setup.userTeamId)!;

    expect(airBox.strategy).toBe("airRaid");
    expect(runBox.strategy).toBe("runHeavy");
    expect(airBox.passAttempts).toBeGreaterThan(runBox.passAttempts);
    expect(runBox.rushAttempts).toBeGreaterThan(airBox.rushAttempts);
    expect(airBox.totals.passAttempts).toBe(airBox.passAttempts);
    expect(runBox.totals.rushAttempts).toBe(runBox.rushAttempts);
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
    expect(eliteReceiver.stats.receivingTargets / userTeam.roster.reduce((sum, player) => sum + player.stats.receivingTargets, 0)).toBeGreaterThanOrEqual(0.25);
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

function withUserStrategy(teams: Team[], userTeamId: string, offensiveStrategy: Team["offensiveStrategy"]): Team[] {
  return teams.map((team) => (team.id === userTeamId ? { ...team, offensiveStrategy } : team));
}

function teamBoxFor(game: Game, teamId: string) {
  const box = game.result?.boxScore;
  if (!box) return undefined;
  return box.home.teamId === teamId ? box.home : box.away.teamId === teamId ? box.away : undefined;
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
