import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: 'https://permacultureplantpicker.com',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
  projects: [
    {
      name: 'logged-in',
      use: { storageState: 'tests/.auth-state.json' },
      testMatch: ['**/lists.spec.ts', '**/plants.spec.ts'],
    },
    {
      name: 'logged-out',
      use: { storageState: { cookies: [], origins: [] } },
      testMatch: ['**/auth.spec.ts', '**/presentation.spec.ts'],
      dependencies: ['logged-in'],
    },
  ],
})
