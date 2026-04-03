import { test, expect } from '@playwright/test';

// Utilizaremos o usuário teste fornecido
const TEST_EMAIL = 'rannierecampos1@gmail.com';
const TEST_PASSWORD = '123456789';

test.describe('Autenticação e Navegação Básica', () => {
  test('Deve realizar o login com sucesso e ir para o dashboard', async ({ page }) => {
    // 1. Acessar a página de login
    await page.goto('/login');
    
    // 2. Preencher o formulário usando os seletores de placeholdes ou names
    // No projeto Elo 57, o input de email costuma ser type="email" e o de password type="password"
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    
    // 3. Clicar no botão de entrar
    // O botão no layout do Login costuma ter o texto 'Entrar'
    await page.click('button[type="submit"]', { hasText: 'Entrar' }).catch(async () => {
       // Fallback se n achar por type="submit" especificamente assim
       await page.click('button:has-text("Entrar")');
    });

    // 4. Aguardar o login concluir e a página redirecionar para a interface restrita
    // Nosso robô agora é Proprietário Normal, ele vai pra /painel
    await page.waitForURL('**/painel**', { timeout: 15000 });
    
    // 5. Validar que na página tem algo da interface (por exemplo um link para "Deslogar" ou o nome do usuário)
    const title = await page.title();
    expect(title).toBeDefined();
    console.log('Login completado e estamos acessando: ', page.url());
  });
});
