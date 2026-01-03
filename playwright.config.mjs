import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 60000,
  // Run tests in parallel (different test files)
  fullyParallel: true,
  // Limit workers to avoid overwhelming the system
  workers: process.env.CI ? 1 : 2,
  // Fail fast on CI
  maxFailures: process.env.CI ? 2 : undefined,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    baseURL: 'http://localhost:5000',
    // Reduce action timeout
    actionTimeout: 10000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
