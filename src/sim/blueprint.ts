import { clamp } from "./rng";
import type { BlueprintCategory, BlueprintFocus, DirectorGoal, ProgramBlueprint, Team } from "./types";

export const BLUEPRINT_CATEGORY_META: { key: BlueprintCategory; label: string; effect: string }[] = [
  { key: "scoutingNetwork", label: "Scouting Network", effect: "Reveals recruit attributes faster and slightly expands recruiting budget." },
  { key: "recruitingReach", label: "Recruiting Reach", effect: "Adds season recruiting points and strengthens scholarship and pitch pressure." },
  { key: "trainingStaff", label: "Training Staff", effect: "Improves offseason player development and training reputation." },
  { key: "facilities", label: "Facilities", effect: "Boosts development, facilities drift, and pitch strength." },
  { key: "academicSupport", label: "Academic Support", effect: "Helps culture, academics, and player retention." },
  { key: "playerTrust", label: "Player Trust", effect: "Reduces pro-departure pressure and stabilizes fan support." },
  { key: "coachRetention", label: "Coach Retention", effect: "Improves staff job security and reduces coordinator movement." },
];

export const MAX_BLUEPRINT_CATEGORY_POINTS = 6;

const CATEGORY_KEYS = BLUEPRINT_CATEGORY_META.map((category) => category.key);
const MAX_BLUEPRINT_TOTAL_POINTS = BLUEPRINT_CATEGORY_META.length * MAX_BLUEPRINT_CATEGORY_POINTS;

export function createProgramBlueprint(team: Team, year: number, autoAllocate = false): ProgramBlueprint {
  const totalPoints = calculateBlueprintBudget(team);
  const blueprint: ProgramBlueprint = {
    year,
    totalPoints,
    focus: autoAllocate ? "balanced" : "custom",
    allocations: autoAllocate ? autoBlueprintAllocations(team, totalPoints) : emptyBlueprintAllocations(),
    goals: createDirectorGoals(team, year),
    resolved: false,
  };
  return evaluateProgramBlueprint(team, blueprint);
}

export function ensureProgramBlueprint(team: Team, year: number, autoAllocate = false): ProgramBlueprint {
  if (!team.blueprint || team.blueprint.year !== year) return createProgramBlueprint(team, year, autoAllocate);
  const totalPoints = normalizeBlueprintTotalPoints(team.blueprint.totalPoints, calculateBlueprintBudget(team));
  const normalized: ProgramBlueprint = {
    ...team.blueprint,
    totalPoints,
    focus: team.blueprint.focus ?? "custom",
    allocations: normalizeBlueprintAllocations(team.blueprint.allocations, totalPoints),
    goals: team.blueprint.goals?.length ? team.blueprint.goals : createDirectorGoals(team, year),
    resolved: Boolean(team.blueprint.resolved),
  };
  return evaluateProgramBlueprint(team, normalized, undefined, normalized.resolved);
}

export function evaluateProgramBlueprint(team: Team, blueprint: ProgramBlueprint, recruitingClassRank?: number, resolved = false): ProgramBlueprint {
  const games = Math.max(0, team.season.wins + team.season.losses);
  const pointsAllowed = games > 0 ? team.season.pointsAgainst / games : 0;
  return {
    ...blueprint,
    goals: blueprint.goals.map((goal) => {
      if (goal.kind === "wins") {
        const met = team.season.wins >= goal.targetValue;
        return {
          ...goal,
          progressValue: team.season.wins,
          progressLabel: `${team.season.wins} win${team.season.wins === 1 ? "" : "s"}`,
          status: resolved ? (met ? "met" : "missed") : "active",
          note: met ? "Target pace reached." : `${Math.max(0, goal.targetValue - team.season.wins)} more win${goal.targetValue - team.season.wins === 1 ? "" : "s"} needed.`,
        };
      }
      if (goal.kind === "recruitingClass") {
        const rank = recruitingClassRank ?? 0;
        const met = rank > 0 && rank <= goal.targetValue;
        return {
          ...goal,
          progressValue: rank,
          progressLabel: rank > 0 ? `#${rank}` : "Pending",
          status: resolved ? (met ? "met" : "missed") : "active",
          note: rank > 0 ? (met ? "Class goal reached." : `Needed top ${goal.targetValue}.`) : "Resolves on signing day.",
        };
      }
      const met = games > 0 && pointsAllowed <= goal.targetValue;
      return {
        ...goal,
        progressValue: Math.round(pointsAllowed * 10) / 10,
        progressLabel: games > 0 ? `${pointsAllowed.toFixed(1)} PPG` : "No games",
        status: resolved ? (met ? "met" : "missed") : "active",
        note: games > 0 ? (met ? "Defense is inside the target." : `Target is ${goal.targetValue} PPG allowed.`) : "Starts after Week 1.",
      };
    }),
    resolved,
  };
}

export function resolveProgramBlueprint(team: Team, year: number, recruitingClassRank?: number): ProgramBlueprint {
  return evaluateProgramBlueprint(team, ensureProgramBlueprint(team, year), recruitingClassRank, true);
}

export function emptyBlueprintAllocations(): Record<BlueprintCategory, number> {
  return CATEGORY_KEYS.reduce(
    (allocations, key) => ({
      ...allocations,
      [key]: 0,
    }),
    {} as Record<BlueprintCategory, number>,
  );
}

export function normalizeBlueprintAllocations(input?: Partial<Record<BlueprintCategory, number>>, totalPoints?: number): Record<BlueprintCategory, number> {
  const allocations = emptyBlueprintAllocations();
  for (const key of CATEGORY_KEYS) {
    allocations[key] = normalizeCategoryPoints(input?.[key]);
  }
  const maxSpent = totalPoints === undefined ? MAX_BLUEPRINT_TOTAL_POINTS : normalizeBlueprintTotalPoints(totalPoints, MAX_BLUEPRINT_TOTAL_POINTS);
  let spent = Object.values(allocations).reduce((sum, value) => sum + value, 0);
  for (const key of [...CATEGORY_KEYS].reverse()) {
    while (spent > maxSpent && allocations[key] > 0) {
      allocations[key] -= 1;
      spent -= 1;
    }
  }
  return allocations;
}

export function blueprintSpent(blueprint: ProgramBlueprint): number {
  return Object.values(normalizeBlueprintAllocations(blueprint.allocations)).reduce((sum, value) => sum + value, 0);
}

export function blueprintRemaining(blueprint: ProgramBlueprint): number {
  return Math.max(0, blueprint.totalPoints - blueprintSpent(blueprint));
}

export function blueprintAllocation(team: Team, key: BlueprintCategory): number {
  return team.blueprint ? normalizeBlueprintAllocations(team.blueprint.allocations)[key] : 0;
}

export function autoBlueprintAllocations(team: Team, totalPoints: number, focus: BlueprintFocus = "balanced"): Record<BlueprintCategory, number> {
  const allocations = emptyBlueprintAllocations();
  const priority: BlueprintCategory[] = focusPriority(focus);
  if (focus === "balanced") {
    if (team.program.recruitingReach < 70) priority.push("recruitingReach", "scoutingNetwork");
    if (team.program.training < 70) priority.push("trainingStaff");
    if (team.program.facilities < 70) priority.push("facilities");
    if (team.program.academics < 70) priority.push("academicSupport");
    if (team.coaches.head.jobSecurity < 64) priority.push("coachRetention");
  }
  priority.push("recruitingReach", "trainingStaff", "scoutingNetwork", "facilities", "playerTrust", "coachRetention", "academicSupport");

  for (let point = 0; point < totalPoints; point += 1) {
    const preferred = priority[point % priority.length]!;
    const key = allocations[preferred] < MAX_BLUEPRINT_CATEGORY_POINTS ? preferred : CATEGORY_KEYS.find((candidate) => allocations[candidate] < MAX_BLUEPRINT_CATEGORY_POINTS);
    if (!key) break;
    allocations[key] += 1;
  }
  return allocations;
}

export function focusPriority(focus: BlueprintFocus): BlueprintCategory[] {
  if (focus === "recruiting") return ["recruitingReach", "scoutingNetwork", "recruitingReach", "facilities"];
  if (focus === "development") return ["trainingStaff", "facilities", "trainingStaff", "academicSupport"];
  if (focus === "academics") return ["academicSupport", "playerTrust", "scoutingNetwork", "coachRetention"];
  if (focus === "facilities") return ["facilities", "trainingStaff", "recruitingReach", "coachRetention"];
  if (focus === "retention") return ["playerTrust", "coachRetention", "academicSupport", "trainingStaff"];
  return [];
}

export function blueprintFocusLabel(focus: BlueprintFocus): string {
  if (focus === "recruiting") return "Recruiting";
  if (focus === "development") return "Development";
  if (focus === "academics") return "Academics";
  if (focus === "facilities") return "Facilities";
  if (focus === "retention") return "Retention";
  if (focus === "balanced") return "Balanced";
  return "Custom";
}

export function completeBlueprintAllocations(team: Team, blueprint: ProgramBlueprint): Record<BlueprintCategory, number> {
  const allocations = normalizeBlueprintAllocations(blueprint.allocations);
  let remaining = blueprintRemaining({ ...blueprint, allocations });
  if (remaining <= 0) return allocations;

  const target = autoBlueprintAllocations(team, blueprint.totalPoints, blueprint.focus === "custom" ? "balanced" : blueprint.focus);
  while (remaining > 0) {
    const preferred = CATEGORY_KEYS.filter((key) => allocations[key] < MAX_BLUEPRINT_CATEGORY_POINTS && allocations[key] < target[key]).sort((a, b) => target[b] - allocations[b] - (target[a] - allocations[a]))[0];
    const fallback = CATEGORY_KEYS.find((key) => allocations[key] < MAX_BLUEPRINT_CATEGORY_POINTS);
    const key = preferred ?? fallback;
    if (!key) break;
    allocations[key] += 1;
    remaining -= 1;
  }
  return allocations;
}

export function blueprintRecruitingBudgetBonus(team: Team): number {
  return blueprintAllocation(team, "recruitingReach") * 90 + blueprintAllocation(team, "scoutingNetwork") * 25;
}

export function blueprintScoutProgressBonus(team: Team): number {
  return blueprintAllocation(team, "scoutingNetwork") * 5;
}

export function blueprintPitchBonus(team: Team): number {
  return blueprintAllocation(team, "recruitingReach") * 2 + blueprintAllocation(team, "facilities");
}

export function blueprintDevelopmentBonus(team: Team): number {
  return blueprintAllocation(team, "trainingStaff") * 0.42 + blueprintAllocation(team, "facilities") * 0.24 + blueprintAllocation(team, "academicSupport") * 0.12;
}

export function blueprintRetentionBonus(team: Team): number {
  return blueprintAllocation(team, "playerTrust") * 0.75 + blueprintAllocation(team, "academicSupport") * 0.25;
}

export function blueprintCoachRetention(team: Team): number {
  return blueprintAllocation(team, "coachRetention");
}

function calculateBlueprintBudget(team: Team): number {
  const programStrength = Math.round((team.program.prestige + team.program.academics + team.program.facilities + team.program.training + team.program.recruitingReach + team.program.fanSupport) / 6);
  const culture = Math.round((team.coaches.head.culture + team.coaches.offense.culture + team.coaches.defense.culture) / 3);
  const seasonLift = Math.floor(team.season.wins / 3) + (team.season.rank && team.season.rank <= 10 ? 2 : team.season.rank && team.season.rank <= 25 ? 1 : 0);
  return clamp(Math.round(12 + programStrength / 8 + (culture - 55) / 12 + seasonLift), 16, 28);
}

function normalizeBlueprintTotalPoints(value: unknown, fallback: number): number {
  const normalized = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return clamp(Math.round(normalized), 0, MAX_BLUEPRINT_TOTAL_POINTS);
}

function normalizeCategoryPoints(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return clamp(Math.round(value), 0, MAX_BLUEPRINT_CATEGORY_POINTS);
}

function createDirectorGoals(team: Team, year: number): DirectorGoal[] {
  const winsTarget = team.expectations >= 82 ? 10 : team.expectations >= 72 ? 8 : team.expectations >= 62 ? 7 : 6;
  const classTarget = team.expectations >= 82 ? 12 : team.expectations >= 72 ? 25 : team.expectations >= 62 ? 40 : 55;
  const defenseTarget = team.expectations >= 82 ? 22 : team.expectations >= 72 ? 25 : team.expectations >= 62 ? 28 : 32;
  return [
    {
      id: `${year}-wins`,
      kind: "wins",
      title: "Director Win Standard",
      targetValue: winsTarget,
      targetLabel: `${winsTarget}+ wins`,
      progressValue: 0,
      progressLabel: "0 wins",
      status: "active",
      note: "Set by program expectations.",
    },
    {
      id: `${year}-class`,
      kind: "recruitingClass",
      title: "Signing Class Standard",
      targetValue: classTarget,
      targetLabel: `Top ${classTarget} class`,
      progressValue: 0,
      progressLabel: "Pending",
      status: "active",
      note: "Resolves after signing day.",
    },
    {
      id: `${year}-defense`,
      kind: "scoringDefense",
      title: "Defensive Pace Standard",
      targetValue: defenseTarget,
      targetLabel: `${defenseTarget} PPG allowed`,
      progressValue: 0,
      progressLabel: "No games",
      status: "active",
      note: "Tracks points allowed per game.",
    },
  ];
}
