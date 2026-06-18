# Changelog

All notable project changes should be recorded here when the app version changes.

## 1.11.0 - 2026-06-17

- Hid the Current Poll panel from the offseason Overview dashboard.
- Kept the offseason dashboard focused on the active offseason stage instead of regular-season context.
- Added smoke coverage that verifies departures focus hides command, awards, and poll panels.

## 1.10.0 - 2026-06-17

- Added signing-day signee drill-in from the all-team class table.
- Added a read-only signed prospect modal with stars, rank, trait, overall, potential, attributes, and school-interest history.
- Added smoke screenshot coverage for the signing-day recruit modal.

## 1.9.0 - 2026-06-17

- Added a Roster Room program selector so any team roster can be inspected.
- Added opponent roster context with conference, overall, identity, record, helmet, and team power.
- Kept depth-chart reordering editable only for the user program and added smoke screenshot coverage for another team roster.

## 1.8.0 - 2026-06-17

- Made Program Blueprint allocations persist through the season after Week 1 kickoff.
- Auto-assigned only unused Program Blueprint points when Week 1 advances, preserving manual player choices.
- Clarified Program Blueprint panel copy and added regression/smoke coverage for the kickoff lock behavior.

## 1.7.0 - 2026-06-17

- Tuned receiving usage so elite WR1 targets are featured more realistically without changing team passing volume.
- Added role-aware receiving weights for yards and touchdown splits while preserving 5-7 target participation.
- Added game-sim regression coverage for elite receiver single-game share and 12-game production.

## 1.6.0 - 2026-06-17

- Reworked the offseason Overview dashboard into focused stages for departures, recruiting, signing day, and preseason development.
- Added a compact offseason recruiting focus panel for late-cycle recruiting weeks.
- Updated smoke coverage so each offseason stage shows only its relevant panels.

## 1.5.0 - 2026-06-17

- Reworked the postseason Overview dashboard so the playoff bracket becomes the priority panel.
- Added an Advance Round control directly on the postseason bracket panel.
- Hid regular-season command, latest awards, and current-poll panels during postseason because those views remain available through the main navigation.

## 1.4.9 - 2026-06-17

- Improved regular-season schedule generation to avoid duplicate opponent pairings.
- Added a constrained weekly pairing matcher that prefers unused team pairs before falling back.
- Added deterministic schedule regression coverage for 12 games per team with unique opponent pairs.

## 1.4.8 - 2026-06-17

- Fixed scouting so a full recruiting board cannot create off-board sunk investments.
- Disabled Scout on off-board prospects when the recruiting board is already full.
- Added regression coverage for full-board scout attempts and normal scout-to-board behavior.

## 1.4.7 - 2026-06-17

- Fixed Debug Sim To End so it completes the full 20-year dynasty instead of stopping at Year 20 kickoff.
- Kept shorter fast-sim requests returning at the next regular-season kickoff.
- Added regression coverage for full-dynasty completion with 20 history entries.

## 1.4.6 - 2026-06-17

- Fixed the Schedule tab so postseason playoff games appear alongside regular-season games.
- Prioritized user-team games and current-week fillers in the Schedule table while preserving box-score drill-in.
- Added smoke coverage and a screenshot for postseason Schedule rows with fictional bowl names.

## 1.4.5 - 2026-06-17

- Fixed signing day so it no longer trims returning players before the offseason departure list is applied.
- Preserved non-departing roster continuity through signing day and preseason development.
- Added regression coverage for a multi-team offseason case where unreported returning players could disappear.

## 1.4.4 - 2026-06-17

- Hardened multi-season roster identity so signed recruits include their signing class year in player IDs.
- Kept offseason signing reports aligned with the roster player IDs created on signing day.
- Added regression coverage for duplicate roster IDs after several recruiting classes.

## 1.4.3 - 2026-06-17

- Fixed matchup previews so only Top 25 poll entries display as ranked teams.
- Added regression coverage for teams with full 1-70 poll positions appearing unranked in matchup stakes when outside the Top 25.
- Refreshed matchup, dashboard, and smoke screenshots with the visible patch version.

## 1.4.2 - 2026-06-17

- Fixed weekly recruiting updates so committed recruits keep their `softPledge` stage instead of being narrowed back to top-school list stages.
- Added regression coverage for committed board refunds and signed recruit preservation during weekly recruiting updates.
- Refreshed smoke screenshots with the visible patch version.

## 1.4.1 - 2026-06-17

- Fixed Program Blueprint budget refreshes so spent recruiting points stay sunk when a rebuild lowers the season budget.
- Added regression coverage for a boosted recruiting blueprint being rebuilt to a lower recruiting-budget allocation.
- Refreshed smoke screenshots with the visible patch version.

## 1.4.0 - 2026-06-17

- Added recruiting board removal and scholarship rescind actions for prospects the user no longer wants to pursue.
- Kept recruiting points as sunk costs when a user removes a recruit or rescinds a scholarship, preserving commitment refunds as the only point-return path.
- Reworked auto-recruit board construction to balance position targets and roster needs instead of over-filling one high-need position.
- Added regression coverage for board control actions and balanced auto-recruit position mixes.
- Refreshed smoke screenshots with the visible minor version.

## 1.3.6 - 2026-06-17

- Hardened legacy save loading against stale user-team, recruit offer, recruit interest, commitment, board, and investment IDs.
- Added regression coverage for corrupted recruiting relationship data that points at missing teams or inactive recruits.
- Refreshed smoke screenshots with the visible patch version.

## 1.3.5 - 2026-06-17

- Fixed recruiting budget reconciliation after Program Blueprint changes so spent plus remaining points equals the current season budget.
- Added regression coverage for manual and auto-built blueprint changes after recruiting points have already been spent.
- Refreshed smoke screenshots with the visible patch version.

## 1.3.4 - 2026-06-17

- Fixed coach-pool hiring so the displaced user coach returns to the available pool instead of disappearing.
- Added a postseason hiring regression covering installed, removed, and returned coach states.
- Refreshed smoke screenshots with the visible patch version.

## 1.3.3 - 2026-06-17

- Added `npm run release:check` to verify package metadata, lockfile metadata, visible app version, and latest changelog heading agree.
- Documented the release-hygiene check in project docs and AGENTS guidance.
- Refreshed smoke screenshots with the visible patch version.

## 1.3.2 - 2026-06-17

- Made smoke tests use an isolated preview server port selected by `scripts/run-smoke.mjs` instead of reusing unrelated servers.
- Added explicit smoke-test dynasty seeds through the launch URL so tracked screenshots are reproducible.
- Stabilized the unit-test harness by running sim-heavy test files sequentially with a larger per-test timeout.
- Refreshed smoke screenshots with the visible patch version.

## 1.3.1 - 2026-06-17

- Hardened legacy save normalization for missing debug fields, recruiting defaults, team history, dynasty history, weekly awards, and poll movement arrays.
- Fixed team-history award recording so completed seasons store only that season's honors instead of re-counting older player career awards.
- Added regression coverage for older save shapes and stale player awards during offseason history creation.

## 1.3.0 - 2026-06-17

- Added a Program Record Book panel to the Awards page using completed user-team history.
- Summarized best record, best final rank, recruiting peak, Crown Bowl titles, Summit Four trips, bowl trips, top-10 finishes, and award totals.
- Added record-book selector tests, expert decision documentation, and smoke screenshot coverage after a multi-season debug simulation.

## 1.2.0 - 2026-06-17

- Added Weekly Matchup Preview panels to the dashboard and Schedule page for the next pending user game.
- Surfaced opponent, venue, records, poll ranks, stakes, team power, and unit edges using existing schedule and roster ratings.
- Added matchup helper tests, expert decision documentation, and smoke screenshot coverage.

## 1.1.0 - 2026-06-17

- Added Recruiting Need Command cards for every position with roster target, active board, offer, and pledge coverage.
- Made position need cards filter the recruiting database directly so roster gaps and prospect search stay connected.
- Added expert decision documentation and smoke screenshot coverage for the recruiting needs panel.

## 1.0.0 - 2026-06-16

- Added the Program Blueprint major-release feature with annual Program Points, category allocations, lock timing, and director goals.
- Connected blueprint allocations to recruiting budget, scouting reveal speed, recruiting pressure, player development, retention, program review, and coach carousel stability.
- Preserved the previous season's resolved director review and surfaced it in the Program tab after offseason development.
- Documented the CFB game expert playthrough decision in `docs/v1-major-release-decision.md`.
- Expanded smoke screenshots and unit coverage for blueprint allocation, budget effects, lock timing, and offseason rollover.

## 0.10.0 - 2026-06-16

- Focused the Overview dashboard during offseason and preseason by hiding the regular Dynasty Command panel and latest national awards.
- Moved the offseason report to the top of the dashboard whenever offseason report context is active.
- Added smoke coverage to guard the offseason dashboard focus behavior and refreshed screenshots.

## 0.9.0 - 2026-06-16

- Reworked signing day distribution so all 70 teams land sustainable classes before roster turnover.
- Added four late-cycle offseason recruiting weeks with bonus points and auto-recruit reallocation after commitment refunds.
- Added roster-floor protection with labeled low-rated walk-ons when recruiting still leaves a team under 85 players.
- Added offseason dashboard stage steps, clearer postseason dashboard playoff actions, and walk-on reporting in offseason and roster views.
- Added debug forcing for walk-on QA, refreshed screenshots, and expanded tests for roster floor, walk-ons, signing class distribution, and auto-recruit refunds.

## 0.8.1 - 2026-06-16

- Fixed signing-day recruits advancing to sophomores during preseason development.
- Added an incoming freshman roster marker that skips offseason development and clears at kickoff.
- Added regression coverage for incoming signees across signing day, preseason, kickoff, and save normalization.

## 0.8.0 - 2026-06-16

- Split postseason advancement into visible offseason departure, signing day, preseason development, and kickoff steps.
- Added all-team recruiting class browsing, preseason player progression reports, and program investment movement to the offseason dashboard.
- Added dashboard playoff bracket visibility during postseason and hid offseason reports once the regular season begins.
- Added manual depth-chart reordering plus rare hot/cold player streaks that affect effective ratings.
- Tuned QB interception pacing, defensive award value, and commitment refunds for board recruits.
- Expanded unit and smoke coverage for the new offseason flow, progression, depth chart, recruiting refunds, and screenshots.

## 0.7.0 - 2026-06-16

- Reworked recruiting actions around scholarship offers, one-pitch-per-recruit weekly cooldowns, and tighter season budgets.
- Added a prospect detail modal with top-school interest movement, scholarship badges, priorities, scouting, and action state.
- Updated CPU recruiting so other schools make offers and offers influence commitments.
- Added migration and tests for recruit offers and pitch cooldown state.

## 0.6.1 - 2026-06-16

- Replaced CSS-only helmet drawings with image-generated 16-bit helmet PNG assets for team identity.
- Converted stat leaderboards to separate stat columns with the selected sorted stat highlighted.
- Added a recruiting commitment filter for all, uncommitted, and committed-only prospect views.
- Expanded smoke screenshots to capture rankings after poll movement with teams moving up, down, in, and out.

## 0.6.0 - 2026-06-16

- Added a national rankings page with poll movement, votes, first-place votes, moved-in teams, and moved-out teams.
- Added poll snapshot history to dynasty state with migration support for older local saves.
- Added paginated recruiting and stat leaderboard tables, with leaderboards showing supporting stat columns.
- Reworked the dashboard to remove Action Items and Top Programs, surface latest awards higher, clarify wins/losses, and show team helmets.
- Added CSS-generated 16-bit helmet variants and assigned them across all teams.
- Expanded the coach pool and limited coach hiring to postseason and offseason windows.

## 0.5.1 - 2026-06-16

- Extracted the awards, stat leaderboard, honor-team, and playoff bracket UI into `src/components/AwardsView.tsx`.
- Kept the shared award card grid reusable for the dashboard while reducing the size of `src/App.tsx`.

## 0.5.0 - 2026-06-16

- Split weekly honors into national and conference offensive/defensive Player of the Week awards based on the latest played games.
- Rebalanced defensive box-score pacing so active defenders produce realistic tackle totals, sacks, and interceptions.
- Exposed recruits committed to other programs in the recruiting database with destination indicators and blocked late user actions on those pledges.
- Added the `stat-pace-expert` repo skill for future stat realism, award pacing, and leaderboard review.

## 0.4.0 - 2026-06-16

- Reworked game stat simulation so only active rotations appear in box scores and roster games-played totals.
- Balanced box score stat allocation so passing touchdowns match receiving touchdowns and rushing/receiving TD labels are explicit.
- Changed recruiting to a capped season-long budget with board caps, no weekly point refill, and signing-day budget reset.
- Added offseason reports for graduates, pro declarations, recruiting class rankings, and stored yearly user recruiting rank history.

## 0.3.0 - 2026-06-16

- Added played-game box score drilldowns with team totals and player stat lines.
- Added Player of the Week, stat leaderboards with national/conference/team filters, and delayed season-award visibility until Week 8.
- Removed award-name labels from All-American and All-Conference team displays.
- Expanded recruiting with position, state, pipeline, star, and rank/interest/need filters plus pipeline bonuses and star icons.
- Reworked team selection into a carousel-style team card and clarified the weekly advance controls.
- Added staff stat help text for Rec, Dev, and Tac abbreviations.

## 0.2.1 - 2026-06-16

- Added the `code-review-integrity` repo skill for sub-agent code review, integrity checks, testing expectations, and release hygiene.
- Centralized the visible UI version in `src/version.ts`.
- Documented changelog and version-bump expectations.
- Fixed review-found integrity issues around invalid team selection, no-op recruiting spends, coach point logging, player award history, and recruiting class rankings.

## 0.2.0 - 2026-06-16

- Added roster list filtering, depth chart, player profile modal tabs, position-specific attribute caps, career stat history, playoff bracket, coach portraits, mobile dashboard simplification, and expanded screenshots.
