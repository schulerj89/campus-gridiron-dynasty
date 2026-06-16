import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  Award,
  BadgeDollarSign,
  CalendarDays,
  ChevronsRight,
  ClipboardList,
  GraduationCap,
  LineChart,
  Medal,
  Play,
  RotateCcw,
  Save,
  Search,
  Shield,
  Sparkles,
  Trophy,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { addRecruitToBoard, autoRecruit, gemBustFor, pitchRecruit, positionNeeds, scoutRecruit } from "./sim/recruiting";
import { createDynasty } from "./sim/generate";
import { advanceWeek, forceUserAward, forceUserPlayoff, getUserTeam, hireCoach, investProgramPoint, simulateSeasons, spendCoachPoint, topTeams } from "./sim/dynasty";
import { clearDynasty, loadActiveDynasty, saveDynasty } from "./sim/storage";
import { teamPower, teamUnitRatings } from "./sim/ratings";
import type { AttributeKey, AwardWinner, DynastyState, Player, ProgramRatings, Recruit, Team } from "./sim/types";

type Tab = "overview" | "roster" | "recruiting" | "schedule" | "awards" | "program" | "debug";

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
          <p className="eyebrow">Campus Gridiron Dynasty</p>
          <h1>{userTeam.name}</h1>
          <p className="muted">
            Year {state.year} of {state.maxYears} · {state.calendarYear} · {state.phase} · Week {state.week}
          </p>
        </div>
        <div className="topbar-actions">
          <button className="secondary" onClick={() => saveDynasty(state).then(() => setSaveStatus("Saved manually"))}>
            <Save size={18} />
            Save
          </button>
          <button className="primary" data-testid="advance-week" onClick={() => update(advanceWeek)} disabled={state.phase === "complete"}>
            <ChevronsRight size={18} />
            Advance
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
  selectedTeamId,
  savedState,
  onSelectTeam,
  onStart,
  onContinue,
  onReset,
}: {
  teams: Team[];
  selectedTeamId: string;
  savedState?: DynastyState;
  onSelectTeam: (teamId: string) => void;
  onStart: () => void;
  onContinue: () => void;
  onReset: () => void;
}) {
  return (
    <div className="home">
      <section className="hero" style={{ backgroundImage: "linear-gradient(90deg, rgba(9,13,18,.94), rgba(9,13,18,.58), rgba(9,13,18,.18)), url('/assets/dynasty-hero.png')" }}>
        <div className="hero-copy">
          <p className="eyebrow">Fictional 20-year dynasty sim</p>
          <h1>Campus Gridiron Dynasty</h1>
          <p className="hero-lede">
            Build a program through recruiting uncertainty, coach movement, playoff pressure, local storage persistence, and rating-driven game simulation.
          </p>
          <div className="feature-list" aria-label="Game features">
            <Feature icon={Shield} text="70 fictional programs across 7 conferences" />
            <Feature icon={Users} text="85-player rosters with 13 detailed ratings" />
            <Feature icon={Search} text="Thousands of recruits with hidden traits, scouting, gems, and busts" />
            <Feature icon={Trophy} text="Weekly awards, season honors, All-Americans, bowls, and playoff history" />
          </div>
          <div className="launch-panel">
            <label>
              Starting program
              <select value={selectedTeamId} onChange={(event) => onSelectTeam(event.target.value)} data-testid="team-select">
                {teams.slice(0, 70).map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} · {team.abbreviation}
                  </option>
                ))}
              </select>
            </label>
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
      <section className="panel span-2">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Dynasty Command</p>
            <h2>{userTeam.season.wins}-{userTeam.season.losses} · Power {teamPower(userTeam.roster)}</h2>
          </div>
          <button className="primary" onClick={() => onUpdate(advanceWeek)} disabled={state.phase === "complete"}>
            <ChevronsRight size={18} />
            Advance Week
          </button>
        </div>
        <div className="metric-grid">
          <Metric label="Program Rating" value={programRating(userTeam)} />
          <Metric label="Recruiting Points" value={state.recruiting.pointsRemaining} />
          <Metric label="Coach Points" value={userTeam.coachPoints} />
          <Metric label="Program Points" value={userTeam.programPoints} />
        </div>
        <div className="unit-grid">
          {Object.entries(units).map(([label, value]) => (
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

      <section className="panel">
        <div className="panel-head compact">
          <h2>Top 8</h2>
          <Medal size={20} />
        </div>
        <ol className="rank-list">
          {rankings.map((team) => (
            <li key={team.id}>
              <span>{team.season.rank ?? "-"}</span>
              <strong>{team.name}</strong>
              <em>{team.season.wins}-{team.season.losses}</em>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel">
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

      <section className="panel span-2">
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
  const sorted = [...team.roster].sort((a, b) => b.overall - a.overall);
  const featured = sorted[0];
  const byPosition = Object.entries(
    team.roster.reduce<Record<string, number>>((counts, player) => {
      counts[player.position] = (counts[player.position] ?? 0) + 1;
      return counts;
    }, {}),
  );
  return (
    <>
      <section className="panel span-2">
        <div className="panel-head compact">
          <h2>Roster Core</h2>
          <Users size={20} />
        </div>
        <div className="position-pills">
          {byPosition.map(([position, count]) => (
            <span key={position}>
              {position} {count}
            </span>
          ))}
        </div>
        <div className="player-grid">
          {sorted.slice(0, 28).map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
      </section>
      {featured && (
        <section className="panel span-2" data-testid="attributes-panel">
          <div className="panel-head compact">
            <h2>Attribute Board</h2>
            <LineChart size={20} />
          </div>
          <div className="attribute-board">
            <div className="featured-player">
              <Portrait index={featured.profileIndex} />
              <div>
                <p className="eyebrow">Featured Player</p>
                <h3>{featured.name}</h3>
                <p className="muted">
                  {featured.year} · {featured.position} · OVR {featured.overall} · Potential {featured.potential}
                </p>
              </div>
            </div>
            <div className="attribute-grid">
              {ATTRIBUTE_KEYS_FOR_UI.map((key) => (
                <div key={key} className="unit-bar">
                  <span>{title(key)}</span>
                  <strong>{featured.attributes[key]}</strong>
                  <div>
                    <i style={{ width: `${featured.attributes[key]}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function Recruiting({ state, onUpdate }: { state: DynastyState; onUpdate: (recipe: (state: DynastyState) => DynastyState) => void }) {
  const userTeam = getUserTeam(state);
  const needs = positionNeeds(userTeam).slice(0, 5);
  const board = state.recruiting.board.map((id) => state.recruits.find((recruit) => recruit.id === id)).filter((recruit): recruit is Recruit => Boolean(recruit));
  const available = state.recruits
    .filter((recruit) => recruit.stage !== "signed" && !state.recruiting.board.includes(recruit.id))
    .sort((a, b) => {
      const needA = needs.find((need) => need.position === a.position)?.need ?? 0;
      const needB = needs.find((need) => need.position === b.position)?.need ?? 0;
      return needB * 25 + b.stars * 12 + (b.interest[userTeam.id] ?? 0) - (needA * 25 + a.stars * 12 + (a.interest[userTeam.id] ?? 0));
    })
    .slice(0, 12);

  return (
    <>
      <section className="panel span-2">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Recruiting Board</p>
            <h2>{state.recruiting.pointsRemaining} / {state.recruiting.weeklyPoints} points</h2>
          </div>
          <button className="primary" data-testid="auto-recruit" onClick={() => onUpdate((current) => autoRecruit(current, "Manual auto-recruit run."))}>
            <Search size={18} />
            Auto Recruit
          </button>
        </div>
        <div className="need-row">
          {needs.map((need) => (
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
        <div className="panel-head compact">
          <h2>Recommended Prospects</h2>
          <Shield size={20} />
        </div>
        <div className="table-list">
          {available.map((recruit) => (
            <button key={recruit.id} className="table-row clickable" onClick={() => onUpdate((current) => addRecruitToBoard(current, recruit.id))}>
              <span>{"★".repeat(recruit.stars)}</span>
              <strong>{recruit.name}</strong>
              <span>{recruit.position}</span>
              <span>#{recruit.nationalRank}</span>
              <span>{recruit.hometown}</span>
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
          <p>{recruit.position} · {"★".repeat(recruit.stars)} · #{recruit.nationalRank}</p>
        </div>
      </div>
      <div className="mini-metrics">
        <span>Interest {recruit.interest[userTeam.id] ?? 0}</span>
        <span>{recruit.stage}</span>
        <span>Scout {recruit.scoutProgress}%</span>
      </div>
      <div className="known-attrs">
        {known.length ? (
          known.map((key) => (
            <span key={key}>
              {shortAttr(key)} {recruit.attributes[key]}
            </span>
          ))
        ) : (
          <span>No ratings unlocked</span>
        )}
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
              <em>{team.season.confWins}-{team.season.confLosses}</em>
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
              <div key={game.id} className="table-row">
                <span>W{game.week}</span>
                <strong>{away?.abbreviation} at {home?.abbreviation}</strong>
                <span>{game.bowlName ?? (game.conferenceGame ? "Conference" : "Non-conf")}</span>
                <span>{game.result?.summary ?? "Pending"}</span>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function Awards({ state }: { state: DynastyState }) {
  const playoffGames = state.playoff?.games ?? [];
  const latestHistory = state.history[0];
  const awardSource = state.seasonAwards?.nationalAwards ?? latestHistory?.awardWinners ?? [];
  const priorPlayoffTeams = latestHistory?.playoffTeams.map((id) => state.teams.find((team) => team.id === id)?.name ?? id) ?? [];
  return (
    <>
      <section className="panel span-2" data-testid="awards-panel">
        <div className="panel-head compact">
          <h2>{state.seasonAwards ? "Season Awards" : "Latest Season Awards"}</h2>
          <Award size={20} />
        </div>
        <AwardGrid awards={awardSource} />
      </section>
      {state.seasonAwards && (
        <section className="panel span-2" data-testid="all-american-panel">
          <div className="panel-head compact">
            <h2>All-American Teams</h2>
            <Medal size={20} />
          </div>
          <AwardGrid awards={[...state.seasonAwards.allAmericans.first.slice(0, 6), ...state.seasonAwards.allAmericans.second.slice(0, 6), ...state.seasonAwards.allAmericans.freshman.slice(0, 4)]} />
        </section>
      )}
      <section className="panel span-2" data-testid="playoff-panel">
        <div className="panel-head compact">
          <h2>{state.playoff ? "Summit Four Playoff" : "Latest Playoff Field"}</h2>
          <Trophy size={20} />
        </div>
        <div className="playoff-grid">
          {playoffGames.length ? (
            playoffGames.map((game) => {
              const home = state.teams.find((team) => team.id === game.homeTeamId);
              const away = state.teams.find((team) => team.id === game.awayTeamId);
              return (
                <article key={game.id} className="card">
                  <p className="eyebrow">{game.bowlName}</p>
                  <strong>{away?.name} at {home?.name}</strong>
                  <span>{game.result?.summary ?? game.playoffRound}</span>
                </article>
              );
            })
          ) : priorPlayoffTeams.length ? (
            priorPlayoffTeams.map((teamName, index) => (
              <article key={`${teamName}-${index}`} className="card">
                <p className="eyebrow">Seed {index + 1}</p>
                <strong>{teamName}</strong>
                <span>{latestHistory?.championName === teamName ? "Crown Bowl Champion" : "Playoff qualifier"}</span>
              </article>
            ))
          ) : (
            <p className="muted">Playoff bracket forms after Week 12.</p>
          )}
        </div>
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
          {programKeys.map((key) => (
            <button key={key} className="investment" onClick={() => onUpdate((current) => investProgramPoint(current, key))} disabled={team.programPoints <= 0}>
              <span>{title(String(key))}</span>
              <strong>{team.program[key] ?? 0}</strong>
            </button>
          ))}
        </div>
      </section>
      <section className="panel span-2">
        <div className="panel-head compact">
          <h2>Staff Room</h2>
          <UserRound size={20} />
        </div>
        <div className="staff-grid">
          {Object.values(team.coaches).map((coach) => (
            <article key={coach.id} className="card">
              <p className="eyebrow">{coach.role} · {coach.scheme}</p>
              <h3>{coach.name}</h3>
              <div className="mini-metrics">
                <span>Rec {coach.recruiting}</span>
                <span>Dev {coach.development}</span>
                <span>Tac {coach.tactics}</span>
                <span>Pts {coach.points}</span>
              </div>
              <div className="button-row compact-row">
                <button className="secondary" onClick={() => onUpdate((current) => spendCoachPoint(current, coach.role, "recruiting"))}>Rec</button>
                <button className="secondary" onClick={() => onUpdate((current) => spendCoachPoint(current, coach.role, "development"))}>Dev</button>
                <button className="secondary" onClick={() => onUpdate((current) => spendCoachPoint(current, coach.role, "tactics"))}>Tac</button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="panel span-2">
        <div className="panel-head compact">
          <h2>Coach Pool</h2>
          <Users size={20} />
        </div>
        <div className="table-list">
          {state.coachPool.slice(0, 9).map((coach) => (
            <button key={coach.id} className="table-row clickable" onClick={() => onUpdate((current) => hireCoach(current, coach.id))}>
              <strong>{coach.name}</strong>
              <span>{coach.role}</span>
              <span>{coach.scheme}</span>
              <span>Rec {coach.recruiting}</span>
              <span>Dev {coach.development}</span>
            </button>
          ))}
        </div>
      </section>
    </>
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

function PlayerCard({ player }: { player: Player }) {
  const attrs = keyAttrs(player).slice(0, 4);
  return (
    <article className="card player-card">
      <div className="card-title">
        <Portrait index={player.profileIndex} />
        <div>
          <strong>{player.name}</strong>
          <p>{player.year} · {player.position} · OVR {player.overall}</p>
        </div>
      </div>
      <div className="known-attrs">
        {attrs.map((key) => (
          <span key={key}>
            {shortAttr(key)} {player.attributes[key]}
          </span>
        ))}
      </div>
      <p className="muted">{player.hometown}</p>
    </article>
  );
}

function AwardGrid({ awards }: { awards: AwardWinner[] }) {
  const list = topAwardList(awards);
  if (!list.length) return <p className="muted">Awards appear once games are simulated.</p>;
  return (
    <div className="award-grid">
      {list.map((award) => (
        <article key={`${award.awardName}-${award.playerId}`} className="card">
          <p className="eyebrow">{award.awardName}</p>
          <h3>{award.playerName}</h3>
          <p>{award.teamName} · {award.position}</p>
          <span>{award.note}</span>
        </article>
      ))}
    </div>
  );
}

function Portrait({ index }: { index: number }) {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return <span className="portrait" style={{ backgroundPosition: `${column * 33.333}% ${row * 33.333}%` }} aria-hidden="true" />;
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

function programRating(team: Team): number {
  const { prestige, academics, facilities, training, recruitingReach, fanSupport } = team.program;
  return Math.round((prestige + academics + facilities + training + recruitingReach + fanSupport) / 6);
}

function keyAttrs(player: Player): AttributeKey[] {
  if (player.position === "QB") return ["throwPower", "accuracy", "awareness", "speed"];
  if (player.position === "HB") return ["speed", "catching", "awareness", "runBlock"];
  if (player.position === "WR") return ["catching", "routeRunning", "speed", "awareness"];
  if (player.position === "TE") return ["catching", "routeRunning", "runBlock", "passBlock"];
  if (player.position === "OL") return ["runBlock", "passBlock", "awareness", "speed"];
  if (player.position === "DL") return ["tackle", "defAwareness", "speed", "interception"];
  if (player.position === "LB") return ["tackle", "defAwareness", "interception", "speed"];
  if (player.position === "CB" || player.position === "S") return ["interception", "defAwareness", "speed", "tackle"];
  return ["kickPower", "kickAccuracy", "awareness", "speed"];
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

function topAwardList<T>(awards: T[]): T[] {
  return awards.slice(0, 12);
}
