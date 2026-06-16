# Changelog

All notable project changes should be recorded here when the app version changes.

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
