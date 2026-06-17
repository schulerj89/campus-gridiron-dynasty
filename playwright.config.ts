import { defineConfig, devices } from "@playwright/test";

const smokePort = Number(process.env.CGD_SMOKE_PORT ?? 4273);
const smokeBaseUrl = `http://127.0.0.1:${smokePort}`;

export default defineConfig({
  testDir: "./smoke",
  timeout: 140_000,
  expect: {
    timeout: 20_000,
  },
  fullyParallel: false,
  reporter: [["list"], ["html", { outputFolder: "artifacts/playwright-report", open: "never" }]],
  use: {
    baseURL: smokeBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${smokePort} --strictPort`,
    url: smokeBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 950 },
      },
    },
    {
      name: "webkit-desktop",
      use: {
        browserName: "webkit",
        viewport: { width: 1440, height: 950 },
      },
    },
    {
      name: "webkit-iphone-15-pro-max",
      use: {
        ...devices["iPhone 15 Pro Max"],
        browserName: "webkit",
      },
    },
  ],
});
