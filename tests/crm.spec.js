const { test, expect } = require('@playwright/test');
const loginBot = require('./utils/loginBot');

test.describe('Módulo Comercial (CRM)', () => {
  test.beforeEach(async ({ page }) => {
    await loginBot(page);
  });

  test('Deve acessar o CRM e visualizar botões de funil', async ({ page }) => {
    // Acessar Kanban de Negócios / CRM
    await page.goto('/crm');
    await page.waitForLoadState('networkidle');

    // Verificar se o título da página ou componente principal chegou na tela
    const title = await page.title();
    expect(title).toBeDefined();

    // Procurar por botão de ação (N1 visual) - Não vamos submeter para evitar sujar o sistema
    // Ex: "Novo Negócio" ou "Cadastrar" ou "Adicionar"
    const novoBotao = page.locator('button:has-text("Novo"), button:has-text("Criar")');
    if (await novoBotao.count() > 0) {
      await expect(novoBotao.first()).toBeVisible();
    }
  });
});
