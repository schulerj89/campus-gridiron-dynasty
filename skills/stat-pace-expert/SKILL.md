---
name: stat-pace-expert
description: Review and tune Campus Gridiron Dynasty football stat pacing, box-score realism, player participation, weekly awards, and season stat ranges. Use when changing src/sim/game.ts, src/sim/awards.ts, stat leaderboards, or tests around offensive and defensive production.
---

# Stat Pace Expert

## Workflow

1. Inspect output at three levels: single-game box score, season leaderboard, and award selection.
2. Confirm participation stays rotation-based: 1 QB, 2-3 HBs, 5-7 targets, 5-6 blockers, 14-18 defenders, and specialists as needed.
3. Validate weekly awards from the games just played whenever game box scores are available.
4. Compare national and conference leaders so high-volume teams do not overwhelm player quality too early in the season.
5. Add or update smoke/unit coverage when stat pacing changes affect visible box scores, awards, or leaderboards.

## Target Ranges

- Team plays: 58-74 per game.
- Team passing: 100-450 yards, 0-6 pass TD, 0-4 interceptions thrown.
- Team rushing: 40-320 yards, 0-6 rush TD.
- Team defense: 50-85 tackles, 0-5 sacks, 0-3 interceptions.
- Individual QB: 160-420 pass yards in normal wins, with rare 450-yard peaks.
- Individual HB: 45-180 rush yards for featured backs.
- Individual receiver: 35-160 receiving yards for top weekly lines.
- Individual defender: 4-12 tackles, 0-3 sacks, 0-2 interceptions.

## Red Flags

- Box scores where every rostered player records stats.
- Weekly awards selected from season totals after several weeks.
- Defensive leaders with only 1-2 tackles in a full game.
- Sacks or interceptions outpacing passing attempts over multi-season smoke tests.
- UI labels that merge passing, rushing, and receiving touchdowns into ambiguous "TD" text.
