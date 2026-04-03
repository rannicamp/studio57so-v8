import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  /* Rodar testes em paralelo se não for teste de UI no Supabase por conflitos de dados. Aqui deixaremos sequencial por enquanto. */
  fullyParallel: false,
  retries: 1,
  workers: 1, // Para não bagunçar o db testando várias coisas ao mesmo tempo.
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 0,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
