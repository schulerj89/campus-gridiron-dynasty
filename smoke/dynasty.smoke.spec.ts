import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const screenshotDir = path.join(process.cwd(), "artifacts", "screenshots");

test.beforeAll(() => {
  fs.mkdirSync(screenshotDir, { recursive: true });
});

test("end-to-end dynasty smoke with debug flows", async ({ page }, testInfo) => {
  await page.goto("/");
  await clearBrowserSave(page);
  await page.reload();

  await expect(page.getByRole("heading", { name: "Campus Gridiron Dynasty" })).toBeVisible();
  await expect(page.getByText("v0.2.0").first()).toBeVisible();
  if (testInfo.project.name === "chromium-desktop") {
    await page.screenshot({ path: path.join(screenshotDir, "home-desktop.png"), fullPage: true });
  }

  await page.getByTestId("new-dynasty").click();
  await expect(page.getByText("Dynasty Command")).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText(/Year 1 of 20/)).toBeVisible();
  await expect(page.getByText("v0.2.0").first()).toBeVisible();

  if (testInfo.project.name === "chromium-desktop") {
    await page.screenshot({ path: path.join(screenshotDir, "dashboard-desktop.png"), fullPage: true });
  }
  if (testInfo.project.name === "webkit-iphone-15-pro-max") {
    await expect(page.getByText("Action Items")).not.toBeVisible();
    await expect(page.getByText("Latest National Awards")).not.toBeVisible();
    await expect(page.getByText("Passing")).not.toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, "mobile-dashboard.png"), fullPage: true });
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

  await page.getByRole("button", { name: /Awards/ }).click();
  await expect(page.getByTestId("awards-panel")).toBeVisible();
  await expect(page.getByTestId("playoff-panel")).toBeVisible();
  await expect(page.getByText("Dynasty History")).toBeVisible();
  if (testInfo.project.name === "chromium-desktop") {
    await page.screenshot({ path: path.join(screenshotDir, "awards-playoff-desktop.png"), fullPage: true });
  }
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
