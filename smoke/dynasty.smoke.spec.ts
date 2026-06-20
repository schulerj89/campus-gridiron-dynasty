import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { APP_VERSION } from "../src/version";

const screenshotDir = path.join(process.cwd(), "artifacts", "screenshots");

test.beforeAll(() => {
  fs.mkdirSync(screenshotDir, { recursive: true });
});

test("end-to-end dynasty smoke with debug flows", async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === "webkit-iphone-15-pro-max";
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
  if (isMobile) {
    await expect(page.getByText("Action Items")).not.toBeVisible();
    await expect(page.getByText("Latest National Awards")).not.toBeVisible();
    await expect(page.getByText("Passing")).not.toBeVisible();
    await expect(page.getByTestId("mobile-section-menu")).toBeVisible();
    await expect(page.locator("#dynasty-section-tabs")).toBeHidden();
    await page.getByTestId("mobile-section-menu").click();
    await expect(page.locator("#dynasty-section-tabs")).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, "mobile-section-menu.png"), fullPage: false });
    await page.getByTestId("mobile-section-menu").click();
    await expectNoHorizontalOverflow(page, "dashboard");
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

  await openDynastySection(page, testInfo, /Recruiting/);
  await page.getByTestId("auto-recruit").click();
  await expect(page.getByTestId("recruiting-board")).toContainText(/Interest|Scout/);
  await expect(page.getByTestId("board targets-pagination")).toContainText("board targets:");
  await page.getByRole("button", { name: "Next board targets page" }).click();
  await expect(page.getByTestId("board targets-pagination")).toContainText("Page 2");
  if (testInfo.project.name === "chromium-desktop") {
    await page.screenshot({ path: path.join(screenshotDir, "recruiting-desktop.png"), fullPage: true });
  }
  if (isMobile) {
    await expect(page.getByTestId("recruiting-database")).toBeVisible();
    const databaseOverflows = await page.getByTestId("recruiting-database").evaluate((element) => element.scrollWidth > element.clientWidth + 1);
    expect(databaseOverflows).toBe(false);
    await expectNoHorizontalOverflow(page, "recruiting");
    await page.getByTestId("recruiting-database").screenshot({ path: path.join(screenshotDir, "mobile-recruiting.png") });
  }

  await openDynastySection(page, testInfo, /Debug/);
  await page.getByRole("button", { name: "Force User Playoff" }).click();
  await page.getByRole("button", { name: "Force User Award" }).click();
  await page.getByTestId("sim-three-seasons").click();
  await expect(page.getByText(/Year 4 of 20/)).toBeVisible({ timeout: 90_000 });

  await openDynastySection(page, testInfo, /Stats/);
  await expect(page.getByTestId("leaderboard-panel")).toBeVisible();
  if (isMobile) {
    await expectNoHorizontalOverflow(page, "stats");
    await page.screenshot({ path: path.join(screenshotDir, "mobile-stats.png"), fullPage: true });
  }

  await openDynastySection(page, testInfo, /Program/);
  await expect(page.getByTestId("program-record-book-panel")).toContainText("Program Record Book");
  await expect(page.getByTestId("dynasty-history-panel")).toContainText("Dynasty History");
  if (testInfo.project.name === "chromium-desktop") {
    await page.getByTestId("program-record-book-panel").screenshot({ path: path.join(screenshotDir, "program-record-book-desktop.png") });
  }
  if (isMobile) {
    await expectNoHorizontalOverflow(page, "program");
    await page.screenshot({ path: path.join(screenshotDir, "mobile-program.png"), fullPage: true });
  }

  if (isMobile) {
    await openDynastySection(page, testInfo, /Debug/);
    await page.getByRole("button", { name: "Force User Award" }).click();
    await openDynastySection(page, testInfo, /Overview/);
    for (let week = 0; week < 12; week += 1) {
      await advanceDynasty(page);
    }
    await expect(page.getByTestId("phase-week-label")).toContainText("postseason", { timeout: 90_000 });
  }

  await openDynastySection(page, testInfo, /Awards/);
  await expect(page.getByTestId("awards-panel")).toBeVisible();
  await expect(page.getByTestId("playoff-panel")).toBeVisible();
  if (testInfo.project.name === "chromium-desktop") {
    await page.screenshot({ path: path.join(screenshotDir, "awards-playoff-desktop.png"), fullPage: true });
  }
  if (isMobile) {
    await expect(page.getByTestId("awards-panel").getByTestId("award-statue-image").first()).toBeVisible();
    const candidateDrawer = page.getByTestId("mobile-award-candidate-list").first();
    await expect(candidateDrawer).toBeVisible();
    await candidateDrawer.locator("summary").click();
    await expect(candidateDrawer.locator(".award-candidate-row").first()).toBeVisible();
    await candidateDrawer.locator("summary").click();
    const honorDrawer = page.locator(".mobile-honor-details").first();
    await expect(honorDrawer).toBeVisible();
    await honorDrawer.locator("summary").click();
    await expect(honorDrawer.locator(".card").first()).toBeVisible();
    await honorDrawer.locator("summary").click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoHorizontalOverflow(page, "awards");
    await page.screenshot({ path: path.join(screenshotDir, "mobile-awards.png"), fullPage: true });
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
  await expect(page.getByTestId("preseason-progression-panel")).not.toContainText("Incoming FR");
  await expect(page.getByTestId("preseason-cutdown-panel")).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, "offseason-development-focus-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: /Awards/ }).click();
  await expect(page.getByTestId("awards-panel")).toContainText("Latest Season Awards");
  await page.getByTestId("awards-panel").screenshot({ path: path.join(screenshotDir, "awards-latest-season-desktop.png") });
  await page.getByRole("button", { name: /Overview/ }).click();

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

async function openDynastySection(page: import("@playwright/test").Page, testInfo: import("@playwright/test").TestInfo, name: string | RegExp) {
  const mobileMenu = page.getByTestId("mobile-section-menu");
  if (testInfo.project.name === "webkit-iphone-15-pro-max" && (await mobileMenu.isVisible())) {
    await mobileMenu.click();
  }
  await page.getByRole("button", { name }).click();
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page, label: string) {
  const overflow = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    if (documentWidth <= viewportWidth + 1) return null;
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: element.className.toString(),
          testId: element.dataset.testid ?? "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        };
      })
      .filter((entry) => entry.right > viewportWidth + 1 || entry.left < -1 || entry.scrollWidth > entry.clientWidth + 1)
      .slice(0, 8);
    return { viewportWidth, documentWidth, offenders };
  });
  expect(overflow, `${label} should fit inside the mobile viewport`).toBeNull();
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
