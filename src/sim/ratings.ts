import { clamp, round } from "./rng";
import { ATTRIBUTE_KEYS, type AttributeKey, type Attributes, type Player, type Position } from "./types";

const POSITION_WEIGHTS: Record<Position, Partial<Record<AttributeKey, number>>> = {
  QB: {
    throwPower: 1,
    accuracy: 1,
    awareness: 0.85,
    speed: 0.25,
  },
  HB: {
    speed: 1,
    awareness: 0.45,
    catching: 0.35,
    runBlock: 0.15,
  },
  WR: {
    catching: 1,
    routeRunning: 1,
    speed: 0.65,
    awareness: 0.35,
  },
  TE: {
    catching: 0.75,
    routeRunning: 0.45,
    runBlock: 0.65,
    passBlock: 0.35,
    awareness: 0.3,
  },
  OL: {
    runBlock: 1,
    passBlock: 1,
    awareness: 0.5,
  },
  DL: {
    tackle: 0.9,
    defAwareness: 0.65,
    speed: 0.35,
    interception: 0.1,
  },
  LB: {
    tackle: 1,
    defAwareness: 0.8,
    speed: 0.45,
    interception: 0.3,
  },
  CB: {
    interception: 0.9,
    defAwareness: 0.75,
    speed: 0.85,
    tackle: 0.35,
  },
  S: {
    interception: 0.75,
    defAwareness: 0.85,
    tackle: 0.7,
    speed: 0.55,
  },
  K: {
    kickPower: 1,
    kickAccuracy: 1,
    awareness: 0.25,
  },
  P: {
    kickPower: 1,
    kickAccuracy: 0.7,
    awareness: 0.2,
  },
};

export const POSITION_ATTRIBUTE_CAPS: Record<Position, Partial<Record<AttributeKey, number>>> = {
  QB: {
    catching: 62,
    tackle: 52,
    interception: 44,
    defAwareness: 58,
    runBlock: 46,
    passBlock: 54,
    routeRunning: 55,
    kickPower: 42,
    kickAccuracy: 42,
  },
  HB: {
    throwPower: 58,
    accuracy: 52,
    tackle: 58,
    interception: 48,
    defAwareness: 58,
    passBlock: 64,
    kickPower: 42,
    kickAccuracy: 42,
  },
  WR: {
    throwPower: 55,
    accuracy: 50,
    tackle: 56,
    interception: 52,
    defAwareness: 58,
    runBlock: 58,
    passBlock: 52,
    kickPower: 42,
    kickAccuracy: 42,
  },
  TE: {
    throwPower: 55,
    accuracy: 50,
    tackle: 62,
    interception: 52,
    defAwareness: 60,
    kickPower: 42,
    kickAccuracy: 42,
  },
  OL: {
    throwPower: 48,
    accuracy: 44,
    speed: 72,
    catching: 48,
    tackle: 58,
    interception: 38,
    defAwareness: 56,
    routeRunning: 44,
    kickPower: 40,
    kickAccuracy: 40,
  },
  DL: {
    throwPower: 46,
    accuracy: 42,
    catching: 48,
    interception: 58,
    runBlock: 58,
    passBlock: 58,
    routeRunning: 42,
    kickPower: 40,
    kickAccuracy: 40,
  },
  LB: {
    throwPower: 48,
    accuracy: 44,
    catching: 52,
    runBlock: 54,
    passBlock: 52,
    routeRunning: 46,
    kickPower: 40,
    kickAccuracy: 40,
  },
  CB: {
    throwPower: 48,
    accuracy: 44,
    catching: 62,
    runBlock: 48,
    passBlock: 46,
    routeRunning: 58,
    kickPower: 40,
    kickAccuracy: 40,
  },
  S: {
    throwPower: 48,
    accuracy: 44,
    catching: 58,
    runBlock: 52,
    passBlock: 50,
    routeRunning: 52,
    kickPower: 40,
    kickAccuracy: 40,
  },
  K: {
    throwPower: 46,
    accuracy: 44,
    speed: 58,
    catching: 42,
    tackle: 44,
    interception: 34,
    defAwareness: 46,
    runBlock: 36,
    passBlock: 36,
    routeRunning: 36,
  },
  P: {
    throwPower: 48,
    accuracy: 44,
    speed: 58,
    catching: 42,
    tackle: 44,
    interception: 34,
    defAwareness: 46,
    runBlock: 36,
    passBlock: 36,
    routeRunning: 36,
  },
};

export const TARGET_ROSTER: Record<Position, number> = {
  QB: 4,
  HB: 7,
  WR: 11,
  TE: 5,
  OL: 16,
  DL: 12,
  LB: 10,
  CB: 8,
  S: 6,
  K: 3,
  P: 3,
};

export const RECRUIT_TRAIT_BANDS = {
  elite: { entryMin: 73, entryMax: 83, potentialMin: 88, potentialMax: 98 },
  starter: { entryMin: 68, entryMax: 78, potentialMin: 82, potentialMax: 91 },
  rotation: { entryMin: 61, entryMax: 74, potentialMin: 76, potentialMax: 86 },
  depth: { entryMin: 55, entryMax: 70, potentialMin: 70, potentialMax: 80 },
  project: { entryMin: 48, entryMax: 66, potentialMin: 66, potentialMax: 78 },
} as const;

export function blankAttributes(value = 50): Attributes {
  return ATTRIBUTE_KEYS.reduce((attrs, key) => {
    attrs[key] = value;
    return attrs;
  }, {} as Attributes);
}

export function calculateOverall(position: Position, attributes: Attributes): number {
  const weights = POSITION_WEIGHTS[position];
  let weighted = 0;
  let totalWeight = 0;
  for (const key of ATTRIBUTE_KEYS) {
    const weight = weights[key] ?? 0.05;
    weighted += attributes[key] * weight;
    totalWeight += weight;
  }
  return Math.round(weighted / totalWeight);
}

export function normalizeAttributesForPosition(position: Position, attributes: Attributes, targetOverall: number): Attributes {
  const current = calculateOverall(position, attributes);
  const delta = targetOverall - current;
  const weights = POSITION_WEIGHTS[position];
  const normalized = { ...attributes };
  for (const key of ATTRIBUTE_KEYS) {
    const weight = weights[key] ?? 0.1;
    normalized[key] = clamp(Math.round(attributes[key] + delta * Math.min(1, weight)), 35, 93);
  }
  return normalized;
}

export function applyPositionCaps(position: Position, attributes: Attributes, maxCap = 93): Attributes {
  const caps = POSITION_ATTRIBUTE_CAPS[position];
  return ATTRIBUTE_KEYS.reduce((next, key) => {
    next[key] = clamp(attributes[key], 20, Math.min(maxCap, caps[key] ?? maxCap));
    return next;
  }, {} as Attributes);
}

export function teamUnitRatings(players: Player[]) {
  const average = (list: number[]) => (list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : 55);
  const byPosition = (positions: Position[]) => players.filter((player) => positions.includes(player.position));
  const top = (positions: Position[], count: number) =>
    byPosition(positions)
      .sort((a, b) => b.overall - a.overall)
      .slice(0, count);

  const passers = top(["QB"], 2);
  const rushers = top(["HB"], 4);
  const receivers = top(["WR", "TE"], 8);
  const blockers = top(["OL", "TE"], 11);
  const front = top(["DL", "LB"], 11);
  const coverage = top(["CB", "S", "LB"], 11);
  const specialists = top(["K", "P"], 3);

  return {
    overall: round(average(players.map((player) => player.overall)), 1),
    passing: round(
      average(passers.map((player) => player.attributes.throwPower * 0.35 + player.attributes.accuracy * 0.45 + player.attributes.awareness * 0.2)),
      1,
    ),
    rushing: round(
      average(rushers.map((player) => player.attributes.speed * 0.55 + player.attributes.awareness * 0.2 + player.overall * 0.25)),
      1,
    ),
    receiving: round(
      average(receivers.map((player) => player.attributes.catching * 0.45 + player.attributes.routeRunning * 0.4 + player.attributes.speed * 0.15)),
      1,
    ),
    blocking: round(average(blockers.map((player) => player.attributes.runBlock * 0.48 + player.attributes.passBlock * 0.48 + player.attributes.awareness * 0.04)), 1),
    defense: round(average(front.map((player) => player.attributes.tackle * 0.55 + player.attributes.defAwareness * 0.35 + player.attributes.speed * 0.1)), 1),
    coverage: round(average(coverage.map((player) => player.attributes.interception * 0.35 + player.attributes.defAwareness * 0.45 + player.attributes.speed * 0.2)), 1),
    specialTeams: round(average(specialists.map((player) => player.attributes.kickPower * 0.55 + player.attributes.kickAccuracy * 0.45)), 1),
  };
}

export function teamPower(players: Player[]): number {
  const units = teamUnitRatings(players);
  return round(
    units.passing * 0.17 +
      units.rushing * 0.12 +
      units.receiving * 0.12 +
      units.blocking * 0.13 +
      units.defense * 0.2 +
      units.coverage * 0.18 +
      units.specialTeams * 0.08,
    1,
  );
}
