import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Glitchcan Minigames testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',

  // Maximum time one test can run
  timeout: 30 * 1000,

  // Fail the build on CI if tests still running after timeout
  globalTimeout: 60 * 60 * 1000,

  // Expect assertions to complete within 5 seconds
  expect: {
    timeout: 5000,
  },

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }],
    ['list']
  ],

  // Shared settings for all projects
  use: {
    // Base URL for all page.goto() calls
    baseURL: process.env.BASE_URL || 'http://localhost:8080',

    // Collect trace when retrying failed tests
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Capture video on first retry
    video: 'retain-on-failure',

    // Permissions for WebGL, audio, etc.
    permissions: ['clipboard-read', 'clipboard-write'],

    // Ignore HTTPS errors (for local testing)
    ignoreHTTPSErrors: true,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },

    // Mobile viewports (critical for this touch-focused project)
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
    },

    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
      },
    },

    // Tablet viewport
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro'],
      },
    },

    // Optional: Firefox and WebKit
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Run local dev server before starting tests
  webServer: {
    command: 'python -m http.server 8080',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
