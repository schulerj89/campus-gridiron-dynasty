# Changelog

All notable project changes should be recorded here when the app version changes.

## 1.21.27 - 2026-06-20

- Fixed the home team-picker ratings mismatch by starting the dynasty from the same generated world seed shown in team selection.
- Stabilized the home team-picker layout so long team names keep the card height steady and the New Dynasty action does not get squeezed.

## 1.21.26 - 2026-06-20

- Added 20 more fictional city names and 20 more mascot/team-name suffixes to reduce repeated generated team identities.
- Updated world generation to use each mascot once before repeating, and added regression coverage for expanded mascot variety.

## 1.21.25 - 2026-06-20

- Raised pro-departure logic with an 88 OVR floor so lower-rated high-production players no longer declare for the pro draft.
- Added pro-pipeline program rewards: pro departures now add offseason program points and can lift recruiting reach, prestige, and fan support.
- Made development-focused Program Blueprints provide a small reliable training-staff attribute-growth edge, and added regression tests comparing recruiting, development, and academics focus effects.
- Let auto-recruit run all four offseason recruiting weeks and signing day from one offseason click, with labels that make the auto window explicit.

## 1.21.24 - 2026-06-20

- Simplified the active and signed recruiting modals on mobile into a full-width sheet with a large close target, immediate recruiting actions, tighter summary chips, and compact school-interest rows.
- Fixed the active recruit modal close button to use the shared icon-button styling instead of an unstyled class.
- Added iPhone smoke coverage that opens a recruit modal, verifies the close/action buttons are visible, checks the modal fits the viewport without horizontal overflow, and captures a mobile modal screenshot.

## 1.21.23 - 2026-06-20

- Added a Standings tab with the top-eight playoff watch, all desktop conference standings, and a mobile conference selector for compact standings review.
- Aligned playoff seeds to the visible final Week 12 national poll top eight and renamed visible playoff labels from Summit Four to Summit Eight.
- Made Air Raid receiver usage strategy-aware so elite WR1s earn a larger target and yardage share without inflating total team passing production.
- Added regression coverage for final-poll playoff seeding and Air Raid elite-receiver concentration.

## 1.21.22 - 2026-06-20

- Routed every topbar advance action, including postseason rounds, back to Overview so simulation context is not hidden behind Awards.
- Removed the playoff bracket from Awards and kept playoff bracket navigation on Overview, where postseason command controls already live.
- Simplified mobile preseason development and roster-cutdown rows into readable summary cards with wrapped names, compact stat pills, and full-width movement notes.
- Fixed pro-departure eligibility so sophomores cannot declare early, with regression coverage for a high-production 99 OVR sophomore.
- Added mobile smoke coverage and screenshots for the preseason development screen plus updated playoff bracket screenshot coverage for the Overview-owned bracket.

## 1.21.21 - 2026-06-20

- Fixed mobile offseason departure rows so player names and departure notes wrap in a dedicated compact layout instead of being squeezed into generic table columns.
- Routed topbar advance actions to the relevant next view: postseason rounds open the Awards playoff view, while regular/offseason advances return to Overview.
- Added smoke coverage for advance navigation, mobile playoff routing, and the mobile departures screenshot.

## 1.21.20 - 2026-06-19

- Consolidated mobile season-award cards with smaller preserved award statues, tighter winner text, and collapsed candidate drawers.
- Tightened mobile weekly award cards, honor-team drawers, and playoff field spacing on the Awards page to reduce vertical scrolling.
- Updated the iPhone smoke screenshot to capture a real season-awards state with statue art and mobile candidate controls.

## 1.21.19 - 2026-06-19

- Simplified mobile Program layouts by collapsing wide control grids, hiding explanatory copy, and compacting blueprint/goals sections for phone screens.
- Reworked mobile Program Record Book rows so they fit the viewport instead of carrying a desktop table minimum width.
- Added iPhone smoke coverage and screenshots for Stats, Program, and Awards with document-level horizontal overflow checks.

## 1.21.18 - 2026-06-19

- Fixed public image asset URLs so helmets, portraits, coach portraits, hero art, and award statues load correctly from the GitHub Pages project path.

## 1.21.17 - 2026-06-19

- Added a mobile section menu that collapses the dynasty tab rail behind a hamburger control on iPhone-sized screens.
- Reduced mobile scrolling with smaller responsive page sizes for roster, recruiting, signing day, development, departures, class rankings, and schedule lists.
- Tightened mobile styles for stat leaders, recruiting need cards, pagination controls, and sticky top navigation.
- Added a GitHub Pages deployment workflow and Vite Pages base path for `campus-gridiron-dynasty`.
- Documented the code-review/design decisions for the mobile usability and Pages deploy patch.

## 1.21.16 - 2026-06-19

- Stopped at-potential players from gaining hidden attribute value during preseason development while keeping high-potential breakout growth intact.
- Added regression coverage to verify players at their potential keep the same attributes and do not generate a development progression row.

## 1.21.15 - 2026-06-19

- Synchronized defensive sack stats with play-by-play sack events by having the play log consume the credited defensive sack queue.
- Added deterministic coverage that compares each defense's box-score sacks to the opponent's play-by-play sack events.

## 1.21.14 - 2026-06-19

- Made interception risk account for estimated pass volume so Air Raid and other high-volume passing teams carry more total turnover exposure than run-heavy teams with the same ratings.
- Added aggregate coverage that keeps interception rate bounded while confirming strategy-driven pass volume changes affect total picks.

## 1.21.13 - 2026-06-19

- Fixed scoring-plan tie-breaks so common scores prefer normal touchdown, field-goal, and made-extra-point compositions instead of artificial missed-extra-point plans.
- Added direct scoring-plan regressions for common final scores including 24, 30, 31, 38, and 45.

## 1.21.12 - 2026-06-19

- Made play-by-play calls honor air raid identity in normal, red-zone, stalled, and fourth-down situations.
- Prevented trailing offenses from punting on late fourth-and-manageable end-game possessions.
- Replaced vague stalled-drive text with concrete incomplete-pass or no-gain play descriptions and added regression coverage.

## 1.21.11 - 2026-06-19

- Let Stats leaderboard rows open the selected player's card directly on the stats tab.
- Let Awards page weekly cards, season award winners, candidate rows, and honor-team cards open current roster players from other programs.
- Added smoke coverage for Stats and Awards player-card entry points and refreshed visible-version screenshots.

## 1.21.10 - 2026-06-19

- Raised high-star recruit starting floors so four-stars enter at 68+ overall and five-stars enter at 74+ overall while preserving the 83 recruit entry cap.
- Added preseason roster cutdown enforcement at the 105-player limit, including reportable cuts and depth-chart pruning without dropping positions below their roster minimums.
- Simplified the preseason development view by sorting returning players by largest overall gain and excluding incoming freshmen from that scan.
- Fixed award and offseason display issues: national players of the week now show only offensive and defensive winners, candidate rank badges stay centered, and departures sort highest overall first.

## 1.21.9 - 2026-06-19

- Split the Roster Room render into focused roster picker, roster list, and depth-chart panel components.
- Kept player modal behavior, team switching, position filtering, and depth-chart movement wiring unchanged while reducing the risk of future styling drift.
- Documented the small-refactor review decision for roster/depth component ownership.

## 1.21.8 - 2026-06-19

- Simplified other-team depth charts by removing disabled move controls from view-only rows.
- Fixed depth row action spacing so editable move buttons no longer overflow their reserved column.
- Refreshed roster smoke coverage to assert view-only depth charts expose no movement buttons.

## 1.21.7 - 2026-06-19

- Shortened the Roster Room by switching between Roster List and Depth Chart views instead of stacking both work areas.
- Compactified depth cards to show the top three players per position while retaining hidden-reserve rotation through move controls.
- Added smoke coverage for demoting the visible depth cutoff into hidden reserves.

## 1.21.6 - 2026-06-19

- Aligned roster list ordering with depth-chart ordering by sorting on effective overall before potential.
- Displayed streak-adjusted roster rows as `Eff` while preserving base overall in the player modal and row title text.
- Updated depth-chart unit coverage to compare effective overall and verify per-position depth totals.

## 1.21.5 - 2026-06-19

- Consolidated recruit card and recruit modal action controls into a shared `RecruitActionButtons` component.
- Preserved compact card labels and full modal labels while sharing disabled-state and action wiring.
- Reduced duplicate Recruiting UI code for future scholarship, scouting, and pitch updates.

## 1.21.4 - 2026-06-19

- Extracted Recruiting page derived data into a pure view-model helper.
- Added unit coverage for active board filtering, position filtering, and rank sorting.
- Kept Recruiting page rendering and mechanics unchanged while reducing component complexity.

## 1.21.3 - 2026-06-19

- Added pagination to the active Recruiting Board so auto-filled boards no longer render every card at once.
- Kept board count, board actions, recruit detail modals, and recruiting mechanics unchanged.
- Added smoke coverage for moving to the second board page after Auto Recruit fills targets.

## 1.21.2 - 2026-06-19

- Compactified Recruiting Need Command into a dense position matrix while preserving roster, need, board, offer, pledge, and meter data.
- Kept each position row clickable so it still filters the recruiting database.
- Refreshed recruiting needs screenshots for the simplified page layout.

## 1.21.1 - 2026-06-19

- Replaced the fallback award statue drawings with file-backed `gpt-image-2` generated bronze statue PNGs.
- Kept one distinct rendered pose per national season award, including a neutral Iron Lantern Trophy pose.
- Refreshed awards screenshots to verify the upgraded trophy art in the candidate-board UI.

## 1.21.0 - 2026-06-19

- Added bronze statue artwork for every national season award, including a neutral pose for the Iron Lantern Trophy.
- Added top-eight candidate boards to active season award watch and finalized season awards.
- Centralized season award definitions so winner selection, candidate boards, and trophy art use the same award scopes.
- Added unit and smoke coverage for award candidate boards and trophy image rendering.

## 1.20.21 - 2026-06-19

- Scoped the forced-award smoke assertion to the Season Awards panel.
- Added an explicit Iron Lantern Trophy assertion so weekly award cards cannot satisfy the season-award check.
- Refreshed the Awards page screenshot artifacts.

## 1.20.20 - 2026-06-19

- Scoped persisted honor-team award labels for player history and the program record book.
- Preserved national trophy names while distinguishing All-American and all-conference team honors.
- Added unit coverage plus a player awards modal screenshot for the forced award winner.

## 1.20.19 - 2026-06-19

- Expanded the Awards page national weekly panel to show all four generated weekly awards.
- Kept the dashboard Latest National Awards panel compact at two cards.
- Added smoke coverage for Ground Surge and Sky Route award visibility.

## 1.20.18 - 2026-06-19

- Corrected the Awards page title when showing completed-season history outside the regular season.
- Added a preseason history smoke assertion for the `Latest Season Awards` state.
- Added the `awards-latest-season-desktop.png` screenshot artifact.

## 1.20.17 - 2026-06-19

- Aligned the signed-recruit modal close control with the app's standard icon button styling.
- Added smoke coverage to assert the signed-recruit close control uses the shared icon-button class.
- Refreshed the signing-day recruit modal screenshot.

## 1.20.16 - 2026-06-19

- Applied existing user-team award highlighting to the dashboard's Latest National Awards panel.
- Made the debug Force User Award command seed a current weekly award card for dashboard QA.
- Added forced-award smoke coverage for the overview award panel.
- Added a dashboard award highlight screenshot artifact.

## 1.20.15 - 2026-06-19

- Defaulted the offseason signing-day class selector to the user's team instead of the top national class.
- Preserved the ranked class list ordering while keeping the dashboard focus on the user's signing class.
- Added smoke coverage that verifies the selected class matches the active dynasty team.

## 1.20.14 - 2026-06-19

- Routed dashboard, postseason, and championship in-panel advance buttons through the guarded advance flow.
- Added an immediate advance lock so rapid clicks cannot queue multiple week or phase advances.
- Added a dashboard smoke screenshot covering the guarded in-panel advance button.

## 1.20.13 - 2026-06-19

- Added a mobile-specific recruiting database row layout to remove desktop-width overflow.
- Kept recruit row metadata readable as compact cards on phone-sized screens.
- Added mobile smoke coverage and screenshot output for the recruiting page.

## 1.20.12 - 2026-06-19

- Corrected Recruiting Need Command meter math to measure covered open roster slots.
- Added a shared coverage-percent helper for Need Command progress bars.
- Added regression coverage for partial, full, and already-covered meter states.

## 1.20.11 - 2026-06-19

- Replaced misleading recruit interest percentage labels with `/150` score labels.
- Applied the shared interest formatter to the database, recruit card, recruit modal, and signed recruit modal.
- Extended recruiting smoke coverage to assert the visible `/150` interest scale.

## 1.20.10 - 2026-06-19

- Updated recruit modal school-interest rows to respect the recruit's actual cut list.
- Added a safe sorted-interest fallback for legacy or malformed recruit cut lists.
- Added regression coverage for cut-list ranking and fallback ranking behavior.

## 1.20.9 - 2026-06-19

- Aligned the regular recruit modal with the app's dialog/backdrop modal pattern.
- Added dialog semantics and an accessible recruit-specific modal label.
- Extended recruiting smoke coverage to verify dialog attributes and backdrop-close behavior.

## 1.20.8 - 2026-06-19

- Stopped rendering fallback database prospects inside an empty Recruiting Board.
- Added a clear empty board state that directs users to the database, Need Command, or Auto Recruit.
- Added reusable empty-state styling for compact panel messages.

## 1.20.7 - 2026-06-19

- Made Recruiting Need Command pledge-aware so user pledges reduce visible positional need.
- Added shared helpers for pledge counts and projected position needs without changing the base roster-only helper.
- Added regression coverage for user pledges reducing a positional recruiting gap.

## 1.20.6 - 2026-06-19

- Blocked manual scouting from spending points on recruits already scouted to 100%.
- Disabled Scout actions for fully scouted recruits in the shared recruiting action eligibility helper.
- Added regression coverage proving fully scouted manual scouts do not mutate points, investments, or action logs.

## 1.20.5 - 2026-06-19

- Centralized recruit action eligibility so card and modal buttons share one Add, Offer, Scout, Pitch, and Rescind rule set.
- Reused the shared eligibility output for recruit status and pitch availability messaging.
- Refined committed recruit status text so committed prospects no longer display as active scholarship targets.

## 1.20.4 - 2026-06-19

- Updated Recruiting Need Command offer counts to include only open, live scholarship offers.
- Moved live offer counting into the recruiting service for consistent future reuse.
- Added regression coverage proving committed recruits do not inflate live offer coverage.

## 1.20.3 - 2026-06-19

- Added a shared minimum recruiting action cost so auto recruit can still scout with 40 remaining points.
- Updated manual and automatic auto-recruit availability checks to use the scout-sized threshold.
- Added regression coverage for auto recruit spending a 40-point remainder on scouting.

## 1.20.2 - 2026-06-19

- Blocked off-board pitch spending when the recruiting board is full.
- Updated recruit card and modal pitch controls to match board-capacity rules.
- Added regression coverage for offered off-board full-board pitch attempts.

## 1.20.1 - 2026-06-18

- Fixed play-by-play field goal continuity so scripted field goals cannot fire immediately after an early-down first-down conversion.
- Prevented normal non-touchdown plays from gaining through the goal line and repeating `1st & 1` at the opponent 1.
- Added terminal drive finalization so possession does not flip after a non-terminal play; exhausted drives now end with a queued score, fourth-down field goal, turnover on downs, or punt.
- Added regression coverage for field-goal jumps, goal-line loops, non-terminal possession changes, and play-by-play attempt count drift.

## 1.20.0 - 2026-06-18

- Added explicit offseason review checkpoints so departures, recruiting, signing day, development, and program review each become a single-focus dashboard stage.
- Added immediate advance-button feedback with disabled loading state and stage-specific button labels such as `Advance to Recruiting`, `Run Signing Day`, and `Advance to Program Review`.
- Reworked preseason development into a full-roster table with green overall deltas, incoming freshman/walk-on indicators, and attribute movement details.
- Extended smoke coverage to capture focused offseason stage screenshots.

## 1.19.3 - 2026-06-18

- Fixed honor-team selection so All-American and all-conference second teams cannot reuse first-team players.
- Kept freshman honor teams independent while making first and second teams disjoint within each award scope.
- Added awards regression coverage for duplicate IDs within teams and overlaps between first and second teams.

## 1.19.2 - 2026-06-18

- Fixed game usage selection so saved manual depth-chart order is honored within each position.
- Applied depth-chart-aware selection to aggregate box-score stats and down-by-down play-by-play.
- Added regression coverage proving a lower-rated manually promoted QB receives the game pass attempts instead of the higher-rated benched QB.

## 1.19.1 - 2026-06-18

- Fixed coach recruiting upgrades so active recruiting season budgets refresh immediately.
- Preserved sunk recruiting points while reconciling `pointsRemaining + pointsSpent` to the new budget.
- Added regression coverage for spending a head coach recruiting point after recruiting points are already spent.

## 1.19.0 - 2026-06-18

- Added WR and CB athletic archetypes so speed varies more realistically while preserving recruit overall and non-speed rating caps.
- Added individual WR/TE-vs-coverage matchup multipliers for target share, receiving yards, receiving touchdowns, play-by-play target selection, completion chance, and pass-play yardage.
- Added regression coverage for WR/CB speed exceptions and controlled elite receiver usage against weak versus shutdown corner matchups.

## 1.18.0 - 2026-06-18

- Made offensive line quality directly influence pass yards per attempt, play-by-play sack chance, and passing completion windows.
- Added controlled simulation coverage proving strong lines produce better rushing output, better pass efficiency, and fewer sacks than weak lines.
- Kept the change isolated to game simulation so existing roster, strategy, and box-score flows remain compatible.

## 1.17.0 - 2026-06-18

- Program Investments now refresh active recruiting budgets immediately while preserving sunk spent points.
- Strengthened training and facilities development bonuses so infrastructure investments produce visible preseason progression changes.
- Added regression coverage for recruiting budget reconciliation and high-vs-low training/facilities development outcomes.

## 1.16.0 - 2026-06-18

- Added trait-specific development profiles with stronger elite and high-potential breakout chances.
- Converted large offseason attribute gains into visible overall catch-up, capped by player potential and trait profile.
- Added dynasty regression coverage proving elite high-potential returners can jump into the 90s with +5 or better growth.

## 1.15.0 - 2026-06-18

- Re-centered QB completion rate around accuracy, awareness, receiving support, blocking, coverage, and pass-heavy strategy so weaker passers can finish below 60%.
- Increased Air Raid and spread passing touchdown share without changing final scores or total offensive touchdowns.
- Added regression coverage for weak passing attributes and strategy-driven passing touchdown distribution.

## 1.14.0 - 2026-06-18

- Added a dedicated Stats tab for national, conference-specific, and User Team leaderboards.
- Added derived completion percentage leaderboard support with minimum pass-attempt qualification.
- Moved the program record book and dynasty history from Awards into the Program page so awards stay focused on honors and playoff results.

## 1.13.0 - 2026-06-18

- Added persisted passing attempts, completions, rushing attempts, and derived completion percentage displays across box scores, player cards, awards notes, and leaderboards.
- Reworked offensive line pancake generation so blockers receive plausible game stats and positive rush play-by-play can cite a pancake block.
- Added legacy save normalization and regression coverage for new attempt/completion fields and pancake play evidence.

## 1.12.13 - 2026-06-18

- Split the Crown Bowl final into a championship recap checkpoint before offseason departures open.
- Added an `Advance to Offseason` action on the recap so the next advance moves focus to the offseason dashboard.
- Updated tests and smoke screenshots to verify the recap no longer buries the active offseason panels.

## 1.12.12 - 2026-06-18

- Moved the Crown Bowl Champion trophy callout into the final bracket column so the champion team appears directly above the championship matchup.
- Updated the champion callout styling to emphasize the team name while keeping the completed bracket compact.
- Refreshed championship and playoff screenshots for the revised bracket placement.

## 1.12.11 - 2026-06-18

- Added an offseason championship recap so the Crown Bowl winner remains visible immediately after the final playoff round advances.
- Updated the playoff bracket to show an explicit Crown Bowl Champion banner when a champion is known.
- Added unit and smoke coverage for retaining and displaying the completed playoff champion before offseason development archives the season.

## 1.12.10 - 2026-06-18

- Expanded completed game play-by-play from scoring-only summaries to down-by-down logs with rushes, passes, sacks, punts, scoring kicks, turnovers, yards, down, distance, and field position.
- Added punt and interception descriptions that identify the punter, returner or no-return result, interceptor, and return yardage.
- Updated box score play-by-play rows to show play number, down-distance, yard line, and yardage metadata, with regression coverage for full play logs.

## 1.12.9 - 2026-06-18

- Guarded localStorage metadata reads, writes, and clears so browser metadata failures do not break IndexedDB saves.
- Hid malformed or active-pointer-mismatched save summaries instead of showing stale Continue details.
- Added storage and smoke coverage for malformed, blocked, and mismatched localStorage metadata.

## 1.12.8 - 2026-06-18

- Cancelled pending save queue completions when local saves are cleared.
- Prevented stale in-flight save completions from updating UI status after reset.
- Added queue and smoke coverage so cleared saves do not resurrect after reload.

## 1.12.7 - 2026-06-18

- Added an IndexedDB `updatedAt` index for faster active-save recovery.
- Used the newest-save index cursor when recovering from a missing or stale active localStorage pointer.
- Kept full-save scanning as a compatibility fallback and added latest-save timestamp coverage.

## 1.12.6 - 2026-06-18

- Recovered the newest IndexedDB dynasty when the active localStorage pointer is missing or stale.
- Rewrote active save metadata after fallback recovery so Continue points back at a valid save.
- Added storage and smoke coverage for newest-save recovery after pointer drift.

## 1.12.5 - 2026-06-18

- Serialized autosaves and manual saves through a shared dynasty save queue.
- Coalesced superseded pending saves so older delayed writes cannot finish after newer dynasty progress.
- Added regression coverage for delayed save ordering and skipped pending save states.

## 1.12.4 - 2026-06-18

- Made IndexedDB saves and clears resolve only after their transactions complete, preventing false-positive save status.
- Added a compact localStorage active-save summary beside the IndexedDB dynasty record for quick home-screen retrieval.
- Let Continue use the local summary immediately while loading the full local DB save on demand.
- Added storage coverage for active save summary generation and smoke coverage for save, reload, and Continue.

## 1.12.3 - 2026-06-18

- Reconciled legacy recruiting budgets on load so spent plus remaining points always equals the season budget.
- Hardened Program Blueprint allocation loading against non-finite values and over-allocated corrupt saves.
- Added storage migration coverage for recruiting budget and Blueprint allocation normalization.

## 1.12.2 - 2026-06-18

- Fixed signing-day report signee player IDs so they match the actual roster players created from recruits.
- Added regression coverage that verifies every signee report entry links to a player on that team roster.

## 1.12.1 - 2026-06-18

- Kept Program Blueprint Auto Build available before kickoff even when the current plan has no remaining points.
- Added smoke coverage that verifies preset-filled Blueprint plans can still be rebuilt.

## 1.12.0 - 2026-06-18

- Added offensive strategy controls for Balanced, Air Raid, Run Heavy, Pro Style, and Spread Tempo identities that affect pass/run volume.
- Split kicker stats into field goals and extra points, including attempts, and added receiving targets to player stats, box scores, player cards, and leaderboards.
- Added scoring play-by-play to completed game box scores for simulation diagnostics.
- Added Program Blueprint focus presets for custom, balanced, recruiting, development, academics, facilities, and retention planning.
- Added save normalization and regression coverage for the new strategy, Blueprint focus, target, FG, XP, and play-by-play fields.

## 1.11.5 - 2026-06-17

- Added a shared user-team highlight treatment across rankings, awards, honor teams, and stat leaderboards.
- Added a Rankings callout so the user's program remains visible even when the ranking row is on a later page.
- Added smoke coverage for ranking, leaderboard, and awards user-team highlights.

## 1.11.4 - 2026-06-17

- Expanded fictional city, first-name, and last-name pools to reduce repeated generated names.
- Updated team generation to avoid duplicate team cities while enough fictional cities remain available.
- Added generation regression coverage for unique team cities and improved player/recruit name diversity.

## 1.11.3 - 2026-06-17

- Hardened legacy offseason report loading when older saves are missing `topClasses` or report arrays.
- Added defaults for departures, signees, walk-ons, progressions, and program changes during offseason report normalization.
- Added storage regression coverage for older offseason saves.

## 1.11.2 - 2026-06-17

- Updated the Rankings page to display the full 1-70 national board instead of only Top 25 entries.
- Kept moved-in and moved-out panels tied to Top 25 movement while exposing all team ranks in the main table.
- Added smoke coverage and a screenshot for deeper rankings pages outside the Top 25.

## 1.11.1 - 2026-06-17

- Added pagination to signing-day class lists so every signee can be opened from large classes.
- Reset the signee page when changing teams to avoid stale page selections.
- Added smoke coverage and a screenshot for page-two signing-day recruits.

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
