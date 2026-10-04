import { defineConfig } from '@playwright/test';

// e2e 跑在本地 IndexedDB 模式（VITE_USE_LOCAL=1）：不依赖 API 服务器与 Supabase，
// 每个用例在独立浏览器上下文中注册新用户，数据完全隔离。
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3016',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm exec vite --port 3016 --strictPort',
    url: 'http://localhost:3016',
    reuseExistingServer: !process.env.CI,
    env: { VITE_USE_LOCAL: '1' },
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
