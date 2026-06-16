import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  Award,
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
  LineChart,
  MapPinned,
  Play,
  RotateCcw,
  Save,
  Search,
  Shield,
  Star,
  TrendingUp,
  Trophy,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { addRecruitToBoard, autoRecruit, gemBustFor, isPipelineRecruit, pitchRecruit, positionNeeds, scoutRecruit } from "./sim/recruiting";
import { createDynasty } from "./sim/generate";
import { advanceWeek, forceUserAward, forceUserPlayoff, getUserTeam, hireCoach, investProgramPoint, simulateSeasons, spendCoachPoint } from "./sim/dynasty";
import { clearDynasty, loadActiveDynasty, saveDynasty } from "./sim/storage";
import { buildDepthChart } from "./sim/depthChart";
import { teamPower, teamUnitRatings } from "./sim/ratings";
import { POSITIONS, type AttributeKey, type Coach, type Conference, type DynastyState, type Game, type Player, type PlayerDeparture, type PlayerGameStats, type PlayerStats, type Position, type ProgramRatings, type Recruit, type Team, type TeamBoxScore } from "./sim/types";
import { Awards, AwardGrid } from "./components/AwardsView";
import { PaginationControls } from "./components/PaginationControls";
import { Rankings } from "./components/RankingsView";
import { TeamHelmet } from "./components/TeamHelmet";
import { APP_VERSION } from "./version";

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
    const dynasty = createDynasty(Date.now(), selectedTeamId);
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
            Year {state.year} of {state.maxYears} - {state.calendarYear} - {state.phase} - Week {state.week}
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
        {activeTab === "overview" && <Overview state={state} onUpdate={update} />}
        {activeTab === "rankings" && <Rankings state={state} />}
        {activeTab === "roster" && <Roster team={userTeam} />}
        {activeTab === "recruiting" && <Recruiting state={state} onUpdate={update} />}
        {activeTab === "schedule" && <Schedule state={state} />}
        {activeTab === "awards" && <Awards state={state} />}
        {activeTab === "program" && <Program state={state} onUpdate={update} />}
        {activeTab === "debug" && <Debug state={state} onUpdate={update} onReset={resetAll} />}
      </main>
    </div>
  );
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
            <Feature icon={Trophy} text="Weekly awards, season honors, All-Americans, bowls, and playoff history" />
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

function Overview({ state, onUpdate }: { state: DynastyState; onUpdate: (recipe: (state: DynastyState) => DynastyState) => void }) {
  const userTeam = getUserTeam(state);
  const units = teamUnitRatings(userTeam.roster);
  const recentAwards = state.weeklyAwards[0]?.national ?? [];
  const userPollEntry = state.rankings?.[0]?.entries.find((entry) => entry.teamId === userTeam.id);
  const offseasonTeamReport = state.offseasonReport?.teams.find((teamReport) => teamReport.teamId === userTeam.id);

  return (
    <>
      <section className="panel span-2 dashboard-panel">
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

      <section className="panel latest-awards-panel">
        <div className="panel-head compact">
          <h2>Latest National Awards</h2>
          <Award size={20} />
        </div>
        <AwardGrid awards={recentAwards.slice(0, 2)} />
      </section>

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

      {state.offseasonReport && offseasonTeamReport && <OffseasonRecap reportYear={state.offseasonReport.year} teamReport={offseasonTeamReport} topClasses={state.offseasonReport.topClasses} />}
    </>
  );
}

function OffseasonRecap({
  reportYear,
  teamReport,
  topClasses,
}: {
  reportYear: number;
  teamReport: NonNullable<DynastyState["offseasonReport"]>["teams"][number];
  topClasses: NonNullable<DynastyState["offseasonReport"]>["topClasses"];
}) {
  const graduates = teamReport.departures.filter((departure) => departure.reason === "graduated");
  const proDepartures = teamReport.departures.filter((departure) => departure.reason === "pro");
  return (
    <section className="panel span-2" data-testid="offseason-report-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Offseason Report</p>
          <h2>
            {reportYear} Departures {teamReport.recruitingRank ? `- Recruiting #${teamReport.recruitingRank}` : ""}
          </h2>
        </div>
        <GraduationCap size={20} />
      </div>
      <div className="metric-grid offseason-metrics">
        <Metric label="Graduated" value={graduates.length} />
        <Metric label="Went Pro" value={proDepartures.length} />
        <Metric label="Class Rank" value={teamReport.recruitingRank ? `#${teamReport.recruitingRank}` : "Pending"} />
        <Metric label="Top Class" value={topClasses[0]?.teamName ?? "Pending"} />
      </div>
      <div className="offseason-grid">
        <DepartureGroup title="Graduated" departures={graduates} />
        <DepartureGroup title="Went Pro" departures={proDepartures} />
        <section className="offseason-column" data-testid="recruiting-ranking-panel">
          <h3>Recruiting Class Leaderboard</h3>
          {topClasses.length ? (
            <div className="table-list class-ranking-list">
              {topClasses.map((entry, index) => (
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
      </div>
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

function Roster({ team }: { team: Team }) {
  const [positionFilter, setPositionFilter] = useState<RosterFilter>("ALL");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | undefined>();
  const [modalTab, setModalTab] = useState<PlayerModalTab>("profile");
  const sorted = [...team.roster].sort((a, b) => b.overall - a.overall || b.potential - a.potential);
  const filtered = positionFilter === "ALL" ? sorted : sorted.filter((player) => player.position === positionFilter);
  const depthChart = buildDepthChart(team.roster, 3);

  const openPlayer = (player: Player) => {
    setSelectedPlayer(player);
    setModalTab("profile");
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
              <span>{player.year}</span>
              <span>OVR {player.overall}</span>
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
                <button key={player.id} onClick={() => openPlayer(player)}>
                  <span>{index + 1}</span>
                  <strong>{player.name}</strong>
                  <em>{player.overall}</em>
                </button>
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
              <p className="eyebrow">{player.position} - {player.year}</p>
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
              <Metric label="Games" value={player.stats.games} />
            </div>
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

function Recruiting({ state, onUpdate }: { state: DynastyState; onUpdate: (recipe: (state: DynastyState) => DynastyState) => void }) {
  const userTeam = getUserTeam(state);
  const [positionFilter, setPositionFilter] = useState<RecruitPositionFilter>("ALL");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [starsFilter, setStarsFilter] = useState<RecruitStarsFilter>("ALL");
  const [commitmentFilter, setCommitmentFilter] = useState<RecruitCommitmentFilter>("all");
  const [pipelineOnly, setPipelineOnly] = useState(false);
  const [sortBy, setSortBy] = useState<RecruitSort>("rank");
  const [recruitPage, setRecruitPage] = useState(1);
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
          <Metric label="Next Refill" value="Signing Day" />
        </div>
        <div className="need-row">
          {needs.slice(0, 5).map((need) => (
            <span key={need.position}>
              {need.position}: need {need.need}
            </span>
          ))}
        </div>
        <div className="recruit-grid" data-testid="recruiting-board">
          {(board.length ? board : matchingRecruits.slice(0, 6)).map((recruit) => (
            <RecruitCard key={recruit.id} recruit={recruit} userTeam={userTeam} onUpdate={onUpdate} onBoard={board.some((item) => item.id === recruit.id)} pointsRemaining={state.recruiting.pointsRemaining} boardFull={boardFull} />
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
            <button key={recruit.id} className="table-row clickable" onClick={() => onUpdate((current) => addRecruitToBoard(current, recruit.id))} disabled={boardFull || Boolean(recruit.committedTeamId)}>
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
    </>
  );
}

function RecruitCard({
  recruit,
  userTeam,
  onUpdate,
  onBoard,
  pointsRemaining,
  boardFull,
}: {
  recruit: Recruit;
  userTeam: Team;
  onUpdate: (recipe: (state: DynastyState) => DynastyState) => void;
  onBoard: boolean;
  pointsRemaining: number;
  boardFull: boolean;
}) {
  const known = recruit.knownAttributes.slice(0, 5);
  const committedElsewhere = Boolean(recruit.committedTeamId && recruit.committedTeamId !== userTeam.id);
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
        <span>{committedElsewhere ? "Committed elsewhere" : recruit.stage}</span>
        <span>Scout {recruit.scoutProgress}%</span>
      </div>
      <div className="known-attrs">
        {known.length ? known.map((key) => <span key={key}>{shortAttr(key)} {recruit.attributes[key]}</span>) : <span>No ratings unlocked</span>}
      </div>
      <p className={clsx("trait-chip", recruit.gemBust)}>{recruit.traitRevealed ? recruit.hiddenTrait : recruit.gemBust ? gemBustFor(recruit) : "trait hidden"}</p>
      <div className="button-row compact-row">
        {!onBoard && (
          <button className="secondary" onClick={() => onUpdate((state) => addRecruitToBoard(state, recruit.id))} disabled={boardFull || committedElsewhere}>
            Add
          </button>
        )}
        <button className="secondary" onClick={() => onUpdate((state) => scoutRecruit(state, recruit.id))} disabled={pointsRemaining < 50 || committedElsewhere}>
          Scout
        </button>
        <button className="primary" onClick={() => onUpdate((state) => pitchRecruit(state, recruit.id))} disabled={pointsRemaining < 100 || committedElsewhere}>
          Pitch
        </button>
      </div>
    </article>
  );
}

function Schedule({ state }: { state: DynastyState }) {
  const userTeam = getUserTeam(state);
  const [selectedGame, setSelectedGame] = useState<Game | undefined>();
  const games = state.schedule.filter((game) => game.homeTeamId === userTeam.id || game.awayTeamId === userTeam.id || game.week === state.week).slice(0, 24);
  const standings = [...state.teams]
    .filter((team) => team.conferenceId === userTeam.conferenceId)
    .sort((a, b) => b.season.confWins - a.season.confWins || a.season.confLosses - b.season.confLosses || b.season.wins - a.season.wins);
  return (
    <>
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
  return (
    <>
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
