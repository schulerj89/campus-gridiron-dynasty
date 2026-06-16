# AGENTS.md

## Project

Campus Gridiron Dynasty is a fictional browser-based college football dynasty sim. Keep all content original: no real schools, conferences, awards, players, coaches, logos, or licensed marks.

## Core Invariants

- The world has 70 teams across 7 conferences.
- Standard generated rosters are 85 players per team.
- Player ratings use the 13 keys in `src/sim/types.ts`.
- Initial player ratings and attributes are capped at 93.
- Position-specific attribute caps in `src/sim/ratings.ts` limit unrelated skills for each position.
- Recruit hidden trait bands live in `src/sim/ratings.ts`; elite recruit entry cap is 83.
- Each recruiting class should include thousands of recruits with about 2-4% five-stars and 10-20% four-stars.
- Dynasty length is 20 years.
- Saves are local-only through IndexedDB via `src/sim/storage.ts`.

## Frequent Commands

```bash
npm run build
npm run test
npm run smoke
```

Run `npm run smoke` before claiming WebKit/mobile support. It covers Chromium desktop, WebKit desktop, and WebKit iPhone 15 Pro Max.

## QA Expectations

- Use the Debug tab for forced playoff, forced award, auto recruit, and multi-season checks.
- Keep screenshots in `artifacts/screenshots`, including roster/depth chart, player modal, awards, all-conference, playoff bracket, program, and mobile dashboard coverage.
- Do not commit `test-results` or Playwright reports.

## UI Organization

- `src/App.tsx` owns app shell state, tab routing, and the main dashboard screens.
- `src/components/AwardsView.tsx` owns awards, stat leaderboard, honor-team, and playoff bracket presentation.

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
- Update smoke expectations when the visible version changes.
