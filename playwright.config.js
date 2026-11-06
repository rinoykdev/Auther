import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration.
 *
 * Starts the Vite dev server itself, so `npx playwright test` works from a
 * clean checkout without a separate terminal.
 *
 * NOTE: journeys requiring an email (registration, verification, password
 * reset) are NOT automated. Removing the local Supabase stack also removed its
 * local inbox, and no mail-testing service is introduced in Milestone 2 (plan
 * §5.2). Those journeys arrive in Milestone 4 with whatever approach is decided
 * then.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      VITE_SUPABASE_URL: 'https://e2e-placeholder.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'e2e-placeholder-not-a-real-key',
    },
  },
})
