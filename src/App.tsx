import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  Award,
  ArrowDown,
  ArrowUp,
  BadgeDollarSign,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  CircleHelp,
  ClipboardList,
  Crown,
  Dumbbell,
  GraduationCap,
  Handshake,
  Heart,
  Flame,
  ListOrdered,
  LineChart,
  MapPinned,
  Menu,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Shield,
  Star,
  Snowflake,
  TrendingUp,
  Trophy,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import {
  addRecruitToBoard,
  autoRecruit,
  gemBustFor,
  isPipelineRecruit,
  MIN_RECRUITING_ACTION_COST,
  OFFER_COST,
  offerScholarship,
  pitchRecruit,
  PITCH_COST,
  rankedRecruitSchoolInterests,
  removeRecruitFromBoard,
  rescindScholarship,
  SCOUT_COST,
  scoutRecruit,
} from "./sim/recruiting";
import { createDynasty } from "./sim/generate";
import { ROSTER_LIMIT, advanceWeek, allocateBlueprintPoint, autoAllocateProgramBlueprint, canEditProgramBlueprint, forceUserAward, forceUserPlayoff, forceUserWalkOnNeed, getUserTeam, hireCoach, investProgramPoint, setProgramBlueprintFocus, setUserOffensiveStrategy, simulateSeasons, spendCoachPoint } from "./sim/dynasty";
import { clearDynasty, loadActiveDynasty, loadActiveDynastySummary, saveDynasty, summarizeDynastyState, type DynastySaveSummary } from "./sim/storage";
import { createDynastySaveQueue } from "./sim/saveQueue";
import { buildDepthChart, moveDepthChartPlayer } from "./sim/depthChart";
import { TARGET_ROSTER, effectiveOverall, teamPower, teamUnitRatings } from "./sim/ratings";
import { buildMatchupPreview, type MatchupPreview as MatchupPreviewData } from "./sim/matchup";
import { ATTRIBUTE_KEYS, POSITIONS, type AttributeKey, type BlueprintCategory, type BlueprintFocus, type Coach, type Conference, type DynastyState, type Game, type OffensiveStrategy, type PlayByPlayEvent, type Player, type PlayerDeparture, type PlayerGameStats, type PlayerProgression, type PlayerStats, type Position, type ProgramChange, type ProgramRatings, type Recruit, type RecruitSigning, type Team, type TeamBoxScore } from "./sim/types";
import { Awards, AwardGrid, PlayoffBracket } from "./components/AwardsView";
import { PlayoffCenter } from "./components/PlayoffCenterView";
import { publicAsset } from "./assets";
import { PaginationControls } from "./components/PaginationControls";
import { ProgramHistory } from "./components/ProgramHistoryView";
import { Rankings } from "./components/RankingsView";
import { Standings } from "./components/StandingsView";
import { Stats } from "./components/StatsView";
import { TeamHelmet } from "./components/TeamHelmet";
import { buildRecruitingViewModel, type RecruitCommitmentFilter, type RecruitPositionFilter, type RecruitSort, type RecruitStarsFilter } from "./components/recruitingViewModel";
import { APP_VERSION } from "./version";
import { BLUEPRINT_CATEGORY_META, MAX_BLUEPRINT_CATEGORY_POINTS, blueprintRemaining, blueprintSpent, ensureProgramBlueprint, evaluateProgramBlueprint } from "./sim/blueprint";

type Tab = "overview" | "rankings" | "standings" | "roster" | "recruiting" | "schedule" | "stats" | "awards" | "playoffCenter" | "program" | "debug";
type RosterFilter = "ALL" | Position;
type RosterView = "roster" | "depth";
type PlayerModalTab = "profile" | "stats" | "attributes" | "awards";
type OffseasonStage = "departures" | "recruiting" | "signing" | "development" | "programReview";
type PlayoffRound = NonNullable<Game["playoffRound"]>;

const tabs: { id: Tab; label: string; icon: typeof LineChart }[] = [
  { id: "overview", label: "Overview", icon: LineChart },
  { id: "rankings", label: "Rankings", icon: TrendingUp },
  { id: "standings", label: "Standings", icon: ListOrdered },
  { id: "roster", label: "Roster", icon: Users },
  { id: "recruiting", label: "Recruiting", icon: Search },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "awards", label: "Awards", icon: Trophy },
  { id: "playoffCenter", label: "Playoff Center", icon: Trophy },
  { id: "program", label: "Program", icon: GraduationCap },
  { id: "debug", label: "Debug", icon: Wrench },
];

const RECRUIT_PAGE_SIZE = 25;
const MOBILE_RECRUIT_PAGE_SIZE = 8;
const BOARD_PAGE_SIZE = 8;
const MOBILE_BOARD_PAGE_SIZE = 4;
const SIGNEE_PAGE_SIZE = 14;
const MOBILE_SIGNEE_PAGE_SIZE = 6;
const ROSTER_PAGE_SIZE = 18;
const MOBILE_ROSTER_PAGE_SIZE = 7;
const PROGRESSION_PAGE_SIZE = 24;
const MOBILE_PROGRESSION_PAGE_SIZE = 4;
const DEPARTURE_PAGE_SIZE = 12;
const MOBILE_DEPARTURE_PAGE_SIZE = 6;
const CLASS_RANKING_PAGE_SIZE = 20;
const MOBILE_CLASS_RANKING_PAGE_SIZE = 8;
const SCHEDULE_PAGE_SIZE = 24;
const MOBILE_SCHEDULE_PAGE_SIZE = 8;
const ROSTER_DEPTH_LIMIT = 3;
const ROSTER_FLOOR_TOTAL = Object.values(TARGET_ROSTER).reduce((sum, count) => sum + count, 0);

const ATTRIBUTE_KEYS_FOR_UI: AttributeKey[] = [
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
];

const programIcons: Record<keyof ProgramRatings, typeof GraduationCap> = {
  academics: BookOpen,
  facilities: Building2,
  training: Dumbbell,
  recruitingReach: MapPinned,
  fanSupport: Heart,
  prestige: Crown,
  NIL: Handshake,
};

const blueprintIcons: Record<BlueprintCategory, typeof GraduationCap> = {
  scoutingNetwork: Search,
  recruitingReach: MapPinned,
  trainingStaff: Dumbbell,
  facilities: Building2,
  academicSupport: BookOpen,
  playerTrust: Heart,
  coachRetention: UserRound,
};

const offensiveStrategyOptions: { value: OffensiveStrategy; label: string; description: string }[] = [
  { value: "balanced", label: "Balanced", description: "Adjusts toward roster strength with no heavy bias." },
  { value: "airRaid", label: "Air Raid", description: "Leans into QB and WR volume with the highest pass rate." },
  { value: "runHeavy", label: "Run Heavy", description: "Protects the ball and feeds backs behind strong blocking." },
  { value: "proStyle", label: "Pro Style", description: "Pass-first balance that still supports a lead back." },
  { value: "spreadTempo", label: "Spread Tempo", description: "Adds pace and passing volume while keeping multiple targets involved." },
];

const blueprintFocusOptions: { value: BlueprintFocus; label: string }[] = [
  { value: "custom", label: "Custom" },
  { value: "balanced", label: "Balanced" },
  { value: "recruiting", label: "Recruiting" },
  { value: "development", label: "Development" },
  { value: "academics", label: "Academics" },
  { value: "facilities", label: "Facilities" },
  { value: "retention", label: "Retention" },
];

function useCompactMobile(): boolean {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 480px)").matches);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 480px)");
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return matches;
}

export default function App() {
  const previewSeed = useMemo(() => dynastySeed(), []);
  const previewWorld = useMemo(() => createDynasty(previewSeed), [previewSeed]);
  const [selectedTeamId, setSelectedTeamId] = useState(previewWorld.userTeamId);
  const [state, setState] = useState<DynastyState>();
  const [savedState, setSavedState] = useState<DynastyState>();
  const [savedSummary, setSavedSummary] = useState<DynastySaveSummary | undefined>(() => loadActiveDynastySummary());
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [saveStatus, setSaveStatus] = useState("Local DB ready");
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>();
  const [playerModalTab, setPlayerModalTab] = useState<PlayerModalTab>("profile");
  const advanceLockedRef = useRef(false);
  const hadDynastyStateRef = useRef(false);
  const lastActiveTabRef = useRef(activeTab);
  const saveQueue = useMemo(() => createDynastySaveQueue(saveDynasty), []);
  const latestSaveRequest = useRef(0);

  useEffect(() => {
    loadActiveDynasty()
      .then((loaded) => {
        if (loaded) {
          setSavedState(loaded);
          setSavedSummary(summarizeDynastyState(loaded));
        } else {
          setSavedSummary(undefined);
        }
      })
      .catch(() => {
        setSavedSummary(undefined);
        setSaveStatus("Local save unavailable");
      });
  }, []);

  useEffect(() => {
    if (!state) return;
    const timeout = window.setTimeout(() => {
      queueSave(state, (saved) => `Saved Year ${saved.year}, Week ${saved.week}`);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [state]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (!state) {
      hadDynastyStateRef.current = false;
      lastActiveTabRef.current = activeTab;
      return;
    }
    const enteringDynasty = !hadDynastyStateRef.current;
    const changedTab = lastActiveTabRef.current !== activeTab;
    hadDynastyStateRef.current = true;
    lastActiveTabRef.current = activeTab;
    if (enteringDynasty || changedTab) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [activeTab, state]);

  const queueSave = (nextState: DynastyState, status: (saved: DynastyState) => string) => {
    const request = ++latestSaveRequest.current;
    saveQueue
      .enqueue(nextState)
      .then((result) => {
        if (!result.saved || request !== latestSaveRequest.current) return;
        setSaveStatus(status(result.state));
        setSavedSummary(summarizeDynastyState(result.state));
      })
      .catch(() => {
        if (request === latestSaveRequest.current) setSaveStatus("Save failed");
      });
  };

  const startDynasty = () => {
    const dynasty = createDynasty(previewSeed, selectedTeamId);
    setSelectedPlayerId(undefined);
    setState(dynasty);
    setActiveTab("overview");
  };

  const continueDynasty = () => {
    if (savedState) {
      setSelectedPlayerId(undefined);
      setState(savedState);
      setActiveTab("overview");
      return;
    }
    setSaveStatus("Loading local save...");
    loadActiveDynasty().then((loaded) => {
      if (!loaded) {
        setSavedSummary(undefined);
        setSaveStatus("Local save unavailable");
        return;
      }
      setSavedState(loaded);
      setSavedSummary(summarizeDynastyState(loaded));
      setSelectedPlayerId(undefined);
      setState(loaded);
      setActiveTab("overview");
    }).catch(() => setSaveStatus("Local save unavailable"));
  };

  const resetAll = async () => {
    try {
      latestSaveRequest.current += 1;
      await saveQueue.cancelPending();
      await clearDynasty();
      setSelectedPlayerId(undefined);
      setState(undefined);
      setSavedState(undefined);
      setSavedSummary(undefined);
      setSaveStatus("Local save cleared");
    } catch {
      setSaveStatus("Clear failed");
    }
  };

  const update = (recipe: (current: DynastyState) => DynastyState) => {
    setState((current) => (current ? recipe(current) : current));
  };

  const runAdvance = (recipe: (current: DynastyState) => DynastyState, status = "Advancing dynasty...") => {
    if (!state || state.phase === "complete" || isAdvancing || advanceLockedRef.current) return;
    advanceLockedRef.current = true;
    setIsAdvancing(true);
    setSaveStatus(status);
    window.setTimeout(() => {
      try {
        const nextState = recipe(state);
        setState(nextState);
        setActiveTab(tabAfterAdvance(state, nextState));
        setMobileNavOpen(false);
      } catch {
        setSaveStatus("Advance failed");
      } finally {
        advanceLockedRef.current = false;
        setIsAdvancing(false);
      }
    }, 40);
  };

  if (!state) {
    return (
      <HomeScreen
        teams={previewWorld.teams}
        conferences={previewWorld.conferences}
        selectedTeamId={selectedTeamId}
        savedState={savedState}
        savedSummary={savedSummary}
        onSelectTeam={setSelectedTeamId}
        onStart={startDynasty}
        onContinue={continueDynasty}
        onReset={resetAll}
      />
    );
  }

  const userTeam = getUserTeam(state);
  const advanceLabel = advanceActionLabel(state);
  const selectedPlayer = selectedPlayerId ? state.teams.flatMap((team) => team.roster).find((player) => player.id === selectedPlayerId) : undefined;
  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]!;
  const ActiveTabIcon = activeTabMeta.icon;
  const openPlayer = (player: Player, tab: PlayerModalTab = "profile") => {
    setSelectedPlayerId(player.id);
    setPlayerModalTab(tab);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">
            Campus Gridiron Dynasty <span className="version-pill">{APP_VERSION}</span>
          </p>
          <h1>{userTeam.name}</h1>
          <p className="muted" data-testid="phase-week-label">
            Year {state.year} of {state.maxYears} - {state.calendarYear} - {phaseWeekLabel(state)}
          </p>
          <p className="save-status" data-testid="save-status">
            {saveStatus}
          </p>
        </div>
        <div className="topbar-actions">
          <button className="secondary" onClick={() => queueSave(state, () => "Saved manually")}>
            <Save size={18} />
            Save
          </button>
          <button className="secondary" data-testid="sim-month" onClick={() => runAdvance((current) => advanceMultipleWeeks(current, 4), "Simulating 4 weeks...")} disabled={state.phase === "complete" || isAdvancing}>
            <ChevronsRight size={18} />
            Sim 4 Weeks
          </button>
          <button className={clsx("primary", isAdvancing && "is-loading")} data-testid="advance-week" onClick={() => runAdvance(advanceWeek, `${advanceLabel}...`)} disabled={state.phase === "complete" || isAdvancing} aria-busy={isAdvancing}>
            <ChevronsRight size={18} />
            {isAdvancing ? "Advancing..." : advanceLabel}
          </button>
        </div>
      </header>

      <button
        type="button"
        className="secondary mobile-menu-trigger"
        data-testid="mobile-section-menu"
        aria-controls="dynasty-section-tabs"
        aria-expanded={mobileNavOpen}
        onClick={() => setMobileNavOpen((open) => !open)}
      >
        <Menu size={18} />
        <span>{activeTabMeta.label}</span>
        <ActiveTabIcon size={17} />
      </button>

      <nav id="dynasty-section-tabs" className={clsx("tabbar", mobileNavOpen && "mobile-open")} aria-label="Dynasty sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={clsx("tab", activeTab === tab.id && "active")}
              onClick={() => {
                setActiveTab(tab.id);
                setMobileNavOpen(false);
              }}
              aria-label={tab.label}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              <Icon size={17} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <main className="content-grid">
        {activeTab === "overview" && <Overview state={state} onAdvance={() => runAdvance(advanceWeek, `${advanceLabel}...`)} advanceLabel={advanceLabel} isAdvancing={isAdvancing} onNavigate={setActiveTab} />}
        {activeTab === "rankings" && <Rankings state={state} />}
        {activeTab === "standings" && <Standings state={state} />}
        {activeTab === "roster" && <Roster state={state} onUpdate={update} onOpenPlayer={(player) => openPlayer(player)} />}
        {activeTab === "recruiting" && <Recruiting state={state} onUpdate={update} />}
        {activeTab === "schedule" && <Schedule state={state} />}
        {activeTab === "stats" && <Stats state={state} onOpenPlayer={(player) => openPlayer(player, "stats")} />}
        {activeTab === "awards" && <Awards state={state} onOpenPlayer={(player) => openPlayer(player, "awards")} />}
        {activeTab === "playoffCenter" && <PlayoffCenter state={state} />}
        {activeTab === "program" && <Program state={state} onUpdate={update} />}
        {activeTab === "debug" && <Debug state={state} onUpdate={update} onReset={resetAll} />}
      </main>
      {selectedPlayer && <PlayerModal player={selectedPlayer} activeTab={playerModalTab} onTabChange={setPlayerModalTab} onClose={() => setSelectedPlayerId(undefined)} />}
    </div>
  );
}

function dynastySeed(): number {
  const seed = new URLSearchParams(window.location.search).get("seed");
  const parsed = Number(seed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
}

function HomeScreen({
  teams,
  conferences,
  selectedTeamId,
  savedState,
  savedSummary,
  onSelectTeam,
  onStart,
  onContinue,
  onReset,
}: {
  teams: Team[];
  conferences: Conference[];
  selectedTeamId: string;
  savedState?: DynastyState;
  savedSummary?: DynastySaveSummary;
  onSelectTeam: (teamId: string) => void;
  onStart: () => void;
  onContinue: () => void;
  onReset: () => void;
}) {
  const selectedIndex = Math.max(0, teams.findIndex((team) => team.id === selectedTeamId));
  const selectedTeam = teams[selectedIndex] ?? teams[0]!;
  const selectedUnits = teamUnitRatings(selectedTeam.roster);
  const selectedConference = conferences.find((conference) => conference.id === selectedTeam.conferenceId);
  const moveTeam = (offset: number) => {
    const nextIndex = (selectedIndex + offset + teams.length) % teams.length;
    onSelectTeam(teams[nextIndex]!.id);
  };

  return (
    <div className="home">
      <section className="hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(9,13,18,.94), rgba(9,13,18,.58), rgba(9,13,18,.18)), url("${publicAsset("assets/dynasty-hero.png")}")` }}>
        <div className="hero-copy">
          <p className="eyebrow">
            Fictional 20-year dynasty sim <span className="version-pill">{APP_VERSION}</span>
          </p>
          <h1>Campus Gridiron Dynasty</h1>
          <p className="hero-lede">Build a program through recruiting uncertainty, coach movement, playoff pressure, local storage persistence, and rating-driven game simulation.</p>
          <div className="feature-list" aria-label="Game features">
            <Feature icon={Shield} text="70 fictional programs across 7 conferences" />
            <Feature icon={Users} text="85-player rosters with 13 detailed ratings" />
            <Feature icon={Search} text="Thousands of recruits with hidden traits, scouting, gems, and busts" />
            <Feature icon={Trophy} text="Program Blueprint budgets, weekly awards, bowls, and playoff history" />
          </div>
          <div className="launch-panel team-picker" data-testid="team-picker">
            <div className="team-picker-head">
              <button className="icon-button" onClick={() => moveTeam(-1)} data-testid="team-prev" aria-label="Previous team">
                <ChevronLeft size={18} />
              </button>
              <div className="team-card-select">
                <div className="team-card-heading">
                  <TeamHelmet team={selectedTeam} size="md" />
                  <div>
                    <p className="eyebrow">Starting program</p>
                    <h2>{selectedTeam.name}</h2>
                    <p className="muted team-card-subtitle">
                      {teamIdentity(selectedTeam)} - {selectedConference?.name ?? "Independent"} - {selectedTeam.city}, {selectedTeam.state}
                    </p>
                  </div>
                </div>
              </div>
              <button className="icon-button" onClick={() => moveTeam(1)} data-testid="team-next" aria-label="Next team">
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="team-picker-metrics">
              <Metric label="Overall" value={selectedUnits.overall} />
              <Metric label="Power" value={teamPower(selectedTeam.roster)} />
              <Metric label="Program" value={programRating(selectedTeam)} />
              <Metric label="Prestige" value={selectedTeam.program.prestige} />
            </div>
            <div className="button-row">
              <button className="primary" onClick={onStart} data-testid="new-dynasty">
                <Play size={18} />
                New Dynasty
              </button>
              <button className="secondary" onClick={onContinue} disabled={!savedState && !savedSummary}>
                <ClipboardList size={18} />
                Continue
              </button>
              <button className="icon-button" onClick={onReset} title="Clear local save">
                <RotateCcw size={18} />
              </button>
            </div>
            {savedSummary && (
              <p className="muted" data-testid="save-summary">
                Continue {savedSummary.userTeamName} - Year {savedSummary.year} of {savedSummary.maxYears}, Week {savedSummary.week}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Overview({
  state,
  onAdvance,
  advanceLabel,
  isAdvancing,
  onNavigate,
}: {
  state: DynastyState;
  onAdvance: () => void;
  advanceLabel: string;
  isAdvancing: boolean;
  onNavigate: (tab: Tab) => void;
}) {
  const userTeam = getUserTeam(state);
  const units = teamUnitRatings(userTeam.roster);
  const recentAwards = state.weeklyAwards[0]?.national ?? [];
  const userPollEntry = state.rankings?.[0]?.entries.find((entry) => entry.teamId === userTeam.id);
  const offseasonTeamReport = state.offseasonReport?.teams.find((teamReport) => teamReport.teamId === userTeam.id);
  const offseasonFocus = Boolean(offseasonTeamReport && state.phase !== "regular" && state.phase !== "postseason");
  const champion = playoffChampion(state);
  const championshipFocus = state.phase === "postseason" && Boolean(champion);
  const postseasonFocus = state.phase === "postseason" && Boolean(state.playoff) && !championshipFocus;
  const regularDashboardFocus = !offseasonFocus && !postseasonFocus && !championshipFocus;
  const advanceDisabled = state.phase === "complete" || isAdvancing;
  const matchupPreview = buildMatchupPreview(state);
  const isCompactMobile = useCompactMobile();
  const activePlayoffRound = isCompactMobile && state.playoff ? currentPlayoffRound(state.playoff.games) : undefined;

  return (
    <>
      {championshipFocus && <ChampionshipRecap state={state} onAdvance={onAdvance} isAdvancing={isAdvancing} onNavigate={onNavigate} />}

      {offseasonFocus && state.offseasonReport && offseasonTeamReport && <OffseasonRecap state={state} report={state.offseasonReport} teamReport={offseasonTeamReport} />}

      {postseasonFocus && state.playoff && (
        <section className="panel span-2 postseason-priority-panel" data-testid="dashboard-playoff-bracket">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Postseason Command</p>
              <h2>Summit Eight Playoff</h2>
              <p className="muted">The dashboard follows the playoff bracket until the Crown Bowl is complete.</p>
            </div>
            <div className="button-row compact-row">
              <button className={clsx("primary", isAdvancing && "is-loading")} onClick={onAdvance} disabled={advanceDisabled} aria-busy={isAdvancing}>
                <ChevronsRight size={16} />
                {isAdvancing ? "Advancing..." : advanceLabel}
              </button>
              <button className="secondary" onClick={() => onNavigate("playoffCenter")}>
                <Trophy size={16} />
                Playoff Center
              </button>
              <button className="secondary" onClick={() => onNavigate("schedule")}>
                <CalendarDays size={16} />
                Box Scores
              </button>
            </div>
          </div>
          <PlayoffBracket games={state.playoff.games} teams={state.teams} priorPlayoffTeams={[]} championName={undefined} activeRound={activePlayoffRound} />
        </section>
      )}

      {regularDashboardFocus && (
        <section className="panel span-2 dashboard-panel" data-testid="dashboard-command-panel">
          <div className="panel-head">
            <div className="dashboard-identity">
              <TeamHelmet team={userTeam} size="lg" />
              <div>
                <p className="eyebrow">Dynasty Command</p>
                <h2>
                  {userTeam.season.wins} wins, {userTeam.season.losses} losses
                </h2>
                <p className="muted">Power {teamPower(userTeam.roster)} {userPollEntry ? `- National Rank #${userPollEntry.rank}` : "- Not ranked"}</p>
              </div>
            </div>
            <button className={clsx("primary", isAdvancing && "is-loading")} onClick={onAdvance} disabled={advanceDisabled} aria-busy={isAdvancing}>
              <ChevronsRight size={18} />
              {isAdvancing ? "Advancing..." : advanceLabel}
            </button>
          </div>
          <div className="metric-grid mobile-priority">
            <Metric label="Program Rating" value={programRating(userTeam)} />
            <Metric label="Overall" value={units.overall} />
            <Metric label="Recruiting Points" value={state.recruiting.pointsRemaining} />
            <Metric label="Program Points" value={userTeam.programPoints} />
          </div>
          <div className="unit-grid desktop-units">
            {Object.entries(units)
              .filter(([label]) => label !== "overall")
              .map(([label, value]) => (
                <div key={label} className="unit-bar">
                  <span>{title(label)}</span>
                  <strong>{value}</strong>
                  <div>
                    <i style={{ width: `${Math.min(100, Number(value))}%` }} />
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {regularDashboardFocus && <MatchupPreviewPanel preview={matchupPreview} testId="dashboard-next-game-panel" />}

      {regularDashboardFocus && (
        <section className="panel latest-awards-panel" data-testid="latest-national-awards-panel">
          <div className="panel-head compact">
            <h2>Latest National Awards</h2>
            <Award size={20} />
          </div>
          <AwardGrid awards={recentAwards.slice(0, 2)} userTeamId={state.userTeamId} />
        </section>
      )}

      {regularDashboardFocus && (
        <section className="panel ranking-snapshot-panel" data-testid="dashboard-current-poll-panel">
          <div className="panel-head compact">
            <h2>Current Poll</h2>
            <TrendingUp size={20} />
          </div>
          {userPollEntry ? (
            <div className="poll-snapshot-card">
              <strong>#{userPollEntry.rank} {userTeam.name}</strong>
              <span>{userPollEntry.votes.toLocaleString()} votes - {userPollEntry.firstPlaceVotes} first-place</span>
            </div>
          ) : (
            <p className="muted">{userTeam.name} is outside the Top 25.</p>
          )}
        </section>
      )}

      {!offseasonFocus && state.phase !== "regular" && state.offseasonReport && offseasonTeamReport && <OffseasonRecap state={state} report={state.offseasonReport} teamReport={offseasonTeamReport} />}
    </>
  );
}

function ChampionshipRecap({ state, onAdvance, isAdvancing, onNavigate }: { state: DynastyState; onAdvance: () => void; isAdvancing: boolean; onNavigate: (tab: Tab) => void }) {
  const champion = playoffChampion(state);
  const finalGame = state.playoff?.games.find((game) => game.playoffRound === "final");
  const isCompactMobile = useCompactMobile();
  if (!champion || !state.playoff) return null;
  const home = finalGame ? state.teams.find((team) => team.id === finalGame.homeTeamId) : undefined;
  const away = finalGame ? state.teams.find((team) => team.id === finalGame.awayTeamId) : undefined;
  const runnerUp = finalGame?.homeTeamId === champion.id ? away : home;
  const finalScore = finalGame?.result ? `${away?.abbreviation ?? "AWY"} ${finalGame.result.awayScore} - ${home?.abbreviation ?? "HME"} ${finalGame.result.homeScore}` : "Final score pending";
  return (
    <section className="panel span-2 championship-recap-panel" data-testid="championship-recap-panel">
      <div className="panel-head">
        <div className="dashboard-identity">
          <TeamHelmet team={champion} size="lg" />
          <div>
            <p className="eyebrow">Crown Bowl Champion</p>
            <h2>{champion.name} won the national title</h2>
            <p className="muted">{runnerUp ? `${finalScore} over ${runnerUp.name}` : finalScore}</p>
          </div>
        </div>
        <div className="button-row compact-row">
          <button className={clsx("primary", isAdvancing && "is-loading")} onClick={onAdvance} disabled={isAdvancing} aria-busy={isAdvancing}>
            <ChevronsRight size={16} />
            {isAdvancing ? "Advancing..." : "Advance to Offseason"}
          </button>
          <button className="secondary" onClick={() => onNavigate("playoffCenter")}>
            <Trophy size={16} />
            Playoff Center
          </button>
          <button className="secondary" onClick={() => onNavigate("schedule")}>
            <CalendarDays size={16} />
            Final Box Score
          </button>
        </div>
      </div>
      <div className="champion-scoreline">
        <Metric label="Champion Record" value={`${champion.season.wins}-${champion.season.losses}`} />
        <Metric label="Runner-up" value={runnerUp?.abbreviation ?? "-"} />
        <Metric label="Crown Bowl" value={finalGame?.bowlName ?? "Crown Bowl"} />
      </div>
      <PlayoffBracket games={state.playoff.games} teams={state.teams} priorPlayoffTeams={[]} championName={champion.name} activeRound={isCompactMobile ? "final" : undefined} />
    </section>
  );
}

function currentPlayoffRound(games: Game[]): PlayoffRound {
  const roundPriority: Record<PlayoffRound, number> = { quarter: 0, semi: 1, final: 2 };
  const pending = games
    .filter((game): game is Game & { playoffRound: PlayoffRound } => Boolean(game.playoffRound) && !game.played)
    .sort((a, b) => roundPriority[a.playoffRound] - roundPriority[b.playoffRound])[0];
  if (pending) return pending.playoffRound;
  if (games.some((game) => game.playoffRound === "final")) return "final";
  if (games.some((game) => game.playoffRound === "semi")) return "semi";
  return "quarter";
}

function playoffChampion(state: DynastyState): Team | undefined {
  const championId = state.playoff?.championTeamId;
  return championId ? state.teams.find((team) => team.id === championId) : undefined;
}

function OffseasonRecap({
  state,
  report,
  teamReport,
}: {
  state: DynastyState;
  report: NonNullable<DynastyState["offseasonReport"]>;
  teamReport: NonNullable<DynastyState["offseasonReport"]>["teams"][number];
}) {
  const graduates = teamReport.departures.filter((departure) => departure.reason === "graduated");
  const proDepartures = teamReport.departures.filter((departure) => departure.reason === "pro");
  const topClasses = report.topClasses;
  const stage = offseasonStage(state, report);
  const team = state.teams.find((candidate) => candidate.id === teamReport.teamId);
  return (
    <section className="panel span-2" data-testid="offseason-report-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{offseasonStageLabel(state, report)}</p>
          <h2>
            {report.year} Offseason {teamReport.recruitingRank ? `- Recruiting #${teamReport.recruitingRank}` : ""}
          </h2>
        </div>
        <GraduationCap size={20} />
      </div>
      <OffseasonSteps state={state} report={report} />
      <div className={clsx("offseason-grid", "single-focus", `offseason-stage-${stage}`)} data-testid={`offseason-stage-${stage}`}>
        {stage === "departures" && (
          <>
            <DepartureGroup title="Graduated" departures={graduates} />
            <DepartureGroup title="Went Pro" departures={proDepartures} />
          </>
        )}
        {stage === "recruiting" && <OffseasonRecruitingFocus state={state} />}
        {stage === "signing" && (
          <>
            <ClassSigneesPanel reports={report.teams} recruits={state.recruits} teams={state.teams} preferredTeamId={teamReport.teamId} />
            <RecruitingRankingPanel topClasses={topClasses} />
          </>
        )}
        {stage === "development" && (
          <>
            <ProgressionGroup team={team} progressions={teamReport.progressions} />
            <RosterCutdownGroup team={team} cuts={teamReport.cuts ?? []} />
          </>
        )}
        {stage === "programReview" && <ProgramChangeGroup changes={teamReport.programChanges} />}
      </div>
    </section>
  );
}

function OffseasonSteps({ state, report }: { state: DynastyState; report: NonNullable<DynastyState["offseasonReport"]> }) {
  const recruitingWeek = state.phase === "offseason" && report.departuresReviewed && !report.signingComplete ? Math.min(4, Math.max(1, state.week - 15)) : report.signingComplete ? 4 : 1;
  const stage = offseasonStage(state, report);
  const steps = [
    { label: "Departures", complete: Boolean(report.departuresReviewed || report.signingComplete || report.developmentComplete), active: stage === "departures" },
    { label: `Recruiting ${recruitingWeek}/4`, complete: report.signingComplete || state.week > 19, active: stage === "recruiting" },
    { label: "Signing Day", complete: Boolean(report.signingComplete), active: stage === "signing" },
    { label: "Development", complete: Boolean(report.developmentComplete), active: stage === "development" },
    { label: "Program Review", complete: Boolean(report.programReviewComplete), active: stage === "programReview" },
  ];
  return (
    <div className="offseason-steps" data-testid="offseason-steps">
      {steps.map((step) => (
        <span key={step.label} className={clsx(step.complete && "complete", step.active && "active")}>
          {step.label}
        </span>
      ))}
    </div>
  );
}

function OffseasonRecruitingFocus({ state }: { state: DynastyState }) {
  const boardLimit = state.recruiting.boardLimit ?? 35;
  const activeBoard = state.recruiting.board.filter((id) => state.recruits.find((recruit) => recruit.id === id && recruit.stage !== "signed" && !recruit.committedTeamId));
  return (
    <section className="offseason-column" data-testid="offseason-recruiting-focus-panel">
      <h3>Offseason Recruiting Window</h3>
      <div className="metric-grid compact-metrics">
        <Metric label="Points" value={state.recruiting.pointsRemaining.toLocaleString()} />
        <Metric label="Board" value={`${activeBoard.length}/${boardLimit}`} />
        <Metric label="Auto Recruit" value={state.recruiting.autoEnabled ? "On" : "Off"} />
      </div>
      <p className="muted">Late-cycle recruiting is active. Use the Recruiting tab to scout, offer, pitch, or let auto-recruit fill remaining needs.</p>
    </section>
  );
}

function RecruitingRankingPanel({ topClasses }: { topClasses: NonNullable<DynastyState["offseasonReport"]>["topClasses"] }) {
  const isCompactMobile = useCompactMobile();
  const pageSize = isCompactMobile ? MOBILE_CLASS_RANKING_PAGE_SIZE : CLASS_RANKING_PAGE_SIZE;
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(topClasses.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleClasses = topClasses.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => {
    setPage(1);
  }, [pageSize, topClasses.length]);
  return (
    <section className="offseason-column" data-testid="recruiting-ranking-panel">
      <h3>Recruiting Class Leaderboard</h3>
      {topClasses.length ? (
        <>
          <div className="table-list class-ranking-list">
            {visibleClasses.map((entry, index) => (
              <div key={entry.teamId} className="table-row class-rank-row">
                <span>{(currentPage - 1) * pageSize + index + 1}</span>
                <strong>{entry.teamName}</strong>
                <span>{entry.points} pts</span>
              </div>
            ))}
          </div>
          {topClasses.length > pageSize && <PaginationControls page={currentPage} pageCount={pageCount} total={topClasses.length} pageSize={pageSize} label="classes" onPageChange={setPage} />}
        </>
      ) : (
        <p className="muted">Class rankings post after signing day.</p>
      )}
    </section>
  );
}

function ClassSigneesPanel({ reports, recruits, teams, preferredTeamId }: { reports: NonNullable<DynastyState["offseasonReport"]>["teams"]; recruits: Recruit[]; teams: Team[]; preferredTeamId: string }) {
  const sortedReports = useMemo(() => [...reports].sort((a, b) => (a.recruitingRank ?? 999) - (b.recruitingRank ?? 999) || a.teamName.localeCompare(b.teamName)), [reports]);
  const preferredReportId = sortedReports.find((report) => report.teamId === preferredTeamId)?.teamId ?? sortedReports[0]?.teamId ?? "";
  const [selectedTeamId, setSelectedTeamId] = useState(preferredReportId);
  const [selectedSigneeId, setSelectedSigneeId] = useState<string>();
  const [signeePage, setSigneePage] = useState(1);
  const isCompactMobile = useCompactMobile();
  const signeePageSize = isCompactMobile ? MOBILE_SIGNEE_PAGE_SIZE : SIGNEE_PAGE_SIZE;
  useEffect(() => {
    setSelectedTeamId((current) => (sortedReports.some((report) => report.teamId === current) ? current : preferredReportId));
  }, [preferredReportId, sortedReports]);
  useEffect(() => {
    setSigneePage(1);
  }, [signeePageSize]);
  const selected = sortedReports.find((report) => report.teamId === selectedTeamId) ?? sortedReports[0];
  const signees = selected?.signees ?? [];
  const signeePageCount = Math.max(1, Math.ceil(signees.length / signeePageSize));
  const currentSigneePage = Math.min(signeePage, signeePageCount);
  const visibleSignees = signees.slice((currentSigneePage - 1) * signeePageSize, currentSigneePage * signeePageSize);
  const selectedSignee = selectedSigneeId ? signees.find((signee) => signee.recruitId === selectedSigneeId) : undefined;
  const selectedRecruit = selectedSignee ? recruits.find((recruit) => recruit.id === selectedSignee.recruitId) : undefined;
  return (
    <section className="offseason-column" data-testid="offseason-all-classes-panel">
      <h3>All Team Classes</h3>
      <label>
        Team
        <select
          value={selected?.teamId ?? ""}
          onChange={(event) => {
            setSelectedTeamId(event.target.value);
            setSelectedSigneeId(undefined);
            setSigneePage(1);
          }}
          data-testid="offseason-class-team-select"
        >
          {sortedReports.map((report) => (
            <option key={report.teamId} value={report.teamId}>
              #{report.recruitingRank ?? "-"} {report.teamName}
            </option>
          ))}
        </select>
      </label>
      {signees.length ? (
        <>
          <div className="table-list signee-list">
            {visibleSignees.map((signee) => (
              <SigneeRow key={signee.recruitId} signee={signee} onOpen={() => setSelectedSigneeId(signee.recruitId)} />
            ))}
          </div>
          <PaginationControls page={currentSigneePage} pageCount={signeePageCount} total={signees.length} pageSize={signeePageSize} label="signees" onPageChange={setSigneePage} />
        </>
      ) : (
        <p className="muted">Signing day has not posted yet.</p>
      )}
      {selectedSignee && <SignedRecruitModal signee={selectedSignee} recruit={selectedRecruit} teamName={selected?.teamName ?? "Signed program"} teams={teams} onClose={() => setSelectedSigneeId(undefined)} />}
    </section>
  );
}

function SigneeRow({ signee, onOpen }: { signee: RecruitSigning; onOpen: () => void }) {
  return (
    <button className="table-row signee-row clickable" onClick={onOpen} data-testid="signee-row">
      <Stars count={signee.stars} />
      <strong>{signee.playerName}</strong>
      <span>{signee.position}</span>
      <span>#{signee.nationalRank}</span>
      <span>OVR/POT {signee.overall}/{signee.potential}</span>
    </button>
  );
}

function SignedRecruitModal({ signee, recruit, teamName, teams, onClose }: { signee: RecruitSigning; recruit?: Recruit; teamName: string; teams: Team[]; onClose: () => void }) {
  const teamById = new Map(teams.map((team) => [team.id, team.name]));
  const topSchools = recruit
    ? Object.entries(recruit.interest)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
    : [];
  return (
    <div className="modal-backdrop recruit-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="player-modal recruit-modal" role="dialog" aria-modal="true" aria-label={`${signee.playerName} signed recruit detail`} onMouseDown={(event) => event.stopPropagation()} data-testid="signed-recruit-modal">
        <div className="modal-head">
          <div className="card-title">
            <Portrait index={recruit?.profileIndex ?? signee.nationalRank % 14} />
            <div>
              <p className="eyebrow">Signed Prospect</p>
              <h2>{signee.playerName}</h2>
              <p>
                {signee.position} - <Stars count={signee.stars} /> - #{signee.nationalRank} - {teamName}
              </p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close signed recruit detail">
            <X size={18} />
          </button>
        </div>
        <div className="recruit-modal-grid">
          <section className="modal-panel">
            <div className="panel-head compact">
              <h3>Signing Summary</h3>
              <Handshake size={18} />
            </div>
            <div className="metric-grid compact-metrics">
              <Metric label="Overall" value={signee.overall} />
              <Metric label="Potential" value={signee.potential} />
              <Metric label="Trait" value={title(signee.trait)} />
              <Metric label="Rank" value={`#${signee.nationalRank}`} />
            </div>
            <p className="muted">{recruit ? `${recruit.hometown} - ${recruit.stage}` : "Signed recruit summary from the offseason report."}</p>
          </section>
          <section className="modal-panel" data-testid="signed-recruit-attributes">
            <div className="panel-head compact">
              <h3>Attributes</h3>
              <LineChart size={18} />
            </div>
            {recruit ? (
              <div className="attribute-grid mini-attributes">
                {ATTRIBUTE_KEYS.map((key) => (
                  <span key={key}>
                    {shortAttr(key)} <strong>{recruit.attributes[key]}</strong>
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted">Detailed attributes are unavailable for this saved signee.</p>
            )}
          </section>
          <section className="modal-panel">
            <div className="panel-head compact">
              <h3>School Interest</h3>
              <TrendingUp size={18} />
            </div>
            {topSchools.length ? (
              <div className="school-interest-list">
                {topSchools.map(([teamId, interest], index) => (
                  <div key={teamId} className={clsx("school-interest-row", teamId === recruit?.committedTeamId && "user-school")}>
                    <span>#{index + 1}</span>
                    <strong>{teamById.get(teamId) ?? teamId}</strong>
                    <em>{recruit?.offers.includes(teamId) ? "Offer" : "-"}</em>
                    <div className="interest-meter">
                      <i style={{ width: `${Math.min(100, Math.round((interest / 150) * 100))}%` }} />
                    </div>
                    <span>{formatRecruitInterest(interest)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Interest history is unavailable for this signee.</p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function ProgressionGroup({
  team,
  progressions,
}: {
  team?: Team;
  progressions: PlayerProgression[];
}) {
  const isCompactMobile = useCompactMobile();
  const pageSize = isCompactMobile ? MOBILE_PROGRESSION_PAGE_SIZE : PROGRESSION_PAGE_SIZE;
  const [page, setPage] = useState(1);
  const progressionByPlayer = new Map(progressions.map((progression) => [progression.playerId, progression]));
  const rosterRows = team
    ? [...team.roster]
        .filter((player) => !player.incomingFreshman)
        .map((player) => {
          const progression = progressionByPlayer.get(player.id);
          return {
            id: player.id,
            name: player.name,
            position: player.position,
            year: progression ? `${progression.fromYear}->${progression.toYear}` : player.year,
            beforeOverall: progression?.beforeOverall ?? player.overall,
            afterOverall: progression?.afterOverall ?? player.overall,
            delta: progression ? progression.afterOverall - progression.beforeOverall : 0,
            potential: progression?.potential ?? player.potential,
            status: player.walkOn ? "Walk-on" : title(player.development),
            gains: progression ? attributeGainText(progression.attributeGains) : "No reported movement",
          };
        })
        .sort((a, b) => b.delta - a.delta || b.afterOverall - a.afterOverall || POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position) || a.name.localeCompare(b.name))
    : [...progressions]
        .sort((a, b) => (b.afterOverall - b.beforeOverall) - (a.afterOverall - a.beforeOverall) || b.afterOverall - a.afterOverall || POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position) || a.playerName.localeCompare(b.playerName))
        .map((progression) => ({
          id: progression.playerId,
          name: progression.playerName,
          position: progression.position,
          year: `${progression.fromYear}->${progression.toYear}`,
          beforeOverall: progression.beforeOverall,
          afterOverall: progression.afterOverall,
          delta: progression.afterOverall - progression.beforeOverall,
          potential: progression.potential,
          status: "Returning",
          gains: attributeGainText(progression.attributeGains),
        }));
  const pageCount = Math.max(1, Math.ceil(rosterRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rosterRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => {
    setPage(1);
  }, [pageSize, progressions.length, team?.id]);
  return (
    <section className="offseason-column" data-testid="preseason-progression-panel">
      <div className="panel-head compact">
        <h3>Preseason Development</h3>
        <span className="muted">{rosterRows.length} returning players</span>
      </div>
      {rosterRows.length ? (
        <div className="table-list progression-list full-roster-development">
          <div className="development-header">
            <span>Player</span>
            <span>Pos</span>
            <span>Year</span>
            <span>OVR</span>
            <span>Pot</span>
            <span>Status</span>
            <span>Attribute Movement</span>
          </div>
          {visibleRows.map((row) => (
            <div key={row.id} className="table-row progression-row">
              <strong className="development-name">{row.name}</strong>
              <span className="development-position">{row.position}</span>
              <span className="development-year">{row.year}</span>
              <span className="development-ovr" data-label="OVR">
                {`${row.beforeOverall}->${row.afterOverall}`} <em className={row.delta > 0 ? "positive" : undefined}>{row.delta > 0 ? `+${row.delta}` : "+0"}</em>
              </span>
              <span className="development-potential" data-label="POT">{row.potential}</span>
              <span className="development-status" data-label="DEV">{row.status}</span>
              <span className="development-gains">{row.gains}</span>
            </div>
          ))}
          {rosterRows.length > pageSize && <PaginationControls page={currentPage} pageCount={pageCount} total={rosterRows.length} pageSize={pageSize} label="development" onPageChange={setPage} />}
        </div>
      ) : (
        <p className="muted">Development posts in preseason week.</p>
      )}
    </section>
  );
}

function RosterCutdownGroup({ team, cuts }: { team?: Team; cuts: NonNullable<DynastyState["offseasonReport"]>["teams"][number]["cuts"] }) {
  return (
    <section className="offseason-column" data-testid="preseason-cutdown-panel">
      <div className="panel-head compact">
        <h3>Roster Cutdown</h3>
        <span className="muted">{team ? `${team.roster.length}/${ROSTER_LIMIT} players` : `${ROSTER_LIMIT} player limit`}</span>
      </div>
      <div className="metric-grid compact-metrics">
        <Metric label="Roster" value={team ? `${team.roster.length}/${ROSTER_LIMIT}` : "-"} />
        <Metric label="Cuts" value={cuts.length} />
        <Metric label="Position Floor" value={ROSTER_FLOOR_TOTAL} />
      </div>
      {cuts.length ? (
        <div className="table-list cut-list">
          {cuts.map((cut) => (
            <div key={cut.playerId} className="table-row cut-row">
              <strong className="cut-name">{cut.playerName}</strong>
              <span className="cut-position">{cut.position}</span>
              <span className="cut-year">{cut.year}</span>
              <span className="cut-overall">OVR {cut.overall}</span>
              <span className="cut-potential">POT {cut.potential}</span>
              <span className="cut-note">{cut.note}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No cuts needed. The roster is at or below the {ROSTER_LIMIT}-player limit.</p>
      )}
    </section>
  );
}

function ProgramChangeGroup({ changes }: { changes: ProgramChange[] }) {
  return (
    <section className="offseason-column program-review-panel" data-testid="program-review-panel">
      <h3>Program Review</h3>
      {changes.length ? (
        <div className="table-list program-change-list">
          {changes.map((change) => (
            <div key={change.key} className="table-row program-change-row">
              <strong className="program-change-title">{title(String(change.key))}</strong>
              <span className={clsx(change.delta > 0 ? "positive" : "negative", "program-change-delta")}>
                {change.delta > 0 ? `+${change.delta}` : change.delta}
              </span>
              <span className="program-change-range">{`${change.before}->${change.after}`}</span>
              <span className="program-change-reason">{change.reason}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Program investment movement posts after development week.</p>
      )}
    </section>
  );
}

function DepartureGroup({ title: groupTitle, departures }: { title: string; departures: PlayerDeparture[] }) {
  const isCompactMobile = useCompactMobile();
  const pageSize = isCompactMobile ? MOBILE_DEPARTURE_PAGE_SIZE : DEPARTURE_PAGE_SIZE;
  const [page, setPage] = useState(1);
  const sortedDepartures = [...departures].sort((a, b) => b.overall - a.overall || a.playerName.localeCompare(b.playerName));
  const pageCount = Math.max(1, Math.ceil(sortedDepartures.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleDepartures = sortedDepartures.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => {
    setPage(1);
  }, [pageSize, departures.length]);

  const showDepartureNote = (note: string) => {
    return !note.includes("completed eligibility") && !/OVR declared after/.test(note);
  };

  return (
    <section className="offseason-column" data-testid={groupTitle === "Graduated" ? "graduated-panel" : "pro-departures-panel"}>
      <h3>{groupTitle}</h3>
      {departures.length ? (
        <>
          <div className="table-list departure-list">
            {visibleDepartures.map((departure) => (
              <div key={departure.playerId} className={clsx("table-row departure-row", isCompactMobile && "departure-row-mobile")}>
                <strong>{departure.playerName}</strong>
                {isCompactMobile ? (
                  <div className="departure-meta-line">
                    <span className="departure-meta-pill">{departure.position}</span>
                    <span className="departure-meta-pill">{departure.year}</span>
                    <span className="departure-meta-pill">OVR {departure.overall}</span>
                  </div>
                ) : (
                  <>
                    <span>{departure.position}</span>
                    <span>{departure.year}</span>
                    <span>OVR {departure.overall}</span>
                  </>
                )}
                {showDepartureNote(departure.note) ? <span className="departure-note">{departure.note}</span> : null}
              </div>
            ))}
          </div>
          {sortedDepartures.length > pageSize && <PaginationControls page={currentPage} pageCount={pageCount} total={sortedDepartures.length} pageSize={pageSize} label={`${groupTitle.toLowerCase()} departures`} onPageChange={setPage} />}
        </>
      ) : (
        <p className="muted">No players in this group.</p>
      )}
    </section>
  );
}

function Roster({ state, onUpdate, onOpenPlayer }: { state: DynastyState; onUpdate: (recipe: (state: DynastyState) => DynastyState) => void; onOpenPlayer: (player: Player) => void }) {
  const [selectedTeamId, setSelectedTeamId] = useState(state.userTeamId);
  const [positionFilter, setPositionFilter] = useState<RosterFilter>("ALL");
  const [rosterView, setRosterView] = useState<RosterView>("roster");
  useEffect(() => {
    if (!state.teams.some((candidate) => candidate.id === selectedTeamId)) {
      setSelectedTeamId(state.userTeamId);
    }
  }, [selectedTeamId, state.teams, state.userTeamId]);
  const team = state.teams.find((candidate) => candidate.id === selectedTeamId) ?? getUserTeam(state);
  const isUserTeam = team.id === state.userTeamId;
  const conference = state.conferences.find((candidate) => candidate.id === team.conferenceId);
  const units = teamUnitRatings(team.roster);
  const teamOptions = [...state.teams].sort((a, b) => a.name.localeCompare(b.name));
  const sorted = [...team.roster].sort((a, b) => effectiveOverall(b) - effectiveOverall(a) || b.potential - a.potential || b.overall - a.overall);
  const filtered = positionFilter === "ALL" ? sorted : sorted.filter((player) => player.position === positionFilter);
  const depthChart = buildDepthChart(team, ROSTER_DEPTH_LIMIT);

  const movePlayer = (position: Position, playerId: string, direction: "up" | "down") => {
    if (!isUserTeam) return;
    onUpdate((current) => ({
      ...current,
      teams: current.teams.map((candidate) => (candidate.id === team.id ? moveDepthChartPlayer(candidate, position, playerId, direction) : candidate)),
    }));
  };

  return (
    <>
      <section className="panel span-2" data-testid="roster-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Roster Room</p>
            <h2>{team.name}</h2>
            <p className="muted">{team.roster.length} players - {conference?.name ?? "Independent"} - OVR {units.overall}</p>
          </div>
          <Users size={20} />
        </div>
        <RosterTeamPicker
          team={team}
          teamOptions={teamOptions}
          userTeamId={state.userTeamId}
          onSelectTeam={(teamId) => {
            setSelectedTeamId(teamId);
          }}
        />
        <div className="roster-view-switch" data-testid="roster-view-switch">
          <button className={clsx(rosterView === "roster" && "active")} onClick={() => setRosterView("roster")}>
            <Users size={16} />
            Roster List
          </button>
          <button className={clsx(rosterView === "depth" && "active")} onClick={() => setRosterView("depth")}>
            <ClipboardList size={16} />
            Depth Chart
          </button>
        </div>
        {rosterView === "roster" ? (
          <RosterList players={filtered} positionFilter={positionFilter} onPositionFilterChange={setPositionFilter} onOpenPlayer={onOpenPlayer} />
        ) : (
          <DepthChartPanel depthChart={depthChart} isUserTeam={isUserTeam} onOpenPlayer={onOpenPlayer} onMovePlayer={movePlayer} />
        )}
      </section>
    </>
  );
}

function RosterTeamPicker({
  team,
  teamOptions,
  userTeamId,
  onSelectTeam,
}: {
  team: Team;
  teamOptions: Team[];
  userTeamId: string;
  onSelectTeam: (teamId: string) => void;
}) {
  return (
    <div className="filter-grid compact-filters roster-team-picker" data-testid="roster-team-picker">
      <label>
        Program
        <select value={team.id} onChange={(event) => onSelectTeam(event.target.value)} data-testid="roster-team-select">
          {teamOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}{option.id === userTeamId ? " (your program)" : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="team-summary-strip" data-testid="roster-view-team-summary">
        <TeamHelmet team={team} size="sm" />
        <span>{teamIdentity(team)}</span>
        <span>{team.season.wins}-{team.season.losses}</span>
        <span>Power {teamPower(team.roster)}</span>
      </div>
    </div>
  );
}

function RosterList({
  players,
  positionFilter,
  onPositionFilterChange,
  onOpenPlayer,
}: {
  players: Player[];
  positionFilter: RosterFilter;
  onPositionFilterChange: (position: RosterFilter) => void;
  onOpenPlayer: (player: Player) => void;
}) {
  const isCompactMobile = useCompactMobile();
  const pageSize = isCompactMobile ? MOBILE_ROSTER_PAGE_SIZE : ROSTER_PAGE_SIZE;
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(players.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visiblePlayers = players.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => {
    setPage(1);
  }, [positionFilter, pageSize, players.length]);
  return (
    <div className="roster-workspace">
      <div className="roster-controls" data-testid="position-filter">
        {(["ALL", ...POSITIONS] as RosterFilter[]).map((position) => (
          <button key={position} className={clsx(positionFilter === position && "active")} onClick={() => onPositionFilterChange(position)}>
            {position}
          </button>
        ))}
      </div>
      {players.length ? (
        <>
          <div className="roster-list" data-testid="roster-list">
            {visiblePlayers.map((player) => {
              const adjustedOverall = effectiveOverall(player);
              return (
                <button key={player.id} className="roster-row" onClick={() => onOpenPlayer(player)}>
                  <Portrait index={player.profileIndex} />
                  <strong>{player.name}</strong>
                  <span>{player.position}</span>
                  <span>{player.incomingFreshman ? `${player.year} In` : player.year}{player.walkOn ? " - Walk-on" : ""}</span>
                  <span title={adjustedOverall === player.overall ? undefined : `Base OVR ${player.overall}`}>
                    {adjustedOverall === player.overall ? "OVR" : "Eff"} {adjustedOverall}
                  </span>
                  <StreakBadge player={player} />
                  <span>Pot {player.potential}</span>
                </button>
              );
            })}
          </div>
          {players.length > pageSize && <PaginationControls page={currentPage} pageCount={pageCount} total={players.length} pageSize={pageSize} label="roster" onPageChange={setPage} />}
        </>
      ) : (
        <div className="empty-state">
          <strong>No players match this position filter.</strong>
          <p>Choose All or another position to continue browsing the roster.</p>
        </div>
      )}
    </div>
  );
}

function DepthChartPanel({
  depthChart,
  isUserTeam,
  onOpenPlayer,
  onMovePlayer,
}: {
  depthChart: ReturnType<typeof buildDepthChart>;
  isUserTeam: boolean;
  onOpenPlayer: (player: Player) => void;
  onMovePlayer: (position: Position, playerId: string, direction: "up" | "down") => void;
}) {
  return (
    <div className="depth-chart-surface" data-testid="depth-chart-panel">
      <div className="depth-chart-header">
        <div>
          <h2>Depth Chart</h2>
          <p className="muted">{isUserTeam ? "Editable for your program. Top reserves stay compact but can be rotated down." : "View only for other programs."}</p>
        </div>
        <ClipboardList size={20} />
      </div>
      <div className="depth-grid">
        {depthChart.map((slot) => (
          <article key={slot.position} className="depth-card" data-testid={`depth-slot-${slot.position}`}>
            <div className="depth-card-head">
              <p className="eyebrow">{slot.position}</p>
              <span className="depth-card-count">Top {slot.players.length} of {slot.totalPlayers}</span>
            </div>
            {slot.players.length ? (
              slot.players.map((player, index) => (
                <div key={player.id} className={clsx("depth-player-row", !isUserTeam && "view-only")}>
                  <button className="depth-main" onClick={() => onOpenPlayer(player)}>
                    <span className="depth-rank">{index + 1}</span>
                    <strong className="depth-name">{player.name}</strong>
                    <em className="depth-overall">OVR {effectiveOverall(player)}</em>
                    <StreakBadge player={player} compact showNeutral={false} />
                  </button>
                  {isUserTeam && (
                    <div className="depth-actions">
                      <button className="icon-button small" onClick={() => onMovePlayer(slot.position, player.id, "up")} disabled={index === 0} aria-label={`Move ${player.name} up`}>
                        <ArrowUp size={15} />
                      </button>
                      <button className="icon-button small" onClick={() => onMovePlayer(slot.position, player.id, "down")} disabled={index + 1 >= slot.totalPlayers} aria-label={`Move ${player.name} down`}>
                        <ArrowDown size={15} />
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="muted">No active players at this position.</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function PlayerModal({ player, activeTab, onTabChange, onClose }: { player: Player; activeTab: PlayerModalTab; onTabChange: (tab: PlayerModalTab) => void; onClose: () => void }) {
  const statRows = playerStatRows(player);
  const awardRows = playerCareerAwardRows(player);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="player-modal" role="dialog" aria-modal="true" aria-label={`${player.name} player card`} onMouseDown={(event) => event.stopPropagation()} data-testid="player-modal">
        <div className="modal-head">
          <div className="modal-title">
            <Portrait index={player.profileIndex} />
            <div>
              <p className="eyebrow">{player.position} - {player.year}{player.incomingFreshman ? " - Incoming" : ""}{player.walkOn ? " - Walk-on" : ""}</p>
              <h2>{player.name}</h2>
              <p className="muted">
                OVR {player.overall} - Potential {player.potential} - {player.hometown}
              </p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close player card">
            <X size={18} />
          </button>
        </div>
        <div className="modal-tabs">
          {(["profile", "stats", "attributes", "awards"] as PlayerModalTab[]).map((tab) => (
            <button key={tab} className={clsx(activeTab === tab && "active")} onClick={() => onTabChange(tab)}>
              {title(tab)}
            </button>
          ))}
        </div>
        {activeTab === "profile" && (
          <div className="modal-section">
            <div className="metric-grid">
              <Metric label="Overall" value={player.overall} />
              <Metric label="Potential" value={player.potential} />
              <Metric label="Development" value={player.development} />
              <Metric label="Origin" value={player.walkOn ? "Walk-on" : "Scholarship"} />
              <Metric label="Form" value={player.streak ? `${title(player.streak.status)} ${player.streak.weeks}w` : "Neutral"} />
            </div>
            {player.streak && <p className="muted">{player.streak.note}: {attributeGainText(player.streak.attributeBoosts)}</p>}
            <p className="muted">Career rows are recorded each offseason before the player advances class year.</p>
          </div>
        )}
        {activeTab === "stats" && (
          <div className="table-list compact-table">
            {statRows.map((row) => (
              <div key={row.label} className="table-row stat-row">
                <strong>{row.label}</strong>
                <span>{row.stats.games} GP</span>
                <span>{row.stats.passCompletions}/{row.stats.passAttempts} ({completionPct(row.stats)})</span>
                <span>{row.stats.passYards} PYD</span>
                <span>{row.stats.rushAttempts} ATT</span>
                <span>{row.stats.rushYards} RYD</span>
                <span>{row.stats.receivingTargets} TGT</span>
                <span>{row.stats.receivingYards} REC</span>
                <span>{row.stats.tackles} TKL</span>
                <span>{row.stats.interceptions} INT</span>
                <span>{row.stats.pancakes} PAN</span>
                <span>{row.stats.fieldGoals}/{row.stats.fieldGoalAttempts} FG</span>
                <span>{row.stats.extraPoints}/{row.stats.extraPointAttempts} XP</span>
              </div>
            ))}
          </div>
        )}
        {activeTab === "attributes" && (
          <div className="attribute-grid" data-testid="attributes-panel">
            {ATTRIBUTE_KEYS_FOR_UI.map((key) => (
              <div key={key} className="unit-bar">
                <span>{title(key)}</span>
                <strong>{player.attributes[key]}</strong>
                <div>
                  <i style={{ width: `${player.attributes[key]}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab === "awards" && (
          <div className="award-history">
            {awardRows.length ? (
              awardRows.map((award) => (
                <span key={award.label}>{award.label}{award.count > 1 ? ` x${award.count}` : ""}</span>
              ))
            ) : (
              <p className="muted">No awards yet.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function StreakBadge({ player, compact = false, showNeutral = true }: { player: Player; compact?: boolean; showNeutral?: boolean }) {
  if (!player.streak) return showNeutral ? <span className={clsx("streak-badge neutral", compact && "compact")}>Neutral</span> : null;
  const Icon = player.streak.status === "hot" ? Flame : Snowflake;
  return (
    <span className={clsx("streak-badge", player.streak.status, compact && "compact")} title={player.streak.note}>
      <Icon size={compact ? 12 : 14} />
      {title(player.streak.status)}
    </span>
  );
}

function Recruiting({ state, onUpdate }: { state: DynastyState; onUpdate: (recipe: (state: DynastyState) => DynastyState) => void }) {
  const userTeam = getUserTeam(state);
  const [positionFilter, setPositionFilter] = useState<RecruitPositionFilter>("ALL");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [starsFilter, setStarsFilter] = useState<RecruitStarsFilter>("ALL");
  const [commitmentFilter, setCommitmentFilter] = useState<RecruitCommitmentFilter>("all");
  const [pipelineOnly, setPipelineOnly] = useState(false);
  const [sortBy, setSortBy] = useState<RecruitSort>("rank");
  const [boardPage, setBoardPage] = useState(1);
  const [recruitPage, setRecruitPage] = useState(1);
  const [selectedRecruitId, setSelectedRecruitId] = useState<string>();
  const isCompactMobile = useCompactMobile();
  const boardPageSize = isCompactMobile ? MOBILE_BOARD_PAGE_SIZE : BOARD_PAGE_SIZE;
  const recruitPageSize = isCompactMobile ? MOBILE_RECRUIT_PAGE_SIZE : RECRUIT_PAGE_SIZE;
  const seasonBudget = state.recruiting.seasonBudget ?? state.recruiting.weeklyPoints;
  const pointsSpent = state.recruiting.pointsSpent ?? Math.max(0, seasonBudget - state.recruiting.pointsRemaining);
  const boardLimit = state.recruiting.boardLimit ?? 35;
  const { teamNameById, board, boardFull, needCommandRows, stateOptions, matchingRecruits } = buildRecruitingViewModel({
    userTeam,
    teams: state.teams,
    recruits: state.recruits,
    boardIds: state.recruiting.board,
    boardLimit,
    positionFilter,
    stateFilter,
    starsFilter,
    commitmentFilter,
    pipelineOnly,
    sortBy,
  });
  const boardPageCount = Math.max(1, Math.ceil(board.length / boardPageSize));
  const currentBoardPage = Math.min(boardPage, boardPageCount);
  const visibleBoard = board.slice((currentBoardPage - 1) * boardPageSize, currentBoardPage * boardPageSize);
  const recruitPageCount = Math.max(1, Math.ceil(matchingRecruits.length / recruitPageSize));
  const currentRecruitPage = Math.min(recruitPage, recruitPageCount);
  const visibleRecruits = matchingRecruits.slice((currentRecruitPage - 1) * recruitPageSize, currentRecruitPage * recruitPageSize);
  const selectedRecruit = selectedRecruitId ? state.recruits.find((recruit) => recruit.id === selectedRecruitId) : undefined;
  const resetRecruitPage = () => setRecruitPage(1);
  useEffect(() => {
    setBoardPage(1);
    setRecruitPage(1);
  }, [boardPageSize, recruitPageSize]);

  return (
    <>
      <section className="panel span-2">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Recruiting Board</p>
            <h2>
              {state.recruiting.pointsRemaining.toLocaleString()} / {seasonBudget.toLocaleString()} season points
            </h2>
            <p className="muted">Board {board.length}/{boardLimit} - weekly estimate {state.recruiting.weeklyPoints.toLocaleString()} - spent {pointsSpent.toLocaleString()}</p>
          </div>
          <button
            className="primary"
            data-testid="auto-recruit"
            onClick={() => {
              setBoardPage(1);
              onUpdate((current) => autoRecruit(current, "Manual auto-recruit run."));
            }}
            disabled={state.recruiting.pointsRemaining < MIN_RECRUITING_ACTION_COST}
          >
            <Search size={18} />
            Auto Recruit
          </button>
        </div>
        <div className="metric-grid recruiting-budget-grid" data-testid="recruiting-budget-panel">
          <Metric label="Remaining" value={state.recruiting.pointsRemaining.toLocaleString()} />
          <Metric label="Spent" value={pointsSpent.toLocaleString()} />
          <Metric label="Board Cap" value={`${board.length}/${boardLimit}`} />
          <Metric label="Points Return" value="Commitments" />
        </div>
        <div className="recruiting-need-command" data-testid="recruiting-needs-panel">
          <div className="need-command-legend">
            <span>Roster</span>
            <span>Need</span>
            <span>Board</span>
            <span>Offers</span>
            <span>Pledges</span>
          </div>
          <div className="need-command-grid">
            {needCommandRows.map((row) => (
              <button
                key={row.position}
                className={clsx("need-command-card", positionFilter === row.position && "active", row.need > 0 && "urgent")}
                onClick={() => {
                  setPositionFilter(row.position);
                  resetRecruitPage();
                }}
                data-testid={`need-command-${row.position}`}
              >
                <strong>{row.position}</strong>
                <span>{row.current}/{row.target}</span>
                <em>{row.need > 0 ? `Need ${row.need}` : "OK"}</em>
                <small>B{row.boardCount}</small>
                <small>O{row.offerCount}</small>
                <small>P{row.committedCount}</small>
                <i>
                  <b style={{ width: `${row.meterPercent}%` }} />
                </i>
              </button>
            ))}
          </div>
        </div>
        {board.length ? (
          <div className="recruit-grid" data-testid="recruiting-board">
            {visibleBoard.map((recruit) => (
              <RecruitCard key={recruit.id} recruit={recruit} userTeam={userTeam} onUpdate={onUpdate} onOpen={setSelectedRecruitId} onBoard pointsRemaining={state.recruiting.pointsRemaining} boardFull={boardFull} week={state.week} />
            ))}
          </div>
        ) : (
          <div className="empty-state recruiting-empty-state" data-testid="recruiting-board">
            <strong>No prospects on your board</strong>
            <p>Use the recruiting database below, Need Command cards, or Auto Recruit to add real board targets.</p>
          </div>
        )}
        {board.length > boardPageSize && <PaginationControls page={currentBoardPage} pageCount={boardPageCount} total={board.length} pageSize={boardPageSize} label="board targets" onPageChange={setBoardPage} />}
      </section>

      <section className="panel span-2">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Recruiting Database</p>
            <h2>{matchingRecruits.length} matching prospects</h2>
          </div>
          <Shield size={20} />
        </div>
        <div className="filter-grid" data-testid="recruit-filter-panel">
          <label>
            Position
            <select value={positionFilter} onChange={(event) => { setPositionFilter(event.target.value as RecruitPositionFilter); resetRecruitPage(); }} data-testid="recruit-position-filter">
              {(["ALL", ...POSITIONS] as RecruitPositionFilter[]).map((position) => (
                <option key={position} value={position}>{position}</option>
              ))}
            </select>
          </label>
          <label>
            State
            <select value={stateFilter} onChange={(event) => { setStateFilter(event.target.value); resetRecruitPage(); }} data-testid="recruit-state-filter">
              <option value="ALL">All states</option>
              {stateOptions.map((stateName) => (
                <option key={stateName} value={stateName}>{stateName}{stateName === userTeam.state ? " (pipeline)" : ""}</option>
              ))}
            </select>
          </label>
          <label>
            Stars
            <select value={starsFilter} onChange={(event) => { setStarsFilter(event.target.value as RecruitStarsFilter); resetRecruitPage(); }} data-testid="recruit-stars-filter">
              <option value="ALL">All stars</option>
              {[5, 4, 3, 2, 1].map((stars) => (
                <option key={stars} value={stars}>{stars} stars</option>
              ))}
            </select>
          </label>
          <label>
            Sort
            <select value={sortBy} onChange={(event) => { setSortBy(event.target.value as RecruitSort); resetRecruitPage(); }}>
              <option value="rank">Rank number</option>
              <option value="interest">Interest</option>
              <option value="stars">Stars</option>
              <option value="need">Team need</option>
            </select>
          </label>
          <label>
            Commitment
            <select value={commitmentFilter} onChange={(event) => { setCommitmentFilter(event.target.value as RecruitCommitmentFilter); resetRecruitPage(); }} data-testid="recruit-commitment-filter">
              <option value="all">All prospects</option>
              <option value="open">Uncommitted only</option>
              <option value="committed">Committed only</option>
            </select>
          </label>
          <label className="check-label">
            <input type="checkbox" checked={pipelineOnly} onChange={(event) => { setPipelineOnly(event.target.checked); resetRecruitPage(); }} />
            Pipeline only
          </label>
        </div>
        <div className="table-list recruit-table" data-testid="recruiting-database">
          {visibleRecruits.map((recruit) => (
            <button key={recruit.id} className="table-row clickable" onClick={() => setSelectedRecruitId(recruit.id)} data-testid="recruit-row">
              <Stars count={recruit.stars} />
              <strong>{recruit.name}</strong>
              <span>{recruit.position}</span>
              <span>#{recruit.nationalRank}</span>
              <span>{recruit.hometown}{isPipelineRecruit(userTeam, recruit) ? " - Pipeline" : ""}</span>
              <span>{formatRecruitInterest(recruit.interest[userTeam.id] ?? 0)}</span>
              <span className={clsx("status-pill", recruit.committedTeamId && "committed")}>
                {recruit.committedTeamId ? `Committed to ${teamNameById.get(recruit.committedTeamId) ?? "another school"}` : recruit.stage}
              </span>
            </button>
          ))}
        </div>
        <PaginationControls page={currentRecruitPage} pageCount={recruitPageCount} total={matchingRecruits.length} pageSize={recruitPageSize} label="recruits" onPageChange={setRecruitPage} />
      </section>
      {selectedRecruit && (
        <RecruitModal
          recruit={selectedRecruit}
          teams={state.teams}
          userTeam={userTeam}
          week={state.week}
          pointsRemaining={state.recruiting.pointsRemaining}
          onBoard={board.some((item) => item.id === selectedRecruit.id)}
          boardFull={boardFull}
          onClose={() => setSelectedRecruitId(undefined)}
          onUpdate={onUpdate}
        />
      )}
    </>
  );
}

function RecruitCard({
  recruit,
  userTeam,
  onUpdate,
  onOpen,
  onBoard,
  pointsRemaining,
  boardFull,
  week,
}: {
  recruit: Recruit;
  userTeam: Team;
  onUpdate: (recipe: (state: DynastyState) => DynastyState) => void;
  onOpen: (recruitId: string) => void;
  onBoard: boolean;
  pointsRemaining: number;
  boardFull: boolean;
  week: number;
}) {
  const known = recruit.knownAttributes.slice(0, 5);
  const eligibility = recruitActionEligibility({ recruit, userTeam, onBoard, boardFull, pointsRemaining, week });
  return (
    <article className="card recruit-card">
      <div className="card-title">
        <Portrait index={recruit.profileIndex} />
        <div>
          <strong>{recruit.name}</strong>
          <p>
            {recruit.position} - <Stars count={recruit.stars} /> - #{recruit.nationalRank}
            {isPipelineRecruit(userTeam, recruit) ? " - Pipeline" : ""}
          </p>
        </div>
      </div>
      <div className="mini-metrics">
        <span>Interest {formatRecruitInterest(recruit.interest[userTeam.id] ?? 0)}</span>
        <span>{eligibility.statusLabel}</span>
        <span>Scout {recruit.scoutProgress}%</span>
      </div>
      <div className="known-attrs">
        {known.length ? known.map((key) => <span key={key}>{shortAttr(key)} {recruit.attributes[key]}</span>) : <span>No ratings unlocked</span>}
      </div>
      <p className={clsx("trait-chip", recruit.gemBust)}>{recruit.traitRevealed ? recruit.hiddenTrait : recruit.gemBust ? gemBustFor(recruit) : "trait hidden"}</p>
      <RecruitActionButtons recruit={recruit} eligibility={eligibility} onBoard={onBoard} onUpdate={onUpdate} onOpen={onOpen} variant="card" />
    </article>
  );
}

function RecruitActionButtons({
  recruit,
  eligibility,
  onBoard,
  onUpdate,
  onOpen,
  variant,
}: {
  recruit: Recruit;
  eligibility: ReturnType<typeof recruitActionEligibility>;
  onBoard: boolean;
  onUpdate: (recipe: (state: DynastyState) => DynastyState) => void;
  onOpen?: (recruitId: string) => void;
  variant: "card" | "modal";
}) {
  const compact = variant === "card";
  return (
    <div className={clsx("button-row", compact && "compact-row", variant === "modal" && "recruit-action-row")}>
      {onOpen && (
        <button className="secondary" onClick={() => onOpen(recruit.id)}>
          Details
        </button>
      )}
      {onBoard ? (
        <button className="secondary" onClick={() => onUpdate((state) => removeRecruitFromBoard(state, recruit.id))}>
          {compact ? "Remove" : "Remove Board"}
        </button>
      ) : (
        <button className="secondary" onClick={() => onUpdate((state) => addRecruitToBoard(state, recruit.id))} disabled={!eligibility.canAdd}>
          {compact ? "Add" : "Add Board"}
        </button>
      )}
      {eligibility.offered ? (
        <button className="secondary" onClick={() => onUpdate((state) => rescindScholarship(state, recruit.id))} disabled={!eligibility.canRescind}>
          {compact ? "Rescind" : "Rescind Scholarship"}
        </button>
      ) : (
        <button className="secondary" onClick={() => onUpdate((state) => offerScholarship(state, recruit.id))} disabled={!eligibility.canOffer}>
          {compact ? "Offer" : "Offer Scholarship"}
        </button>
      )}
      <button className="secondary" onClick={() => onUpdate((state) => scoutRecruit(state, recruit.id))} disabled={!eligibility.canScout}>
        Scout
      </button>
      <button className="primary" onClick={() => onUpdate((state) => pitchRecruit(state, recruit.id))} disabled={!eligibility.canPitch}>
        Pitch
      </button>
    </div>
  );
}

function RecruitModal({
  recruit,
  teams,
  userTeam,
  week,
  pointsRemaining,
  onBoard,
  boardFull,
  onClose,
  onUpdate,
}: {
  recruit: Recruit;
  teams: Team[];
  userTeam: Team;
  week: number;
  pointsRemaining: number;
  onBoard: boolean;
  boardFull: boolean;
  onClose: () => void;
  onUpdate: (recipe: (state: DynastyState) => DynastyState) => void;
}) {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const eligibility = recruitActionEligibility({ recruit, userTeam, onBoard, boardFull, pointsRemaining, week });
  const topSchools = rankedRecruitSchoolInterests(recruit);
  const userRank = topSchools.findIndex(([teamId]) => teamId === userTeam.id) + 1;
  const userRankLabel = recruit.topSchools.length ? "Outside current cut" : "Outside Top 10";
  const priorities = Object.entries(recruit.priorities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="modal-backdrop recruit-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="player-modal recruit-modal" role="dialog" aria-modal="true" aria-label={`${recruit.name} recruit detail`} onMouseDown={(event) => event.stopPropagation()} data-testid="recruit-modal">
        <div className="modal-head">
          <div className="card-title">
            <Portrait index={recruit.profileIndex} />
            <div>
              <p className="eyebrow">Prospect Detail</p>
              <h2>{recruit.name}</h2>
              <p>
                {recruit.position} - <Stars count={recruit.stars} /> - #{recruit.nationalRank} - {recruit.hometown}
              </p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close recruit detail">
            <X size={18} />
          </button>
        </div>
        <div className="recruit-modal-grid">
          <section className="modal-panel recruit-interest-panel">
            <div className="panel-head compact">
              <h3>School Interest</h3>
              <TrendingUp size={18} />
            </div>
            <p className="muted">Top schools update each week until the prospect pledges or signs.</p>
            <div className="school-interest-list" data-testid="recruit-school-list">
              {topSchools.map(([teamId, interest], index) => {
                const team = teamById.get(teamId);
                const hasOffer = recruit.offers?.includes(teamId);
                const isUser = teamId === userTeam.id;
                return (
                  <div key={teamId} className={clsx("school-interest-row", isUser && "user-school")}>
                    <span>#{index + 1}</span>
                    <strong>{team?.name ?? teamId}</strong>
                    <em>{hasOffer ? "Offer" : "-"}</em>
                    <div className="interest-meter">
                      <i style={{ width: `${Math.min(100, Math.round((interest / 150) * 100))}%` }} />
                    </div>
                    <span>{formatRecruitInterest(interest)}</span>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="modal-panel recruit-plan-panel">
            <div className="panel-head compact">
              <h3>Recruiting Plan</h3>
              <Handshake size={18} />
            </div>
            <div className="mini-metrics modal-metrics">
              <span>{eligibility.offered ? "Scholarship sent" : "No scholarship"}</span>
              <span>{userRank ? `Your rank #${userRank}` : userRankLabel}</span>
              <span>Pitch: {eligibility.pitchStatus}</span>
            </div>
            <div className="known-attrs">
              {priorities.map(([key, value]) => (
                <span key={key}>{title(key)} {value}/10</span>
              ))}
            </div>
            <div className="known-attrs">
              {recruit.knownAttributes.length ? recruit.knownAttributes.slice(0, 6).map((key) => <span key={key}>{shortAttr(key)} {recruit.attributes[key]}</span>) : <span>No ratings unlocked</span>}
            </div>
            <RecruitActionButtons recruit={recruit} eligibility={eligibility} onBoard={onBoard} onUpdate={onUpdate} variant="modal" />
          </section>
        </div>
      </section>
    </div>
  );
}

interface RecruitActionEligibilityInput {
  recruit: Recruit;
  userTeam: Team;
  onBoard: boolean;
  boardFull: boolean;
  pointsRemaining: number;
  week: number;
}

function recruitActionEligibility({ recruit, userTeam, onBoard, boardFull, pointsRemaining, week }: RecruitActionEligibilityInput) {
  const committedElsewhere = Boolean(recruit.committedTeamId && recruit.committedTeamId !== userTeam.id);
  const lockedCommitment = Boolean(recruit.committedTeamId);
  const offered = recruit.offers?.includes(userTeam.id) ?? false;
  const pitchedThisWeek = recruit.lastPitchWeek === week;
  const boardBlocked = boardFull && !onBoard;
  const canAdd = !onBoard && !boardBlocked && !lockedCommitment;
  const canRescind = offered && !lockedCommitment;
  const canOffer = !offered && !boardBlocked && pointsRemaining >= OFFER_COST && !lockedCommitment;
  const canScout = recruit.scoutProgress < 100 && !boardBlocked && pointsRemaining >= SCOUT_COST && !lockedCommitment;
  const canPitch = offered && !pitchedThisWeek && !boardBlocked && pointsRemaining >= PITCH_COST && !lockedCommitment;
  const statusLabel = committedElsewhere ? "Committed elsewhere" : lockedCommitment ? "Committed" : offered ? "Scholarship sent" : recruit.stage;
  const pitchStatus = committedElsewhere
    ? "Committed elsewhere"
    : lockedCommitment
      ? "Committed"
      : boardBlocked
        ? "Board full"
        : !offered
          ? "Scholarship required"
          : pitchedThisWeek
            ? `Available Week ${week + 1}`
            : pointsRemaining < PITCH_COST
              ? "Not enough points"
              : "Ready";

  return {
    offered,
    canAdd,
    canRescind,
    canOffer,
    canScout,
    canPitch,
    statusLabel,
    pitchStatus,
  };
}

function formatRecruitInterest(score: number): string {
  return `${score}/150`;
}

function Schedule({ state }: { state: DynastyState }) {
  const userTeam = getUserTeam(state);
  const [selectedGame, setSelectedGame] = useState<Game | undefined>();
  const [gamePage, setGamePage] = useState(1);
  const isCompactMobile = useCompactMobile();
  const gamePageSize = isCompactMobile ? MOBILE_SCHEDULE_PAGE_SIZE : SCHEDULE_PAGE_SIZE;
  const matchupPreview = buildMatchupPreview(state);
  const games = scheduleGamesForDisplay(state, userTeam.id);
  const gamePageCount = Math.max(1, Math.ceil(games.length / gamePageSize));
  const currentGamePage = Math.min(gamePage, gamePageCount);
  const visibleGames = games.slice((currentGamePage - 1) * gamePageSize, currentGamePage * gamePageSize);
  const standings = [...state.teams]
    .filter((team) => team.conferenceId === userTeam.conferenceId)
    .sort((a, b) => b.season.confWins - a.season.confWins || a.season.confLosses - b.season.confLosses || b.season.wins - a.season.wins);
  useEffect(() => {
    setGamePage(1);
  }, [gamePageSize, state.phase, state.week]);
  return (
    <>
      <MatchupPreviewPanel preview={matchupPreview} testId="schedule-matchup-preview" />
      <section className="panel">
        <div className="panel-head compact">
          <h2>Conference Race</h2>
          <CalendarDays size={20} />
        </div>
        <ol className="rank-list">
          {standings.map((team, index) => (
            <li key={team.id}>
              <span>{index + 1}</span>
              <strong>{team.name}</strong>
              <em>
                {team.season.confWins}-{team.season.confLosses}
              </em>
            </li>
          ))}
        </ol>
      </section>
      <section className="panel span-2">
        <div className="panel-head compact">
          <h2>Games</h2>
          <Trophy size={20} />
        </div>
        <div className="table-list">
          {visibleGames.map((game) => {
            const home = state.teams.find((team) => team.id === game.homeTeamId);
            const away = state.teams.find((team) => team.id === game.awayTeamId);
            return (
              <button key={game.id} className="table-row clickable" onClick={() => setSelectedGame(game)} data-testid="game-row">
                <span>W{game.week}</span>
                <strong>
                  {away?.abbreviation} at {home?.abbreviation}
                </strong>
                <span>{game.bowlName ?? (game.conferenceGame ? "Conference" : "Non-conf")}</span>
                <span>{game.result?.summary ?? "Pending"}</span>
              </button>
            );
          })}
        </div>
        {games.length > gamePageSize && <PaginationControls page={currentGamePage} pageCount={gamePageCount} total={games.length} pageSize={gamePageSize} label="games" onPageChange={setGamePage} />}
      </section>
      {selectedGame && <GameModal game={selectedGame} teams={state.teams} onClose={() => setSelectedGame(undefined)} />}
    </>
  );
}

function scheduleGamesForDisplay(state: DynastyState, userTeamId: string): Game[] {
  const gamesById = new Map([...state.schedule, ...(state.playoff?.games ?? [])].map((game) => [game.id, game]));
  return [...gamesById.values()]
    .filter((game) => game.homeTeamId === userTeamId || game.awayTeamId === userTeamId || game.week === state.week)
    .sort((a, b) => {
      const userGameDelta = Number(b.homeTeamId === userTeamId || b.awayTeamId === userTeamId) - Number(a.homeTeamId === userTeamId || a.awayTeamId === userTeamId);
      if (userGameDelta) return userGameDelta;
      const currentWeekDelta = Number(b.week === state.week) - Number(a.week === state.week);
      if (currentWeekDelta) return currentWeekDelta;
      return a.week - b.week || a.id.localeCompare(b.id);
    })
    .slice(0, 24);
}

function MatchupPreviewPanel({ preview, testId }: { preview?: MatchupPreviewData; testId: string }) {
  if (!preview) {
    return (
      <section className="panel span-2 matchup-panel" data-testid={testId}>
        <div className="panel-head compact">
          <div>
            <p className="eyebrow">Weekly Matchup Preview</p>
            <h2>No pending user game</h2>
            <p className="muted">The next matchup will appear when a user-team game is on the calendar.</p>
          </div>
          <CalendarDays size={20} />
        </div>
      </section>
    );
  }
  const opponentLabel = preview.venue === "Home" ? `vs ${preview.opponent.name}` : preview.venue === "Away" ? `at ${preview.opponent.name}` : preview.opponent.name;
  return (
    <section className="panel span-2 matchup-panel" data-testid={testId}>
      <div className="panel-head">
        <div>
          <p className="eyebrow">Week {preview.game.week} Matchup Preview</p>
          <h2>{opponentLabel}</h2>
          <p className="muted">{preview.venue} - {preview.venueLabel}</p>
        </div>
        <CalendarDays size={20} />
      </div>
      <div className="matchup-head-to-head">
        <div className="matchup-team-card">
          <TeamHelmet team={preview.userTeam} size="md" />
          <div>
            <strong>{preview.userTeam.name}</strong>
            <span>{preview.userTeam.season.wins}-{preview.userTeam.season.losses}{preview.userRank ? ` - #${preview.userRank}` : ""}</span>
          </div>
          <em>{preview.userPower}</em>
        </div>
        <div className="matchup-versus">vs</div>
        <div className="matchup-team-card">
          <TeamHelmet team={preview.opponent} size="md" />
          <div>
            <strong>{preview.opponent.name}</strong>
            <span>{preview.opponent.season.wins}-{preview.opponent.season.losses}{preview.opponentRank ? ` - #${preview.opponentRank}` : ""}</span>
          </div>
          <em>{preview.opponentPower}</em>
        </div>
      </div>
      <div className="matchup-stakes">
        {preview.stakes.map((stake) => (
          <span key={stake}>{stake}</span>
        ))}
      </div>
      <div className="matchup-edge-grid">
        {preview.unitEdges.map((unit) => (
          <div key={unit.label} className={clsx("matchup-edge", unit.edge >= 0 ? "advantage" : "deficit")}>
            <span>{unit.label}</span>
            <strong>{unit.userValue} / {unit.opponentValue}</strong>
            <em>{unit.edge >= 0 ? "+" : ""}{unit.edge}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function GameModal({ game, teams, onClose }: { game: Game; teams: Team[]; onClose: () => void }) {
  const home = teams.find((team) => team.id === game.homeTeamId);
  const away = teams.find((team) => team.id === game.awayTeamId);
  const boxScore = game.result?.boxScore;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="player-modal game-modal" role="dialog" aria-modal="true" aria-label="Game box score" onMouseDown={(event) => event.stopPropagation()} data-testid="box-score-modal">
        <div className="modal-head">
          <div>
            <p className="eyebrow">Week {game.week} - {game.bowlName ?? (game.conferenceGame ? "Conference" : "Non-conference")}</p>
            <h2>{away?.name} at {home?.name}</h2>
            <p className="muted">{game.result?.summary ?? "Game has not been played yet."}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close box score">
            <X size={18} />
          </button>
        </div>
        {boxScore ? (
          <>
            <div className="box-score-grid">
              <TeamBoxScorePanel box={boxScore.away} />
              <TeamBoxScorePanel box={boxScore.home} />
            </div>
            <section className="play-by-play-panel" data-testid="play-by-play-panel">
              <div className="panel-head compact">
                <h3>Play By Play</h3>
                <ClipboardList size={18} />
              </div>
              <div className="play-by-play-list">
                {(game.result?.playByPlay ?? []).map((event, index) => (
                  <div key={`${event.teamId}-${event.quarter}-${event.clock}-${index}`} className="play-event">
                    <span>#{event.playNumber ?? index + 1} Q{event.quarter} {event.clock}</span>
                    <strong>{event.teamName}</strong>
                    <em>
                      <b>{playMeta(event)}</b>
                      {event.description}
                    </em>
                    <b>{event.awayScore}-{event.homeScore}</b>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <div className="metric-grid">
            <Metric label={away?.abbreviation ?? "Away"} value={away ? teamPower(away.roster) : "-"} />
            <Metric label={home?.abbreviation ?? "Home"} value={home ? teamPower(home.roster) : "-"} />
          </div>
        )}
      </section>
    </div>
  );
}

function TeamBoxScorePanel({ box }: { box: TeamBoxScore }) {
  return (
    <article className="box-score-team">
      <div className="box-score-head">
        <h3>{box.teamName}</h3>
        <strong>{box.score}</strong>
      </div>
      <div className="mini-metrics">
        <span>{strategyLabel(box.strategy)} - {box.plays} plays</span>
        <span>{box.totals.passCompletions}/{box.totals.passAttempts} passing ({completionPct(box.totals)}), {box.totals.passYards} pass, {box.totals.passTd} PaTD</span>
        <span>{box.totals.rushAttempts} rushes, {box.totals.rushYards} rush, {box.totals.rushTd} RuTD</span>
        <span>{box.totals.receivingTargets} targets, {box.totals.receivingYards} rec, {box.totals.receivingTd} RecTD</span>
        <span>{box.totals.fieldGoals}/{box.totals.fieldGoalAttempts} FG, {box.totals.extraPoints}/{box.totals.extraPointAttempts} XP</span>
        <span>{box.totals.tackles} tackles, {box.totals.pancakes} pancakes</span>
      </div>
      <div className="box-player-list">
        {box.players.map((line) => (
          <PlayerGameLine key={line.playerId} line={line} />
        ))}
      </div>
    </article>
  );
}

function PlayerGameLine({ line }: { line: PlayerGameStats }) {
  return (
    <div className="box-player-row">
      <strong>{line.playerName}</strong>
      <span>{line.position}</span>
      <em>{gameLineSummary(line.stats)}</em>
    </div>
  );
}

function Program({ state, onUpdate }: { state: DynastyState; onUpdate: (recipe: (state: DynastyState) => DynastyState) => void }) {
  const team = getUserTeam(state);
  const programKeys: (keyof ProgramRatings)[] = ["academics", "facilities", "training", "recruitingReach", "fanSupport", "prestige"];
  const canShowCoachPool = state.phase === "postseason" || state.phase === "offseason";
  const canEditBlueprint = canEditProgramBlueprint(state);
  const storedBlueprint = ensureProgramBlueprint(team, state.calendarYear);
  const blueprintRecruitingRank = state.offseasonReport?.year === storedBlueprint.year ? state.offseasonReport?.userRecruitingRank : undefined;
  const blueprint = evaluateProgramBlueprint(team, storedBlueprint, blueprintRecruitingRank, storedBlueprint.resolved);
  const remaining = blueprintRemaining(blueprint);
  const spent = blueprintSpent(blueprint);
  const selectedStrategy = offensiveStrategyOptions.find((option) => option.value === team.offensiveStrategy) ?? offensiveStrategyOptions[0]!;
  const strategyUnits = teamUnitRatings(team.roster);
  return (
    <>
      <section className="panel span-2" data-testid="strategy-panel">
        <div className="panel-head compact">
          <div>
            <p className="eyebrow">Team Strategy</p>
            <h2>Offensive Identity</h2>
            <p className="muted">{selectedStrategy.description}</p>
          </div>
          <LineChart size={20} />
        </div>
        <div className="program-control-grid">
          <label>
            Offensive Strategy
            <select value={team.offensiveStrategy ?? "balanced"} onChange={(event) => onUpdate((current) => setUserOffensiveStrategy(current, event.target.value as OffensiveStrategy))} data-testid="offensive-strategy-select">
              {offensiveStrategyOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <div className="strategy-summary">
            <Metric label="Pass Unit" value={strategyUnits.passing} />
            <Metric label="Run Unit" value={strategyUnits.rushing} />
            <Metric label="Blocking" value={strategyUnits.blocking} />
          </div>
        </div>
      </section>
      <section className="panel span-2" data-testid="program-blueprint-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Annual Program Blueprint</p>
            <h2>Director Goals and Program Points</h2>
            <p className="muted">{canEditBlueprint ? "Set or change the season plan before kickoff. Any unused points auto-assign when Week 1 advances." : blueprint.resolved ? "This blueprint resolved during the offseason review; the next plan opens before kickoff." : "Season plan is locked through the year and reopens after offseason development."}</p>
          </div>
          <button className="secondary" onClick={() => onUpdate(autoAllocateProgramBlueprint)} disabled={!canEditBlueprint}>
            <Wrench size={16} />
            Auto Build
          </button>
        </div>
        <div className="program-control-grid">
          <label>
            Blueprint Focus
            <select value={blueprint.focus} onChange={(event) => onUpdate((current) => setProgramBlueprintFocus(current, event.target.value as BlueprintFocus))} disabled={!canEditBlueprint} data-testid="blueprint-focus-select">
              {blueprintFocusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <p className="muted">{blueprint.focus === "custom" ? "Manual allocation is active. Use the plus buttons to shape the plan." : "Preset focus fills the annual plan immediately and can still be changed before kickoff."}</p>
        </div>
        <div className="metric-grid blueprint-summary">
          <Metric label="Total Points" value={blueprint.totalPoints} />
          <Metric label="Spent" value={spent} />
          <Metric label="Remaining" value={remaining} />
          <Metric label="Status" value={blueprint.resolved ? "Resolved" : canEditBlueprint ? "Open" : "Locked"} />
        </div>
        <div className="blueprint-grid">
          {BLUEPRINT_CATEGORY_META.map((category) => {
            const Icon = blueprintIcons[category.key];
            const value = blueprint.allocations[category.key];
            return (
              <article key={category.key} className="blueprint-card">
                <div className="blueprint-card-head">
                  <Icon size={19} />
                  <div>
                    <h3>{category.label}</h3>
                    <p>{category.effect}</p>
                  </div>
                  <button className="icon-button blueprint-add" onClick={() => onUpdate((current) => allocateBlueprintPoint(current, category.key))} disabled={!canEditBlueprint || remaining <= 0 || value >= MAX_BLUEPRINT_CATEGORY_POINTS} aria-label={`Add ${category.label}`} title={`Add ${category.label}`}>
                    <Plus size={16} />
                  </button>
                </div>
                <div className="blueprint-pips" aria-label={`${category.label} allocation ${value}`}>
                  {Array.from({ length: MAX_BLUEPRINT_CATEGORY_POINTS }, (_, index) => (
                    <span key={index} className={clsx(index < value && "filled")} />
                  ))}
                </div>
              </article>
            );
          })}
        </div>
        <section className="director-goals" data-testid="director-goals-panel">
          <div className="panel-head compact">
            <h3>Director Goals</h3>
            <ClipboardList size={18} />
          </div>
          <div className="goal-grid">
            {blueprint.goals.map((goal) => (
              <article key={goal.id} className={clsx("goal-card", goal.status)}>
                <div>
                  <strong>{goal.title}</strong>
                  <span>{goal.targetLabel}</span>
                </div>
                <em>{goal.progressLabel}</em>
                <p>{goal.note}</p>
              </article>
            ))}
          </div>
        </section>
        {team.lastBlueprint?.resolved && team.lastBlueprint.year !== blueprint.year && (
          <section className="director-goals" data-testid="director-review-panel">
            <div className="panel-head compact">
              <h3>{team.lastBlueprint.year} Director Review</h3>
              <Award size={18} />
            </div>
            <div className="goal-grid">
              {team.lastBlueprint.goals.map((goal) => (
                <article key={goal.id} className={clsx("goal-card", goal.status)}>
                  <div>
                    <strong>{goal.title}</strong>
                    <span>{goal.targetLabel}</span>
                  </div>
                  <em>{goal.progressLabel}</em>
                  <p>{goal.note}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
      <section className="panel span-2">
        <div className="panel-head compact">
          <h2>Program Investments</h2>
          <BadgeDollarSign size={20} />
        </div>
        <div className="investment-grid">
          {programKeys.map((key) => {
            const Icon = programIcons[key];
            return (
              <button key={key} className="investment" onClick={() => onUpdate((current) => investProgramPoint(current, key))} disabled={team.programPoints <= 0}>
                <Icon size={20} />
                <span>{title(String(key))}</span>
                <strong>{team.program[key] ?? 0}</strong>
              </button>
            );
          })}
        </div>
      </section>
      <ProgramHistory state={state} />
      <section className="panel span-2">
        <div className="panel-head compact">
          <h2>Staff Room</h2>
          <UserRound size={20} />
        </div>
        <div className="staff-grid">
          {Object.values(team.coaches).map((coach) => (
            <CoachCard key={coach.id} coach={coach} onUpdate={onUpdate} />
          ))}
        </div>
      </section>
      {canShowCoachPool && (
        <section className="panel span-2" data-testid="coach-pool-panel">
          <div className="panel-head compact">
            <h2>Coach Pool</h2>
            <Users size={20} />
          </div>
          <div className="coach-pool-grid">
            {state.coachPool.slice(0, 18).map((coach) => (
              <button key={coach.id} className="coach-pool-card" onClick={() => onUpdate((current) => hireCoach(current, coach.id))}>
                <CoachPortrait index={coach.portraitIndex ?? 0} />
                <strong>{coach.name}</strong>
                <span>{coach.role} - {coach.scheme}</span>
                <em>Rec {coach.recruiting} - Dev {coach.development}</em>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function CoachCard({ coach, onUpdate }: { coach: Coach; onUpdate: (recipe: (state: DynastyState) => DynastyState) => void }) {
  return (
    <article className="card coach-card">
      <div className="card-title">
        <CoachPortrait index={coach.portraitIndex ?? 0} />
        <div>
          <p className="eyebrow">{coach.role} - {coach.scheme}</p>
          <h3>{coach.name}</h3>
        </div>
      </div>
      <div className="mini-metrics">
        <InfoStat label="Rec" value={coach.recruiting} titleText="Recruiting: increases weekly points, pitch strength, and coach market value." />
        <InfoStat label="Dev" value={coach.development} titleText="Development: improves offseason player growth with training and facilities." />
        <InfoStat label="Tac" value={coach.tactics} titleText="Tactics: gives a small game-simulation power boost and affects coach movement." />
        <span>Pts {coach.points}</span>
      </div>
      <div className="button-row compact-row">
        <button className="secondary" onClick={() => onUpdate((current) => spendCoachPoint(current, coach.role, "recruiting"))} disabled={coach.points <= 0} title="Improve recruiting">
          Rec
        </button>
        <button className="secondary" onClick={() => onUpdate((current) => spendCoachPoint(current, coach.role, "development"))} disabled={coach.points <= 0} title="Improve player development">
          Dev
        </button>
        <button className="secondary" onClick={() => onUpdate((current) => spendCoachPoint(current, coach.role, "tactics"))} disabled={coach.points <= 0} title="Improve game tactics">
          Tac
        </button>
      </div>
    </article>
  );
}

function InfoStat({ label, value, titleText }: { label: string; value: number; titleText: string }) {
  return (
    <span className="info-stat" title={titleText}>
      {label} {value}
      <CircleHelp size={13} />
    </span>
  );
}

function Debug({ state, onUpdate, onReset }: { state: DynastyState; onUpdate: (recipe: (state: DynastyState) => DynastyState) => void; onReset: () => void }) {
  return (
    <>
      <section className="panel span-2" data-testid="debug-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Deterministic QA Controls</p>
            <h2>Force and smoke-test dynasty paths</h2>
          </div>
          <button className="secondary" onClick={onReset}>
            <RotateCcw size={18} />
            Reset Save
          </button>
        </div>
        <div className="debug-grid">
          <button onClick={() => onUpdate(forceUserPlayoff)}>Force User Playoff</button>
          <button onClick={() => onUpdate(forceUserAward)}>Force User Award</button>
          <button onClick={() => onUpdate(forceUserWalkOnNeed)}>Force Walk-on Need</button>
          <button onClick={() => onUpdate((current) => autoRecruit(current, "Debug auto-recruit executed."))}>Run Auto Recruit</button>
          <button data-testid="sim-three-seasons" onClick={() => onUpdate((current) => simulateSeasons(current, 3))}>Sim 3 Seasons</button>
          <button onClick={() => onUpdate((current) => simulateSeasons(current, 20))}>Sim To End</button>
        </div>
        <div className="log">
          {state.debugLog.slice(0, 12).map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
        </div>
      </section>
    </>
  );
}

function Stars({ count }: { count: number }) {
  return (
    <span className="stars" aria-label={`${count} stars`}>
      {Array.from({ length: count }, (_, index) => (
        <Star key={index} size={14} fill="currentColor" />
      ))}
    </span>
  );
}

function Portrait({ index }: { index: number }) {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return <span className="portrait" style={{ backgroundImage: `url("${publicAsset("assets/portrait-sprite.png")}")`, backgroundPosition: `${column * 33.333}% ${row * 33.333}%` }} aria-hidden="true" />;
}

function CoachPortrait({ index }: { index: number }) {
  const column = index % 5;
  const row = Math.floor(index / 5);
  return <span className="coach-portrait" style={{ backgroundImage: `url("${publicAsset("assets/coach-portrait-sprite.png")}")`, backgroundPosition: `${column * 25}% ${row * 100}%` }} aria-hidden="true" />;
}

function Feature({ icon: Icon, text }: { icon: typeof Shield; text: string }) {
  return (
    <div className="feature">
      <Icon size={20} />
      <span>{text}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function advanceMultipleWeeks(state: DynastyState, weeks: number): DynastyState {
  let next = state;
  for (let index = 0; index < weeks && next.phase !== "complete"; index += 1) {
    next = advanceWeek(next);
  }
  return next;
}

function tabAfterAdvance(_previous: DynastyState, _next: DynastyState): Tab {
  return "overview";
}

function isOffseasonAutoRecruitReady(state: DynastyState): boolean {
  const report = state.offseasonReport;
  return state.phase === "offseason" && Boolean(report?.departuresReviewed) && !report?.signingComplete && state.week <= 19 && state.recruiting.autoEnabled;
}

function phaseWeekLabel(state: DynastyState): string {
  if (state.phase === "postseason" && state.playoff?.championTeamId) return "postseason - championship recap";
  if (state.phase === "offseason") {
    if (state.offseasonReport && !state.offseasonReport.departuresReviewed) return "offseason departures";
    if (isOffseasonAutoRecruitReady(state)) return "offseason auto recruiting ready";
    if (!state.offseasonReport?.signingComplete && state.week <= 19) return `offseason recruiting week ${Math.max(1, state.week - 15)} of 4`;
    if (!state.offseasonReport?.signingComplete) return "offseason signing day - ready";
    if (state.offseasonReport?.signingComplete && !state.offseasonReport.developmentComplete) return "offseason signing day - classes posted";
    return "offseason player development";
  }
  if (state.phase === "preseason" && state.offseasonReport?.developmentComplete) {
    if (!state.offseasonReport.programReviewComplete) return "preseason development results";
    return "preseason program review";
  }
  if (state.phase === "preseason") return "preseason week";
  return `${state.phase} - Week ${state.week}`;
}

function advanceActionLabel(state: DynastyState): string {
  if (state.phase === "complete") return "Dynasty Complete";
  if (state.phase === "postseason") return state.playoff?.championTeamId ? "Advance to Offseason" : "Advance Round";
  if (state.phase === "offseason") {
    const report = state.offseasonReport;
    if (report && !report.departuresReviewed) return "Advance to Recruiting";
    if (isOffseasonAutoRecruitReady(state)) return "Run Auto Recruiting";
    if (!report?.signingComplete && state.week <= 19) return "Advance Recruiting Week";
    if (!report?.signingComplete) return "Run Signing Day";
    if (report.signingComplete && !report.developmentComplete) return "Run Player Development";
    return "Advance to Preseason";
  }
  if (state.phase === "preseason") {
    if (state.offseasonReport?.developmentComplete && !state.offseasonReport.programReviewComplete) return "Advance to Program Review";
    return "Start Season";
  }
  return "Advance Week";
}

function offseasonStageLabel(state: DynastyState, report: NonNullable<DynastyState["offseasonReport"]>): string {
  const stage = offseasonStage(state, report);
  if (stage === "departures") return "Offseason Departures";
  if (stage === "recruiting" && state.recruiting.autoEnabled) return "Offseason Auto Recruiting Ready";
  if (stage === "recruiting") return `Offseason Recruiting Week ${Math.min(4, Math.max(1, state.week - 15))} of 4`;
  if (stage === "signing") return report.signingComplete ? "Offseason Signing Day" : "Offseason Signing Day Ready";
  if (stage === "development") return "Preseason Development";
  return "Preseason Program Review";
}

function offseasonStage(state: DynastyState, report: NonNullable<DynastyState["offseasonReport"]>): OffseasonStage {
  if (report.developmentComplete) return report.programReviewComplete ? "programReview" : "development";
  if (report.signingComplete || state.week > 19) return "signing";
  if (!report.departuresReviewed) return "departures";
  return "recruiting";
}

function attributeGainText(gains: Partial<Record<AttributeKey, number>>): string {
  const entries = Object.entries(gains)
    .filter(([, value]) => value !== undefined && value !== 0)
    .sort((a, b) => Math.abs(Number(b[1])) - Math.abs(Number(a[1])))
    .slice(0, 4);
  if (!entries.length) return "No attribute movement";
  return entries.map(([key, value]) => `${Number(value) > 0 ? "+" : ""}${value} ${shortAttr(key as AttributeKey)}`).join(", ");
}

function teamIdentity(team: Team): string {
  const power = teamPower(team.roster);
  if (power >= 78) return "National contender";
  if (team.program.prestige >= 75) return "Tradition power";
  if (team.program.training >= 78 || team.program.facilities >= 78) return "Development factory";
  if (team.program.academics >= 78) return "Academic standard";
  if (power < 65) return "Rebuild opportunity";
  return "Balanced program";
}

function programRating(team: Team): number {
  const { prestige, academics, facilities, training, recruitingReach, fanSupport } = team.program;
  return Math.round((prestige + academics + facilities + training + recruitingReach + fanSupport) / 6);
}

function shortAttr(key: AttributeKey): string {
  return key
    .replace("throwPower", "THP")
    .replace("accuracy", "ACC")
    .replace("awareness", "AWR")
    .replace("catching", "CTH")
    .replace("interception", "INT")
    .replace("defAwareness", "DAW")
    .replace("runBlock", "RBK")
    .replace("passBlock", "PBK")
    .replace("routeRunning", "RTE")
    .replace("kickPower", "KPW")
    .replace("kickAccuracy", "KAC")
    .replace("speed", "SPD")
    .replace("tackle", "TAK");
}

function title(value: string): string {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function strategyLabel(value?: OffensiveStrategy): string {
  if (value === "airRaid") return "Air Raid";
  if (value === "runHeavy") return "Run Heavy";
  if (value === "proStyle") return "Pro Style";
  if (value === "spreadTempo") return "Spread Tempo";
  return "Balanced";
}

function playerStatRows(player: Player): { label: string; stats: PlayerStats }[] {
  const career = (player.careerStats ?? []).map((entry) => ({
    label: `${entry.year} ${entry.teamName} ${entry.collegeYear}`,
    stats: entry.stats,
  }));
  return [
    ...career,
    {
      label: `Current ${player.year}`,
      stats: player.stats,
    },
  ];
}

function playerCareerAwardRows(player: Player): { label: string; count: number }[] {
  const awards = player.careerAwards?.length ? player.careerAwards : player.awards;
  const counts = new Map<string, number>();
  for (const award of awards) {
    const label = award.replace(/^\d{4}\s+/, "");
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function gameLineSummary(stats: PlayerStats): string {
  const parts: string[] = [];
  if (stats.passAttempts || stats.passYards || stats.passTd || stats.interceptionsThrown) parts.push(`${stats.passCompletions}/${stats.passAttempts} (${completionPct(stats)}), ${stats.passYards} PYD, ${stats.passTd} PaTD, ${stats.interceptionsThrown} INT`);
  if (stats.rushAttempts || stats.rushYards || stats.rushTd) parts.push(`${stats.rushAttempts} ATT, ${stats.rushYards} RYD, ${stats.rushTd} RuTD`);
  if (stats.receivingYards || stats.receivingTd || stats.receivingTargets) parts.push(`${stats.receivingTargets} TGT, ${stats.receivingYards} REC, ${stats.receivingTd} RecTD`);
  if (stats.tackles || stats.sacks || stats.interceptions) parts.push(`${stats.tackles} TKL, ${stats.sacks} SCK, ${stats.interceptions} INT`);
  if (stats.pancakes) parts.push(`${stats.pancakes} PAN`);
  if (stats.fieldGoalAttempts) parts.push(`${stats.fieldGoals}/${stats.fieldGoalAttempts} FG`);
  if (stats.extraPointAttempts) parts.push(`${stats.extraPoints}/${stats.extraPointAttempts} XP`);
  return parts.join(" | ") || "Appeared";
}

function completionPct(stats: PlayerStats): string {
  return stats.passAttempts ? `${Math.round((stats.passCompletions / stats.passAttempts) * 100)}%` : "0%";
}

function playMeta(event: PlayByPlayEvent): string {
  const parts: string[] = [];
  if (event.down && event.distance !== undefined) parts.push(`${ordinalDown(event.down)} & ${event.distance}`);
  if (event.yardLine) parts.push(event.yardLine);
  if (event.yards !== undefined) parts.push(`${event.yards > 0 ? "+" : ""}${event.yards} yd`);
  return parts.join(" - ");
}

function ordinalDown(down: 1 | 2 | 3 | 4): string {
  if (down === 1) return "1st";
  if (down === 2) return "2nd";
  if (down === 3) return "3rd";
  return "4th";
}
