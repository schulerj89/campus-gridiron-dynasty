import type { DynastyState, TeamHistoryEntry } from "./types";

export interface ProgramRecordBook {
  teamName: string;
  seasonsLogged: number;
  crownBowlTitles: number;
  summitFourTrips: number;
  bowlTrips: number;
  topTenFinishes: number;
  individualAwards: number;
  bestRecord?: {
    year: number;
    record: string;
    wins: number;
    losses: number;
  };
  bestFinalRank?: {
    year: number;
    rank: number;
  };
  bestRecruitingClass?: {
    year: number;
    rank: number;
  };
  awardLeaders: { awardName: string; count: number }[];
  recentSeasons: TeamHistoryEntry[];
}

export function buildProgramRecordBook(state: DynastyState): ProgramRecordBook | undefined {
  const team = state.teams.find((candidate) => candidate.id === state.userTeamId);
  if (!team) return undefined;
  const history = [...team.history].sort((a, b) => b.year - a.year);
  const parsedRecords = history
    .map((entry) => ({ entry, parsed: parseRecord(entry.record) }))
    .filter((item): item is { entry: TeamHistoryEntry; parsed: { wins: number; losses: number } } => Boolean(item.parsed));
  const bestRecord = parsedRecords
    .sort((a, b) => b.parsed.wins - a.parsed.wins || a.parsed.losses - b.parsed.losses || b.entry.year - a.entry.year)
    .at(0);
  const rankedFinishes = history
    .filter((entry): entry is TeamHistoryEntry & { finalRank: number } => entry.finalRank !== undefined)
    .sort((a, b) => a.finalRank - b.finalRank || b.year - a.year);
  const recruitingClasses = history
    .filter((entry): entry is TeamHistoryEntry & { recruitingClassRank: number } => entry.recruitingClassRank !== undefined)
    .sort((a, b) => a.recruitingClassRank - b.recruitingClassRank || b.year - a.year);
  const awardCounts = countAwards(history.flatMap((entry) => entry.awards));

  return {
    teamName: team.name,
    seasonsLogged: history.length,
    crownBowlTitles: history.filter((entry) => entry.postseason === "Crown Bowl Champion").length,
    summitFourTrips: history.filter((entry) => entry.postseason === "Crown Bowl Champion" || entry.postseason === "Summit Eight" || entry.postseason === "Summit Four").length,
    bowlTrips: history.filter((entry) => entry.postseason !== "Missed Bowls").length,
    topTenFinishes: history.filter((entry) => entry.finalRank !== undefined && entry.finalRank <= 10).length,
    individualAwards: history.reduce((sum, entry) => sum + entry.awards.length, 0),
    bestRecord: bestRecord
      ? {
          year: bestRecord.entry.year,
          record: bestRecord.entry.record,
          wins: bestRecord.parsed.wins,
          losses: bestRecord.parsed.losses,
        }
      : undefined,
    bestFinalRank: rankedFinishes[0] ? { year: rankedFinishes[0].year, rank: rankedFinishes[0].finalRank } : undefined,
    bestRecruitingClass: recruitingClasses[0] ? { year: recruitingClasses[0].year, rank: recruitingClasses[0].recruitingClassRank } : undefined,
    awardLeaders: awardCounts,
    recentSeasons: history.slice(0, 8),
  };
}

function parseRecord(record: string): { wins: number; losses: number } | undefined {
  const match = /^(\d+)-(\d+)$/.exec(record);
  if (!match) return undefined;
  return {
    wins: Number(match[1]),
    losses: Number(match[2]),
  };
}

function countAwards(awards: string[]): { awardName: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const award of awards) {
    counts.set(award, (counts.get(award) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([awardName, count]) => ({ awardName, count }))
    .sort((a, b) => b.count - a.count || a.awardName.localeCompare(b.awardName))
    .slice(0, 5);
}
