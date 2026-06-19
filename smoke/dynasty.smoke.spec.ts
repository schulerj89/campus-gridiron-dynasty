import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { APP_VERSION } from "../src/version";

const screenshotDir = path.join(process.cwd(), "artifacts", "screenshots");

test.beforeAll(() => {
  fs.mkdirSync(screenshotDir, { recursive: true });
});

test("end-to-end dynasty smoke with debug flows", async ({ page }, testInfo) => {
  await page.goto("/?seed=13002");
  await clearBrowserSave(page);
  await page.reload();

  await expect(page.getByRole("heading", { name: "Campus Gridiron Dynasty" })).toBeVisible();
  await expect(page.getByText(APP_VERSION).first()).toBeVisible();
  await expect(page.getByTestId("team-picker")).toBeVisible();
  await page.getByTestId("team-next").click();
  if (testInfo.project.name === "chromium-desktop") {
    await page.screenshot({ path: path.join(screenshotDir, "home-desktop.png"), fullPage: true });
  }

  await page.getByTestId("new-dynasty").click();
  await expect(page.getByText("Dynasty Command")).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText(/Year 1 of 20/)).toBeVisible();
  await expect(page.getByText(APP_VERSION).first()).toBeVisible();
  await expect(page.getByTestId("advance-week")).toContainText("Advance Week");
  await expect(page.getByTestId("sim-month")).toContainText("Sim 4 Weeks");

  if (testInfo.project.name === "chromium-desktop") {
    await page.screenshot({ path: path.join(screenshotDir, "dashboard-desktop.png"), fullPage: true });
  }
  if (testInfo.project.name === "webkit-iphone-15-pro-max") {
    await expect(page.getByText("Action Items")).not.toBeVisible();
    await expect(page.getByText("Latest National Awards")).not.toBeVisible();
    await expect(page.getByText("Passing")).not.toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, "mobile-dashboard.png"), fullPage: true });
  }

  if (testInfo.project.name !== "webkit-iphone-15-pro-max") {
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("save-status")).toContainText("Saved", { timeout: 20_000 });
    await page.evaluate(() => {
      localStorage.setItem("campus-gridiron-active-save", "missing-save");
      localStorage.removeItem("campus-gridiron-active-save-summary");
    });
    await page.reload();
    await expect(page.getByTestId("save-summary")).toContainText("Continue", { timeout: 20_000 });
    await page.waitForFunction(() => {
      const activeId = localStorage.getItem("campus-gridiron-active-save");
      return Boolean(activeId && activeId !== "missing-save");
    });
    if (testInfo.project.name === "chromium-desktop") {
      await page.screenshot({ path: path.join(screenshotDir, "home-continue-summary-desktop.png"), fullPage: true });
    }
    await page.evaluate(() => {
      localStorage.setItem("campus-gridiron-active-save-summary", JSON.stringify({
        id: "wrong-save",
        userTeamName: "Wrong Save",
        year: 9,
        calendarYear: 2034,
        maxYears: 20,
        phase: "regular",
        week: 9,
        updatedAt: "2034-01-01T00:00:00.000Z",
      }));
    });
    await page.reload();
    await expect(page.getByText("Wrong Save")).not.toBeVisible();
    await expect(page.getByTestId("save-summary")).toContainText("Continue", { timeout: 20_000 });
    await page.getByRole("button", { name: "Clear local save" }).click();
    await expect(page.getByTestId("team-picker")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("save-summary")).not.toBeVisible();
    await page.reload();
    await expect(page.getByTestId("team-picker")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("save-summary")).not.toBeVisible();
    await page.getByTestId("new-dynasty").click();
    await expect(page.getByText(/Year 1 of 20/)).toBeVisible({ timeout: 40_000 });
  }

  await page.getByRole("button", { name: /Recruiting/ }).click();
  await page.getByTestId("auto-recruit").click();
  await expect(page.getByTestId("recruiting-board")).toContainText(/Interest|Scout/);
  if (testInfo.project.name === "chromium-desktop") {
    await page.screenshot({ path: path.join(screenshotDir, "recruiting-desktop.png"), fullPage: true });
  }

  await page.getByRole("button", { name: /Debug/ }).click();
  await page.getByRole("button", { name: "Force User Playoff" }).click();
  await page.getByRole("button", { name: "Force User Award" }).click();
  await page.getByTestId("sim-three-seasons").click();
  await expect(page.getByText(/Year 4 of 20/)).toBeVisible({ timeout: 90_000 });

  await page.getByRole("button", { name: /Program/ }).click();
  await expect(page.getByTestId("program-record-book-panel")).toContainText("Program Record Book");
  await expect(page.getByTestId("dynasty-history-panel")).toContainText("Dynasty History");
  if (testInfo.project.name === "chromium-desktop") {
    await page.getByTestId("program-record-book-panel").screenshot({ path: path.join(screenshotDir, "program-record-book-desktop.png") });
  }

  await page.getByRole("button", { name: /Awards/ }).click();
  await expect(page.getByTestId("awards-panel")).toBeVisible();
  await expect(page.getByTestId("playoff-panel")).toBeVisible();
  if (testInfo.project.name === "chromium-desktop") {
    await page.screenshot({ path: path.join(screenshotDir, "awards-playoff-desktop.png"), fullPage: true });
  }
});

test("focused offseason stage smoke screenshots", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Focused offseason screenshots are captured once on desktop.");

  await page.goto("/?seed=19301");
  await clearBrowserSave(page);
  await page.reload();
  await page.getByTestId("new-dynasty").click();
  await expect(page.getByText(/Year 1 of 20/)).toBeVisible({ timeout: 40_000 });

  await page.getByRole("button", { name: /Debug/ }).click();
  await page.getByRole("button", { name: "Force User Playoff" }).click();
  await page.getByRole("button", { name: "Force User Award" }).click();
  await page.getByRole("button", { name: /Overview/ }).click();

  for (let week = 0; week < 12; week += 1) {
    await advanceDynasty(page);
  }
  await expect(page.getByTestId("phase-week-label")).toContainText("postseason", { timeout: 60_000 });

  for (let round = 0; round < 3; round += 1) {
    await advanceDynasty(page);
  }
  await expect(page.getByTestId("championship-recap-panel")).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: path.join(screenshotDir, "offseason-championship-recap-desktop.png"), fullPage: true });

  await advanceDynasty(page);
  await expect(page.getByTestId("offseason-stage-departures")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("advance-week")).toContainText("Advance to Recruiting");
  await page.screenshot({ path: path.join(screenshotDir, "offseason-departures-focus-desktop.png"), fullPage: true });

  await advanceDynasty(page);
  await expect(page.getByTestId("offseason-stage-recruiting")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("advance-week")).toContainText("Advance Recruiting Week");
  await page.screenshot({ path: path.join(screenshotDir, "offseason-recruiting-focus-desktop.png"), fullPage: true });

  for (let week = 0; week < 4; week += 1) {
    await advanceDynasty(page);
  }
  await expect(page.getByTestId("advance-week")).toContainText("Run Signing Day");
  await advanceDynasty(page);
  await expect(page.getByTestId("offseason-stage-signing")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("offseason-all-classes-panel")).toContainText("All Team Classes");
  await page.screenshot({ path: path.join(screenshotDir, "offseason-signing-day-focus-desktop.png"), fullPage: true });

  await advanceDynasty(page);
  await expect(page.getByTestId("offseason-stage-development")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("preseason-progression-panel")).toContainText("Preseason Development");
  await page.screenshot({ path: path.join(screenshotDir, "offseason-development-focus-desktop.png"), fullPage: true });

  await advanceDynasty(page);
  await expect(page.getByTestId("offseason-stage-programReview")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("program-review-panel")).toContainText("Program Review");
  await page.screenshot({ path: path.join(screenshotDir, "offseason-program-review-focus-desktop.png"), fullPage: true });
});

async function advanceDynasty(page: import("@playwright/test").Page) {
  const label = page.getByTestId("phase-week-label");
  const before = await label.textContent();
  const advance = page.getByTestId("advance-week");
  await expect(advance).toBeEnabled({ timeout: 60_000 });
  await advance.click();
  await expect(advance).toBeEnabled({ timeout: 90_000 });
  await page.waitForFunction((previous) => document.querySelector('[data-testid="phase-week-label"]')?.textContent !== previous, before, { timeout: 90_000 }).catch(() => undefined);
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
