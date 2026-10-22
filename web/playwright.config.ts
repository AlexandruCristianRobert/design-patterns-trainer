import { defineConfig, devices } from '@playwright/test'

// Dedicated port: 5173 is commonly taken by unrelated dev servers.
const PORT = 5199

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
