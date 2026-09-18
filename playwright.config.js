const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    locale: 'es-CO',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run build && node scripts/e2e-server.cjs',
    url: 'http://localhost:4173/api/health',
    timeout: 90_000,
    reuseExistingServer: false,
    env: {
      PORT: '4173',
      NODE_ENV: 'development',
      JWT_SECRET: 'e2e-secret'
    }
  }
});