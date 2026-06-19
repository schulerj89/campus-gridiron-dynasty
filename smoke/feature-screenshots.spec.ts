import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const screenshotDir = path.join(process.cwd(), "artifacts", "screenshots");

test.beforeAll(() => {
  fs.mkdirSync(screenshotDir, { recursive: true });
});

test("captures additional feature screenshots", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Feature screenshot artifacts are captured once on desktop Chromium.");

  await page.goto("/?seed=13001");
  await clearBrowserSave(page);
  await page.reload();
  await page.getByTestId("new-dynasty").click();
  await expect(page.getByText("Dynasty Command")).toBeVisible({ timeout: 40_000 });
  const userTeamName = (await page.locator(".topbar h1").textContent())?.trim() ?? "";
  await expect(page.getByTestId("dashboard-next-game-panel")).toContainText("Matchup Preview");
  await page.getByTestId("dashboard-next-game-panel").screenshot({ path: path.join(screenshotDir, "dashboard-next-game-desktop.png") });

  await page.getByRole("button", { name: "Roster" }).click();
  await expect(page.getByText("Roster Room")).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "roster-desktop.png"), fullPage: true });
  await page.getByTestId("depth-chart-panel").screenshot({ path: path.join(screenshotDir, "depth-chart-desktop.png") });
  await page.locator(".roster-row").first().click();
  await expect(page.getByTestId("player-modal")).toBeVisible();
  await page.getByTestId("player-modal").screenshot({ path: path.join(screenshotDir, "player-profile-modal-desktop.png") });
  await page.getByTestId("player-modal").getByRole("button", { name: "Stats" }).click();
  await page.getByTestId("player-modal").screenshot({ path: path.join(screenshotDir, "player-stats-modal-desktop.png") });
  await page.getByTestId("player-modal").getByRole("button", { name: "Attributes" }).click();
  await expect(page.getByTestId("attributes-panel")).toBeVisible();
  await page.getByTestId("player-modal").screenshot({ path: path.join(screenshotDir, "attributes-desktop.png") });
  await page.getByRole("button", { name: "Close player card" }).click();
  const rosterTeamSelect = page.getByTestId("roster-team-select");
  const userRosterTeam = await rosterTeamSelect.inputValue();
  const rosterTeamOptions = await rosterTeamSelect.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
  const otherRosterTeam = rosterTeamOptions.find((value) => value !== userRosterTeam);
  if (otherRosterTeam) {
    await rosterTeamSelect.selectOption(otherRosterTeam);
    await expect(page.getByTestId("depth-chart-panel")).toContainText("View only");
    await expect(page.getByTestId("roster-view-team-summary")).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, "roster-other-team-desktop.png"), fullPage: true });
    await rosterTeamSelect.selectOption(userRosterTeam);
  }

  await page.getByRole("button", { name: "Rankings" }).click();
  await expect(page.getByTestId("rankings-panel")).toContainText("Full 70-Team Board");
  await expect(page.getByTestId("user-team-ranking-callout")).toContainText("Your Program");
  await expect(page.getByTestId("rankings-panel")).toContainText("1st");
  await expect(page.getByTestId("rankings-pagination")).toContainText("1-10 of 70");
  await page.screenshot({ path: path.join(screenshotDir, "rankings-desktop.png"), fullPage: true });
  for (let pageNumber = 0; pageNumber < 2; pageNumber += 1) {
    await page.getByRole("button", { name: "Next rankings page" }).click();
  }
  await expect(page.getByTestId("rankings-pagination")).toContainText("Page 3");
  await page.screenshot({ path: path.join(screenshotDir, "rankings-full-board-desktop.png"), fullPage: true });

  await page.getByRole("button", { name: "Recruiting", exact: true }).click();
  await expect(page.getByTestId("recruit-filter-panel")).toBeVisible();
  await expect(page.getByTestId("recruiting-needs-panel")).toContainText("Board");
  await page.getByTestId("recruiting-needs-panel").screenshot({ path: path.join(screenshotDir, "recruiting-needs-desktop.png") });
  await page.getByTestId("need-command-QB").click();
  await expect(page.getByTestId("recruit-position-filter")).toHaveValue("QB");
  await expect(page.locator(".stars svg").first()).toBeVisible();
  await expect(page.getByTestId("recruiting-database")).toContainText("QB");
  await expect(page.getByTestId("recruiting-database")).toContainText(/\/150/);
  await expect(page.getByTestId("recruits-pagination")).toContainText("recruits:");
  await page.getByRole("button", { name: "Next recruits page" }).click();
  await expect(page.getByTestId("recruits-pagination")).toContainText("Page 2");
  await page.getByTestId("recruit-row").first().click();
  const recruitModal = page.getByTestId("recruit-modal");
  await expect(recruitModal).toHaveAttribute("role", "dialog");
  await expect(recruitModal).toHaveAttribute("aria-modal", "true");
  await expect(recruitModal).toContainText("School Interest");
  await expect(recruitModal).toContainText("Offer Scholarship");
  const offerButton = recruitModal.getByRole("button", { name: "Offer Scholarship" });
  if (await offerButton.isEnabled()) await offerButton.click();
  const pitchButton = recruitModal.getByRole("button", { name: "Pitch" });
  if (await pitchButton.isEnabled()) await pitchButton.click();
  await expect(recruitModal).toContainText("Pitch:");
  await expect(recruitModal.getByTestId("recruit-school-list")).toContainText(/\/150/);
  await recruitModal.screenshot({ path: path.join(screenshotDir, "recruiting-scholarship-modal-desktop.png") });
  await page.locator(".modal-backdrop").click({ position: { x: 8, y: 8 } });
  await expect(recruitModal).not.toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "recruiting-filters-desktop.png"), fullPage: true });

  await page.getByRole("button", { name: "Program" }).click();
  await expect(page.getByTestId("strategy-panel")).toContainText("Offensive Identity");
  await page.getByTestId("offensive-strategy-select").selectOption("airRaid");
  await expect(page.getByTestId("program-blueprint-panel")).toBeVisible();
  await expect(page.getByTestId("program-blueprint-panel")).toContainText("unused points auto-assign");
  await page.getByTestId("blueprint-focus-select").selectOption("development");
  await expect(page.getByTestId("program-blueprint-panel").getByRole("button", { name: "Auto Build" })).toBeEnabled();
  await expect(page.getByTestId("director-goals-panel")).toContainText("Director");
  await page.getByTestId("strategy-panel").screenshot({ path: path.join(screenshotDir, "offensive-strategy-desktop.png") });
  await page.getByTestId("program-blueprint-panel").screenshot({ path: path.join(screenshotDir, "program-blueprint-desktop.png") });
  await expect(page.getByText("Program Investments")).toBeVisible();
  await expect(page.getByTestId("coach-pool-panel")).not.toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "program-staff-desktop.png"), fullPage: true });

  await advanceDynasty(page);
  await page.getByRole("button", { name: "Schedule" }).click();
  await expect(page.getByTestId("schedule-matchup-preview")).toContainText("Matchup Preview");
  await page.getByTestId("schedule-matchup-preview").screenshot({ path: path.join(screenshotDir, "schedule-matchup-preview-desktop.png") });
  const completedWeekOneRow = page.getByTestId("game-row").filter({ hasText: /W1/ }).first();
  await expect(completedWeekOneRow).toBeVisible();
  await completedWeekOneRow.click();
  await expect(page.getByTestId("box-score-modal")).toBeVisible();
  await expect(page.getByTestId("box-score-modal")).toContainText("PaTD");
  await expect(page.getByTestId("box-score-modal")).toContainText("passing");
  await expect(page.getByTestId("box-score-modal")).toContainText("pancakes");
  await expect(page.getByTestId("box-score-modal")).toContainText("XP");
  await expect(page.getByTestId("play-by-play-panel")).toContainText("Play By Play");
  await expect(page.getByTestId("play-by-play-panel")).toContainText(/1st & \d+/);
  await expect(page.getByTestId("play-by-play-panel")).toContainText(/punted \d+ yards/);
  await page.getByTestId("box-score-modal").screenshot({ path: path.join(screenshotDir, "box-score-desktop.png") });
  await page.getByTestId("play-by-play-panel").screenshot({ path: path.join(screenshotDir, "play-by-play-desktop.png") });
  await page.locator(".play-event").filter({ hasText: "punted" }).first().scrollIntoViewIfNeeded();
  await page.getByTestId("play-by-play-panel").screenshot({ path: path.join(screenshotDir, "play-by-play-punt-desktop.png") });
  await page.getByRole("button", { name: "Close box score" }).click();

  await page.getByRole("button", { name: "Awards" }).click();
  await expect(page.getByText("Season Award Watch Opens Week 8")).toBeVisible();
  await expect(page.getByTestId("player-of-week-panel")).toBeVisible();
  await expect(page.getByTestId("player-of-week-panel")).toContainText("National Offensive Player of the Week");
  await expect(page.getByTestId("player-of-week-panel")).toContainText("National Defensive Player of the Week");
  await expect(page.getByTestId("player-of-week-panel")).toContainText("Ground Surge");
  await expect(page.getByTestId("player-of-week-panel")).toContainText("Sky Route");
  await page.getByTestId("player-of-week-panel").screenshot({ path: path.join(screenshotDir, "player-of-week-desktop.png") });
  await expect(page.getByTestId("conference-player-of-week-panel")).toBeVisible();
  await page.getByTestId("conference-player-of-week-panel").screenshot({ path: path.join(screenshotDir, "conference-player-of-week-desktop.png") });
  await page.getByRole("button", { name: "Stats" }).click();
  await expect(page.getByTestId("leaderboard-panel")).toContainText("Pass Yds");
  await expect(page.getByTestId("leaderboard-panel")).toContainText("Pass Att");
  await expect(page.getByTestId("leaderboard-panel")).toContainText("Comp %");
  await expect(page.getByTestId("leaderboard-panel")).toContainText("Rush Att");
  await expect(page.getByTestId("leaderboard-panel")).toContainText("Rush TD");
  await expect(page.getByTestId("leaderboard-panel")).toContainText("Targets");
  await expect(page.getByTestId("leaderboard-panel")).toContainText("XP");
  const scopeSelect = page.getByTestId("leaderboard-scope-select");
  await expect(scopeSelect).toContainText("User Team");
  const firstConferenceScope = await scopeSelect.locator("option").nth(1).getAttribute("value");
  if (firstConferenceScope) await scopeSelect.selectOption(firstConferenceScope);
  await expect(page.getByTestId("leaderboard-panel")).toContainText("leaders:");
  await scopeSelect.selectOption("user-team");
  await expect(page.getByTestId("user-team-leaderboard-row").first()).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "stats-desktop.png"), fullPage: true });
  await page.getByTestId("leaderboard-panel").screenshot({ path: path.join(screenshotDir, "leaderboard-desktop.png") });

  for (let week = 0; week < 7; week += 1) {
    await advanceDynasty(page);
  }

  await page.getByRole("button", { name: "Rankings" }).click();
  await expect(page.locator(".movement-chip.up").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".movement-chip.down").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("rankings-moved-in-panel").getByTestId("ranking-movement-row").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("rankings-moved-out-panel").getByTestId("ranking-movement-row").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("rankings-moved-out-panel")).toContainText("Now #");
  await expect(page.getByTestId("rankings-moved-out-panel")).toContainText("From #");
  await page.screenshot({ path: path.join(screenshotDir, "rankings-movement-desktop.png"), fullPage: true });

  await page.getByRole("button", { name: "Recruiting", exact: true }).click();
  await page.getByTestId("recruit-stars-filter").selectOption("2");
  await expect(page.getByTestId("recruiting-database")).toContainText("Committed to", { timeout: 30_000 });
  await page.getByTestId("recruit-commitment-filter").selectOption("open");
  await expect(page.getByTestId("recruiting-database")).not.toContainText("Committed to");
  await page.getByTestId("recruit-commitment-filter").selectOption("committed");
  await expect(page.getByTestId("recruiting-database")).toContainText("Committed to", { timeout: 30_000 });
  await page.screenshot({ path: path.join(screenshotDir, "recruiting-commitments-desktop.png"), fullPage: true });

  await page.getByRole("button", { name: "Debug" }).click();
  await page.getByRole("button", { name: "Force User Playoff" }).click();
  await page.getByRole("button", { name: "Force User Award" }).click();
  await page.getByRole("button", { name: "Force Walk-on Need" }).click();

  for (let week = 0; week < 4; week += 1) {
    await advanceDynasty(page);
  }

  await expect(page.getByText(/postseason/)).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: "Overview" }).click();
  await expect(page.getByTestId("dashboard-playoff-bracket")).toBeVisible();
  await expect(page.getByTestId("dashboard-playoff-bracket")).toContainText("Postseason Command");
  await expect(page.getByTestId("dashboard-command-panel")).not.toBeVisible();
  await expect(page.getByTestId("latest-national-awards-panel")).not.toBeVisible();
  await expect(page.getByTestId("dashboard-current-poll-panel")).not.toBeVisible();
  await page.getByTestId("dashboard-playoff-bracket").screenshot({ path: path.join(screenshotDir, "dashboard-playoff-bracket-desktop.png") });
  await page.getByRole("button", { name: "Schedule" }).click();
  await expect(page.getByTestId("game-row").first()).toContainText(/Bowl/);
  await page.screenshot({ path: path.join(screenshotDir, "schedule-postseason-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Program" }).click();
  await expect(page.getByTestId("coach-pool-panel")).toBeVisible();
  await page.getByTestId("coach-pool-panel").screenshot({ path: path.join(screenshotDir, "coach-pool-postseason-desktop.png") });
  await page.getByRole("button", { name: "Awards" }).click();
  await expect(page.getByText("Season Awards")).toBeVisible();
  const userSeasonAwardCard = page.getByTestId("awards-panel").getByTestId("user-team-award-card").first();
  await expect(userSeasonAwardCard).toBeVisible();
  await expect(page.getByTestId("awards-panel")).toContainText("Iron Lantern Trophy");
  const userSeasonAwardPlayer = (await userSeasonAwardCard.locator("h3").textContent())?.trim() ?? "";
  await page.getByTestId("awards-panel").screenshot({ path: path.join(screenshotDir, "awards-desktop.png") });
  await page.getByTestId("all-american-first-panel").screenshot({ path: path.join(screenshotDir, "all-american-desktop.png") });
  await page.getByTestId("all-american-second-panel").screenshot({ path: path.join(screenshotDir, "all-american-second-desktop.png") });
  await page.getByTestId("all-conference-first-panel").screenshot({ path: path.join(screenshotDir, "all-conference-first-desktop.png") });
  await page.getByTestId("all-conference-second-panel").screenshot({ path: path.join(screenshotDir, "all-conference-second-desktop.png") });
  await page.getByTestId("playoff-panel").screenshot({ path: path.join(screenshotDir, "playoffs-desktop.png") });
  await page.getByRole("button", { name: "Roster" }).click();
  await page.locator(".roster-row").filter({ hasText: userSeasonAwardPlayer }).first().click();
  await page.getByTestId("player-modal").getByRole("button", { name: "Awards" }).click();
  await expect(page.getByTestId("player-modal")).toContainText("Iron Lantern Trophy");
  await page.getByTestId("player-modal").screenshot({ path: path.join(screenshotDir, "player-awards-modal-desktop.png") });
  await page.getByRole("button", { name: "Close player card" }).click();

  for (let round = 0; round < 3; round += 1) {
    await advanceDynasty(page);
  }

  await expect(page.getByText(/championship recap/)).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: "Overview" }).click();
  await expect(page.getByTestId("championship-recap-panel")).toContainText("Crown Bowl Champion");
  await expect(page.getByTestId("championship-recap-panel")).toContainText("won the national title");
  await expect(page.getByTestId("playoff-champion-banner")).toBeVisible();
  await expect(page.getByTestId("offseason-report-panel")).not.toBeVisible();
  await page.getByTestId("championship-recap-panel").screenshot({ path: path.join(screenshotDir, "championship-recap-desktop.png") });

  await advanceDynasty(page);
  await expect(page.getByText(/offseason/)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("offseason-report-panel")).toBeVisible();
  await expect(page.getByTestId("championship-recap-panel")).not.toBeVisible();
  await expect(page.getByTestId("dashboard-command-panel")).not.toBeVisible();
  await expect(page.getByTestId("latest-national-awards-panel")).not.toBeVisible();
  await expect(page.getByTestId("dashboard-current-poll-panel")).not.toBeVisible();
  await expect(page.getByTestId("offseason-steps")).toContainText("Departures");
  await expect(page.getByTestId("graduated-panel")).toBeVisible();
  await expect(page.getByTestId("offseason-all-classes-panel")).not.toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "offseason-dashboard-desktop.png"), fullPage: true });
  await page.getByTestId("offseason-report-panel").screenshot({ path: path.join(screenshotDir, "offseason-departures-desktop.png") });

  await advanceDynasty(page);
  await expect(page.getByText(/offseason recruiting week 1 of 4/)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("offseason-steps")).toContainText("Recruiting 1/4");
  await expect(page.getByTestId("offseason-recruiting-focus-panel")).toBeVisible();
  await expect(page.getByTestId("graduated-panel")).not.toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "offseason-extra-recruiting-desktop.png"), fullPage: true });

  for (let week = 0; week < 4; week += 1) {
    await advanceDynasty(page);
  }

  await expect(page.getByText(/offseason signing day - ready/)).toBeVisible({ timeout: 90_000 });

  await advanceDynasty(page);
  await expect(page.getByText(/offseason signing day - classes posted/)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("offseason-all-classes-panel")).toBeVisible();
  const selectedClassName = await page.getByTestId("offseason-class-team-select").evaluate((select) => (select as HTMLSelectElement).selectedOptions[0]?.textContent ?? "");
  expect(selectedClassName).toContain(userTeamName);
  await expect(page.getByTestId("recruiting-ranking-panel")).toContainText("Recruiting Class Leaderboard");
  await page.getByTestId("recruiting-ranking-panel").screenshot({ path: path.join(screenshotDir, "offseason-recruiting-rankings-desktop.png") });
  await page.getByTestId("offseason-all-classes-panel").screenshot({ path: path.join(screenshotDir, "offseason-all-classes-desktop.png") });
  await expect(page.getByTestId("signees-pagination")).toContainText("signees:");
  await page.getByRole("button", { name: "Next signees page" }).click();
  await expect(page.getByTestId("signees-pagination")).toContainText("Page 2");
  await page.getByTestId("offseason-all-classes-panel").screenshot({ path: path.join(screenshotDir, "offseason-all-classes-page-2-desktop.png") });
  await page.getByTestId("signee-row").first().click();
  await expect(page.getByTestId("signed-recruit-modal")).toContainText("Signed Prospect");
  await expect(page.getByTestId("signed-recruit-attributes")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close signed recruit detail" })).toHaveClass(/icon-button/);
  await page.getByTestId("signed-recruit-modal").screenshot({ path: path.join(screenshotDir, "signing-day-recruit-modal-desktop.png") });
  await page.getByRole("button", { name: "Close signed recruit detail" }).click();

  await advanceDynasty(page);
  await expect(page.getByText(/preseason development results/)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("preseason-progression-panel")).toBeVisible();
  await expect(page.getByTestId("program-review-panel")).not.toBeVisible();
  await page.getByTestId("preseason-progression-panel").screenshot({ path: path.join(screenshotDir, "preseason-progression-desktop.png") });
  await page.getByTestId("preseason-progression-panel").screenshot({ path: path.join(screenshotDir, "offseason-walk-ons-desktop.png") });

  await advanceDynasty(page);
  await expect(page.getByText(/preseason program review/)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("program-review-panel")).toBeVisible();
  await page.getByTestId("program-review-panel").screenshot({ path: path.join(screenshotDir, "offseason-program-review-desktop.png") });

  await page.getByRole("button", { name: "Program" }).click();
  await expect(page.getByTestId("program-blueprint-panel")).toContainText("Director Goals");
  await expect(page.getByTestId("director-review-panel")).toBeVisible();
  await page.getByTestId("program-blueprint-panel").screenshot({ path: path.join(screenshotDir, "program-blueprint-review-desktop.png") });

  await page.getByRole("button", { name: "Recruiting", exact: true }).click();
  await expect(page.getByTestId("recruiting-budget-panel")).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "offseason-recruiting-desktop.png"), fullPage: true });

  await advanceDynasty(page);
  await expect(page.getByText(/regular - Week 1/)).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: "Overview" }).click();
  await expect(page.getByTestId("offseason-report-panel")).not.toBeVisible();
});

async function advanceDynasty(page: import("@playwright/test").Page) {
  const label = page.getByTestId("phase-week-label");
  const before = await label.textContent().catch(() => undefined);
  const advance = page.getByTestId("advance-week");
  await expect(advance).toBeEnabled({ timeout: 60_000 });
  await advance.click();
  await expect(advance).toBeEnabled({ timeout: 90_000 });
  if (before) {
    await page.waitForFunction((previous) => document.querySelector('[data-testid="phase-week-label"]')?.textContent !== previous, before, { timeout: 90_000 }).catch(() => undefined);
  }
}

async function clearBrowserSave(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("campus-gridiron-dynasty");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });
}
