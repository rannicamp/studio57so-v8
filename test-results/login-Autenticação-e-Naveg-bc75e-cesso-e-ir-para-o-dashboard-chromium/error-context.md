# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.spec.js >> Autenticação e Navegação Básica >> Deve realizar o login com sucesso e ir para o dashboard
- Location: tests\login.spec.js:8:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/login
Call log:
  - navigating to "http://localhost:3000/login", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | // Utilizaremos o usuário teste fornecido
  4  | const TEST_EMAIL = 'rannierecampos1@gmail.com';
  5  | const TEST_PASSWORD = '123456';
  6  | 
  7  | test.describe('Autenticação e Navegação Básica', () => {
  8  |   test('Deve realizar o login com sucesso e ir para o dashboard', async ({ page }) => {
  9  |     // 1. Acessar a página de login
> 10 |     await page.goto('/login');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/login
  11 |     
  12 |     // 2. Preencher o formulário usando os seletores de placeholdes ou names
  13 |     // No projeto Elo 57, o input de email costuma ser type="email" e o de password type="password"
  14 |     await page.fill('input[type="email"]', TEST_EMAIL);
  15 |     await page.fill('input[type="password"]', TEST_PASSWORD);
  16 |     
  17 |     // 3. Clicar no botão de entrar
  18 |     // O botão no layout do Login costuma ter o texto 'Entrar'
  19 |     await page.click('button[type="submit"]', { hasText: 'Entrar' }).catch(async () => {
  20 |        // Fallback se n achar por type="submit" especificamente assim
  21 |        await page.click('button:has-text("Entrar")');
  22 |     });
  23 | 
  24 |     // 4. Aguardar o login concluir e a página redirecionar para a interface restrita
  25 |     // Isso é verificado checando se alguma URL base como /dashboard ou a logo do header carregaram
  26 |     // Uma forma genérica que não quebra fácil: Checar se não estamos mais no login e "Central" ou "Visão" ou algo do tipo aparece, 
  27 |     // Ou aguardar a URL mudar
  28 |     await page.waitForURL('**/dashboard**');
  29 |     
  30 |     // 5. Validar que na página tem algo da interface (por exemplo um link para "Deslogar" ou o nome do usuário)
  31 |     const title = await page.title();
  32 |     expect(title).toBeDefined();
  33 |     console.log('Login completado e estamos acessando: ', page.url());
  34 |   });
  35 | });
  36 | 
```