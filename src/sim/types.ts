export const ATTRIBUTE_KEYS = [
  "throwPower",
  "accuracy",
  "awareness",
  "speed",
  "catching",
  "tackle",
  "interception",
  "defAwareness",
  "runBlock",
  "passBlock",
  "routeRunning",
  "kickPower",
  "kickAccuracy",
] as const;

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type Attributes = Record<AttributeKey, number>;

export const POSITIONS = [
  "QB",
  "HB",
  "WR",
  "TE",
  "OL",
  "DL",
  "LB",
  "CB",
  "S",
  "K",
  "P",
] as const;

export type Position = (typeof POSITIONS)[number];
export type CollegeYear = "FR" | "SO" | "JR" | "SR";
export type RecruitStage = "open" | "top10" | "top5" | "top3" | "softPledge" | "signed";
export type RecruitTrait = "elite" | "starter" | "rotation" | "depth" | "project";
export type GemBust = "gem" | "solid" | "bust";
export type Phase = "preseason" | "regular" | "postseason" | "offseason" | "complete";
export type AutomationProfile = "balanced" | "recruitFirst" | "developYouth" | "retainStars";

export interface PlayerStats {
  games: number;
  passYards: number;
  passTd: number;
  interceptionsThrown: number;
  rushYards: number;
  rushTd: number;
  receivingYards: number;
  receivingTd: number;
  tackles: number;
  sacks: number;
  interceptions: number;
  pancakes: number;
  fieldGoals: number;
  fieldGoalAttempts: number;
}

export interface Player {
  id: string;
  name: string;
  position: Position;
  year: CollegeYear;
  profileIndex: number;
  attributes: Attributes;
  overall: number;
  potential: number;
  development: RecruitTrait;
  hometown: string;
  stats: PlayerStats;
  awards: string[];
}

export interface Coach {
  id: string;
  name: string;
  role: "head" | "offense" | "defense";
  age: number;
  scheme: string;
  recruiting: number;
  development: number;
  tactics: number;
  culture: number;
  points: number;
  jobSecurity: number;
  hiredBy?: string;
}

export interface ProgramRatings {
  prestige: number;
  academics: number;
  facilities: number;
  training: number;
  recruitingReach: number;
  fanSupport: number;
  NIL?: number;
}

export interface TeamSeason {
  wins: number;
  losses: number;
  confWins: number;
  confLosses: number;
  pointsFor: number;
  pointsAgainst: number;
  rank?: number;
  streak: number;
}

export interface Team {
  id: string;
  name: string;
  mascot: string;
  abbreviation: string;
  city: string;
  state: string;
  conferenceId: string;
  primary: string;
  secondary: string;
  roster: Player[];
  coaches: {
    head: Coach;
    offense: Coach;
    defense: Coach;
  };
  program: ProgramRatings;
  coachPoints: number;
  programPoints: number;
  expectations: number;
  season: TeamSeason;
  history: TeamHistoryEntry[];
}

export interface Conference {
  id: string;
  name: string;
  teamIds: string[];
}

export interface TeamHistoryEntry {
  year: number;
  record: string;
  finalRank?: number;
  conferenceFinish: number;
  postseason: string;
  awards: string[];
}

export interface Recruit {
  id: string;
  name: string;
  position: Position;
  stars: 1 | 2 | 3 | 4 | 5;
  nationalRank: number;
  state: string;
  hometown: string;
  profileIndex: number;
  hiddenTrait: RecruitTrait;
  traitRevealed: boolean;
  gemBust?: GemBust;
  attributes: Attributes;
  knownAttributes: AttributeKey[];
  scoutProgress: number;
  overall: number;
  potential: number;
  stage: RecruitStage;
  topSchools: string[];
  interest: Record<string, number>;
  priorities: {
    playingTime: number;
    development: number;
    academics: number;
    facilities: number;
    distance: number;
    prestige: number;
  };
  committedTeamId?: string;
}

export interface RecruitingState {
  weeklyPoints: number;
  pointsRemaining: number;
  board: string[];
  autoEnabled: boolean;
  profile: AutomationProfile;
  lastActions: string[];
}

export interface GameResult {
  homeScore: number;
  awayScore: number;
  winnerTeamId: string;
  summary: string;
}

export interface Game {
  id: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  conferenceGame: boolean;
  played: boolean;
  result?: GameResult;
  playoffRound?: "quarter" | "semi" | "final";
  bowlName?: string;
}

export interface AwardWinner {
  awardName: string;
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  position: Position;
  note: string;
}

export interface WeeklyAwards {
  year: number;
  week: number;
  national: AwardWinner[];
  conference: Record<string, AwardWinner[]>;
}

export interface SeasonAwards {
  year: number;
  nationalAwards: AwardWinner[];
  allAmericans: {
    first: AwardWinner[];
    second: AwardWinner[];
    freshman: AwardWinner[];
  };
  allConference: Record<
    string,
    {
      first: AwardWinner[];
      second: AwardWinner[];
      freshman: AwardWinner[];
    }
  >;
}

export interface Playoff {
  year: number;
  seeds: string[];
  games: Game[];
  championTeamId?: string;
}

export interface SeasonHistory {
  year: number;
  championTeamId?: string;
  championName?: string;
  playoffTeams: string[];
  awardWinners: AwardWinner[];
  topClasses: { teamId: string; teamName: string; points: number }[];
}

export interface DebugFlags {
  forceUserPlayoff: boolean;
  forceUserAward: boolean;
  fastSimSeasons: number;
}

export interface DynastyState {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  seed: number;
  rngState: number;
  year: number;
  calendarYear: number;
  maxYears: number;
  phase: Phase;
  week: number;
  userTeamId: string;
  conferences: Conference[];
  teams: Team[];
  recruits: Recruit[];
  recruiting: RecruitingState;
  schedule: Game[];
  weeklyAwards: WeeklyAwards[];
  seasonAwards?: SeasonAwards;
  playoff?: Playoff;
  coachPool: Coach[];
  history: SeasonHistory[];
  debugFlags: DebugFlags;
  debugLog: string[];
}

export function emptyStats(): PlayerStats {
  return {
    games: 0,
    passYards: 0,
    passTd: 0,
    interceptionsThrown: 0,
    rushYards: 0,
    rushTd: 0,
    receivingYards: 0,
    receivingTd: 0,
    tackles: 0,
    sacks: 0,
    interceptions: 0,
    pancakes: 0,
    fieldGoals: 0,
    fieldGoalAttempts: 0,
  };
}
