---
name: dynasty-game-qa
description: Verify Campus Gridiron Dynasty simulation and UI behavior. Use when testing recruiting, roster generation, games, awards, playoffs, coach movement, 20-year dynasty advancement, debug controls, local storage, responsive layouts, or browser smoke tests including WebKit/mobile.
---

# Dynasty Game QA

## Workflow

1. Run deterministic unit tests for generation, recruiting, game simulation, awards, playoffs, coach movement, and multi-season advancement.
2. Run browser smoke tests in Chromium and WebKit, including an iPhone 15 Pro Max-sized viewport.
3. Use debug controls to force edge cases: user playoff berth, user award winner, recruiting auto-fill, and multi-season simulation.
4. Capture screenshots for the home page, dynasty dashboard, recruiting, awards/playoffs, and mobile layout.
5. Report failures by feature area with the exact command, screenshot name, and observed behavior.

## Coverage Expectations

- Initial world: 70 fictional teams, average-sized rosters, thousands of recruits, caps at or below configured limits.
- Recruiting: weekly points, scouting unlocks, gem/bust reveal, smart auto-recruit, prospect top-school narrowing.
- Simulation: ratings influence stats, standings update, awards are generated weekly and yearly.
- Offseason: recruits sign, hidden traits reveal, coaches can be hired/fired, program investment changes ratings.
- Persistence: save, load, reset, and local-storage schema migration behave predictably.

## References

Read `references/smoke-matrix.md` before adding or revising smoke tests.
