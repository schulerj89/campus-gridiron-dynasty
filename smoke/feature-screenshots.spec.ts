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
  await expect(page.getByText("Roster Core")).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "roster-desktop.png"), fullPage: true });
  await expect(page.getByTestId("attributes-panel")).toBeVisible();
  await page.getByTestId("attributes-panel").screenshot({ path: path.join(screenshotDir, "attributes-desktop.png") });

  await page.getByRole("button", { name: "Program" }).click();
  await expect(page.getByText("Program Investments")).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "program-staff-desktop.png"), fullPage: true });

  await page.getByRole("button", { name: "Debug" }).click();
  await page.getByRole("button", { name: "Force User Playoff" }).click();
  await page.getByRole("button", { name: "Force User Award" }).click();

  for (let week = 0; week < 12; week += 1) {
    await page.getByTestId("advance-week").click();
  }

  await expect(page.getByText(/postseason/)).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: "Awards" }).click();
  await expect(page.getByText("Season Awards")).toBeVisible();
  await page.getByTestId("awards-panel").screenshot({ path: path.join(screenshotDir, "awards-desktop.png") });
  await page.getByTestId("all-american-panel").screenshot({ path: path.join(screenshotDir, "all-american-desktop.png") });
  await page.getByTestId("playoff-panel").screenshot({ path: path.join(screenshotDir, "playoffs-desktop.png") });

  for (let round = 0; round < 3; round += 1) {
    await page.getByTestId("advance-week").click();
  }

  await expect(page.getByText(/offseason/)).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: "Overview" }).click();
  await page.screenshot({ path: path.join(screenshotDir, "offseason-dashboard-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Recruiting" }).click();
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
