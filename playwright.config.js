// @ts-check
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const BASE_URL = process.env.BASE_URL || 'https://silent-flowers-190203.1wp.site';

module.exports = defineConfig({
  globalSetup: require.resolve('./utils/global-setup'),
  testDir: './tests',
  timeout: 150 * 1000,
  expect: { timeout: 10 * 1000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 1,   // 1 retry locally catches transient flakiness
  workers: process.env.CI ? 2 : 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: 'only-on-failure',
    video:      'retain-on-failure',
    trace:      'retain-on-failure',
    actionTimeout:     30 * 1000,
    navigationTimeout: 60 * 1000,
  },

  projects: [
    // ── Desktop ────────────────────────────────────────────────────────────────
    {
      name: 'Desktop Chrome',
      use: { browserName: 'chromium' },
    },
    {
      name: 'Desktop Safari',
      use: { browserName: 'webkit' },
    },

    // ── Mobile ─────────────────────────────────────────────────────────────────
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // ── Tablet ─────────────────────────────────────────────────────────────────
    {
      name: 'iPad',
      use: { ...devices['iPad (gen 7)'] },
    },
  ],
});
