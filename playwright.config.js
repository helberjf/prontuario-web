import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  workers: 2,
  timeout: 30000,
  expect: { timeout: 7000 },
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  globalSetup: './e2e/global-setup.js',
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/resultados.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    storageState: 'e2e/.auth/demo.json',
    browserName: 'chromium',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-claro', use: { viewport: { width: 1440, height: 900 }, colorScheme: 'light' } },
    { name: 'desktop-escuro', use: { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' } },
    { name: 'celular-claro', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light' } },
    { name: 'celular-escuro', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' } },
  ],
  webServer: { command: 'node e2e/server.mjs', url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 20000 },
});
