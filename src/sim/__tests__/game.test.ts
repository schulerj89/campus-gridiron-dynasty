import { describe, expect, it } from "vitest";
import { createDynasty } from "../generate";
import { scoringPlan, simulateGame } from "../game";
import { Rng } from "../rng";
import type { Game, PlayByPlayEvent, Player, Team } from "../types";

describe("game simulation stat pacing", () => {
  it("prefers conventional touchdown and extra-point scoring plans", () => {
    expect(scoringPlan(24)).toMatchObject({ score: 24, offensiveTd: 3, fieldGoals: 1, extraPoints: 3, extraPointAttempts: 3 });
    expect(scoringPlan(30)).toMatchObject({ score: 30, offensiveTd: 3, fieldGoals: 3, extraPoints: 3, extraPointAttempts: 3 });
    expect(scoringPlan(31)).toMatchObject({ score: 31, offensiveTd: 4, fieldGoals: 1, extraPoints: 4, extraPointAttempts: 4 });
    expect(scoringPlan(38)).toMatchObject({ score: 38, offensiveTd: 5, fieldGoals: 1, extraPoints: 5, extraPointAttempts: 5 });
    expect(scoringPlan(45)).toMatchObject({ score: 45, offensiveTd: 6, fieldGoals: 1, extraPoints: 6, extraPointAttempts: 6 });
  });

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

  it("uses individual corner matchups to change elite receiver usage", () => {
    const strongCorner = controlledCornerMatchupSetup(7134, "strong");
    const weakCorner = controlledCornerMatchupSetup(7134, "weak");
    const strongTotals = receiverMatchupTotals(strongCorner, 7340);
    const weakTotals = receiverMatchupTotals(weakCorner, 7340);
    const strongTargetShare = strongTotals.eliteTargets / strongTotals.teamTargets;
    const weakTargetShare = weakTotals.eliteTargets / weakTotals.teamTargets;
    const strongYardShare = strongTotals.eliteYards / strongTotals.teamYards;
    const weakYardShare = weakTotals.eliteYards / weakTotals.teamYards;

    expect(weakTargetShare).toBeGreaterThan(strongTargetShare + 0.03);
    expect(weakYardShare).toBeGreaterThan(strongYardShare + 0.04);
    expect(weakTotals.eliteYards).toBeGreaterThan(strongTotals.eliteYards);
  });

  it("separates scoring kicks and records full down-by-down play-by-play totals", () => {
    const { teams, game } = controlledReceivingSetup(7104);
    let result = simulateGame(new Rng(7105), game, teams);
    for (let seed = 7106; seed < 7205 && !hasKickAndTurnoverCoverage(result.game.result?.playByPlay ?? []); seed += 1) {
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
    expect(events.some((event) => event.description.includes("could not create space"))).toBe(false);
    for (const teamBox of [box.home, box.away]) {
      const teamEvents = events.filter((event) => event.teamId === teamBox.teamId);
      const playByPlayPassAttempts = teamEvents.filter((event) => event.type === "pass" || event.type === "sack" || event.type === "passTd" || event.type === "turnover").length;
      const playByPlayRushAttempts = teamEvents.filter((event) => event.type === "rush" || event.type === "rushTd").length;
      expect(playByPlayPassAttempts).toBe(teamBox.passAttempts);
      expect(playByPlayRushAttempts).toBe(teamBox.rushAttempts);
    }
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index]!;
      if (event.type !== "extraPoint" && event.type !== "missedExtraPoint") continue;
      expect(events[index - 1]?.type === "passTd" || events[index - 1]?.type === "rushTd").toBe(true);
    }
  });

  it("keeps play-by-play drive context through field goals, goal-line snaps, and possession changes", () => {
    const { teams, game } = controlledReceivingSetup(7104);
    const teamAbbreviations = new Map(teams.map((team) => [team.id, team.abbreviation]));

    for (let seed = 7105; seed < 7205; seed += 1) {
      const result = simulateGame(new Rng(seed), game, teams);
      const events = result.game.result?.playByPlay ?? [];
      const badJump = events.some((event, index) => {
        const previous = events[index - 1];
        return Boolean(previous && event.teamId === previous.teamId && isFieldGoalPlay(event) && convertedEarlyDown(previous));
      });
      const badGoalLineGain = events.some((event) => isPositiveNonTouchdownAtOpponentOne(event, teamAbbreviations.get(event.teamId)));
      const badPossessionChange = events.some((event, index) => {
        const previous = events[index - 1];
        return Boolean(previous && previous.teamId !== event.teamId && !isTerminalPlay(previous));
      });

      expect(badJump).toBe(false);
      expect(badGoalLineGain).toBe(false);
      expect(badPossessionChange).toBe(false);
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
    expect(airBox.totals.passTd).toBeGreaterThanOrEqual(runBox.totals.passTd);
  });

  it("prices interception risk by passing volume without runaway pick rates", () => {
    const setup = controlledReceivingSetup(7126);
    const airTeams = withUserStrategy(setup.teams, setup.userTeamId, "airRaid");
    const runTeams = withUserStrategy(setup.teams, setup.userTeamId, "runHeavy");
    let airAttempts = 0;
    let runAttempts = 0;
    let airInterceptions = 0;
    let runInterceptions = 0;

    for (let seed = 7127; seed < 7207; seed += 1) {
      const airBox = teamBoxFor(simulateGame(new Rng(seed), setup.game, airTeams).game, setup.userTeamId)!;
      const runBox = teamBoxFor(simulateGame(new Rng(seed), setup.game, runTeams).game, setup.userTeamId)!;
      airAttempts += airBox.passAttempts;
      runAttempts += runBox.passAttempts;
      airInterceptions += airBox.totals.interceptionsThrown;
      runInterceptions += runBox.totals.interceptionsThrown;
    }

    expect(airAttempts).toBeGreaterThan(runAttempts);
    expect(airInterceptions).toBeGreaterThanOrEqual(runInterceptions);
    expect(airInterceptions / airAttempts).toBeLessThan(0.09);
    expect(runInterceptions / runAttempts).toBeLessThan(0.09);
  });

  it("keeps air raid red-zone play-by-play pass first", () => {
    const setup = controlledReceivingSetup(7141);
    const teams = withUserStrategy(setup.teams, setup.userTeamId, "airRaid");
    const teamAbbreviation = teams.find((team) => team.id === setup.userTeamId)?.abbreviation;
    let passCalls = 0;
    let runCalls = 0;

    for (let seed = 7142; seed < 7182; seed += 1) {
      const result = simulateGame(new Rng(seed), setup.game, teams);
      for (const event of result.game.result?.playByPlay ?? []) {
        if (event.teamId !== setup.userTeamId || !isOpponentRedZone(event, teamAbbreviation)) continue;
        if (isPassCall(event)) passCalls += 1;
        if (isRunCall(event)) runCalls += 1;
      }
    }

    expect(passCalls).toBeGreaterThan(0);
    expect(passCalls).toBeGreaterThan(runCalls);
  });

  it("does not punt while trailing late in the fourth quarter", () => {
    const setup = controlledReceivingSetup(7183);
    const teams = withUserStrategy(setup.teams, setup.userTeamId, "airRaid");
    const lateTrailingPunts: PlayByPlayEvent[] = [];

    for (let seed = 7184; seed < 7244; seed += 1) {
      const result = simulateGame(new Rng(seed), setup.game, teams);
      lateTrailingPunts.push(
        ...((result.game.result?.playByPlay ?? []).filter((event) => event.type === "punt" && event.quarter === 4 && clockSeconds(event.clock) <= 300 && isTrailing(event, result.game))),
      );
    }

    expect(lateTrailingPunts).toHaveLength(0);
  });

  it("uses manual depth chart starters for simulated game usage", () => {
    const setup = controlledDepthChartSetup(7108);
    const result = simulateGame(new Rng(7109), setup.game, setup.teams);
    const updatedUserTeam = result.teams.find((team) => team.id === setup.userTeamId)!;
    const promotedQuarterback = updatedUserTeam.roster.find((player) => player.id === setup.promotedQuarterbackId)!;
    const benchedQuarterback = updatedUserTeam.roster.find((player) => player.id === setup.benchedQuarterbackId)!;

    expect(promotedQuarterback.overall).toBeLessThan(benchedQuarterback.overall);
    expect(promotedQuarterback.stats.passAttempts).toBeGreaterThan(0);
    expect(benchedQuarterback.stats.passAttempts).toBe(0);
  });

  it("lets weak passing attributes produce sub-60 completion games", () => {
    const { teams, game, userTeamId } = controlledPassingStressSetup(7111);
    const result = simulateGame(new Rng(7112), game, teams);
    const teamBox = teamBoxFor(result.game, userTeamId)!;
    const updatedUserTeam = result.teams.find((team) => team.id === userTeamId)!;
    const quarterback = updatedUserTeam.roster.find((player) => player.position === "QB" && player.stats.passAttempts > 0)!;
    const completionRate = quarterback.stats.passCompletions / quarterback.stats.passAttempts;

    expect(teamBox.totals.passAttempts).toBe(teamBox.passAttempts);
    expect(quarterback.stats.passAttempts).toBeGreaterThanOrEqual(24);
    expect(completionRate).toBeLessThan(0.6);
  });

  it("makes offensive line quality affect pass protection and rushing output", () => {
    const strongSetup = controlledLineSetup(7118, "strong");
    const weakSetup = controlledLineSetup(7118, "weak");
    const strongTotals = lineScenarioTotals(strongSetup, 7320);
    const weakTotals = lineScenarioTotals(weakSetup, 7320);

    expect(strongTotals.rushYards).toBeGreaterThan(weakTotals.rushYards);
    expect(strongTotals.passYards / strongTotals.passAttempts).toBeGreaterThan(weakTotals.passYards / weakTotals.passAttempts);
    expect(strongTotals.sacksAllowed).toBeLessThan(weakTotals.sacksAllowed);
    expect(strongTotals.playByPlaySacksAllowed).toBeLessThanOrEqual(weakTotals.playByPlaySacksAllowed);
  });

  it("keeps defensive sack stats synchronized with play-by-play sacks", () => {
    const setup = controlledLineSetup(7121, "weak");

    for (let seed = 7350; seed < 7362; seed += 1) {
      const result = simulateGame(new Rng(seed), setup.games[0]!, setup.teams);
      const box = result.game.result!.boxScore!;
      const events = result.game.result!.playByPlay ?? [];
      expect(box.home.totals.sacks).toBe(events.filter((event) => event.teamId === box.away.teamId && event.type === "sack").length);
      expect(box.away.totals.sacks).toBe(events.filter((event) => event.teamId === box.home.teamId && event.type === "sack").length);
    }
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

function isFieldGoalPlay(event: PlayByPlayEvent): boolean {
  return event.type === "fieldGoal" || event.type === "missedFieldGoal";
}

function hasKickAndTurnoverCoverage(events: PlayByPlayEvent[]): boolean {
  return events.some((event) => event.type === "punt") && events.some((event) => event.type === "turnover" && event.description.includes("intercepted by"));
}

function convertedEarlyDown(event: PlayByPlayEvent): boolean {
  return Boolean(event.down && event.down < 4 && event.distance !== undefined && event.yards !== undefined && event.yards >= event.distance);
}

function isPositiveNonTouchdownAtOpponentOne(event: PlayByPlayEvent, teamAbbreviation: string | undefined): boolean {
  if (event.type !== "pass" && event.type !== "rush") return false;
  if (!event.yardLine?.endsWith(" 1") || event.yardLine === `${teamAbbreviation} 1`) return false;
  return Boolean(event.yards && event.yards > 0);
}

function isTerminalPlay(event: PlayByPlayEvent): boolean {
  return ["punt", "passTd", "rushTd", "fieldGoal", "missedFieldGoal", "extraPoint", "missedExtraPoint", "turnover", "turnoverOnDowns"].includes(event.type);
}

function isOpponentRedZone(event: PlayByPlayEvent, teamAbbreviation: string | undefined): boolean {
  if (!event.yardLine || !teamAbbreviation) return false;
  if (event.yardLine.startsWith(teamAbbreviation)) return false;
  const yard = Number(event.yardLine.split(" ").at(-1));
  return Number.isFinite(yard) && yard <= 20;
}

function isPassCall(event: PlayByPlayEvent): boolean {
  return ["pass", "sack", "passTd", "turnover"].includes(event.type) || event.description.includes("throw") || event.description.includes("incomplete");
}

function isRunCall(event: PlayByPlayEvent): boolean {
  return event.type === "rush" || event.type === "rushTd" || event.description.includes("rushed") || event.description.includes("bottled up");
}

function clockSeconds(clock: string): number {
  const [minutes = "0", seconds = "0"] = clock.split(":");
  return Number(minutes) * 60 + Number(seconds);
}

function isTrailing(event: PlayByPlayEvent, game: Game): boolean {
  return event.teamId === game.homeTeamId ? event.homeScore < event.awayScore : event.awayScore < event.homeScore;
}

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

function controlledPassingStressSetup(seed: number): { teams: Team[]; game: Game; userTeamId: string } {
  const state = createDynasty(seed, "team-1");
  const userTeamId = state.userTeamId;
  const userGames = state.schedule.filter((game) => game.homeTeamId === userTeamId || game.awayTeamId === userTeamId);
  const opponentIds = new Set(userGames.flatMap((game) => [game.homeTeamId, game.awayTeamId]).filter((teamId) => teamId !== userTeamId));
  const teams = state.teams.map((team) => {
    if (team.id === userTeamId) {
      return {
        ...team,
        offensiveStrategy: "airRaid" as const,
        roster: team.roster.map(tuneWeakPassingPlayer),
      };
    }
    if (opponentIds.has(team.id)) {
      return {
        ...team,
        roster: team.roster.map(tuneStrongCoveragePlayer),
      };
    }
    return team;
  });
  return { teams, game: userGames[0]!, userTeamId };
}

function controlledDepthChartSetup(seed: number): { teams: Team[]; game: Game; userTeamId: string; promotedQuarterbackId: string; benchedQuarterbackId: string } {
  const state = createDynasty(seed, "team-1");
  const userTeamId = state.userTeamId;
  const userGames = state.schedule.filter((game) => game.homeTeamId === userTeamId || game.awayTeamId === userTeamId);
  const userTeam = state.teams.find((team) => team.id === userTeamId)!;
  const quarterbacks = userTeam.roster.filter((player) => player.position === "QB").sort((a, b) => b.overall - a.overall);
  const benchedQuarterbackId = quarterbacks[0]!.id;
  const promotedQuarterbackId = quarterbacks.at(-1)!.id;
  const teams = state.teams.map((team) =>
    team.id === userTeamId
      ? {
          ...team,
          depthChart: {
            ...team.depthChart,
            QB: [promotedQuarterbackId, ...quarterbacks.filter((player) => player.id !== promotedQuarterbackId).map((player) => player.id)],
          },
          roster: team.roster.map((player) => {
            if (player.id === promotedQuarterbackId) {
              return {
                ...player,
                overall: 58,
                attributes: {
                  ...player.attributes,
                  throwPower: 58,
                  accuracy: 56,
                  awareness: 57,
                },
              };
            }
            if (player.id === benchedQuarterbackId) {
              return {
                ...player,
                overall: 92,
                attributes: {
                  ...player.attributes,
                  throwPower: 92,
                  accuracy: 92,
                  awareness: 92,
                },
              };
            }
            return player;
          }),
        }
      : team,
  );
  return { teams, game: userGames[0]!, userTeamId, promotedQuarterbackId, benchedQuarterbackId };
}

function controlledCornerMatchupSetup(seed: number, corner: "strong" | "weak"): { teams: Team[]; game: Game; userTeamId: string; eliteReceiverId: string } {
  const state = createDynasty(seed, "team-1");
  const userTeamId = state.userTeamId;
  const userGames = state.schedule.filter((game) => game.homeTeamId === userTeamId || game.awayTeamId === userTeamId);
  const game = userGames[0]!;
  const opponentId = game.homeTeamId === userTeamId ? game.awayTeamId : game.homeTeamId;
  const userTeam = state.teams.find((team) => team.id === userTeamId)!;
  const opponentTeam = state.teams.find((team) => team.id === opponentId)!;
  const eliteReceiverId = userTeam.roster.find((player) => player.position === "WR")!.id;
  const topCornerId = opponentTeam.roster.find((player) => player.position === "CB")!.id;
  const teams = state.teams.map((team) => {
    if (team.id === userTeamId) {
      return {
        ...team,
        offensiveStrategy: "airRaid" as const,
        roster: team.roster.map((player) => tuneMatchupUserPlayer(player, eliteReceiverId)),
      };
    }
    if (team.id === opponentId) {
      return {
        ...team,
        roster: team.roster.map((player) => tuneCornerMatchupOpponent(player, topCornerId, corner)),
      };
    }
    return team;
  });

  return { teams, game, userTeamId, eliteReceiverId };
}

function receiverMatchupTotals(setup: { teams: Team[]; game: Game; userTeamId: string; eliteReceiverId: string }, seed: number): { eliteTargets: number; eliteYards: number; teamTargets: number; teamYards: number } {
  return Array.from({ length: 16 }, (_, index) => index).reduce(
    (totals, _, index) => {
      const result = simulateGame(new Rng(seed + index), setup.game, setup.teams);
      const userBox = teamBoxFor(result.game, setup.userTeamId)!;
      const updatedUserTeam = result.teams.find((team) => team.id === setup.userTeamId)!;
      const eliteReceiver = updatedUserTeam.roster.find((player) => player.id === setup.eliteReceiverId)!;
      return {
        eliteTargets: totals.eliteTargets + eliteReceiver.stats.receivingTargets,
        eliteYards: totals.eliteYards + eliteReceiver.stats.receivingYards,
        teamTargets: totals.teamTargets + userBox.totals.receivingTargets,
        teamYards: totals.teamYards + userBox.totals.receivingYards,
      };
    },
    { eliteTargets: 0, eliteYards: 0, teamTargets: 0, teamYards: 0 },
  );
}

function controlledLineSetup(seed: number, line: "strong" | "weak"): { teams: Team[]; games: Game[]; userTeamId: string } {
  const state = createDynasty(seed, "team-1");
  const userTeamId = state.userTeamId;
  const userGames = state.schedule.filter((game) => game.homeTeamId === userTeamId || game.awayTeamId === userTeamId).slice(0, 6);
  const opponentIds = new Set(userGames.flatMap((game) => [game.homeTeamId, game.awayTeamId]).filter((teamId) => teamId !== userTeamId));
  const teams = state.teams.map((team) => {
    if (team.id === userTeamId) {
      return {
        ...team,
        offensiveStrategy: "balanced" as const,
        roster: team.roster.map((player) => tuneLineScenarioPlayer(player, line)),
      };
    }
    if (opponentIds.has(team.id)) {
      return {
        ...team,
        roster: team.roster.map(tunePassRushOpponent),
      };
    }
    return team;
  });
  return { teams, games: userGames, userTeamId };
}

function lineScenarioTotals(setup: { teams: Team[]; games: Game[]; userTeamId: string }, seed: number): { passYards: number; passAttempts: number; rushYards: number; sacksAllowed: number; playByPlaySacksAllowed: number } {
  const game = setup.games[0]!;
  return Array.from({ length: 20 }, (_, index) => index).reduce(
    (totals, _, index) => {
      const result = simulateGame(new Rng(seed + index), game, setup.teams);
      const userBox = teamBoxFor(result.game, setup.userTeamId)!;
      const opponentBox = opponentBoxFor(result.game, setup.userTeamId)!;
      const playByPlaySacksAllowed = result.game.result?.playByPlay?.filter((event) => event.teamId === setup.userTeamId && event.type === "sack").length ?? 0;
      return {
        passYards: totals.passYards + userBox.totals.passYards,
        passAttempts: totals.passAttempts + userBox.totals.passAttempts,
        rushYards: totals.rushYards + userBox.totals.rushYards,
        sacksAllowed: totals.sacksAllowed + opponentBox.totals.sacks,
        playByPlaySacksAllowed: totals.playByPlaySacksAllowed + playByPlaySacksAllowed,
      };
    },
    { passYards: 0, passAttempts: 0, rushYards: 0, sacksAllowed: 0, playByPlaySacksAllowed: 0 },
  );
}

function withUserStrategy(teams: Team[], userTeamId: string, offensiveStrategy: Team["offensiveStrategy"]): Team[] {
  return teams.map((team) => (team.id === userTeamId ? { ...team, offensiveStrategy } : team));
}

function teamBoxFor(game: Game, teamId: string) {
  const box = game.result?.boxScore;
  if (!box) return undefined;
  return box.home.teamId === teamId ? box.home : box.away.teamId === teamId ? box.away : undefined;
}

function opponentBoxFor(game: Game, teamId: string) {
  const box = game.result?.boxScore;
  if (!box) return undefined;
  return box.home.teamId === teamId ? box.away : box.away.teamId === teamId ? box.home : undefined;
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

function tuneWeakPassingPlayer(player: Player): Player {
  if (player.position === "QB") {
    return {
      ...player,
      overall: 58,
      attributes: {
        ...player.attributes,
        throwPower: 58,
        accuracy: 52,
        awareness: 54,
      },
    };
  }
  if (player.position === "WR" || player.position === "TE") {
    return {
      ...player,
      overall: 58,
      attributes: {
        ...player.attributes,
        speed: 58,
        catching: 52,
        routeRunning: 52,
        awareness: 55,
      },
    };
  }
  if (player.position === "OL") {
    return {
      ...player,
      overall: 60,
      attributes: {
        ...player.attributes,
        runBlock: 58,
        passBlock: 56,
        awareness: 58,
      },
    };
  }
  return player;
}

function tuneStrongCoveragePlayer(player: Player): Player {
  if (player.position === "CB" || player.position === "S" || player.position === "LB") {
    return {
      ...player,
      overall: Math.max(player.overall, 86),
      attributes: {
        ...player.attributes,
        speed: Math.max(player.attributes.speed, 84),
        defAwareness: Math.max(player.attributes.defAwareness, 88),
        interception: Math.max(player.attributes.interception, 86),
      },
    };
  }
  if (player.position === "DL") {
    return {
      ...player,
      overall: Math.max(player.overall, 84),
      attributes: {
        ...player.attributes,
        tackle: Math.max(player.attributes.tackle, 86),
        defAwareness: Math.max(player.attributes.defAwareness, 84),
      },
    };
  }
  return player;
}

function tuneMatchupUserPlayer(player: Player, eliteReceiverId: string): Player {
  if (player.id === eliteReceiverId) {
    return {
      ...player,
      overall: 92,
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
      overall: 90,
      attributes: {
        ...player.attributes,
        throwPower: 91,
        accuracy: 91,
        awareness: 90,
      },
    };
  }
  if (player.position === "WR" || player.position === "TE") {
    return {
      ...player,
      overall: 75,
      attributes: {
        ...player.attributes,
        speed: 75,
        catching: 75,
        routeRunning: 75,
        awareness: 74,
      },
    };
  }
  if (player.position === "OL") {
    return {
      ...player,
      overall: 82,
      attributes: {
        ...player.attributes,
        runBlock: 82,
        passBlock: 82,
        awareness: 82,
      },
    };
  }
  return player;
}

function tuneCornerMatchupOpponent(player: Player, topCornerId: string, corner: "strong" | "weak"): Player {
  if (player.position === "CB" || player.position === "S" || player.position === "LB") {
    const topCornerValue = corner === "strong" && player.id === topCornerId ? 96 : 56;
    return {
      ...player,
      overall: corner === "strong" && player.id === topCornerId ? 94 : 58,
      attributes: {
        ...player.attributes,
        speed: topCornerValue,
        defAwareness: topCornerValue,
        interception: topCornerValue,
        tackle: Math.max(player.attributes.tackle, 58),
      },
    };
  }
  if (player.position === "DL") {
    return {
      ...player,
      overall: 72,
      attributes: {
        ...player.attributes,
        tackle: 72,
        defAwareness: 70,
      },
    };
  }
  return player;
}

function tuneLineScenarioPlayer(player: Player, line: "strong" | "weak"): Player {
  if (player.position === "OL" || player.position === "TE") {
    const value = line === "strong" ? 94 : 48;
    return {
      ...player,
      overall: line === "strong" ? Math.max(player.overall, 90) : Math.min(player.overall, 58),
      attributes: {
        ...player.attributes,
        runBlock: value,
        passBlock: value,
        awareness: value,
        catching: player.position === "TE" ? 76 : player.attributes.catching,
        routeRunning: player.position === "TE" ? 74 : player.attributes.routeRunning,
      },
    };
  }
  if (player.position === "QB") {
    return {
      ...player,
      overall: 82,
      attributes: {
        ...player.attributes,
        throwPower: 82,
        accuracy: 80,
        awareness: 80,
      },
    };
  }
  if (player.position === "HB") {
    return {
      ...player,
      overall: 80,
      attributes: {
        ...player.attributes,
        speed: 80,
        awareness: 78,
      },
    };
  }
  if (player.position === "WR") {
    return {
      ...player,
      attributes: {
        ...player.attributes,
        catching: 78,
        routeRunning: 78,
        speed: 80,
      },
    };
  }
  return player;
}

function tunePassRushOpponent(player: Player): Player {
  if (player.position === "DL" || player.position === "LB") {
    return {
      ...player,
      overall: Math.max(player.overall, 84),
      attributes: {
        ...player.attributes,
        tackle: Math.max(player.attributes.tackle, 86),
        defAwareness: Math.max(player.attributes.defAwareness, 84),
        speed: Math.max(player.attributes.speed, 78),
      },
    };
  }
  return player;
}
