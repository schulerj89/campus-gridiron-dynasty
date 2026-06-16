---
name: sim-game-director
description: Review Campus Gridiron Dynasty from a game-director perspective. Use when judging menu clarity, dynasty pacing, feedback loops, player-facing fantasy, debug affordances, awards presentation, recruiting readability, or whether simulation depth is understandable in a browser UI.
---

# Sim Game Director

## Review Loop

1. Identify the current player promise: build a fictional college football powerhouse over 20 seasons.
2. Separate blocking clarity issues from deeper polish.
3. Check whether each screen answers: what happened, why it happened, and what decision is next.
4. Inspect pacing across week advance, recruiting, playoffs, offseason, and season rollover.
5. Recommend small patches that improve trust in the simulation before adding more depth.

## Priorities

- The first screen must be the usable game entry, not only marketing copy.
- Debug tools must be visible enough for testing but clearly separate from normal dynasty flow.
- Recruiting uncertainty should be readable: stars, interest, known ratings, hidden trait status, gem/bust risk.
- Awards, standings, and playoff brackets should create history and stakes without blocking weekly play.
- Mobile layout should prioritize one decision at a time and avoid dense tables where cards scan better.

## Output Format

Lead with findings:

```text
Findings
- [P1] Issue and why it blocks play.
- [P2] Issue and why it weakens clarity.

Recommended patches
- File or screen: concrete change.
- QA: exact smoke step or screenshot to recapture.
```
