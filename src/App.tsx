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
  Medal,
  Play,
  RotateCcw,
  Save,
  Search,
  Shield,
  Sparkles,
  Star,
  Trophy,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { addRecruitToBoard, autoRecruit, gemBustFor, isPipelineRecruit, pitchRecruit, positionNeeds, scoutRecruit } from "./sim/recruiting";
import { createDynasty } from "./sim/generate";
import { advanceWeek, forceUserAward, forceUserPlayoff, getUserTeam, hireCoach, investProgramPoint, simulateSeasons, spendCoachPoint, topTeams } from "./sim/dynasty";
import { clearDynasty, loadActiveDynasty, saveDynasty } from "./sim/storage";
import { buildDepthChart } from "./sim/depthChart";
import { teamPower, teamUnitRatings } from "./sim/ratings";
import { createSeasonAwards } from "./sim/awards";
import { POSITIONS, type AttributeKey, type AwardWinner, type Coach, type Conference, type DynastyState, type Game, type Player, type PlayerGameStats, type PlayerStats, type Position, type ProgramRatings, type Recruit, type Team, type TeamBoxScore } from "./sim/types";
import { APP_VERSION } from "./version";

type Tab = "overview" | "roster" | "recruiting" | "schedule" | "awards" | "program" | "debug";
type RosterFilter = "ALL" | Position;
type PlayerModalTab = "profile" | "stats" | "attributes" | "awards";
type RecruitPositionFilter = "ALL" | Position;
type RecruitStarsFilter = "ALL" | "1" | "2" | "3" | "4" | "5";
type RecruitSort = "rank" | "interest" | "stars" | "need";
type LeaderboardScope = "national" | "conference" | "team";
type LeaderboardStatKey = keyof PlayerStats;

const tabs: { id: Tab; label: string; icon: typeof LineChart }[] = [
  { id: "overview", label: "Overview", icon: LineChart },
  { id: "roster", label: "Roster", icon: Users },
  { id: "recruiting", label: "Recruiting", icon: Search },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "awards", label: "Awards", icon: Trophy },
  { id: "program", label: "Program", icon: GraduationCap },
  { id: "debug", label: "Debug", icon: Wrench },
];

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

const leaderboardStats: { key: LeaderboardStatKey; label: string }[] = [
  { key: "passYards", label: "Passing Yards" },
  { key: "passTd", label: "Passing TD" },
  { key: "rushYards", label: "Rushing Yards" },
  { key: "rushTd", label: "Rushing TD" },
  { key: "receivingYards", label: "Receiving Yards" },
  { key: "receivingTd", label: "Receiving TD" },
  { key: "tackles", label: "Tackles" },
  { key: "sacks", label: "Sacks" },
  { key: "interceptions", label: "Interceptions" },
  { key: "pancakes", label: "Pancakes" },
  { key: "fieldGoals", label: "Field Goals" },
];

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
        {activeTab === "overview" && <Overview state={state} onUpdate={update} saveStatus={saveStatus} />}
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
                <p className="eyebrow">Starting program</p>
                <h2>{selectedTeam.name}</h2>
                <p className="muted">{teamIdentity(selectedTeam)} - {selectedConference?.name ?? "Independent"} - {selectedTeam.city}, {selectedTeam.state}</p>
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

function Overview({ state, onUpdate, saveStatus }: { state: DynastyState; onUpdate: (recipe: (state: DynastyState) => DynastyState) => void; saveStatus: string }) {
  const userTeam = getUserTeam(state);
  const units = teamUnitRatings(userTeam.roster);
  const rankings = topTeams(state, 8);
  const recentAwards = state.weeklyAwards[0]?.national ?? [];
  const playoffTeams = state.playoff?.seeds.map((id) => state.teams.find((team) => team.id === id)?.name ?? id) ?? [];

  return (
    <>
      <section className="panel span-2 dashboard-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Dynasty Command</p>
            <h2>
              {userTeam.season.wins}-{userTeam.season.losses} - Power {teamPower(userTeam.roster)}
            </h2>
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

      <section className="panel standings-panel">
        <div className="panel-head compact">
          <h2>Top Programs</h2>
          <Medal size={20} />
        </div>
        <ol className="rank-list">
          {rankings.map((team) => (
            <li key={team.id}>
              <span>{team.season.rank ?? "-"}</span>
              <strong>{team.name}</strong>
              <em>
                {team.season.wins}-{team.season.losses}
              </em>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel action-panel">
        <div className="panel-head compact">
          <h2>Action Items</h2>
          <Sparkles size={20} />
        </div>
        <ul className="action-list">
          <li>{saveStatus}</li>
          <li>{state.recruiting.board.length ? `${state.recruiting.board.length} recruits on your board` : "Recruiting board is empty; auto-recruit can fill it"}</li>
          <li>{state.phase === "postseason" ? "Postseason bracket is active" : state.phase === "offseason" ? "Offseason signing day is ready" : "Weekly game simulation ready"}</li>
          <li>{playoffTeams.length ? `Playoff field: ${playoffTeams.slice(0, 3).join(", ")}...` : "Playoff field forms after Week 12"}</li>
        </ul>
      </section>

      <section className="panel span-2 latest-awards-panel">
        <div className="panel-head compact">
          <h2>Latest National Awards</h2>
          <Award size={20} />
        </div>
        <AwardGrid awards={recentAwards} />
      </section>
    </>
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
  const [pipelineOnly, setPipelineOnly] = useState(false);
  const [sortBy, setSortBy] = useState<RecruitSort>("rank");
  const needs = positionNeeds(userTeam);
  const board = state.recruiting.board.map((id) => state.recruits.find((recruit) => recruit.id === id)).filter((recruit): recruit is Recruit => Boolean(recruit));
  const stateOptions = Array.from(new Set(state.recruits.map((recruit) => recruit.state))).sort();
  const available = state.recruits
    .filter((recruit) => recruit.stage !== "signed" && !state.recruiting.board.includes(recruit.id))
    .filter((recruit) => positionFilter === "ALL" || recruit.position === positionFilter)
    .filter((recruit) => stateFilter === "ALL" || recruit.state === stateFilter)
    .filter((recruit) => starsFilter === "ALL" || recruit.stars === Number(starsFilter))
    .filter((recruit) => !pipelineOnly || isPipelineRecruit(userTeam, recruit))
    .sort((a, b) => {
      const needA = needs.find((need) => need.position === a.position)?.need ?? 0;
      const needB = needs.find((need) => need.position === b.position)?.need ?? 0;
      if (sortBy === "interest") return (b.interest[userTeam.id] ?? 0) - (a.interest[userTeam.id] ?? 0) || a.nationalRank - b.nationalRank;
      if (sortBy === "stars") return b.stars - a.stars || a.nationalRank - b.nationalRank;
      if (sortBy === "need") return needB - needA || a.nationalRank - b.nationalRank;
      return a.nationalRank - b.nationalRank;
    })
    .slice(0, 60);

  return (
    <>
      <section className="panel span-2">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Recruiting Board</p>
            <h2>
              {state.recruiting.pointsRemaining} / {state.recruiting.weeklyPoints} points
            </h2>
          </div>
          <button className="primary" data-testid="auto-recruit" onClick={() => onUpdate((current) => autoRecruit(current, "Manual auto-recruit run."))}>
            <Search size={18} />
            Auto Recruit
          </button>
        </div>
        <div className="need-row">
          {needs.slice(0, 5).map((need) => (
            <span key={need.position}>
              {need.position}: need {need.need}
            </span>
          ))}
        </div>
        <div className="recruit-grid" data-testid="recruiting-board">
          {(board.length ? board : available.slice(0, 6)).map((recruit) => (
            <RecruitCard key={recruit.id} recruit={recruit} userTeam={userTeam} onUpdate={onUpdate} onBoard={board.some((item) => item.id === recruit.id)} />
          ))}
        </div>
      </section>

      <section className="panel span-2">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Recruiting Database</p>
            <h2>{available.length} matching prospects</h2>
          </div>
          <Shield size={20} />
        </div>
        <div className="filter-grid" data-testid="recruit-filter-panel">
          <label>
            Position
            <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value as RecruitPositionFilter)} data-testid="recruit-position-filter">
              {(["ALL", ...POSITIONS] as RecruitPositionFilter[]).map((position) => (
                <option key={position} value={position}>{position}</option>
              ))}
            </select>
          </label>
          <label>
            State
            <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
              <option value="ALL">All states</option>
              {stateOptions.map((stateName) => (
                <option key={stateName} value={stateName}>{stateName}{stateName === userTeam.state ? " (pipeline)" : ""}</option>
              ))}
            </select>
          </label>
          <label>
            Stars
            <select value={starsFilter} onChange={(event) => setStarsFilter(event.target.value as RecruitStarsFilter)}>
              <option value="ALL">All stars</option>
              {[5, 4, 3, 2, 1].map((stars) => (
                <option key={stars} value={stars}>{stars} stars</option>
              ))}
            </select>
          </label>
          <label>
            Sort
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as RecruitSort)}>
              <option value="rank">Rank number</option>
              <option value="interest">Interest</option>
              <option value="stars">Stars</option>
              <option value="need">Team need</option>
            </select>
          </label>
          <label className="check-label">
            <input type="checkbox" checked={pipelineOnly} onChange={(event) => setPipelineOnly(event.target.checked)} />
            Pipeline only
          </label>
        </div>
        <div className="table-list recruit-table" data-testid="recruiting-database">
          {available.map((recruit) => (
            <button key={recruit.id} className="table-row clickable" onClick={() => onUpdate((current) => addRecruitToBoard(current, recruit.id))}>
              <Stars count={recruit.stars} />
              <strong>{recruit.name}</strong>
              <span>{recruit.position}</span>
              <span>#{recruit.nationalRank}</span>
              <span>{recruit.hometown}{isPipelineRecruit(userTeam, recruit) ? " - Pipeline" : ""}</span>
              <span>{recruit.interest[userTeam.id] ?? 0}%</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function RecruitCard({
  recruit,
  userTeam,
  onUpdate,
  onBoard,
}: {
  recruit: Recruit;
  userTeam: Team;
  onUpdate: (recipe: (state: DynastyState) => DynastyState) => void;
  onBoard: boolean;
}) {
  const known = recruit.knownAttributes.slice(0, 5);
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
        <span>{recruit.stage}</span>
        <span>Scout {recruit.scoutProgress}%</span>
      </div>
      <div className="known-attrs">
        {known.length ? known.map((key) => <span key={key}>{shortAttr(key)} {recruit.attributes[key]}</span>) : <span>No ratings unlocked</span>}
      </div>
      <p className={clsx("trait-chip", recruit.gemBust)}>{recruit.traitRevealed ? recruit.hiddenTrait : recruit.gemBust ? gemBustFor(recruit) : "trait hidden"}</p>
      <div className="button-row compact-row">
        {!onBoard && (
          <button className="secondary" onClick={() => onUpdate((state) => addRecruitToBoard(state, recruit.id))}>
            Add
          </button>
        )}
        <button className="secondary" onClick={() => onUpdate((state) => scoutRecruit(state, recruit.id))}>
          Scout
        </button>
        <button className="primary" onClick={() => onUpdate((state) => pitchRecruit(state, recruit.id))}>
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
        <span>{box.totals.passYards} pass</span>
        <span>{box.totals.rushYards} rush</span>
        <span>{box.totals.receivingYards} rec</span>
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

function Awards({ state }: { state: DynastyState }) {
  const userTeam = getUserTeam(state);
  const userConference = state.conferences.find((conference) => conference.id === userTeam.conferenceId);
  const conferenceAwards = userConference && state.seasonAwards ? state.seasonAwards.allConference[userConference.id] : undefined;
  const playoffGames = state.playoff?.games ?? [];
  const latestHistory = state.history[0];
  const latestWeeklyAwards = state.weeklyAwards[0]?.national ?? [];
  const seasonAwardWatch = !state.seasonAwards && state.phase === "regular" && state.week >= 8 ? createSeasonAwards(state.teams, state.conferences, state.calendarYear).nationalAwards : undefined;
  const awardSource = state.seasonAwards?.nationalAwards ?? seasonAwardWatch ?? (state.phase === "regular" ? [] : latestHistory?.awardWinners ?? []);
  const priorPlayoffTeams = latestHistory?.playoffTeams.map((id) => state.teams.find((team) => team.id === id)?.name ?? id) ?? [];
  return (
    <>
      <section className="panel span-2" data-testid="player-of-week-panel">
        <div className="panel-head compact">
          <h2>Player of the Week</h2>
          <Award size={20} />
        </div>
        <AwardGrid awards={latestWeeklyAwards.slice(0, 1)} />
      </section>
      <section className="panel span-2" data-testid="awards-panel">
        <div className="panel-head compact">
          <h2>{state.seasonAwards ? "Season Awards" : state.week >= 8 ? "Season Award Watch" : "Season Award Watch Opens Week 8"}</h2>
          <Award size={20} />
        </div>
        {state.week >= 8 || state.seasonAwards || state.phase !== "regular" ? <AwardGrid awards={awardSource} /> : <p className="muted">Season award tracking unlocks after Week 8.</p>}
      </section>
      <StatLeaderboard state={state} />
      {state.seasonAwards && (
        <>
          <AwardTeamPanel title="All-American First Team" awards={state.seasonAwards.allAmericans.first} testId="all-american-first-panel" />
          <AwardTeamPanel title="All-American Second Team" awards={state.seasonAwards.allAmericans.second} testId="all-american-second-panel" />
          <AwardTeamPanel title="Freshman All-American" awards={state.seasonAwards.allAmericans.freshman} testId="all-american-freshman-panel" />
        </>
      )}
      {conferenceAwards && (
        <>
          <AwardTeamPanel title={`${userConference?.name ?? "Conference"} First Team`} awards={conferenceAwards.first} testId="all-conference-first-panel" />
          <AwardTeamPanel title={`${userConference?.name ?? "Conference"} Second Team`} awards={conferenceAwards.second} testId="all-conference-second-panel" />
          <AwardTeamPanel title={`${userConference?.name ?? "Conference"} Freshman Team`} awards={conferenceAwards.freshman} testId="all-conference-freshman-panel" />
        </>
      )}
      <section className="panel span-2" data-testid="playoff-panel">
        <div className="panel-head compact">
          <h2>{state.playoff ? "Summit Four Playoff" : "Latest Playoff Field"}</h2>
          <Trophy size={20} />
        </div>
        <PlayoffBracket games={playoffGames} teams={state.teams} priorPlayoffTeams={priorPlayoffTeams} championName={latestHistory?.championName} />
      </section>
      <section className="panel span-2">
        <div className="panel-head compact">
          <h2>Dynasty History</h2>
          <ClipboardList size={20} />
        </div>
        <div className="table-list">
          {state.history.slice(0, 10).map((entry) => (
            <div key={entry.year} className="table-row">
              <span>{entry.year}</span>
              <strong>{entry.championName ?? "No champion"}</strong>
              <span>{entry.awardWinners[0]?.playerName ?? "Awards pending"}</span>
              <span>{entry.topClasses[0]?.teamName ?? "Class pending"}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function AwardTeamPanel({ title: panelTitle, awards, testId }: { title: string; awards: AwardWinner[]; testId: string }) {
  return (
    <section className="panel span-2" data-testid={testId}>
      <div className="panel-head compact">
        <h2>{panelTitle}</h2>
        <Medal size={20} />
      </div>
      <HonorGrid awards={awards} limit={16} />
    </section>
  );
}

function StatLeaderboard({ state }: { state: DynastyState }) {
  const userTeam = getUserTeam(state);
  const [scope, setScope] = useState<LeaderboardScope>("national");
  const [statKey, setStatKey] = useState<LeaderboardStatKey>("passYards");
  const userConferenceTeamIds = new Set(state.conferences.find((conference) => conference.id === userTeam.conferenceId)?.teamIds ?? []);
  const rows = state.teams
    .filter((team) => scope === "national" || (scope === "conference" ? userConferenceTeamIds.has(team.id) : team.id === userTeam.id))
    .flatMap((team) =>
      team.roster.map((player) => ({
        team,
        player,
        value: player.stats[statKey],
      })),
    )
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || b.player.overall - a.player.overall)
    .slice(0, 12);

  return (
    <section className="panel span-2" data-testid="leaderboard-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Stat Leaders</p>
          <h2>{leaderboardStats.find((stat) => stat.key === statKey)?.label}</h2>
        </div>
        <LineChart size={20} />
      </div>
      <div className="filter-grid compact-filters">
        <label>
          Scope
          <select value={scope} onChange={(event) => setScope(event.target.value as LeaderboardScope)}>
            <option value="national">National</option>
            <option value="conference">Conference</option>
            <option value="team">Team</option>
          </select>
        </label>
        <label>
          Statistic
          <select value={statKey} onChange={(event) => setStatKey(event.target.value as LeaderboardStatKey)}>
            {leaderboardStats.map((stat) => (
              <option key={stat.key} value={stat.key}>{stat.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-list leaderboard-list">
        {rows.length ? (
          rows.map((row, index) => (
            <div key={`${row.player.id}-${statKey}`} className="table-row leaderboard-row">
              <span>{index + 1}</span>
              <strong>{row.player.name}</strong>
              <span>{row.player.position}</span>
              <span>{row.team.name}</span>
              <span>{row.value.toLocaleString()}</span>
            </div>
          ))
        ) : (
          <p className="muted">Stat leaders populate after games are played.</p>
        )}
      </div>
    </section>
  );
}

function PlayoffBracket({ games, teams, priorPlayoffTeams, championName }: { games: Game[]; teams: Team[]; priorPlayoffTeams: string[]; championName?: string }) {
  if (!games.length && priorPlayoffTeams.length) {
    return (
      <div className="playoff-bracket field-only">
        <div className="bracket-round">
          {priorPlayoffTeams.map((teamName, index) => (
            <article key={`${teamName}-${index}`} className="bracket-game">
              <p className="eyebrow">Seed {index + 1}</p>
              <strong>{teamName}</strong>
              <span>{championName === teamName ? "Crown Bowl Champion" : "Playoff qualifier"}</span>
            </article>
          ))}
        </div>
      </div>
    );
  }
  if (!games.length) return <p className="muted">Playoff bracket forms after Week 12.</p>;

  const rounds = [
    { label: "Quarterfinals", games: games.filter((game) => game.playoffRound === "quarter"), placeholder: "Opening bowls pending" },
    { label: "Semifinals", games: games.filter((game) => game.playoffRound === "semi"), placeholder: "Awaiting quarterfinal winners" },
    { label: "Crown Bowl", games: games.filter((game) => game.playoffRound === "final"), placeholder: "Awaiting semifinal winners" },
  ];

  return (
    <div className="playoff-bracket">
      {rounds.map((round) => (
        <div key={round.label} className="bracket-round">
          <h3>{round.label}</h3>
          {round.games.map((game) => {
            const home = teams.find((team) => team.id === game.homeTeamId);
            const away = teams.find((team) => team.id === game.awayTeamId);
            return (
              <article key={game.id} className="bracket-game">
                <p className="eyebrow">{game.bowlName}</p>
                <div className={clsx(game.result?.winnerTeamId === away?.id && "winner")}>
                  <strong>{away?.name}</strong>
                  <span>{game.result?.awayScore ?? "-"}</span>
                </div>
                <div className={clsx(game.result?.winnerTeamId === home?.id && "winner")}>
                  <strong>{home?.name}</strong>
                  <span>{game.result?.homeScore ?? "-"}</span>
                </div>
              </article>
            );
          })}
          {!round.games.length && (
            <article className="bracket-game placeholder">
              <p className="eyebrow">{round.label}</p>
              <strong>{round.placeholder}</strong>
              <span>Bracket advances after the prior round.</span>
            </article>
          )}
        </div>
      ))}
    </div>
  );
}

function Program({ state, onUpdate }: { state: DynastyState; onUpdate: (recipe: (state: DynastyState) => DynastyState) => void }) {
  const team = getUserTeam(state);
  const programKeys: (keyof ProgramRatings)[] = ["academics", "facilities", "training", "recruitingReach", "fanSupport", "prestige"];
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
      <section className="panel span-2">
        <div className="panel-head compact">
          <h2>Coach Pool</h2>
          <Users size={20} />
        </div>
        <div className="coach-pool-grid">
          {state.coachPool.slice(0, 9).map((coach) => (
            <button key={coach.id} className="coach-pool-card" onClick={() => onUpdate((current) => hireCoach(current, coach.id))}>
              <CoachPortrait index={coach.portraitIndex ?? 0} />
              <strong>{coach.name}</strong>
              <span>{coach.role} - {coach.scheme}</span>
              <em>Rec {coach.recruiting} - Dev {coach.development}</em>
            </button>
          ))}
        </div>
      </section>
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

function AwardGrid({ awards, limit = 12 }: { awards: AwardWinner[]; limit?: number }) {
  const list = awards.slice(0, limit);
  if (!list.length) return <p className="muted">Awards appear once games are simulated.</p>;
  return (
    <div className="award-grid">
      {list.map((award) => (
        <article key={`${award.awardName}-${award.playerId}`} className="card">
          <p className="eyebrow">{award.awardName}</p>
          <h3>{award.playerName}</h3>
          <p>
            {award.teamName} - {award.position}
          </p>
          <span>{award.note}</span>
        </article>
      ))}
    </div>
  );
}

function HonorGrid({ awards, limit = 16 }: { awards: AwardWinner[]; limit?: number }) {
  const list = awards.slice(0, limit);
  if (!list.length) return <p className="muted">Honor teams appear once season awards are available.</p>;
  return (
    <div className="award-grid honor-grid">
      {list.map((award) => (
        <article key={`${award.playerId}-${award.position}`} className="card">
          <p className="eyebrow">{award.position}</p>
          <h3>{award.playerName}</h3>
          <p>{award.teamName}</p>
          <span>{award.note}</span>
        </article>
      ))}
    </div>
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
  if (stats.passYards || stats.passTd || stats.interceptionsThrown) parts.push(`${stats.passYards} PYD, ${stats.passTd} TD, ${stats.interceptionsThrown} INT`);
  if (stats.rushYards || stats.rushTd) parts.push(`${stats.rushYards} RYD, ${stats.rushTd} TD`);
  if (stats.receivingYards || stats.receivingTd) parts.push(`${stats.receivingYards} REC, ${stats.receivingTd} TD`);
  if (stats.tackles || stats.sacks || stats.interceptions) parts.push(`${stats.tackles} TKL, ${stats.sacks} SCK, ${stats.interceptions} INT`);
  if (stats.pancakes) parts.push(`${stats.pancakes} PAN`);
  if (stats.fieldGoalAttempts) parts.push(`${stats.fieldGoals}/${stats.fieldGoalAttempts} FG`);
  return parts.join(" | ") || "Appeared";
}
