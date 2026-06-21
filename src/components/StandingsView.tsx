import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ListOrdered, Trophy } from "lucide-react";
import { TeamHelmet } from "./TeamHelmet";
import type { Conference, DynastyState, Team } from "../sim/types";

type StandingsRowData = {
  team: Team;
  conference: Conference;
  conferenceRank: number;
  nationalRank?: number;
  playoffSeed?: number;
  pointDifferential: number;
};

export function Standings({ state }: { state: DynastyState }) {
  const userTeam = state.teams.find((team) => team.id === state.userTeamId);
  const defaultConferenceId = userTeam?.conferenceId ?? state.conferences[0]?.id ?? "";
  const [selectedConferenceId, setSelectedConferenceId] = useState(defaultConferenceId);
  const standings = useMemo(() => buildStandings(state), [state]);
  const selectedConference = standings.find((entry) => entry.conference.id === selectedConferenceId) ?? standings.find((entry) => entry.conference.id === defaultConferenceId) ?? standings[0];
  const playoffRows = playoffPictureRows(state, standings.flatMap((entry) => entry.rows));
  const playoffTitle = state.playoff ? "Playoff Field" : state.phase === "regular" && state.week >= 8 ? "Projected Playoff Field" : "Poll-Based Playoff Watch";

  useEffect(() => {
    setSelectedConferenceId((current) => (standings.some((entry) => entry.conference.id === current) ? current : defaultConferenceId));
  }, [defaultConferenceId, standings]);

  return (
    <>
      <section className="panel span-2" data-testid="standings-playoff-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Top 8</p>
            <h2>{playoffTitle}</h2>
            <p className="muted">The postseason field follows the final Week 12 national poll order. Forced debug berths are shown as the first seed.</p>
          </div>
          <Trophy size={20} />
        </div>
        <div className="table-list standings-table">
          <div className="table-row standings-row standings-header">
            <span>Seed</span>
            <strong>Team</strong>
            <span>Conf</span>
            <span>Overall</span>
            <span>Diff</span>
            <span>Natl</span>
          </div>
          {playoffRows.map((row, index) => (
            <StandingsRow key={row.team.id} row={{ ...row, playoffSeed: index + 1 }} userTeamId={state.userTeamId} mode="playoff" />
          ))}
        </div>
      </section>

      {selectedConference && (
        <section className="panel span-2 standings-mobile-focus" data-testid="standings-selected-conference-panel">
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">Conference Standings</p>
              <h2>{selectedConference.conference.name}</h2>
            </div>
            <ListOrdered size={20} />
          </div>
          <label>
            Conference
            <select value={selectedConference.conference.id} onChange={(event) => setSelectedConferenceId(event.target.value)} data-testid="standings-conference-select">
              {standings.map((entry) => (
                <option key={entry.conference.id} value={entry.conference.id}>
                  {entry.conference.name}
                </option>
              ))}
            </select>
          </label>
          <ConferenceStandingsTable rows={selectedConference.rows} userTeamId={state.userTeamId} />
        </section>
      )}

      <section className="panel span-2 standings-all-conferences" data-testid="conference-standings-panel">
        <div className="panel-head compact">
          <div>
            <p className="eyebrow">Conference Standings</p>
            <h2>All Conferences</h2>
          </div>
          <ListOrdered size={20} />
        </div>
        <div className="conference-standings-grid">
          {standings.map((entry) => (
            <section key={entry.conference.id} className="conference-standings-card">
              <div className="conference-card-head">
                <h3>{entry.conference.name}</h3>
                <span>{entry.rows.length} teams</span>
              </div>
              <ConferenceStandingsTable rows={entry.rows} userTeamId={state.userTeamId} />
            </section>
          ))}
        </div>
      </section>
    </>
  );
}

function ConferenceStandingsTable({ rows, userTeamId }: { rows: StandingsRowData[]; userTeamId: string }) {
  return (
    <div className="table-list standings-table">
      <div className="table-row standings-row standings-header">
        <span>Place</span>
        <strong>Team</strong>
        <span>Conf</span>
        <span>Overall</span>
        <span>Diff</span>
        <span>Natl</span>
        <span>Seed</span>
      </div>
      {rows.map((row) => (
        <StandingsRow key={row.team.id} row={row} userTeamId={userTeamId} mode="conference" />
      ))}
    </div>
  );
}

function StandingsRow({ row, userTeamId, mode }: { row: StandingsRowData; userTeamId: string; mode: "conference" | "playoff" }) {
  const place = mode === "playoff" ? row.playoffSeed : row.conferenceRank;
  return (
    <div className={clsx("table-row standings-row", row.team.id === userTeamId && "user-team-highlight")} data-testid={row.team.id === userTeamId ? "user-team-standings-row" : undefined}>
      <span className="standings-place">#{place}</span>
      <strong className="standings-team">
        <TeamHelmet team={row.team} size="sm" />
        {row.team.name}
      </strong>
      <div className="standings-meta-grid">
        <span className="standings-conf" data-label="Conf">{row.team.season.confWins}-{row.team.season.confLosses}</span>
        <span className="standings-record" data-label="Overall">{row.team.season.wins}-{row.team.season.losses}</span>
        <span className={clsx("standings-diff", row.pointDifferential >= 0 ? "positive" : "negative")} data-label="Diff">
          {row.pointDifferential >= 0 ? "+" : ""}{row.pointDifferential}
        </span>
        <span className="standings-national-rank" data-label="Natl">{row.nationalRank ? `#${row.nationalRank}` : "-"}</span>
        {mode === "conference" && <span className="standings-seed" data-label="Seed">{row.playoffSeed ? `#${row.playoffSeed}` : "-"}</span>}
      </div>
    </div>
  );
}

function buildStandings(state: DynastyState): { conference: Conference; rows: StandingsRowData[] }[] {
  const latestPoll = state.rankings[0];
  const pollEntries = latestPoll?.allEntries?.length ? latestPoll.allEntries : latestPoll?.entries ?? [];
  const nationalRankByTeam = new Map(pollEntries.map((entry) => [entry.teamId, entry.rank]));
  const playoffSeedByTeam = new Map((state.playoff?.seeds ?? pollEntries.slice(0, 8).map((entry) => entry.teamId)).map((teamId, index) => [teamId, index + 1]));
  const teamById = new Map(state.teams.map((team) => [team.id, team]));

  return state.conferences.map((conference) => {
    const rows = conference.teamIds
      .map((teamId) => teamById.get(teamId))
      .filter((team): team is Team => Boolean(team))
      .sort(compareStandingsTeams(nationalRankByTeam))
      .map((team, index) => ({
        team,
        conference,
        conferenceRank: index + 1,
        nationalRank: nationalRankByTeam.get(team.id),
        playoffSeed: playoffSeedByTeam.get(team.id),
        pointDifferential: team.season.pointsFor - team.season.pointsAgainst,
      }));
    return { conference, rows };
  });
}

function playoffPictureRows(state: DynastyState, rows: StandingsRowData[]): StandingsRowData[] {
  const byTeamId = new Map(rows.map((row) => [row.team.id, row]));
  const latestPoll = state.rankings[0];
  const pollEntries = latestPoll?.allEntries?.length ? latestPoll.allEntries : latestPoll?.entries ?? [];
  const seedIds = state.playoff?.seeds ?? pollEntries.slice(0, 8).map((entry) => entry.teamId);
  return seedIds.map((teamId) => byTeamId.get(teamId)).filter((row): row is StandingsRowData => Boolean(row));
}

function compareStandingsTeams(nationalRankByTeam: Map<string, number>) {
  return (a: Team, b: Team) => {
    const conferenceDelta = b.season.confWins - a.season.confWins || a.season.confLosses - b.season.confLosses;
    if (conferenceDelta) return conferenceDelta;
    const overallDelta = b.season.wins - a.season.wins || a.season.losses - b.season.losses;
    if (overallDelta) return overallDelta;
    const pointDelta = b.season.pointsFor - b.season.pointsAgainst - (a.season.pointsFor - a.season.pointsAgainst);
    if (pointDelta) return pointDelta;
    return (nationalRankByTeam.get(a.id) ?? 999) - (nationalRankByTeam.get(b.id) ?? 999) || a.name.localeCompare(b.name);
  };
}
