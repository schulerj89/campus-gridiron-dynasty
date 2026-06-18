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
  await expect(page.getByTestId("rankings-panel")).toContainText("Top 25");
  await expect(page.getByTestId("rankings-panel")).toContainText("1st");
  await page.screenshot({ path: path.join(screenshotDir, "rankings-desktop.png"), fullPage: true });

  await page.getByRole("button", { name: "Recruiting", exact: true }).click();
  await expect(page.getByTestId("recruit-filter-panel")).toBeVisible();
  await expect(page.getByTestId("recruiting-needs-panel")).toContainText("Board");
  await page.getByTestId("recruiting-needs-panel").screenshot({ path: path.join(screenshotDir, "recruiting-needs-desktop.png") });
  await page.getByTestId("need-command-QB").click();
  await expect(page.getByTestId("recruit-position-filter")).toHaveValue("QB");
  await expect(page.locator(".stars svg").first()).toBeVisible();
  await expect(page.getByTestId("recruiting-database")).toContainText("QB");
  await expect(page.getByTestId("recruits-pagination")).toContainText("recruits:");
  await page.getByRole("button", { name: "Next recruits page" }).click();
  await expect(page.getByTestId("recruits-pagination")).toContainText("Page 2");
  await page.getByTestId("recruit-row").first().click();
  const recruitModal = page.getByTestId("recruit-modal");
  await expect(recruitModal).toContainText("School Interest");
  await expect(recruitModal).toContainText("Offer Scholarship");
  const offerButton = recruitModal.getByRole("button", { name: "Offer Scholarship" });
  if (await offerButton.isEnabled()) await offerButton.click();
  const pitchButton = recruitModal.getByRole("button", { name: "Pitch" });
  if (await pitchButton.isEnabled()) await pitchButton.click();
  await expect(recruitModal).toContainText("Pitch:");
  await recruitModal.screenshot({ path: path.join(screenshotDir, "recruiting-scholarship-modal-desktop.png") });
  await page.getByRole("button", { name: "Close recruit detail" }).click();
  await page.screenshot({ path: path.join(screenshotDir, "recruiting-filters-desktop.png"), fullPage: true });

  await page.getByRole("button", { name: "Program" }).click();
  await expect(page.getByTestId("program-blueprint-panel")).toBeVisible();
  await expect(page.getByTestId("program-blueprint-panel")).toContainText("unused points auto-assign");
  await expect(page.getByTestId("director-goals-panel")).toContainText("Director");
  await page.getByTestId("program-blueprint-panel").screenshot({ path: path.join(screenshotDir, "program-blueprint-desktop.png") });
  await expect(page.getByText("Program Investments")).toBeVisible();
  await expect(page.getByTestId("coach-pool-panel")).not.toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "program-staff-desktop.png"), fullPage: true });

  await page.getByTestId("advance-week").click();
  await page.getByRole("button", { name: "Schedule" }).click();
  await expect(page.getByTestId("schedule-matchup-preview")).toContainText("Matchup Preview");
  await page.getByTestId("schedule-matchup-preview").screenshot({ path: path.join(screenshotDir, "schedule-matchup-preview-desktop.png") });
  const completedWeekOneRow = page.getByTestId("game-row").filter({ hasText: /W1/ }).first();
  await expect(completedWeekOneRow).toBeVisible();
  await completedWeekOneRow.click();
  await expect(page.getByTestId("box-score-modal")).toBeVisible();
  await expect(page.getByTestId("box-score-modal")).toContainText("PaTD");
  await page.getByTestId("box-score-modal").screenshot({ path: path.join(screenshotDir, "box-score-desktop.png") });
  await page.getByRole("button", { name: "Close box score" }).click();

  await page.getByRole("button", { name: "Awards" }).click();
  await expect(page.getByText("Season Award Watch Opens Week 8")).toBeVisible();
  await expect(page.getByTestId("player-of-week-panel")).toBeVisible();
  await expect(page.getByTestId("player-of-week-panel")).toContainText("National Offensive Player of the Week");
  await expect(page.getByTestId("player-of-week-panel")).toContainText("National Defensive Player of the Week");
  await page.getByTestId("player-of-week-panel").screenshot({ path: path.join(screenshotDir, "player-of-week-desktop.png") });
  await expect(page.getByTestId("conference-player-of-week-panel")).toBeVisible();
  await page.getByTestId("conference-player-of-week-panel").screenshot({ path: path.join(screenshotDir, "conference-player-of-week-desktop.png") });
  await expect(page.getByTestId("leaderboard-panel")).toContainText("Pass Yds");
  await expect(page.getByTestId("leaderboard-panel")).toContainText("Rush TD");
  await page.getByTestId("leaderboard-panel").screenshot({ path: path.join(screenshotDir, "leaderboard-desktop.png") });

  for (let week = 0; week < 7; week += 1) {
    await page.getByTestId("advance-week").click();
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
    await page.getByTestId("advance-week").click();
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
  await page.getByTestId("awards-panel").screenshot({ path: path.join(screenshotDir, "awards-desktop.png") });
  await page.getByTestId("all-american-first-panel").screenshot({ path: path.join(screenshotDir, "all-american-desktop.png") });
  await page.getByTestId("all-american-second-panel").screenshot({ path: path.join(screenshotDir, "all-american-second-desktop.png") });
  await page.getByTestId("all-conference-first-panel").screenshot({ path: path.join(screenshotDir, "all-conference-first-desktop.png") });
  await page.getByTestId("all-conference-second-panel").screenshot({ path: path.join(screenshotDir, "all-conference-second-desktop.png") });
  await page.getByTestId("playoff-panel").screenshot({ path: path.join(screenshotDir, "playoffs-desktop.png") });

  for (let round = 0; round < 3; round += 1) {
    await page.getByTestId("advance-week").click();
  }

  await expect(page.getByText(/offseason/)).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: "Overview" }).click();
  await expect(page.getByTestId("offseason-report-panel")).toBeVisible();
  await expect(page.getByTestId("dashboard-command-panel")).not.toBeVisible();
  await expect(page.getByTestId("latest-national-awards-panel")).not.toBeVisible();
  await expect(page.getByTestId("offseason-steps")).toContainText("Departures");
  await expect(page.getByTestId("graduated-panel")).toBeVisible();
  await expect(page.getByTestId("offseason-all-classes-panel")).not.toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "offseason-dashboard-desktop.png"), fullPage: true });
  await page.getByTestId("offseason-report-panel").screenshot({ path: path.join(screenshotDir, "offseason-departures-desktop.png") });

  await page.getByTestId("advance-week").click();
  await expect(page.getByText(/offseason recruiting week 2 of 4/)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("offseason-steps")).toContainText("Recruiting 2/4");
  await expect(page.getByTestId("offseason-recruiting-focus-panel")).toBeVisible();
  await expect(page.getByTestId("graduated-panel")).not.toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "offseason-extra-recruiting-desktop.png"), fullPage: true });

  for (let week = 0; week < 3; week += 1) {
    await page.getByTestId("advance-week").click();
  }

  await expect(page.getByText(/offseason signing day - ready/)).toBeVisible({ timeout: 90_000 });

  await page.getByTestId("advance-week").click();
  await expect(page.getByText(/offseason signing day - classes posted/)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("offseason-all-classes-panel")).toBeVisible();
  await expect(page.getByTestId("recruiting-ranking-panel")).toContainText("Recruiting Class Leaderboard");
  await page.getByTestId("recruiting-ranking-panel").screenshot({ path: path.join(screenshotDir, "offseason-recruiting-rankings-desktop.png") });
  await page.getByTestId("offseason-all-classes-panel").screenshot({ path: path.join(screenshotDir, "offseason-all-classes-desktop.png") });

  await page.getByTestId("advance-week").click();
  await expect(page.getByText(/preseason week - player development/)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("preseason-progression-panel")).toBeVisible();
  await expect(page.getByTestId("program-review-panel")).toBeVisible();
  await expect(page.getByTestId("walk-ons-panel")).toBeVisible();
  await page.getByTestId("preseason-progression-panel").screenshot({ path: path.join(screenshotDir, "preseason-progression-desktop.png") });
  await page.getByTestId("program-review-panel").screenshot({ path: path.join(screenshotDir, "offseason-program-review-desktop.png") });
  await page.getByTestId("walk-ons-panel").screenshot({ path: path.join(screenshotDir, "offseason-walk-ons-desktop.png") });

  await page.getByRole("button", { name: "Program" }).click();
  await expect(page.getByTestId("program-blueprint-panel")).toContainText("Director Goals");
  await expect(page.getByTestId("director-review-panel")).toBeVisible();
  await page.getByTestId("program-blueprint-panel").screenshot({ path: path.join(screenshotDir, "program-blueprint-review-desktop.png") });

  await page.getByRole("button", { name: "Recruiting", exact: true }).click();
  await expect(page.getByTestId("recruiting-budget-panel")).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "offseason-recruiting-desktop.png"), fullPage: true });

  await page.getByTestId("advance-week").click();
  await expect(page.getByText(/regular - Week 1/)).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: "Overview" }).click();
  await expect(page.getByTestId("offseason-report-panel")).not.toBeVisible();
});

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
