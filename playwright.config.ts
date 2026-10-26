import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: { baseURL: 'http://localhost:3101', browserName: 'chromium' },
  webServer: {
    command: 'node server/index.mjs',
    url: 'http://localhost:3101/api/state',
    env: { PORT: '3101', DATA_DIR: `./browser-test-${Date.now()}.local`, ADMIN_PASSWORD: 'browser-test-password', SEED_2026_SAMPLE: 'false' },
    reuseExistingServer: false,
  },
});
