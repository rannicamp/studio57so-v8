const { test, expect } = require('@playwright/test');
const loginBot = require('./utils/loginBot');

test.describe('Módulo Recursos Humanos', () => {
  test.beforeEach(async ({ page }) => {
    await loginBot(page);
  });

  test('Deve acessar lista de Gestão de RH sem erros (Crash)', async ({ page }) => {
    // Acessar gestao de RH, normalmente em /funcionarios ou /rh
    await page.goto('/funcionarios');
    
    // Opcional: esperar um pouco pra UI reagir (ou networkidle)
    await page.waitForLoadState('domcontentloaded');

    // Como estamos apenas fazendo leitura estrutural (N1)
    // Precisamos saber se não ocorreu "Application Error" 
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error: a client-side exception has occurred');
    expect(bodyText).not.toContain('ChunkLoadError');
    
    // Supondo que tem um botão Novo Funcionario ou Campo de Busca
    const isSearchVisible = await page.locator('input[placeholder*="buscar" i], input[type="text"]').first().isVisible().catch(() => false);
    console.log('[RH] Campo de busca detectado?', isSearchVisible);
  });
});
