import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const screenshotDir = path.join(process.cwd(), "artifacts", "screenshots");

test.beforeAll(() => {
  fs.mkdirSync(screenshotDir, { recursive: true });
});

test("captures additional feature screenshots", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Feature screenshot artifacts are captured once on desktop Chromium.");

  await page.goto("/");
  await clearBrowserSave(page);
  await page.reload();
  await page.getByTestId("new-dynasty").click();
  await expect(page.getByText("Dynasty Command")).toBeVisible({ timeout: 40_000 });

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

  await page.getByRole("button", { name: "Recruiting" }).click();
  await expect(page.getByTestId("recruit-filter-panel")).toBeVisible();
  await expect(page.locator(".stars svg").first()).toBeVisible();
  await page.getByTestId("recruit-position-filter").selectOption("QB");
  await expect(page.getByTestId("recruiting-database")).toContainText("QB");
  await page.screenshot({ path: path.join(screenshotDir, "recruiting-filters-desktop.png"), fullPage: true });

  await page.getByRole("button", { name: "Program" }).click();
  await expect(page.getByText("Program Investments")).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "program-staff-desktop.png"), fullPage: true });

  await page.getByTestId("advance-week").click();
  await page.getByRole("button", { name: "Schedule" }).click();
  await expect(page.getByTestId("game-row").first()).toContainText(/W1/);
  await page.getByTestId("game-row").first().click();
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
  await page.getByTestId("leaderboard-panel").screenshot({ path: path.join(screenshotDir, "leaderboard-desktop.png") });

  for (let week = 0; week < 7; week += 1) {
    await page.getByTestId("advance-week").click();
  }

  await page.getByRole("button", { name: "Recruiting" }).click();
  await page.getByTestId("recruit-stars-filter").selectOption("2");
  await expect(page.getByTestId("recruiting-database")).toContainText("Committed to", { timeout: 30_000 });
  await page.screenshot({ path: path.join(screenshotDir, "recruiting-commitments-desktop.png"), fullPage: true });

  await page.getByRole("button", { name: "Debug" }).click();
  await page.getByRole("button", { name: "Force User Playoff" }).click();
  await page.getByRole("button", { name: "Force User Award" }).click();

  for (let week = 0; week < 4; week += 1) {
    await page.getByTestId("advance-week").click();
  }

  await expect(page.getByText(/postseason/)).toBeVisible({ timeout: 90_000 });
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
  await page.screenshot({ path: path.join(screenshotDir, "offseason-dashboard-desktop.png"), fullPage: true });
  await page.getByTestId("offseason-report-panel").screenshot({ path: path.join(screenshotDir, "offseason-departures-desktop.png") });
  await page.getByTestId("advance-week").click();
  await expect(page.getByText(/Year 2 of 20/)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("recruiting-ranking-panel")).toContainText("Recruiting Class Leaderboard");
  await page.getByTestId("recruiting-ranking-panel").screenshot({ path: path.join(screenshotDir, "offseason-recruiting-rankings-desktop.png") });
  await page.getByRole("button", { name: "Recruiting" }).click();
  await expect(page.getByTestId("recruiting-budget-panel")).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "offseason-recruiting-desktop.png"), fullPage: true });
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
