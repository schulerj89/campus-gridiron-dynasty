# AGENTS.md

## Project

Campus Gridiron Dynasty is a fictional browser-based college football dynasty sim. Keep all content original: no real schools, conferences, awards, players, coaches, logos, or licensed marks.

## Core Invariants

- The world has 70 teams across 7 conferences.
- Generated team cities should not repeat while the fictional city pool has enough unused names.
- First and last name pools should stay broad enough to reduce duplicate player and recruit names.
- Standard generated rosters are 85 players per team.
- Player ratings use the 13 keys in `src/sim/types.ts`.
- Initial player ratings and attributes are capped at 93.
- Position-specific attribute caps in `src/sim/ratings.ts` limit unrelated skills for each position.
- Recruit hidden trait bands live in `src/sim/ratings.ts`; elite recruit entry cap is 83.
- Each recruiting class should include thousands of recruits with about 2-4% five-stars and 10-20% four-stars.
- Recruiting scholarships are tracked per recruit, add prospects to the board, and gate one-pitch-per-week recruiting actions.
- Recruiting action points are tracked per recruit and return when a board prospect commits.
- Removing a recruit from the board or rescinding a scholarship should free board/offer state but not immediately refund sunk recruiting points.
- Scouting an off-board recruit should require board space before spending points.
- Auto-recruit should fill the board, balance position targets against team needs, use scouting/gem-bust information when available, and reallocate refunded points after commitments.
- Committed recruits should preserve their commitment stage through weekly recruiting updates until signing day.
- Recruiting UI should keep position needs visible with roster target, active board, offer, and pledge coverage.
- Signing day should distribute enough recruits for every team to sustain roster turnover before walk-ons are needed.
- Signed recruit player IDs must include the dynasty signing year so multi-season classes cannot collide.
- Offseason advancement exposes departures, four late recruiting weeks, signing day, preseason player development, and kickoff as separate steps.
- The Overview offseason report should focus on only the active stage: departures, recruiting, signing day, or development.
- The Overview offseason dashboard should hide regular-season command, awards, and current-poll panels.
- Signing day class rows should paginate and open read-only recruit detail modals for signed prospects.
- Signing day must not remove returning players before the offseason departure report is applied.
- Teams must be restored to the 85-player roster floor after offseason turnover; emergency walk-ons should be labeled and initially capped around 60 overall.
- Player offseason progression must not regress attributes or overall.
- Signing-day recruits are incoming freshmen and must be excluded from preseason development/year progression until kickoff clears the marker.
- Player hot/cold streaks should be rare, temporary, and applied through effective ratings rather than permanent base ratings.
- Receiving stat distribution should keep 5-7 targets involved while giving WR1 and elite WRs realistic usage shares.
- Offensive strategies should affect pass/run volume while still adjusting toward roster strength and game state.
- Game box scores should expose strategy, play count, pass/rush attempts, targets, separate FG/XP stats, and scoring play-by-play.
- Dynasty length is 20 years.
- Debug Sim To End should finish the 20th season and reach the `complete` phase.
- Saves are local-only through IndexedDB via `src/sim/storage.ts`; localStorage may keep only the active save pointer and compact summary.
- IndexedDB migrations should preserve the `dynasties` object store and its `updatedAt` index for fast latest-save recovery.
- National poll snapshots live on `DynastyState.rankings` and should preserve Top 25 entries, full 1-70 all-team rankings, votes, first-place votes, and movement history.
- The Rankings tab should display the full 1-70 national board; Top 25 status still controls matchup ranked labels and moved-in/out panels.
- Rankings, awards, honor teams, and stat leaderboards should visually highlight the user's program when it appears.
- Weekly matchup previews should be derived from pending user games, poll ranks, team power, and unit ratings; they should not alter simulation results.
- Matchup previews should only display ranked labels for teams currently in the Top 25 poll entries.
- The Schedule tab should display regular-season games and postseason playoff games with box-score access.
- Regular-season schedules should give every team 12 games without duplicate opponent pairings when possible.
- During postseason, the Overview dashboard should prioritize the playoff bracket and hide regular-season summary panels.
- Program record book summaries should be calculated from completed user-team history, not stored as separate mutable dynasty state.
- Completed team-history entries should use current-season award names only; do not re-count cumulative player career awards.
- Legacy save loading should normalize missing debug, recruiting, history, weekly award, and poll movement fields before rendering or advancing.
- Legacy save loading should sanitize stale user-team, recruit offer, recruit interest, commitment, board, and investment IDs before simulation code uses them.
- Legacy offseason report loading should default missing topClasses, departures, signees, walk-ons, progressions, and program changes.
- Active save loading should recover the newest IndexedDB dynasty if the active localStorage pointer is missing or stale.
- Smoke tests should use `scripts/run-smoke.mjs` and fixed seed query params instead of reusing an arbitrary preview server.
- Hiring from the coach pool should return the displaced user coach to the pool with no `hiredBy` assignment.
- Program Blueprint changes must reconcile recruiting `pointsRemaining + pointsSpent` to the current season budget.
- Program Blueprint rebuilds must preserve already-spent recruiting points as sunk costs when the budget changes.
- Annual Program Blueprint state lives on each team and must affect recruiting budget, scouting speed, recruiting pressure, player development, retention, program review, and coach carousel stability.
- Program Blueprint focus presets should auto-fill the plan before kickoff while Custom preserves manual allocation.
- Unspent user Program Blueprint points should auto-fill at Week 1 kickoff while preserving any manual allocations.
- Director Goals should appear before Week 1 and the previous resolved blueprint review should remain visible during the next preseason.
- Team helmets use generated fictional 16-bit PNG assets in `public/assets/team-helmets`; do not add real logos or licensed marks.
- Roster Room can inspect any team roster, but depth-chart movement should remain user-team only.

## Frequent Commands

```bash
npm run build
npm run test
npm run release:check
npm run smoke
```

Run `npm run smoke` before claiming WebKit/mobile support. It covers Chromium desktop, WebKit desktop, and WebKit iPhone 15 Pro Max.
The smoke script chooses an available preview port and smoke specs use fixed seed query params for repeatable screenshots.
`npm run test` intentionally disables file parallelism because dynasty generation is CPU-heavy and can exceed default per-test timeouts when several suites generate worlds at once.

## QA Expectations

- Use the Debug tab for forced playoff, forced award, forced walk-on need, auto recruit, and multi-season checks.
- Keep screenshots in `artifacts/screenshots`, including rankings movement, roster/depth chart, other-team roster, player modal, recruiting needs, matchup previews, box score/play-by-play, postseason schedule, program record book, offensive strategy, Program Blueprint, director review, awards, all-conference, dashboard/playoff bracket, offseason recruiting, offseason signing, signing-day pagination, signing-day recruit modal, walk-ons, preseason progression, program review, and mobile dashboard coverage.
- Do not commit `test-results` or Playwright reports.

## UI Organization

- `src/App.tsx` owns app shell state, tab routing, and the main dashboard screens.
- `src/components/AwardsView.tsx` owns awards, stat leaderboard, honor-team, and playoff bracket presentation.
- `src/components/RankingsView.tsx` owns national poll presentation.
- `src/components/PaginationControls.tsx` owns reusable table pagination controls.
- `src/components/TeamHelmet.tsx` maps `Team.helmetIndex` to generated helmet PNG assets.
- `src/sim/blueprint.ts` owns Program Blueprint categories, director goal evaluation, and sim-effect helpers.
- `src/sim/matchup.ts` owns pending user-game matchup preview calculations.
- `src/sim/history.ts` owns derived program record-book summaries.

## Repo-Local Skills

This repo includes local skill briefs under `skills/`:

- `skills/cfb-game-expert`: dynasty-mode research translation.
- `skills/code-review-integrity`: code review, integrity checks, test coverage, screenshots, and version-bump hygiene.
- `skills/dynasty-game-qa`: test and smoke coverage checklist.
- `skills/sim-game-director`: game-director review priorities.
- `skills/stat-pace-expert`: stat pacing, box-score realism, weekly awards, and leaderboard balance.

Update this file when core simulation rules, commands, storage, or QA expectations change.

## Versioning

- Bump `package.json`, `package-lock.json`, and `src/version.ts` together.
- Add a `CHANGELOG.md` entry for every app version bump.
- Run `npm run release:check` before committing version bumps.
- Update smoke expectations when the visible version changes.
