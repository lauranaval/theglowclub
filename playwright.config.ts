import { defineConfig } from "@playwright/test";

const PORT = 8788;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "tauler/.resultats/playwright.json" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    serviceWorkers: "allow",
    locale: "ca-ES",
    timezoneId: "Europe/Madrid",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobil-390", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "ipad-820", grep: /F-14/, use: { browserName: "chromium", viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `node scripts/servidor-local.mjs ${PORT} --proves`,
    url: `http://127.0.0.1:${PORT}/entrar`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
