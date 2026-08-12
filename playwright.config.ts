import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// The container ships a pinned Chromium; prefer it, else let Playwright resolve.
const CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = existsSync(CHROMIUM) ? CHROMIUM : undefined;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: { executablePath, args: ["--no-sandbox"] },
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: false,
        launchOptions: { executablePath, args: ["--no-sandbox"] },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
