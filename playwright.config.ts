// End-to-end smoke tests (npm run test:e2e), in Chromium only to keep CI fast.
// They run against `astro preview` of a build made the way the GitHub Pages
// preview is built (under /peter-rothwell-website/, with PREVIEW=true), so
// base-path bugs show up. That build goes to dist-e2e/, leaving dist/ alone.
import { defineConfig, devices } from '@playwright/test';

const port = 4330;
const base = '/peter-rothwell-website/';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${port}${base}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx astro build && npx astro preview --port ${port} --ignore-lock`,
    url: `http://localhost:${port}${base}`,
    env: { BASE_PATH: base, PREVIEW: 'true', OUT_DIR: './dist-e2e' },
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
  },
});
