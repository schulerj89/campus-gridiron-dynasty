import { effectiveOverall } from "./ratings";
import { POSITIONS, type Player, type Position, type Team } from "./types";

export interface DepthChartSlot {
  position: Position;
  players: Player[];
}

export function buildDepthChart(teamOrRoster: Team | Player[], maxPerPosition = 4): DepthChartSlot[] {
  const team = Array.isArray(teamOrRoster) ? undefined : teamOrRoster;
  const roster = Array.isArray(teamOrRoster) ? teamOrRoster : teamOrRoster.roster;
  return POSITIONS.map((position) => ({
    position,
    players: orderPositionPlayers(roster, position, team?.depthChart?.[position]).slice(0, maxPerPosition),
  }));
}

export function orderPositionPlayers(roster: Player[], position: Position, savedOrder: string[] = []): Player[] {
  const ranked = roster
    .filter((player) => player.position === position)
    .sort((a, b) => effectiveOverall(b) - effectiveOverall(a) || b.potential - a.potential);
  if (!savedOrder.length) return ranked;
  const byId = new Map(ranked.map((player) => [player.id, player]));
  const ordered = savedOrder.map((id) => byId.get(id)).filter((player): player is Player => Boolean(player));
  const orderedIds = new Set(ordered.map((player) => player.id));
  return [...ordered, ...ranked.filter((player) => !orderedIds.has(player.id))];
}

export function moveDepthChartPlayer(team: Team, position: Position, playerId: string, direction: "up" | "down"): Team {
  const players = orderPositionPlayers(team.roster, position, team.depthChart?.[position]);
  const index = players.findIndex((player) => player.id === playerId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= players.length) return team;
  const orderedIds = players.map((player) => player.id);
  const [moved] = orderedIds.splice(index, 1);
  orderedIds.splice(target, 0, moved!);
  return {
    ...team,
    depthChart: {
      ...team.depthChart,
      [position]: orderedIds,
    },
  };
}
