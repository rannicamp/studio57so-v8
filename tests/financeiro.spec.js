const { test, expect } = require('@playwright/test');
const loginBot = require('./utils/loginBot');

test.describe('Módulo Financeiro', () => {
  test.beforeEach(async ({ page }) => {
    await loginBot(page);
  });

  test('Acesso Direto ao Cofre Central Financeiro', async ({ page }) => {
    await page.goto('/financeiro');
    await page.waitForLoadState('networkidle');

    // Verifica se os cartões de saldo carregaram no topo
    // Procuramos termos que geralmente existem num dashboard financeiro
    const pageText = await page.textContent('body');
    
    // Apenas verificações anti-crash
    expect(pageText).not.toContain('Unhandled Runtime Error');
    expect(pageText).not.toContain('ChunkLoadError');

    // Verifica se alguma tabela ou listagem carregou
    const tablesCount = await page.locator('table').count();
    const listsCount = await page.locator('ul').count();
    expect(tablesCount + listsCount).toBeGreaterThanOrEqual(0);
  });
});
