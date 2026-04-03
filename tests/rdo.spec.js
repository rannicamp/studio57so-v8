const { test, expect } = require('@playwright/test');
const loginBot = require('./utils/loginBot');

test.describe('Módulo Engenharia / Controle Obras (RDO)', () => {
  test.beforeEach(async ({ page }) => {
    await loginBot(page);
  });

  test('Teste de Leitura RDO', async ({ page }) => {
    await page.goto('/rdo');
    
    await page.waitForURL('**/rdo**', { timeout: 10000 }).catch(()=>null);
    
    const pageText = await page.textContent('body');
    
    // Verificações essenciais base
    expect(pageText).not.toContain('Unhandled Runtime Error');
    expect(pageText).not.toContain('Error: Minified React error');
  });
});
