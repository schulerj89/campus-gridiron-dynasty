import { POSITIONS, type Player, type Position } from "./types";

export interface DepthChartSlot {
  position: Position;
  players: Player[];
}

export function buildDepthChart(roster: Player[], maxPerPosition = 4): DepthChartSlot[] {
  return POSITIONS.map((position) => ({
    position,
    players: roster
      .filter((player) => player.position === position)
      .sort((a, b) => b.overall - a.overall || b.potential - a.potential)
      .slice(0, maxPerPosition),
  }));
}
