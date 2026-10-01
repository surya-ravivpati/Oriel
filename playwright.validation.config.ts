import { defineConfig } from "@playwright/test";

/** Validation harnesses (not part of CI e2e): run against the dev server. */
export default defineConfig({
  testDir: "tests/validation",
  testMatch: /.*\.validation\.ts$/,
  timeout: 300_000,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.ORIEL_URL ?? "http://localhost:3100", channel: "chrome", headless: true },
});
