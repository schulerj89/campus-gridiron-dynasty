import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const screenshotDir = path.join(process.cwd(), "artifacts", "screenshots");

test.beforeAll(() => {
  fs.mkdirSync(screenshotDir, { recursive: true });
});

test("dashboard advance buttons use the guarded advance flow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Dashboard regression screenshots are captured once on desktop Chromium.");

  await page.goto("/?seed=13041");
  await clearBrowserSave(page);
  await page.reload();
  await page.getByTestId("new-dynasty").click();
  await expect(page.getByText("Dynasty Command")).toBeVisible({ timeout: 40_000 });

  const phaseLabel = page.getByTestId("phase-week-label");
  const dashboardAdvance = page.getByTestId("dashboard-command-panel").getByRole("button", { name: "Advance Week" });
  await dashboardAdvance.dblclick();
  await expect(dashboardAdvance).toBeEnabled({ timeout: 90_000 });
  await expect(phaseLabel).toContainText("Week 2");
  await expect(phaseLabel).not.toContainText("Week 3");
  await page.screenshot({ path: path.join(screenshotDir, "dashboard-advance-guard-desktop.png"), fullPage: true });
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
