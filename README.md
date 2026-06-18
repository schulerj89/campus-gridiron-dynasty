# Campus Gridiron Dynasty

A fictional college football dynasty simulation web app built with React, TypeScript, Vite, Vitest, and Playwright.

The app creates a 20-year dynasty with 70 made-up programs, 7 conferences, 85-player rosters, thousands of recruits per cycle, hidden recruit traits, annual Program Blueprint budgets, director goals, coach movement, program investments, weekly awards, season awards, all-national/all-conference teams, fictional bowls, and an 8-team playoff.

## Run

```bash
npm install
npm run dev
```

The app stores saves locally in IndexedDB. Local storage only keeps the active save pointer because the dynasty state includes thousands of players and recruits.

## Test

```bash
npm run build
npm run test
npm run release:check
npm run smoke
```

Smoke coverage runs Chromium desktop, WebKit desktop, and WebKit with an iPhone 15 Pro Max profile. The smoke test also uses the debug controls to force a user playoff berth, force a user award winner, force walk-on roster need, auto-recruit, and simulate three seasons.
`npm run test` runs simulation-heavy test files sequentially for stable timing. `npm run smoke` chooses an available local preview port and the smoke specs use fixed seed query params so screenshots are repeatable.

## Versioning

When bumping the app version, update `package.json`, `package-lock.json`, `src/version.ts`, smoke expectations, and `CHANGELOG.md` in the same change. Run `npm run release:check` before committing a version bump.

QA screenshots are written to:

- `artifacts/screenshots/home-desktop.png`
- `artifacts/screenshots/dashboard-desktop.png`
- `artifacts/screenshots/dashboard-next-game-desktop.png`
- `artifacts/screenshots/rankings-desktop.png`
- `artifacts/screenshots/rankings-movement-desktop.png`
- `artifacts/screenshots/roster-desktop.png`
- `artifacts/screenshots/roster-other-team-desktop.png`
- `artifacts/screenshots/depth-chart-desktop.png`
- `artifacts/screenshots/player-profile-modal-desktop.png`
- `artifacts/screenshots/player-stats-modal-desktop.png`
- `artifacts/screenshots/attributes-desktop.png`
- `artifacts/screenshots/recruiting-desktop.png`
- `artifacts/screenshots/recruiting-needs-desktop.png`
- `artifacts/screenshots/recruiting-filters-desktop.png`
- `artifacts/screenshots/recruiting-scholarship-modal-desktop.png`
- `artifacts/screenshots/program-blueprint-desktop.png`
- `artifacts/screenshots/program-blueprint-review-desktop.png`
- `artifacts/screenshots/program-staff-desktop.png`
- `artifacts/screenshots/coach-pool-postseason-desktop.png`
- `artifacts/screenshots/box-score-desktop.png`
- `artifacts/screenshots/schedule-matchup-preview-desktop.png`
- `artifacts/screenshots/schedule-postseason-desktop.png`
- `artifacts/screenshots/player-of-week-desktop.png`
- `artifacts/screenshots/conference-player-of-week-desktop.png`
- `artifacts/screenshots/leaderboard-desktop.png`
- `artifacts/screenshots/recruiting-commitments-desktop.png`
- `artifacts/screenshots/awards-desktop.png`
- `artifacts/screenshots/all-american-desktop.png`
- `artifacts/screenshots/all-american-second-desktop.png`
- `artifacts/screenshots/all-conference-first-desktop.png`
- `artifacts/screenshots/all-conference-second-desktop.png`
- `artifacts/screenshots/program-record-book-desktop.png`
- `artifacts/screenshots/dashboard-playoff-bracket-desktop.png`
- `artifacts/screenshots/playoffs-desktop.png`
- `artifacts/screenshots/awards-playoff-desktop.png`
- `artifacts/screenshots/offseason-dashboard-desktop.png`
- `artifacts/screenshots/offseason-departures-desktop.png`
- `artifacts/screenshots/offseason-extra-recruiting-desktop.png`
- `artifacts/screenshots/offseason-all-classes-desktop.png`
- `artifacts/screenshots/offseason-recruiting-rankings-desktop.png`
- `artifacts/screenshots/preseason-progression-desktop.png`
- `artifacts/screenshots/offseason-program-review-desktop.png`
- `artifacts/screenshots/offseason-walk-ons-desktop.png`
- `artifacts/screenshots/offseason-recruiting-desktop.png`
- `artifacts/screenshots/mobile-dashboard.png`

## Generated Assets

The home hero, the 14-portrait 8-bit player sprite sheet, the 10-portrait coach sprite sheet, and the 14 generated helmet images were generated with the built-in image generator and copied into:

- `public/assets/dynasty-hero.png`
- `public/assets/portrait-sprite.png`
- `public/assets/coach-portrait-sprite.png`
- `public/assets/team-helmets/helmet-00.png` through `helmet-13.png`

## Design Rules

- Do not use real college names, real awards, real athletes, real coaches, real conferences, or real logos.
- Initial generated players must not exceed 93 in any rating.
- Generated players and recruits also use position-specific off-skill caps so non-role attributes stay plausible.
- Team helmets use generated fictional 16-bit PNG assets with no logos, letters, mascots, or licensed marks.
- The Roster Room should allow viewing any program roster while keeping depth-chart movement editable only for the user program.
- National poll rankings are stored as dynasty snapshots with Top 25 entries, full 1-70 all-team ranks, votes, first-place votes, and weekly movement.
- Matchup previews should only display ranked labels for teams currently in the Top 25 poll entries.
- Recruit generated ratings must stay within their hidden trait entry bands, with `elite` capped at 83.
- Annual Program Blueprint allocations must persist, lock after kickoff, and affect recruiting, scouting, development, retention, program review, and coach movement.
- Any unspent user Program Blueprint points auto-fill at Week 1 kickoff without replacing manual allocations.
- Director Goals should be visible before Week 1 and the previous season's resolved review should remain inspectable during the next preseason.
- Recruiting traits stay hidden until signing day unless scouting fully unlocks gem/bust information.
- Recruiting scholarships are one-time offers that add prospects to the board, and pitches require an offer with a one-week cooldown per recruit.
- Recruiting action points are tracked by recruit and return when a board prospect commits.
- Removing a recruit from the board or rescinding a scholarship frees the board/offer state but does not immediately refund sunk recruiting points.
- Scouting an off-board recruit should require board space before spending points.
- Auto-recruit should fill the board, balance position targets against team needs, use scouting information when choosing targets, and reallocate refunded points after commitments.
- Committed recruits should preserve their commitment stage through weekly recruiting updates until signing day.
- Recruits committed to other programs remain visible in the database with destination indicators but cannot be added, scouted, or pitched.
- Signed recruit player IDs should include the dynasty signing year so rosters stay unique across many classes.
- Offseason advancement should expose departures, four late recruiting weeks, signing day, preseason player development, and kickoff as distinct steps.
- The Overview offseason report should focus on only the active stage: departures, recruiting, signing day, or development.
- Signing day should not remove returning players before the offseason departure report is applied.
- Teams should stay at or above the 85-player roster floor after offseason turnover; add labeled walk-ons capped around 60 overall only when recruiting cannot fill the roster.
- Player offseason development must never regress attributes or overall.
- Signing-day recruits are incoming freshmen: they do not advance class year or gain offseason development until after kickoff clears the incoming marker.
- Player hot/cold streaks are rare, temporary, and affect effective ratings without overwriting base attributes.
- Receiving stat distribution should keep 5-7 targets involved while giving WR1 and elite WRs realistic usage shares.
- Weekly matchup previews should be derived from pending user games and existing team/unit ratings; do not hand-author matchup outcomes.
- The Schedule tab should include postseason playoff games and keep box-score drill-in available.
- Regular-season schedules should give every team 12 games without duplicate opponent pairings when possible.
- During postseason, the Overview dashboard should prioritize the playoff bracket and hide regular-season summary panels.
- Program record book totals should be derived from completed user-team history and never maintained as duplicate state.
- Completed season history should store only current-season award names; player career award lists must not be re-counted in later seasons.
- Legacy save loading should normalize missing debug, recruiting, history, weekly award, and poll movement fields before the app renders or advances.
- Legacy save loading should sanitize stale team, recruit, board, commitment, and recruiting investment references before simulation code uses them.
- Smoke tests should use the repo-local runner and explicit seed query params; do not reuse an arbitrary server on the preview port.
- Hiring from the coach pool should return the displaced user coach to the pool with no `hiredBy` assignment.
- Program Blueprint changes must reconcile recruiting `pointsRemaining + pointsSpent` to the current season budget.
- Program Blueprint rebuilds must preserve already-spent recruiting points as sunk costs when the budget changes.
- The game should stay playable on WebKit and on mobile-width screens.
- Debug Sim To End should complete all 20 dynasty seasons and reach the complete phase.

## Research Notes

Modern dynasty-mode inspiration was checked against official EA pages and translated into original mechanics only:

- https://www.ea.com/games/ea-sports-college-football/college-football-26/news/cfb26-campus-huddle-dynasty-deep-dive
- https://www.ea.com/games/ea-sports-college-football/college-football-27/news/college-football-27-dynasty
