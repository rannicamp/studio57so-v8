# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: financeiro.spec.js >> Módulo Financeiro >> Acesso Direto ao Cofre Central Financeiro
- Location: tests\financeiro.spec.js:9:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForLoadState: Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]: Carregando...
  - region "Notifications alt+T"
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | const loginBot = require('./utils/loginBot');
  3  | 
  4  | test.describe('Módulo Financeiro', () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await loginBot(page);
  7  |   });
  8  | 
  9  |   test('Acesso Direto ao Cofre Central Financeiro', async ({ page }) => {
  10 |     await page.goto('/financeiro');
> 11 |     await page.waitForLoadState('networkidle');
     |                ^ Error: page.waitForLoadState: Test timeout of 30000ms exceeded.
  12 | 
  13 |     // Verifica se os cartões de saldo carregaram no topo
  14 |     // Procuramos termos que geralmente existem num dashboard financeiro
  15 |     const pageText = await page.textContent('body');
  16 |     
  17 |     // Apenas verificações anti-crash
  18 |     expect(pageText).not.toContain('Unhandled Runtime Error');
  19 |     expect(pageText).not.toContain('ChunkLoadError');
  20 | 
  21 |     // Verifica se alguma tabela ou listagem carregou
  22 |     const tablesCount = await page.locator('table').count();
  23 |     const listsCount = await page.locator('ul').count();
  24 |     expect(tablesCount + listsCount).toBeGreaterThanOrEqual(0);
  25 |   });
  26 | });
  27 | 
```