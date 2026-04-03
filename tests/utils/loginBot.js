const TEST_EMAIL = 'rannierecampos1@gmail.com';
const TEST_PASSWORD = '123456789';

/**
 * Função utilitária para fazer login com o robô de testes.
 * Aceita uma página do Playwright e retorna após a página garantir o carregamento do Painel.
 */
module.exports = async function loginBot(page) {
    await page.goto('/login');
    
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    
    await page.click('button[type="submit"]', { hasText: 'Entrar' }).catch(async () => {
        await page.click('button:has-text("Entrar")');
    });

    // O robô é proprietário então ele vai pro /painel
    await page.waitForURL('**/painel**', { timeout: 15000 });
}
