# v1.0 Major Release Decision

## Expert Playthrough

The CFB game expert used the repo-local `cfb-game-expert` brief, checked current official EA dynasty-mode sources for inspiration, and played a full browser season into Year 2 Week 1. The pass covered recruiting filters and modal actions, roster and depth chart screens, player cards, box scores, awards, rankings movement, forced playoff and award debug flows, the coach pool, offseason departures, extra recruiting weeks, signing day, player development, program review, walk-ons, and Year 2 kickoff.

The playthrough confirmed that the game already has the main dynasty loops, but the loops were too separate. Recruiting, scouting, program investments, player growth, coach movement, and annual expectations all worked, but the player did not yet make a single annual resource decision that tied those systems together.

Official inspiration checked:

- https://www.ea.com/games/ea-sports-college-football/college-football-26/features/cfb26-dynasty
- https://www.ea.com/games/ea-sports-college-football/college-football-26/news/cfb26-campus-huddle-dynasty-deep-dive
- https://www.ea.com/games/ea-sports-college-football/college-football-27/news/college-football-27-dynasty

## Decision

Ship v1.0 as **Program Blueprint & Director Goals**.

The release adds an annual Program Blueprint budget that opens before kickoff. The player allocates Program Points into scouting, recruiting reach, training staff, facilities, academic support, player trust, and coach retention. Those choices now affect recruiting budget, scouting reveal speed, scholarship and pitch pressure, offseason development, pro-departure thresholds, program review drift, head-coach security, and coordinator movement.

Director Goals give each season a visible target set: wins, recruiting class rank, and scoring defense pace. Goals track during the year and resolve during offseason review.

## Why This First

This was chosen over a transfer portal, rivalry page, or trophy room because it gives the existing systems more strategic weight without requiring a new content-heavy calendar. It also creates a foundation for later v1.x work: rivalry goals, historical trophy cases, contract extensions, coordinator poaching stories, and deeper offseason budget tradeoffs can all read from the same blueprint and director-goal model.

## Acceptance Criteria

- Program tab shows a Program Blueprint panel with total, spent, remaining, and lock status.
- Blueprint allocations persist in dynasty state and migrate older local saves.
- The first user season can be allocated at Week 1 before kickoff, then locks after games begin.
- CPU teams receive deterministic auto-allocated blueprints.
- Recruiting Reach and Scouting Network influence recruiting budget, offer pressure, pitch pressure, and scouting reveal speed.
- Training Staff and Facilities influence offseason player development.
- Academic Support and Player Trust influence retention and program review outcomes.
- Coach Retention influences head-coach job security and coordinator movement.
- Director Goals appear before Week 1 and resolve during offseason review.
- Smoke screenshots include the Program Blueprint panel and director goals.
- `npm run build`, `npm run test`, and `npm run smoke` pass before release.
