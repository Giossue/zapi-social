import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: "bun --env-file=../api/.env run --cwd ../api start:e2e",
          url: "http://127.0.0.1:3101/v1/setup",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: "bun run start:e2e",
          url: "http://localhost:3100/login",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
})
