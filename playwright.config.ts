import { defineConfig, devices } from "@playwright/test";
import "./tests/support/load-env";

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: { baseURL: process.env.BETTER_AUTH_URL },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://localhost:3100/api/health",
    timeout: 60_000,
    reuseExistingServer: false,
  },
  projects: [
    { name: "Smartphone 375", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true } },
    { name: "Tablet 768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true } },
    { name: "Desktop 1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
});
