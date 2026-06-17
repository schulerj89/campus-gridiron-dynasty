import { AWARD_NAMES, CITIES, CONFERENCE_NAMES, FIRST_NAMES, LAST_NAMES, MASCOTS, SCHEMES, STATES } from "./names";
import { clamp, Rng } from "./rng";
import {
  ATTRIBUTE_KEYS,
  emptyStats,
  type Attributes,
  type Coach,
  type CollegeYear,
  type Conference,
  type DynastyState,
  type Player,
  type Position,
  type Recruit,
  type RecruitTrait,
  type Team,
  type TeamSeason,
} from "./types";
import { applyPositionCaps, blankAttributes, calculateOverall, normalizeAttributesForPosition, RECRUIT_TRAIT_BANDS, TARGET_ROSTER, teamPower } from "./ratings";
import { createPollSnapshot } from "./polls";
import { createSchedule } from "./schedule";
import { blueprintRecruitingBudgetBonus, createProgramBlueprint } from "./blueprint";

const COLORS = [
  ["#8a1f2d", "#f2c14e"],
  ["#12355b", "#d7263d"],
  ["#0b6e4f", "#f9c80e"],
  ["#4b2e83", "#b7a57a"],
  ["#1f7a8c", "#f4d35e"],
  ["#2d3047", "#ff6b35"],
  ["#3a5a40", "#dad7cd"],
  ["#582f0e", "#ffba08"],
  ["#003049", "#f77f00"],
  ["#5f0f40", "#fb8b24"],
] as const;

const POSITION_ATTRIBUTE_FOCUS: Record<Position, readonly (keyof Attributes)[]> = {
  QB: ["throwPower", "accuracy", "awareness"],
  HB: ["speed", "awareness", "catching"],
  WR: ["catching", "routeRunning", "speed"],
  TE: ["catching", "routeRunning", "runBlock", "passBlock"],
  OL: ["runBlock", "passBlock", "awareness"],
  DL: ["tackle", "defAwareness", "speed"],
  LB: ["tackle", "defAwareness", "interception"],
  CB: ["interception", "defAwareness", "speed"],
  S: ["interception", "defAwareness", "tackle"],
  K: ["kickPower", "kickAccuracy"],
  P: ["kickPower", "kickAccuracy"],
};

export function createDynasty(seed = Date.now(), userTeamId?: string): DynastyState {
  const rng = new Rng(seed);
  const conferences = createConferences();
  const coachPool = createCoachPool(rng, 360);
  const createdTeams = createTeams(rng, conferences, coachPool);
  const pollUpdate = createPollSnapshot(createdTeams, 2026, 0, "regular");
  const selectedTeamId = pollUpdate.teams.find((team) => team.id === userTeamId)?.id ?? pollUpdate.teams[0]!.id;
  const teams = pollUpdate.teams.map((team) => ({
    ...team,
    blueprint: createProgramBlueprint(team, 2026, team.id !== selectedTeamId),
  }));
  const userTeam = teams.find((team) => team.id === selectedTeamId)!;
  const recruits = createRecruitClass(rng, teams, 2600);
  const seasonBudget = calculateSeasonRecruitingBudget(userTeam);
  const weeklyPoints = calculateWeeklyRecruitingPoints(userTeam);
  const schedule = createSchedule(rng, teams, 1);

  return {
    id: `dynasty-${seed}`,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    seed,
    rngState: rng.currentState(),
    year: 1,
    calendarYear: 2026,
    maxYears: 20,
    phase: "regular",
    week: 1,
    userTeamId: selectedTeamId,
    conferences,
    teams,
    recruits,
    recruiting: {
      weeklyPoints,
      seasonBudget,
      pointsRemaining: seasonBudget,
      pointsSpent: 0,
      investedByRecruit: {},
      boardLimit: 35,
      board: [],
      autoEnabled: true,
      profile: "balanced",
      lastActions: [`Opened ${userTeam.name} dynasty with ${seasonBudget.toLocaleString()} season recruiting points.`],
    },
    schedule,
    weeklyAwards: [],
    coachPool: coachPool.filter((coach) => !coach.hiredBy).slice(0, 72),
    rankings: [pollUpdate.poll],
    history: [],
    debugFlags: {
      forceUserPlayoff: false,
      forceUserAward: false,
      fastSimSeasons: 0,
    },
    debugLog: [`World generated with 70 fictional teams, 5,950 players, and ${recruits.length.toLocaleString()} recruits.`],
  };
}

export function createConferences(): Conference[] {
  return CONFERENCE_NAMES.map((name, index) => ({
    id: `conf-${index + 1}`,
    name,
    teamIds: [],
  }));
}

function createTeams(rng: Rng, conferences: Conference[], coachPool: Coach[]): Team[] {
  const teams: Team[] = [];
  const usedNames = new Set<string>();

  for (let index = 0; index < 70; index += 1) {
    const conference = conferences[index % conferences.length]!;
    const city = `${rng.pick(CITIES)}`;
    const state = `${rng.pick(STATES)}`;
    let mascot = `${rng.pick(MASCOTS)}`;
    let name = `${city} ${mascot}`;
    while (usedNames.has(name)) {
      mascot = `${rng.pick(MASCOTS)}`;
      name = `${city} ${mascot}`;
    }
    usedNames.add(name);
    const id = `team-${index + 1}`;
    const color = COLORS[index % COLORS.length]!;
    const prestige = rng.nextInt(48, 88);
    const program = {
      prestige,
      academics: rng.nextInt(45, 88),
      facilities: rng.nextInt(45, 88),
      training: rng.nextInt(45, 88),
      recruitingReach: rng.nextInt(45, 88),
      fanSupport: rng.nextInt(45, 88),
      NIL: rng.nextInt(40, 85),
    };
    const coaches = {
      head: hireCoach(coachPool, "head", id),
      offense: hireCoach(coachPool, "offense", id),
      defense: hireCoach(coachPool, "defense", id),
    };
    const roster = createRoster(rng, id, prestige);
    const team: Team = {
      id,
      name,
      mascot,
      abbreviation: abbreviation(name, index),
      city,
      state,
      conferenceId: conference.id,
      helmetIndex: index % 14,
      primary: color[0],
      secondary: color[1],
      roster,
      coaches,
      program,
      coachPoints: rng.nextInt(3, 9),
      programPoints: rng.nextInt(4, 10),
      expectations: clamp(Math.round((prestige + program.facilities + program.fanSupport) / 3), 45, 92),
      season: freshTeamSeason(),
      history: [],
      depthChart: {},
    };
    conference.teamIds.push(id);
    teams.push(team);
  }

  return teams.sort((a, b) => teamPower(b.roster) + b.program.prestige * 0.08 - (teamPower(a.roster) + a.program.prestige * 0.08));
}

export function createRoster(rng: Rng, teamId: string, prestige: number): Player[] {
  const players: Player[] = [];
  for (const [position, count] of Object.entries(TARGET_ROSTER) as [Position, number][]) {
    for (let slot = 0; slot < count; slot += 1) {
      const base = clamp(Math.round(rng.nextInt(52, 79) + (prestige - 60) * 0.18 + rng.nextInt(-8, 8)), 42, 93);
      players.push(createPlayer(rng, `${teamId}-${position}-${slot}`, position, base, false));
    }
  }
  return players;
}

export function createRecruitClass(rng: Rng, teams: Team[], count = 2600): Recruit[] {
  const raw: Recruit[] = [];
  for (let index = 0; index < count; index += 1) {
    const stars = rollStars(rng);
    const position = rollPosition(rng);
    const hiddenTrait = rollTrait(rng, stars);
    const band = RECRUIT_TRAIT_BANDS[hiddenTrait];
    const starBoost = (stars - 1) * 4;
    const targetOverall = clamp(rng.nextInt(band.entryMin, band.entryMax) + starBoost - 5, 42, band.entryMax);
    const profileIndex = rng.nextInt(0, 13);
    const state = `${rng.pick(STATES)}`;
    const hometown = `${rng.pick(CITIES)}, ${state}`;
    const attributes = createAttributes(rng, position, targetOverall, 83);
    const overall = calculateOverall(position, attributes);
    const potential = rng.nextInt(band.potentialMin, band.potentialMax);
    const interest = createRecruitInterest(rng, teams, state, stars);
    const topSchools = sortSchoolsByInterest(interest).slice(0, stars === 5 ? 14 : 10);
    const offers = initialScholarshipOffers(rng, topSchools, stars);
    const recruit: Recruit = {
      id: `recruit-${index + 1}`,
      name: createPersonName(rng),
      position,
      stars,
      nationalRank: 9999,
      state,
      hometown,
      profileIndex,
      hiddenTrait,
      traitRevealed: false,
      attributes,
      knownAttributes: [],
      scoutProgress: 0,
      overall,
      potential,
      stage: "open",
      topSchools,
      offers,
      interest,
      priorities: {
        playingTime: rng.nextInt(1, 10),
        development: rng.nextInt(1, 10),
        academics: rng.nextInt(1, 10),
        facilities: rng.nextInt(1, 10),
        distance: rng.nextInt(1, 10),
        prestige: rng.nextInt(1, 10),
      },
    };
    raw.push(recruit);
  }

  return raw
    .sort((a, b) => b.stars - a.stars || b.overall + b.potential * 0.3 - (a.overall + a.potential * 0.3))
    .map((recruit, index) => ({ ...recruit, nationalRank: index + 1 }));
}

export function createCoachPool(rng: Rng, count: number): Coach[] {
  const roles = ["head", "offense", "defense"] as const;
  return Array.from({ length: count }, (_, index) => {
    const role = roles[index % roles.length]!;
    return {
      id: `coach-${index + 1}`,
      name: createPersonName(rng),
      role,
      portraitIndex: index % 10,
      age: rng.nextInt(31, 67),
      scheme: `${rng.pick(SCHEMES)}`,
      recruiting: rng.nextInt(45, 92),
      development: rng.nextInt(45, 92),
      tactics: rng.nextInt(45, 92),
      culture: rng.nextInt(45, 92),
      points: rng.nextInt(0, 8),
      jobSecurity: rng.nextInt(45, 95),
    };
  });
}

export function calculateWeeklyRecruitingPoints(team: Team): number {
  return Math.round(calculateSeasonRecruitingBudget(team) / 12);
}

export function calculateSeasonRecruitingBudget(team: Team): number {
  const programStrength =
    team.program.prestige * 5 +
    team.program.recruitingReach * 4 +
    team.program.facilities * 2 +
    team.program.academics * 1.5 +
    team.program.fanSupport * 1.5 +
    (team.program.NIL ?? 50) * 2;
  const staffStrength = team.coaches.head.recruiting * 4 + team.coaches.offense.recruiting * 1.5 + team.coaches.defense.recruiting * 1.5;
  const recordBonus = team.season.wins * 24 - team.season.losses * 12 + (team.season.rank && team.season.rank <= 10 ? 160 : team.season.rank && team.season.rank <= 25 ? 80 : 0);
  return clamp(Math.round(650 + programStrength + staffStrength + recordBonus + blueprintRecruitingBudgetBonus(team)), 1450, 3250);
}

export function createPersonName(rng: Rng): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
}

export function freshTeamSeason(): TeamSeason {
  return {
    wins: 0,
    losses: 0,
    confWins: 0,
    confLosses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    streak: 0,
  };
}

export function resetPlayerStats(player: Player): Player {
  return { ...player, stats: emptyStats(), awards: [], streak: undefined };
}

export function signedPlayerIdForRecruit(recruit: Pick<Recruit, "id" | "committedTeamId">, classYear: number): string {
  return `player-y${classYear}-${recruit.id}-${recruit.committedTeamId ?? "walkon"}`;
}

export function createSignedPlayerFromRecruit(recruit: Recruit, classYear = 1): Player {
  return {
    id: signedPlayerIdForRecruit(recruit, classYear),
    name: recruit.name,
    position: recruit.position,
    year: "FR",
    profileIndex: recruit.profileIndex,
    attributes: recruit.attributes,
    overall: recruit.overall,
    potential: recruit.potential,
    development: recruit.hiddenTrait,
    hometown: recruit.hometown,
    stats: emptyStats(),
    careerStats: [],
    awards: [],
    streak: undefined,
    incomingFreshman: true,
  };
}

export function createWalkOnPlayer(rng: Rng, teamId: string, position: Position, year: number, index: number): Player {
  const targetOverall = rng.nextInt(45, 59);
  const attributes = createAttributes(rng, position, targetOverall, 60);
  const overall = clamp(calculateOverall(position, attributes), 38, 60);
  const potential = clamp(overall + rng.nextInt(4, 18), overall, 78);
  return {
    id: `walkon-${teamId}-${year}-${position}-${index}-${rng.currentState()}`,
    name: createPersonName(rng),
    position,
    year: "FR",
    profileIndex: rng.nextInt(0, 13),
    attributes,
    overall,
    potential,
    development: rng.weighted<RecruitTrait>([
      { value: "project", weight: 48 },
      { value: "depth", weight: 36 },
      { value: "rotation", weight: 14 },
      { value: "starter", weight: 2 },
    ]),
    hometown: `${rng.pick(CITIES)}, ${rng.pick(STATES)}`,
    stats: emptyStats(),
    careerStats: [],
    awards: [],
    streak: undefined,
    incomingFreshman: true,
    walkOn: true,
  };
}

export function awardNameForPosition(position: Position): string {
  if (position === "QB") return AWARD_NAMES.qb;
  if (position === "HB") return AWARD_NAMES.rb;
  if (position === "WR" || position === "TE") return AWARD_NAMES.wr;
  if (position === "OL") return AWARD_NAMES.ol;
  if (position === "DL") return AWARD_NAMES.dl;
  if (position === "LB") return AWARD_NAMES.lb;
  if (position === "CB" || position === "S") return AWARD_NAMES.db;
  return AWARD_NAMES.kicker;
}

function createPlayer(rng: Rng, id: string, position: Position, targetOverall: number, freshman: boolean): Player {
  const attributes = createAttributes(rng, position, targetOverall, 93);
  const overall = calculateOverall(position, attributes);
  const trait = rng.weighted<RecruitTrait>([
    { value: "elite", weight: Math.max(1, overall - 82) },
    { value: "starter", weight: 18 },
    { value: "rotation", weight: 35 },
    { value: "depth", weight: 26 },
    { value: "project", weight: 12 },
  ]);
  return {
    id,
    name: createPersonName(rng),
    position,
    year: freshman ? "FR" : rng.weighted<CollegeYear>([
      { value: "FR", weight: 24 },
      { value: "SO", weight: 26 },
      { value: "JR", weight: 25 },
      { value: "SR", weight: 25 },
    ]),
    profileIndex: rng.nextInt(0, 13),
    attributes,
    overall,
    potential: clamp(overall + rng.nextInt(4, 18), overall, 99),
    development: trait,
    hometown: `${rng.pick(CITIES)}, ${rng.pick(STATES)}`,
    stats: emptyStats(),
    careerStats: [],
    awards: [],
    streak: undefined,
  };
}

function createAttributes(rng: Rng, position: Position, targetOverall: number, cap: number): Attributes {
  const focus = new Set(POSITION_ATTRIBUTE_FOCUS[position]);
  const raw = blankAttributes(45);
  for (const key of ATTRIBUTE_KEYS) {
    const base = focus.has(key) ? targetOverall + rng.nextInt(-7, 7) : targetOverall + rng.nextInt(-23, 3);
    raw[key] = clamp(base, 20, cap);
  }
  const normalized = normalizeAttributesForPosition(position, raw, targetOverall);
  return applyPositionCaps(position, Object.fromEntries(Object.entries(normalized).map(([key, value]) => [key, clamp(value, 20, cap)])) as Attributes, cap);
}

function rollStars(rng: Rng): 1 | 2 | 3 | 4 | 5 {
  return rng.weighted([
    { value: 5 as const, weight: 3 },
    { value: 4 as const, weight: 15 },
    { value: 3 as const, weight: 35 },
    { value: 2 as const, weight: 30 },
    { value: 1 as const, weight: 17 },
  ]);
}

function rollPosition(rng: Rng): Position {
  return rng.weighted(
    (Object.entries(TARGET_ROSTER) as [Position, number][]).map(([position, count]) => ({
      value: position,
      weight: count,
    })),
  );
}

function rollTrait(rng: Rng, stars: 1 | 2 | 3 | 4 | 5): RecruitTrait {
  const eliteBoost = stars * stars;
  return rng.weighted<RecruitTrait>([
    { value: "elite", weight: stars === 5 ? 22 : eliteBoost * 0.35 },
    { value: "starter", weight: 10 + stars * 4 },
    { value: "rotation", weight: 30 },
    { value: "depth", weight: 28 - stars * 2 },
    { value: "project", weight: 20 - stars * 2 },
  ]);
}

function createRecruitInterest(rng: Rng, teams: Team[], state: string, stars: number): Record<string, number> {
  const interest: Record<string, number> = {};
  for (const team of teams) {
    const localBoost = team.state === state ? 16 : rng.nextInt(-3, 5);
    const prestigeBoost = team.program.prestige * (0.35 + stars * 0.04);
    const facilityBoost = team.program.facilities * 0.18;
    interest[team.id] = clamp(Math.round(prestigeBoost + facilityBoost + localBoost + rng.nextInt(0, 40)), 1, 100);
  }
  return interest;
}

function sortSchoolsByInterest(interest: Record<string, number>): string[] {
  return Object.entries(interest)
    .sort((a, b) => b[1] - a[1])
    .map(([teamId]) => teamId);
}

function initialScholarshipOffers(rng: Rng, topSchools: string[], stars: number): string[] {
  const offerCount = stars >= 5 ? rng.nextInt(1, 3) : stars === 4 ? rng.nextInt(0, 2) : rng.chance(0.18) ? 1 : 0;
  return topSchools.slice(0, offerCount);
}

function hireCoach(coaches: Coach[], role: Coach["role"], teamId: string): Coach {
  const coach = coaches.find((candidate) => candidate.role === role && !candidate.hiredBy);
  if (!coach) {
    throw new Error(`No available ${role} coach.`);
  }
  coach.hiredBy = teamId;
  return { ...coach };
}

function abbreviation(name: string, index: number): string {
  const letters = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  return `${letters}${index + 1}`.slice(0, 4);
}
