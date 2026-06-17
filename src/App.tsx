import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  Award,
  ArrowDown,
  ArrowUp,
  BadgeDollarSign,
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
  LineChart,
  MapPinned,
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
  OFFER_COST,
  offerScholarship,
  pitchRecruit,
  PITCH_COST,
  positionNeeds,
  removeRecruitFromBoard,
  rescindScholarship,
  SCOUT_COST,
  scoutRecruit,
} from "./sim/recruiting";
import { createDynasty } from "./sim/generate";
import { advanceWeek, allocateBlueprintPoint, autoAllocateProgramBlueprint, canEditProgramBlueprint, forceUserAward, forceUserPlayoff, forceUserWalkOnNeed, getUserTeam, hireCoach, investProgramPoint, simulateSeasons, spendCoachPoint } from "./sim/dynasty";
import { clearDynasty, loadActiveDynasty, saveDynasty } from "./sim/storage";
import { buildDepthChart, moveDepthChartPlayer } from "./sim/depthChart";
import { effectiveOverall, teamPower, teamUnitRatings } from "./sim/ratings";
import { buildMatchupPreview, type MatchupPreview as MatchupPreviewData } from "./sim/matchup";
import { POSITIONS, type AttributeKey, type BlueprintCategory, type Coach, type Conference, type DynastyState, type Game, type Player, type PlayerDeparture, type PlayerGameStats, type PlayerProgression, type PlayerStats, type Position, type ProgramChange, type ProgramRatings, type Recruit, type RecruitSigning, type Team, type TeamBoxScore } from "./sim/types";
import { Awards, AwardGrid, PlayoffBracket } from "./components/AwardsView";
import { PaginationControls } from "./components/PaginationControls";
import { Rankings } from "./components/RankingsView";
import { TeamHelmet } from "./components/TeamHelmet";
import { APP_VERSION } from "./version";
import { BLUEPRINT_CATEGORY_META, MAX_BLUEPRINT_CATEGORY_POINTS, blueprintRemaining, blueprintSpent, ensureProgramBlueprint, evaluateProgramBlueprint } from "./sim/blueprint";

type Tab = "overview" | "rankings" | "roster" | "recruiting" | "schedule" | "awards" | "program" | "debug";
type RosterFilter = "ALL" | Position;
type PlayerModalTab = "profile" | "stats" | "attributes" | "awards";
type RecruitPositionFilter = "ALL" | Position;
type RecruitStarsFilter = "ALL" | "1" | "2" | "3" | "4" | "5";
type RecruitSort = "rank" | "interest" | "stars" | "need";
type RecruitCommitmentFilter = "all" | "open" | "committed";

const tabs: { id: Tab; label: string; icon: typeof LineChart }[] = [
  { id: "overview", label: "Overview", icon: LineChart },
  { id: "rankings", label: "Rankings", icon: TrendingUp },
  { id: "roster", label: "Roster", icon: Users },
  { id: "recruiting", label: "Recruiting", icon: Search },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "awards", label: "Awards", icon: Trophy },
  { id: "program", label: "Program", icon: GraduationCap },
  { id: "debug", label: "Debug", icon: Wrench },
];

const RECRUIT_PAGE_SIZE = 25;

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

export default function App() {
  const previewWorld = useMemo(() => createDynasty(20260616), []);
  const [selectedTeamId, setSelectedTeamId] = useState(previewWorld.userTeamId);
  const [state, setState] = useState<DynastyState>();
  const [savedState, setSavedState] = useState<DynastyState>();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [saveStatus, setSaveStatus] = useState("Local DB ready");

  useEffect(() => {
    loadActiveDynasty().then((loaded) => {
      if (loaded) setSavedState(loaded);
    });
  }, []);

  useEffect(() => {
    if (!state) return;
    const timeout = window.setTimeout(() => {
      saveDynasty(state)
        .then(() => setSaveStatus(`Saved Year ${state.year}, Week ${state.week}`))
        .catch(() => setSaveStatus("Save failed"));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [state]);

  const startDynasty = () => {
    const dynasty = createDynasty(dynastySeed(), selectedTeamId);
    setState(dynasty);
    setActiveTab("overview");
  };

  const continueDynasty = () => {
    if (savedState) {
      setState(savedState);
      setActiveTab("overview");
    }
  };

  const resetAll = async () => {
    await clearDynasty();
    setState(undefined);
    setSavedState(undefined);
    setSaveStatus("Local save cleared");
  };

  const update = (recipe: (current: DynastyState) => DynastyState) => {
    setState((current) => (current ? recipe(current) : current));
  };

  if (!state) {
    return (
      <HomeScreen
        teams={previewWorld.teams}
        conferences={previewWorld.conferences}
        selectedTeamId={selectedTeamId}
        savedState={savedState}
        onSelectTeam={setSelectedTeamId}
        onStart={startDynasty}
        onContinue={continueDynasty}
        onReset={resetAll}
      />
    );
  }

  const userTeam = getUserTeam(state);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">
            Campus Gridiron Dynasty <span className="version-pill">{APP_VERSION}</span>
          </p>
          <h1>{userTeam.name}</h1>
          <p className="muted">
            Year {state.year} of {state.maxYears} - {state.calendarYear} - {phaseWeekLabel(state)}
          </p>
          <p className="save-status">{saveStatus}</p>
        </div>
        <div className="topbar-actions">
          <button className="secondary" onClick={() => saveDynasty(state).then(() => setSaveStatus("Saved manually"))}>
            <Save size={18} />
            Save
          </button>
          <button className="secondary" data-testid="sim-month" onClick={() => update((current) => advanceMultipleWeeks(current, 4))} disabled={state.phase === "complete"}>
            <ChevronsRight size={18} />
            Sim 4 Weeks
          </button>
          <button className="primary" data-testid="advance-week" onClick={() => update(advanceWeek)} disabled={state.phase === "complete"}>
            <ChevronsRight size={18} />
            Advance Week
          </button>
        </div>
      </header>

      <nav className="tabbar" aria-label="Dynasty sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} className={clsx("tab", activeTab === tab.id && "active")} onClick={() => setActiveTab(tab.id)} aria-label={tab.label}>
              <Icon size={17} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <main className="content-grid">
        {activeTab === "overview" && <Overview state={state} onUpdate={update} onNavigate={setActiveTab} />}
        {activeTab === "rankings" && <Rankings state={state} />}
        {activeTab === "roster" && <Roster state={state} onUpdate={update} />}
        {activeTab === "recruiting" && <Recruiting state={state} onUpdate={update} />}
        {activeTab === "schedule" && <Schedule state={state} />}
        {activeTab === "awards" && <Awards state={state} />}
        {activeTab === "program" && <Program state={state} onUpdate={update} />}
        {activeTab === "debug" && <Debug state={state} onUpdate={update} onReset={resetAll} />}
      </main>
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
  onSelectTeam,
  onStart,
  onContinue,
  onReset,
}: {
  teams: Team[];
  conferences: Conference[];
  selectedTeamId: string;
  savedState?: DynastyState;
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
      <section className="hero" style={{ backgroundImage: "linear-gradient(90deg, rgba(9,13,18,.94), rgba(9,13,18,.58), rgba(9,13,18,.18)), url('/assets/dynasty-hero.png')" }}>
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
                    <p className="muted">{teamIdentity(selectedTeam)} - {selectedConference?.name ?? "Independent"} - {selectedTeam.city}, {selectedTeam.state}</p>
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
              <button className="secondary" onClick={onContinue} disabled={!savedState}>
                <ClipboardList size={18} />
                Continue
              </button>
              <button className="icon-button" onClick={onReset} title="Clear local save">
                <RotateCcw size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Overview({
  state,
  onUpdate,
  onNavigate,
}: {
  state: DynastyState;
  onUpdate: (recipe: (state: DynastyState) => DynastyState) => void;
  onNavigate: (tab: Tab) => void;
}) {
  const userTeam = getUserTeam(state);
  const units = teamUnitRatings(userTeam.roster);
  const recentAwards = state.weeklyAwards[0]?.national ?? [];
  const userPollEntry = state.rankings?.[0]?.entries.find((entry) => entry.teamId === userTeam.id);
  const offseasonTeamReport = state.offseasonReport?.teams.find((teamReport) => teamReport.teamId === userTeam.id);
  const offseasonFocus = Boolean(offseasonTeamReport && state.phase !== "regular" && state.phase !== "postseason");
  const matchupPreview = buildMatchupPreview(state);

  return (
    <>
      {offseasonFocus && state.offseasonReport && offseasonTeamReport && <OffseasonRecap state={state} report={state.offseasonReport} teamReport={offseasonTeamReport} />}

      {!offseasonFocus && (
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
            <button className="primary" onClick={() => onUpdate(advanceWeek)} disabled={state.phase === "complete"}>
              <ChevronsRight size={18} />
              Advance Week
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

      {!offseasonFocus && <MatchupPreviewPanel preview={matchupPreview} testId="dashboard-next-game-panel" />}

      {!offseasonFocus && (
        <section className="panel latest-awards-panel" data-testid="latest-national-awards-panel">
          <div className="panel-head compact">
            <h2>Latest National Awards</h2>
            <Award size={20} />
          </div>
          <AwardGrid awards={recentAwards.slice(0, 2)} />
        </section>
      )}

      <section className="panel ranking-snapshot-panel">
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

      {state.phase === "postseason" && state.playoff && (
        <section className="panel span-2" data-testid="dashboard-playoff-bracket">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Season Complete</p>
              <h2>Summit Four Playoff</h2>
              <p className="muted">The dashboard now follows the postseason bracket until the Crown Bowl is complete.</p>
            </div>
            <div className="button-row compact-row">
              <button className="secondary" onClick={() => onNavigate("awards")}>
                <Trophy size={16} />
                Playoff Center
              </button>
              <button className="secondary" onClick={() => onNavigate("schedule")}>
                <CalendarDays size={16} />
                Box Scores
              </button>
            </div>
          </div>
          <PlayoffBracket games={state.playoff.games} teams={state.teams} priorPlayoffTeams={[]} championName={undefined} />
        </section>
      )}

      {!offseasonFocus && state.phase !== "regular" && state.offseasonReport && offseasonTeamReport && <OffseasonRecap state={state} report={state.offseasonReport} teamReport={offseasonTeamReport} />}
    </>
  );
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
  const walkOns = teamReport.walkOns ?? [];
  const topClasses = report.topClasses;
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
      <div className="metric-grid offseason-metrics">
        <Metric label="Graduated" value={graduates.length} />
        <Metric label="Went Pro" value={proDepartures.length} />
        <Metric label="Signees" value={report.signingComplete ? teamReport.signees.length : "Pending"} />
        <Metric label="Walk-ons" value={report.developmentComplete ? walkOns.length : "Pending"} />
        <Metric label="Class Rank" value={teamReport.recruitingRank ? `#${teamReport.recruitingRank}` : "Pending"} />
      </div>
      <OffseasonSteps state={state} report={report} />
      <div className="offseason-grid">
        <DepartureGroup title="Graduated" departures={graduates} />
        <DepartureGroup title="Went Pro" departures={proDepartures} />
        <ClassSigneesPanel reports={report.teams} />
        <WalkOnGroup walkOns={walkOns} />
        <section className="offseason-column" data-testid="recruiting-ranking-panel">
          <h3>Recruiting Class Leaderboard</h3>
          {topClasses.length ? (
            <div className="table-list class-ranking-list">
              {topClasses.slice(0, 20).map((entry, index) => (
                <div key={entry.teamId} className="table-row class-rank-row">
                  <span>{index + 1}</span>
                  <strong>{entry.teamName}</strong>
                  <span>{entry.points} pts</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Class rankings post after signing day.</p>
          )}
        </section>
        <ProgressionGroup progressions={teamReport.progressions} />
        <ProgramChangeGroup changes={teamReport.programChanges} />
      </div>
    </section>
  );
}

function OffseasonSteps({ state, report }: { state: DynastyState; report: NonNullable<DynastyState["offseasonReport"]> }) {
  const recruitingWeek = state.phase === "offseason" && !report.signingComplete ? Math.min(4, Math.max(1, state.week - 15)) : 4;
  const steps = [
    { label: "Departures", complete: true, active: state.phase === "offseason" && !report.signingComplete && state.week === 16 },
    { label: `Recruiting ${recruitingWeek}/4`, complete: report.signingComplete || state.week > 19, active: state.phase === "offseason" && !report.signingComplete },
    { label: "Signing Day", complete: Boolean(report.signingComplete), active: state.phase === "offseason" && report.signingComplete && !report.developmentComplete },
    { label: "Development", complete: Boolean(report.developmentComplete), active: state.phase === "preseason" },
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

function ClassSigneesPanel({ reports }: { reports: NonNullable<DynastyState["offseasonReport"]>["teams"] }) {
  const sortedReports = [...reports].sort((a, b) => (a.recruitingRank ?? 999) - (b.recruitingRank ?? 999) || a.teamName.localeCompare(b.teamName));
  const [selectedTeamId, setSelectedTeamId] = useState(sortedReports[0]?.teamId ?? "");
  const selected = sortedReports.find((report) => report.teamId === selectedTeamId) ?? sortedReports[0];
  const signees = selected?.signees ?? [];
  return (
    <section className="offseason-column" data-testid="offseason-all-classes-panel">
      <h3>All Team Classes</h3>
      <label>
        Team
        <select value={selected?.teamId ?? ""} onChange={(event) => setSelectedTeamId(event.target.value)} data-testid="offseason-class-team-select">
          {sortedReports.map((report) => (
            <option key={report.teamId} value={report.teamId}>
              #{report.recruitingRank ?? "-"} {report.teamName}
            </option>
          ))}
        </select>
      </label>
      {signees.length ? (
        <div className="table-list signee-list">
          {signees.slice(0, 14).map((signee) => (
            <SigneeRow key={signee.recruitId} signee={signee} />
          ))}
        </div>
      ) : (
        <p className="muted">Signing day has not posted yet.</p>
      )}
    </section>
  );
}

function WalkOnGroup({ walkOns }: { walkOns: NonNullable<DynastyState["offseasonReport"]>["teams"][number]["walkOns"] }) {
  return (
    <section className="offseason-column" data-testid="walk-ons-panel">
      <h3>Walk-on Additions</h3>
      {walkOns.length ? (
        <div className="table-list walk-on-list">
          {walkOns.slice(0, 12).map((walkOn) => (
            <div key={walkOn.playerId} className="table-row walk-on-row">
              <strong>{walkOn.playerName}</strong>
              <span>{walkOn.position}</span>
              <span>OVR {walkOn.overall}</span>
              <span>Pot {walkOn.potential}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Walk-ons appear only if recruiting does not restore the roster floor.</p>
      )}
    </section>
  );
}

function SigneeRow({ signee }: { signee: RecruitSigning }) {
  return (
    <div className="table-row signee-row">
      <Stars count={signee.stars} />
      <strong>{signee.playerName}</strong>
      <span>{signee.position}</span>
      <span>#{signee.nationalRank}</span>
      <span>OVR/POT {signee.overall}/{signee.potential}</span>
    </div>
  );
}

function ProgressionGroup({ progressions }: { progressions: PlayerProgression[] }) {
  const topProgressions = [...progressions].sort((a, b) => b.afterOverall - b.beforeOverall - (a.afterOverall - a.beforeOverall) || b.afterOverall - a.afterOverall).slice(0, 12);
  return (
    <section className="offseason-column" data-testid="preseason-progression-panel">
      <h3>Preseason Development</h3>
      {topProgressions.length ? (
        <div className="table-list progression-list">
          {topProgressions.map((progression) => (
            <div key={progression.playerId} className="table-row progression-row">
              <strong>{progression.playerName}</strong>
              <span>{progression.position}</span>
              <span>
                {`${progression.fromYear}->${progression.toYear}`}
              </span>
              <span>
                {`OVR +${progression.afterOverall - progression.beforeOverall} (${progression.beforeOverall}->${progression.afterOverall})`}
              </span>
              <span>{attributeGainText(progression.attributeGains)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Development posts in preseason week.</p>
      )}
    </section>
  );
}

function ProgramChangeGroup({ changes }: { changes: ProgramChange[] }) {
  return (
    <section className="offseason-column" data-testid="program-review-panel">
      <h3>Program Review</h3>
      {changes.length ? (
        <div className="table-list program-change-list">
          {changes.map((change) => (
            <div key={change.key} className="table-row program-change-row">
              <strong>{title(String(change.key))}</strong>
              <span className={clsx(change.delta > 0 ? "positive" : "negative")}>{change.delta > 0 ? `+${change.delta}` : change.delta}</span>
              <span>{`${change.before}->${change.after}`}</span>
              <span>{change.reason}</span>
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
  return (
    <section className="offseason-column" data-testid={groupTitle === "Graduated" ? "graduated-panel" : "pro-departures-panel"}>
      <h3>{groupTitle}</h3>
      {departures.length ? (
        <div className="table-list departure-list">
          {departures.slice(0, 12).map((departure) => (
            <div key={departure.playerId} className="table-row departure-row">
              <strong>{departure.playerName}</strong>
              <span>{departure.position}</span>
              <span>{departure.year}</span>
              <span>OVR {departure.overall}</span>
              <span>{departure.note}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No players in this group.</p>
      )}
    </section>
  );
}

function Roster({ state, onUpdate }: { state: DynastyState; onUpdate: (recipe: (state: DynastyState) => DynastyState) => void }) {
  const team = getUserTeam(state);
  const [positionFilter, setPositionFilter] = useState<RosterFilter>("ALL");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | undefined>();
  const [modalTab, setModalTab] = useState<PlayerModalTab>("profile");
  const sorted = [...team.roster].sort((a, b) => b.overall - a.overall || b.potential - a.potential);
  const filtered = positionFilter === "ALL" ? sorted : sorted.filter((player) => player.position === positionFilter);
  const depthChart = buildDepthChart(team, 5);

  const openPlayer = (player: Player) => {
    setSelectedPlayer(player);
    setModalTab("profile");
  };
  const movePlayer = (position: Position, playerId: string, direction: "up" | "down") => {
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
            <h2>{team.roster.length} players</h2>
          </div>
          <Users size={20} />
        </div>
        <div className="roster-controls" data-testid="position-filter">
          {(["ALL", ...POSITIONS] as RosterFilter[]).map((position) => (
            <button key={position} className={clsx(positionFilter === position && "active")} onClick={() => setPositionFilter(position)}>
              {position}
            </button>
          ))}
        </div>
        <div className="roster-list" data-testid="roster-list">
          {filtered.map((player) => (
            <button key={player.id} className="roster-row" onClick={() => openPlayer(player)}>
              <Portrait index={player.profileIndex} />
              <strong>{player.name}</strong>
              <span>{player.position}</span>
              <span>{player.incomingFreshman ? `${player.year} In` : player.year}{player.walkOn ? " - Walk-on" : ""}</span>
              <span>OVR {player.overall}</span>
              <StreakBadge player={player} />
              <span>Pot {player.potential}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel span-2" data-testid="depth-chart-panel">
        <div className="panel-head compact">
          <h2>Depth Chart</h2>
          <ClipboardList size={20} />
        </div>
        <div className="depth-grid">
          {depthChart.map((slot) => (
            <article key={slot.position} className="depth-card">
              <p className="eyebrow">{slot.position}</p>
              {slot.players.map((player, index) => (
                <div key={player.id} className="depth-player-row">
                  <button className="depth-main" onClick={() => openPlayer(player)}>
                    <span className="depth-rank">{index + 1}</span>
                    <strong className="depth-name">{player.name}</strong>
                    <em className="depth-overall">OVR {effectiveOverall(player)}</em>
                    <StreakBadge player={player} compact showNeutral={false} />
                  </button>
                  <div className="depth-actions">
                    <button className="icon-button small" onClick={() => movePlayer(slot.position, player.id, "up")} disabled={index === 0} aria-label={`Move ${player.name} up`}>
                      <ArrowUp size={15} />
                    </button>
                    <button className="icon-button small" onClick={() => movePlayer(slot.position, player.id, "down")} disabled={index === slot.players.length - 1} aria-label={`Move ${player.name} down`}>
                      <ArrowDown size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </article>
          ))}
        </div>
      </section>

      {selectedPlayer && <PlayerModal player={selectedPlayer} activeTab={modalTab} onTabChange={setModalTab} onClose={() => setSelectedPlayer(undefined)} />}
    </>
  );
}

function PlayerModal({ player, activeTab, onTabChange, onClose }: { player: Player; activeTab: PlayerModalTab; onTabChange: (tab: PlayerModalTab) => void; onClose: () => void }) {
  const statRows = playerStatRows(player);
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
                <span>{row.stats.passYards} PYD</span>
                <span>{row.stats.rushYards} RYD</span>
                <span>{row.stats.receivingYards} REC</span>
                <span>{row.stats.tackles} TKL</span>
                <span>{row.stats.interceptions} INT</span>
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
            {player.awards.length ? player.awards.map((award) => <span key={award}>{award}</span>) : <p className="muted">No awards yet.</p>}
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
  const [recruitPage, setRecruitPage] = useState(1);
  const [selectedRecruitId, setSelectedRecruitId] = useState<string>();
  const needs = positionNeeds(userTeam);
  const seasonBudget = state.recruiting.seasonBudget ?? state.recruiting.weeklyPoints;
  const pointsSpent = state.recruiting.pointsSpent ?? Math.max(0, seasonBudget - state.recruiting.pointsRemaining);
  const boardLimit = state.recruiting.boardLimit ?? 35;
  const teamNameById = new Map(state.teams.map((team) => [team.id, team.name]));
  const board = state.recruiting.board
    .map((id) => state.recruits.find((recruit) => recruit.id === id))
    .filter((recruit): recruit is Recruit => recruit !== undefined)
    .filter((recruit) => recruit.stage !== "signed" && !recruit.committedTeamId);
  const boardFull = board.length >= boardLimit;
  const needsByPosition = new Map(needs.map((need) => [need.position, need]));
  const needCommandRows = POSITIONS.map((position) => {
    const need = needsByPosition.get(position) ?? { position, need: 0, target: 0, current: 0 };
    const boardCount = board.filter((recruit) => recruit.position === position).length;
    const offerCount = state.recruits.filter((recruit) => recruit.position === position && recruit.stage !== "signed" && recruit.offers?.includes(userTeam.id)).length;
    const committedCount = state.recruits.filter((recruit) => recruit.position === position && recruit.committedTeamId === userTeam.id).length;
    return {
      ...need,
      boardCount,
      offerCount,
      committedCount,
      coverage: boardCount + committedCount,
    };
  });
  const stateOptions = Array.from(new Set(state.recruits.map((recruit) => recruit.state))).sort();
  const matchingRecruits = state.recruits
    .filter((recruit) => recruit.stage !== "signed" && !state.recruiting.board.includes(recruit.id))
    .filter((recruit) => positionFilter === "ALL" || recruit.position === positionFilter)
    .filter((recruit) => stateFilter === "ALL" || recruit.state === stateFilter)
    .filter((recruit) => starsFilter === "ALL" || recruit.stars === Number(starsFilter))
    .filter((recruit) => commitmentFilter === "all" || (commitmentFilter === "open" ? !recruit.committedTeamId : Boolean(recruit.committedTeamId)))
    .filter((recruit) => !pipelineOnly || isPipelineRecruit(userTeam, recruit))
    .sort((a, b) => {
      const needA = needs.find((need) => need.position === a.position)?.need ?? 0;
      const needB = needs.find((need) => need.position === b.position)?.need ?? 0;
      if (sortBy === "interest") return (b.interest[userTeam.id] ?? 0) - (a.interest[userTeam.id] ?? 0) || a.nationalRank - b.nationalRank;
      if (sortBy === "stars") return b.stars - a.stars || a.nationalRank - b.nationalRank;
      if (sortBy === "need") return needB - needA || a.nationalRank - b.nationalRank;
      return a.nationalRank - b.nationalRank;
    });
  const recruitPageCount = Math.max(1, Math.ceil(matchingRecruits.length / RECRUIT_PAGE_SIZE));
  const currentRecruitPage = Math.min(recruitPage, recruitPageCount);
  const visibleRecruits = matchingRecruits.slice((currentRecruitPage - 1) * RECRUIT_PAGE_SIZE, currentRecruitPage * RECRUIT_PAGE_SIZE);
  const selectedRecruit = selectedRecruitId ? state.recruits.find((recruit) => recruit.id === selectedRecruitId) : undefined;
  const resetRecruitPage = () => setRecruitPage(1);

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
          <button className="primary" data-testid="auto-recruit" onClick={() => onUpdate((current) => autoRecruit(current, "Manual auto-recruit run."))} disabled={state.recruiting.pointsRemaining < 50}>
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
              <span>{row.current}/{row.target} roster</span>
              <em>{row.need > 0 ? `Need ${row.need}` : "Covered"}</em>
              <small>Board {row.boardCount} - Offers {row.offerCount} - Pledges {row.committedCount}</small>
              <i>
                <b style={{ width: `${Math.min(100, Math.round((row.coverage / Math.max(1, row.need || row.target)) * 100))}%` }} />
              </i>
            </button>
          ))}
        </div>
        <div className="recruit-grid" data-testid="recruiting-board">
          {(board.length ? board : matchingRecruits.slice(0, 6)).map((recruit) => (
            <RecruitCard key={recruit.id} recruit={recruit} userTeam={userTeam} onUpdate={onUpdate} onOpen={setSelectedRecruitId} onBoard={board.some((item) => item.id === recruit.id)} pointsRemaining={state.recruiting.pointsRemaining} boardFull={boardFull} week={state.week} />
          ))}
        </div>
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
              <span>{recruit.interest[userTeam.id] ?? 0}%</span>
              <span className={clsx("status-pill", recruit.committedTeamId && "committed")}>
                {recruit.committedTeamId ? `Committed to ${teamNameById.get(recruit.committedTeamId) ?? "another school"}` : recruit.stage}
              </span>
            </button>
          ))}
        </div>
        <PaginationControls page={currentRecruitPage} pageCount={recruitPageCount} total={matchingRecruits.length} pageSize={RECRUIT_PAGE_SIZE} label="recruits" onPageChange={setRecruitPage} />
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
  const committedElsewhere = Boolean(recruit.committedTeamId && recruit.committedTeamId !== userTeam.id);
  const lockedCommitment = Boolean(recruit.committedTeamId);
  const offered = recruit.offers?.includes(userTeam.id);
  const pitchedThisWeek = recruit.lastPitchWeek === week;
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
        <span>Interest {recruit.interest[userTeam.id] ?? 0}</span>
        <span>{offered ? "Scholarship sent" : committedElsewhere ? "Committed elsewhere" : recruit.stage}</span>
        <span>Scout {recruit.scoutProgress}%</span>
      </div>
      <div className="known-attrs">
        {known.length ? known.map((key) => <span key={key}>{shortAttr(key)} {recruit.attributes[key]}</span>) : <span>No ratings unlocked</span>}
      </div>
      <p className={clsx("trait-chip", recruit.gemBust)}>{recruit.traitRevealed ? recruit.hiddenTrait : recruit.gemBust ? gemBustFor(recruit) : "trait hidden"}</p>
      <div className="button-row compact-row">
        <button className="secondary" onClick={() => onOpen(recruit.id)}>
          Details
        </button>
        {onBoard ? (
          <button className="secondary" onClick={() => onUpdate((state) => removeRecruitFromBoard(state, recruit.id))}>
            Remove
          </button>
        ) : (
          <button className="secondary" onClick={() => onUpdate((state) => addRecruitToBoard(state, recruit.id))} disabled={boardFull || lockedCommitment}>
            Add
          </button>
        )}
        {offered ? (
          <button className="secondary" onClick={() => onUpdate((state) => rescindScholarship(state, recruit.id))} disabled={lockedCommitment}>
            Rescind
          </button>
        ) : (
          <button className="secondary" onClick={() => onUpdate((state) => offerScholarship(state, recruit.id))} disabled={(boardFull && !onBoard) || pointsRemaining < OFFER_COST || lockedCommitment}>
            Offer
          </button>
        )}
        <button className="secondary" onClick={() => onUpdate((state) => scoutRecruit(state, recruit.id))} disabled={pointsRemaining < SCOUT_COST || lockedCommitment}>
          Scout
        </button>
        <button className="primary" onClick={() => onUpdate((state) => pitchRecruit(state, recruit.id))} disabled={!offered || pitchedThisWeek || pointsRemaining < PITCH_COST || lockedCommitment}>
          Pitch
        </button>
      </div>
    </article>
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
  const offered = recruit.offers?.includes(userTeam.id);
  const committedElsewhere = Boolean(recruit.committedTeamId && recruit.committedTeamId !== userTeam.id);
  const lockedCommitment = Boolean(recruit.committedTeamId);
  const pitchedThisWeek = recruit.lastPitchWeek === week;
  const topSchools = Object.entries(recruit.interest)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const userRank = topSchools.findIndex(([teamId]) => teamId === userTeam.id) + 1;
  const priorities = Object.entries(recruit.priorities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const pitchStatus = committedElsewhere
    ? "Committed elsewhere"
    : !offered
      ? "Scholarship required"
      : pitchedThisWeek
        ? `Available Week ${week + 1}`
        : pointsRemaining < PITCH_COST
          ? "Not enough points"
          : "Ready";

  return (
    <div className="modal-backdrop">
      <section className="player-modal recruit-modal" data-testid="recruit-modal">
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
          <button className="icon-btn" onClick={onClose} aria-label="Close recruit detail">
            <X size={18} />
          </button>
        </div>
        <div className="recruit-modal-grid">
          <section className="modal-panel">
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
                    <span>{interest}%</span>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="modal-panel">
            <div className="panel-head compact">
              <h3>Recruiting Plan</h3>
              <Handshake size={18} />
            </div>
            <div className="mini-metrics modal-metrics">
              <span>{offered ? "Scholarship sent" : "No scholarship"}</span>
              <span>{userRank ? `Your rank #${userRank}` : "Outside Top 10"}</span>
              <span>Pitch: {pitchStatus}</span>
            </div>
            <div className="known-attrs">
              {priorities.map(([key, value]) => (
                <span key={key}>{title(key)} {value}/10</span>
              ))}
            </div>
            <div className="known-attrs">
              {recruit.knownAttributes.length ? recruit.knownAttributes.slice(0, 6).map((key) => <span key={key}>{shortAttr(key)} {recruit.attributes[key]}</span>) : <span>No ratings unlocked</span>}
            </div>
            <div className="button-row">
              {onBoard ? (
                <button className="secondary" onClick={() => onUpdate((state) => removeRecruitFromBoard(state, recruit.id))}>
                  Remove Board
                </button>
              ) : (
                <button className="secondary" onClick={() => onUpdate((state) => addRecruitToBoard(state, recruit.id))} disabled={boardFull || lockedCommitment}>
                  Add Board
                </button>
              )}
              {offered ? (
                <button className="secondary" onClick={() => onUpdate((state) => rescindScholarship(state, recruit.id))} disabled={lockedCommitment}>
                  Rescind Scholarship
                </button>
              ) : (
                <button className="secondary" onClick={() => onUpdate((state) => offerScholarship(state, recruit.id))} disabled={(boardFull && !onBoard) || pointsRemaining < OFFER_COST || lockedCommitment}>
                  Offer Scholarship
                </button>
              )}
              <button className="secondary" onClick={() => onUpdate((state) => scoutRecruit(state, recruit.id))} disabled={pointsRemaining < SCOUT_COST || lockedCommitment}>
                Scout
              </button>
              <button className="primary" onClick={() => onUpdate((state) => pitchRecruit(state, recruit.id))} disabled={!offered || pitchedThisWeek || pointsRemaining < PITCH_COST || lockedCommitment}>
                Pitch
              </button>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function Schedule({ state }: { state: DynastyState }) {
  const userTeam = getUserTeam(state);
  const [selectedGame, setSelectedGame] = useState<Game | undefined>();
  const matchupPreview = buildMatchupPreview(state);
  const games = scheduleGamesForDisplay(state, userTeam.id);
  const standings = [...state.teams]
    .filter((team) => team.conferenceId === userTeam.conferenceId)
    .sort((a, b) => b.season.confWins - a.season.confWins || a.season.confLosses - b.season.confLosses || b.season.wins - a.season.wins);
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
          {games.map((game) => {
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
          <div className="box-score-grid">
            <TeamBoxScorePanel box={boxScore.away} />
            <TeamBoxScorePanel box={boxScore.home} />
          </div>
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
        <span>{box.totals.passYards} pass, {box.totals.passTd} PaTD</span>
        <span>{box.totals.rushYards} rush, {box.totals.rushTd} RuTD</span>
        <span>{box.totals.receivingYards} rec, {box.totals.receivingTd} RecTD</span>
        <span>{box.totals.tackles} tackles</span>
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
  return (
    <>
      <section className="panel span-2" data-testid="program-blueprint-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Annual Program Blueprint</p>
            <h2>Director Goals and Program Points</h2>
            <p className="muted">{canEditBlueprint ? "Allocate the annual budget before kickoff." : blueprint.resolved ? "This blueprint resolved during the offseason review." : "Blueprint allocations are locked after kickoff."}</p>
          </div>
          <button className="secondary" onClick={() => onUpdate(autoAllocateProgramBlueprint)} disabled={!canEditBlueprint || remaining <= 0}>
            <Wrench size={16} />
            Auto Build
          </button>
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
  return <span className="portrait" style={{ backgroundPosition: `${column * 33.333}% ${row * 33.333}%` }} aria-hidden="true" />;
}

function CoachPortrait({ index }: { index: number }) {
  const column = index % 5;
  const row = Math.floor(index / 5);
  return <span className="coach-portrait" style={{ backgroundPosition: `${column * 25}% ${row * 100}%` }} aria-hidden="true" />;
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

function phaseWeekLabel(state: DynastyState): string {
  if (state.phase === "offseason") {
    if (!state.offseasonReport?.signingComplete && state.week <= 19) return `offseason recruiting week ${Math.max(1, state.week - 15)} of 4`;
    if (!state.offseasonReport?.signingComplete) return "offseason signing day - ready";
    if (state.offseasonReport?.signingComplete && !state.offseasonReport.developmentComplete) return "offseason signing day - classes posted";
    return "offseason player development";
  }
  if (state.phase === "preseason") return "preseason week - player development";
  return `${state.phase} - Week ${state.week}`;
}

function offseasonStageLabel(state: DynastyState, report: NonNullable<DynastyState["offseasonReport"]>): string {
  if (report.developmentComplete) return "Preseason Development";
  if (report.signingComplete) return "Offseason Signing Day";
  if (state.week > 19) return "Offseason Signing Day Ready";
  return `Offseason Recruiting Week ${Math.max(1, state.week - 15)} of 4`;
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

function gameLineSummary(stats: PlayerStats): string {
  const parts: string[] = [];
  if (stats.passYards || stats.passTd || stats.interceptionsThrown) parts.push(`${stats.passYards} PYD, ${stats.passTd} PaTD, ${stats.interceptionsThrown} INT`);
  if (stats.rushYards || stats.rushTd) parts.push(`${stats.rushYards} RYD, ${stats.rushTd} RuTD`);
  if (stats.receivingYards || stats.receivingTd) parts.push(`${stats.receivingYards} REC, ${stats.receivingTd} RecTD`);
  if (stats.tackles || stats.sacks || stats.interceptions) parts.push(`${stats.tackles} TKL, ${stats.sacks} SCK, ${stats.interceptions} INT`);
  if (stats.pancakes) parts.push(`${stats.pancakes} PAN`);
  if (stats.fieldGoalAttempts) parts.push(`${stats.fieldGoals}/${stats.fieldGoalAttempts} FG`);
  return parts.join(" | ") || "Appeared";
}
