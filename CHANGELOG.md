# Changelog

All notable project changes should be recorded here when the app version changes.

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
