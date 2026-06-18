import { useState } from "react";
import clsx from "clsx";
import { LineChart } from "lucide-react";
import { PaginationControls } from "./PaginationControls";
import { getUserTeam } from "../sim/dynasty";
import type { DynastyState, Player, PlayerStats, Team } from "../sim/types";

type LeaderboardStatKey = keyof PlayerStats | "completionPct";

interface LeaderboardStatOption {
  key: LeaderboardStatKey;
  label: string;
}

interface LeaderboardColumn {
  key: LeaderboardStatKey;
  label: string;
}

interface LeaderboardRow {
  team: Team;
  player: Player;
  value: number;
}

const leaderboardStats: LeaderboardStatOption[] = [
  { key: "passAttempts", label: "Pass Attempts" },
  { key: "passCompletions", label: "Pass Completions" },
  { key: "completionPct", label: "Completion Percentage" },
  { key: "passYards", label: "Passing Yards" },
  { key: "passTd", label: "Passing TD" },
  { key: "interceptionsThrown", label: "INT Thrown" },
  { key: "rushAttempts", label: "Rushing Attempts" },
  { key: "rushYards", label: "Rushing Yards" },
  { key: "rushTd", label: "Rushing TD" },
  { key: "receivingTargets", label: "Receiving Targets" },
  { key: "receivingYards", label: "Receiving Yards" },
  { key: "receivingTd", label: "Receiving TD" },
  { key: "tackles", label: "Tackles" },
  { key: "sacks", label: "Sacks" },
  { key: "interceptions", label: "Interceptions" },
  { key: "pancakes", label: "Pancakes" },
  { key: "fieldGoals", label: "Field Goals" },
  { key: "extraPoints", label: "Extra Points" },
];

const leaderboardColumns: LeaderboardColumn[] = [
  { key: "passCompletions", label: "Comp" },
  { key: "passAttempts", label: "Pass Att" },
  { key: "completionPct", label: "Comp %" },
  { key: "passYards", label: "Pass Yds" },
  { key: "passTd", label: "Pass TD" },
  { key: "interceptionsThrown", label: "INT-T" },
  { key: "rushAttempts", label: "Rush Att" },
  { key: "rushYards", label: "Rush Yds" },
  { key: "rushTd", label: "Rush TD" },
  { key: "receivingTargets", label: "Targets" },
  { key: "receivingYards", label: "Rec Yds" },
  { key: "receivingTd", label: "Rec TD" },
  { key: "tackles", label: "Tkl" },
  { key: "sacks", label: "Sck" },
  { key: "interceptions", label: "Def INT" },
  { key: "pancakes", label: "Pan" },
  { key: "fieldGoals", label: "FG" },
  { key: "fieldGoalAttempts", label: "FGA" },
  { key: "extraPoints", label: "XP" },
  { key: "extraPointAttempts", label: "XPA" },
];

const LEADERBOARD_PAGE_SIZE = 10;
const USER_TEAM_SCOPE = "user-team";
const NATIONAL_SCOPE = "national";

export function Stats({ state }: { state: DynastyState }) {
  return <StatLeaderboard state={state} />;
}

function StatLeaderboard({ state }: { state: DynastyState }) {
  const userTeam = getUserTeam(state);
  const [scope, setScope] = useState(NATIONAL_SCOPE);
  const [statKey, setStatKey] = useState<LeaderboardStatKey>("passYards");
  const [page, setPage] = useState(1);
  const selectedStat = leaderboardStats.find((stat) => stat.key === statKey) ?? leaderboardStats[0]!;
  const rows = buildRows(state, scope, statKey).sort((a, b) => b.value - a.value || b.player.overall - a.player.overall);
  const pageCount = Math.max(1, Math.ceil(rows.length / LEADERBOARD_PAGE_SIZE));
  const visibleRows = rows.slice((page - 1) * LEADERBOARD_PAGE_SIZE, page * LEADERBOARD_PAGE_SIZE);
  const changeScope = (nextScope: string) => {
    setScope(nextScope);
    setPage(1);
  };
  const changeStat = (nextStat: LeaderboardStatKey) => {
    setStatKey(nextStat);
    setPage(1);
  };

  return (
    <section className="panel span-2 stats-leaderboard-panel" data-testid="leaderboard-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Stat Leaders</p>
          <h2>{selectedStat.label}</h2>
          <p className="muted">Filter national leaders, individual conferences, or your own roster without leaving the stats page.</p>
        </div>
        <LineChart size={20} />
      </div>
      <div className="filter-grid compact-filters stats-filters">
        <label>
          Scope
          <select value={scope} onChange={(event) => changeScope(event.target.value)} data-testid="leaderboard-scope-select">
            <option value={NATIONAL_SCOPE}>National</option>
            {state.conferences.map((conference) => (
              <option key={conference.id} value={conference.id}>{conference.name}</option>
            ))}
            <option value={USER_TEAM_SCOPE}>User Team</option>
          </select>
        </label>
        <label>
          Statistic
          <select value={statKey} onChange={(event) => changeStat(event.target.value as LeaderboardStatKey)} data-testid="leaderboard-stat-select">
            {leaderboardStats.map((stat) => (
              <option key={stat.key} value={stat.key}>{stat.label}</option>
            ))}
          </select>
        </label>
      </div>
      {statKey === "completionPct" && (
        <p className="muted stats-note">Completion percentage requires at least 10 attempts per game played to qualify.</p>
      )}
      <div className="table-list leaderboard-list stats-table-scroll">
        <div className="table-row leaderboard-row leaderboard-header">
          <span>Rank</span>
          <strong>Player</strong>
          <span>Pos</span>
          <span>Team</span>
          {leaderboardColumns.map((column) => (
            <span key={column.key} className={clsx(column.key === statKey && "selected-stat")}>{column.label}</span>
          ))}
        </div>
        {visibleRows.length ? (
          visibleRows.map((row, index) => (
            <div key={`${row.player.id}-${statKey}`} className={clsx("table-row leaderboard-row", row.team.id === userTeam.id && "user-team-highlight")} data-testid={row.team.id === userTeam.id ? "user-team-leaderboard-row" : undefined}>
              <span>{(page - 1) * LEADERBOARD_PAGE_SIZE + index + 1}</span>
              <strong>{row.player.name}</strong>
              <span>{row.player.position}</span>
              <span>{row.team.name}</span>
              {leaderboardColumns.map((column) => (
                <span key={column.key} className={clsx(column.key === statKey && "selected-stat")}>
                  {formatStat(row.player.stats, column.key)}
                </span>
              ))}
            </div>
          ))
        ) : (
          <p className="muted">Stat leaders populate after games are played.</p>
        )}
      </div>
      <PaginationControls page={page} pageCount={pageCount} total={rows.length} pageSize={LEADERBOARD_PAGE_SIZE} label="leaders" onPageChange={setPage} />
    </section>
  );
}

function buildRows(state: DynastyState, scope: string, statKey: LeaderboardStatKey): LeaderboardRow[] {
  const userTeam = getUserTeam(state);
  const selectedConference = state.conferences.find((conference) => conference.id === scope);
  const teamIds = new Set(selectedConference?.teamIds ?? []);
  return state.teams
    .filter((team) => {
      if (scope === NATIONAL_SCOPE) return true;
      if (scope === USER_TEAM_SCOPE) return team.id === userTeam.id;
      return teamIds.has(team.id);
    })
    .flatMap((team) =>
      team.roster.map((player) => ({
        team,
        player,
        value: statValue(player.stats, statKey),
      })),
    )
    .filter((row) => qualifies(row.player.stats, statKey) && row.value > 0);
}

function qualifies(stats: PlayerStats, key: LeaderboardStatKey): boolean {
  if (key !== "completionPct") return true;
  return stats.passAttempts >= Math.max(10, stats.games * 10);
}

function statValue(stats: PlayerStats, key: LeaderboardStatKey): number {
  if (key === "completionPct") return stats.passAttempts ? (stats.passCompletions / stats.passAttempts) * 100 : 0;
  return stats[key];
}

function formatStat(stats: PlayerStats, key: LeaderboardStatKey): string {
  if (key === "completionPct") return stats.passAttempts ? `${Math.round((stats.passCompletions / stats.passAttempts) * 100)}%` : "-";
  return stats[key].toLocaleString();
}
