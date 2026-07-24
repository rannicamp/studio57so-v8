---
name: Operar Captura Automática de Screenshots de Alta Qualidade (Playwright Headless)
description: Ensina a IA a capturar screenshots limpos do ERP Elo 57 via Playwright headless, eliminando badges e overlays de desenvolvimento (Netlify e Next.js Dev Portal).
---

# ⚙️ Manual de Operação Autônoma: Captura de Screenshots Limpos para Manuais e Apresentações

Esta Skill ensina a IA a realizar capturas de tela (screenshots) de alta fidelidade e de forma 100% limpa no sistema Elo 57, removendo automaticamente qualquer elemento intrusivo de desenvolvimento e permitindo a geração de imagens para manuais, landing pages e apresentações corporativas.

---

## 1. Mapeamento de Ferramentas e Rotas

As capturas são realizadas utilizando o **Playwright Headless** em um script utilitário rodando localmente no Node.js. 

- **Autenticação Obrigatória:** O script deve realizar o fluxo de login de demonstração acessando a página `/login` e preenchendo as credenciais de teste para obter o cookie de sessão do Supabase Auth.
- **Rotas Mapeadas:**
  - **Dashboard (Painel):** `http://localhost:3000/painel`
  - **Kanban de Compras:** `http://localhost:3000/pedidos`
  - **Relatório Diário de Obra (RDO):** `http://localhost:3000/rdo/[id_do_diario]` (buscar o ID mais recente no banco de dados)
  - **BIM Manager (Visualizador 3D):** `http://localhost:3000/bim-manager`

---

## 2. Protocolo Anti-Badges de Desenvolvimento (Next.js & Netlify)

Durante a execução local com o servidor de desenvolvimento (`npm run dev` ou `netlify dev`), ferramentas de desenvolvimento inserem badges no canto inferior esquerdo da tela que comprometem a imersão e estética do sistema. Para eliminá-los preservando o layout original por baixo:

1. **Bloqueio de Requisições de Rede (Netlify Dev):**
   Deve-se interceptar as requisições de rede no Playwright e abortar o carregamento do script devtools do Netlify:
   ```javascript
   await page.route('**/*netlify*', route => route.abort());
   await page.route('**/netlify-devtools/**', route => route.abort());
   ```

2. **Injeção de CSS Preventivo (Next.js & Netlify):**
   Injetar regras CSS com `!important` no início do carregamento de qualquer página (`page.addInitScript`) para ocultar as tags hospedeiras:
   ```javascript
   await page.addInitScript(() => {
     const style = document.createElement('style');
     style.innerHTML = `
       nextjs-portal,
       next-dev-overlay,
       netlify-devtools,
       [id*="netlify"],
       [class*="netlify"],
       [data-netlify],
       #__next-build-watcher,
       div[style*="position: fixed"][style*="bottom: 0"][style*="left: 0"] {
         display: none !important;
         opacity: 0 !important;
         visibility: hidden !important;
         pointer-events: none !important;
         width: 0 !important;
         height: 0 !important;
       }
     `;
     document.head ? document.head.appendChild(style) : document.documentElement.appendChild(style);
   });
   ```

3. **Loop de Remoção Ativa (Shadow DOM & DOM Principal):**
   Como o Next.js 15 renderiza o Dev Overlay (erros e issues) dentro de um Shadow DOM fechado sob a tag `<nextjs-portal>`, seletores comuns do DOM principal não alcançam o interior do componente. Deve-se rodar um `setInterval` a cada `100ms` para varrer e remover ativamente as tags do DOM principal e também dentro de qualquer Shadow Root:
   ```javascript
   setInterval(() => {
     // Remover tags diretas do DOM
     ['nextjs-portal', 'next-dev-overlay', 'netlify-devtools'].forEach(tag => {
       const el = document.querySelector(tag);
       if (el) el.remove();
     });

     // Varrer Shadow Roots
     document.querySelectorAll('*').forEach(el => {
       if (el.shadowRoot) {
         ['nextjs-portal', 'next-dev-overlay', 'netlify-devtools'].forEach(tag => {
           const inner = el.shadowRoot.querySelector(tag);
           if (inner) inner.remove();
         });
         el.shadowRoot.querySelectorAll('div').forEach(div => {
           if (div.innerText && (div.innerText.includes('issue') || div.innerText.includes('Issue') || div.innerText === 'N')) {
             div.remove();
           }
         });
       }
     });
   }, 100);
   ```

---

## 3. Padrão Ouro de Implementação do Script

Abaixo está o modelo funcional completo para execução de capturas autônomas do sistema:

```javascript
module.paths.push('c:\\Projetos\\studio57so-v8\\node_modules');

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function run() {
  const connStr = 'postgresql://postgres:REMOVED_PASSWORD@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  
  let rdoId = 315; // Fallback
  try {
    await client.connect();
    const res = await client.query(`
      SELECT id FROM public.diarios_obra 
      WHERE organizacao_id = 57 
      ORDER BY id DESC LIMIT 1
    `);
    if (res.rows.length > 0) rdoId = res.rows[0].id;
  } catch (err) {
    console.error('Erro ao buscar ID do RDO no banco:', err.message);
  } finally {
    await client.end();
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Bloqueio de rede e injeção do script de destruição contínua
  await page.route('**/*netlify*', route => route.abort());
  await page.route('**/netlify-devtools/**', route => route.abort());
  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      nextjs-portal, next-dev-overlay, netlify-devtools, [id*="netlify"], [class*="netlify"],
      [data-netlify], #__next-build-watcher, div[style*="position: fixed"][style*="bottom: 0"][style*="left: 0"] {
        display: none !important; opacity: 0 !important; visibility: hidden !important;
        pointer-events: none !important; width: 0 !important; height: 0 !important;
      }
    `;
    document.head ? document.head.appendChild(style) : document.documentElement.appendChild(style);

    setInterval(() => {
      ['nextjs-portal', 'next-dev-overlay', 'netlify-devtools'].forEach(tag => {
        const el = document.querySelector(tag);
        if (el) el.remove();
      });

      document.querySelectorAll('*').forEach(el => {
        if (el.shadowRoot) {
          ['nextjs-portal', 'next-dev-overlay', 'netlify-devtools'].forEach(tag => {
            const inner = el.shadowRoot.querySelector(tag);
            if (inner) inner.remove();
          });
          el.shadowRoot.querySelectorAll('div').forEach(div => {
            if (div.innerText && (div.innerText.includes('issue') || div.innerText.includes('Issue') || div.innerText === 'N')) {
              div.remove();
            }
          });
        }
      });
    }, 100);
  });

  // Fluxo de Login
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'elo57@studio57.arq.br');
  await page.fill('input[type="password"]', 'Elo57demo');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/painel', { timeout: 15000 });

  const printsDir = 'c:\\Projetos\\studio57so-v8\\public\\prints';
  if (!fs.existsSync(printsDir)) fs.mkdirSync(printsDir, { recursive: true });

  // Função utilitária para limpar badges de desenvolvimento e tirar o print
  async function cleanAndScreenshot(url, outputPath, timeout = 4000) {
    await page.goto(url);
    await page.waitForTimeout(timeout);
    
    await page.evaluate(() => {
      const devtools = document.querySelector('netlify-devtools');
      if (devtools) devtools.remove();

      const overlay = document.querySelector('next-dev-overlay');
      if (overlay) overlay.remove();

      const portal = document.querySelector('nextjs-portal');
      if (portal) portal.remove();

      const suspDivs = document.querySelectorAll('div');
      suspDivs.forEach(div => {
        if (div.innerText && (div.innerText.includes('1 issue') || div.innerText.includes('Issue') || div.innerText === 'N' || div.innerText.includes('Netlify'))) {
          div.remove();
        }
      });

      const style = document.createElement('style');
      style.innerHTML = `
        nextjs-portal, next-dev-overlay, netlify-devtools, [id*="netlify"], [class*="netlify"],
        #__next-build-watcher, div[style*="position: fixed"][style*="bottom"][style*="left"] {
          display: none !important; opacity: 0 !important; visibility: hidden !important;
          pointer-events: none !important; width: 0 !important; height: 0 !important;
        }
      `;
      document.head.appendChild(style);
    });

    await page.waitForTimeout(500);
    await page.screenshot({ path: outputPath });
  }

  // 1. Dashboard / Painel
  console.log('Capturando tela: Dashboard...');
  await cleanAndScreenshot('http://localhost:3000/painel', path.join(printsDir, 'painel.png'), 4000);

  // 2. Kanban de Compras
  console.log('Capturando tela: Kanban de Compras...');
  await cleanAndScreenshot('http://localhost:3000/pedidos', path.join(printsDir, 'pedidos_compras.png'), 4000);

  // 3. Relatório Diário de Obra (RDO)
  console.log(`Capturando tela: RDO...`);
  await cleanAndScreenshot(`http://localhost:3000/rdo/${rdoId}`, path.join(printsDir, 'rdo_modelo.png'), 4000);

  // 4. BIM Manager com carregamento de modelo
  console.log('Capturando tela: BIM Manager com Modelo 3D...');
  await page.evaluate(() => {
    const fileObjNum = {
      id: 50,
      nome_arquivo: "2024_000_ESTRUTURA_CORRETA.rvt",
      urn_autodesk: "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6c3R1ZGlvNTdfYmltX2J1Y2tldF9qYXV0OXdzMDhyanpkb256ZXdhbmp1Zzdia2R2MzJ5dDB1bmRkYTY5eTJ2ZXNlYmMvMjAyNF8wMDBfRVNUUlVUVVJBX0NPUlJFVEEucnZ0",
      status: "Concluido",
      empreendimento_id: 14,
      disciplina_id: 9,
      versao: 5,
      organizacao_id: 57,
      is_lixeira: false
    };
    
    const fileObjStr = {
      id: "50",
      nome_arquivo: "2024_000_ESTRUTURA_CORRETA.rvt",
      urn_autodesk: "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6c3R1ZGlvNTdfYmltX2J1Y2tldF9qYXV0OXdzMDhyanpkb256ZXdhbmp1Zzdia2R2MzJ5dDB1bmRkYTY5eTJ2ZXNlYmMvMjAyNF8wMDBfRVNUUlVUVVJBX0NPUlJFVEEucnZ0",
      status: "Concluido",
      empreendimento_id: 14,
      disciplina_id: 9,
      versao: 5,
      organizacao_id: 57,
      is_lixeira: false
    };

    localStorage.setItem('bim_loadedFiles', JSON.stringify([fileObjNum, fileObjStr]));
    localStorage.setItem('bim_layout_isSidebarVisible', 'true');
    localStorage.setItem('bim_layout_activeMainTab', 'viewer');
  });

  await page.goto('http://localhost:3000/bim-manager');
  await page.waitForTimeout(4000);

  try {
    const isModelActive = await page.evaluate(() => {
      return window.NOP_VIEWER && 
             window.NOP_VIEWER.modelQueue && 
             window.NOP_VIEWER.modelQueue().getModels &&
             window.NOP_VIEWER.modelQueue().getModels().length > 0;
    });

    if (!isModelActive) {
      await page.waitForSelector('text=2024_000_ESTRUTURA_CORRETA.rvt', { timeout: 15000 });
      await page.waitForTimeout(2000);
      await page.click('text=2024_000_ESTRUTURA_CORRETA.rvt');
    }

    await page.waitForFunction(() => {
      return window.NOP_VIEWER && 
             window.NOP_VIEWER.modelQueue && 
             window.NOP_VIEWER.modelQueue().getModels &&
             window.NOP_VIEWER.modelQueue().getModels().length > 0;
    }, undefined, { timeout: 60000 });

    await page.waitForTimeout(8000); // Aguarda renderização WebGL estabilizar
  } catch (err) {
    console.warn('Erro ao carregar modelo automaticamente, usando clique fallback:', err.message);
    try {
      await page.click('text=2024_000_ESTRUTURA_CORRETA.rvt');
      await page.waitForTimeout(10000);
    } catch (e) {}
  }

  // Limpeza final antes de fotografar
  await page.evaluate(() => {
    ['netlify-devtools', 'next-dev-overlay', 'nextjs-portal'].forEach(tag => {
      const el = document.querySelector(tag);
      if (el) el.remove();
    });
    const style = document.createElement('style');
    style.innerHTML = `
      nextjs-portal, next-dev-overlay, netlify-devtools, [id*="netlify"], [class*="netlify"],
      #__next-build-watcher, div[style*="position: fixed"][style*="bottom"][style*="left"] {
        display: none !important; opacity: 0 !important; visibility: hidden !important;
        pointer-events: none !important; width: 0 !important; height: 0 !important;
      }
    `;
    document.head.appendChild(style);
  });
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(printsDir, 'bim_manager.png') });
  console.log('[OK] Foto salva: bim_manager.png');

  // 5. Captura Mobile para PWA (iPhone 12 Emulação)
  console.log('--- INICIANDO CAPTURA MÓVEL (PWA) ---');
  const cookies = await context.cookies();
  
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 800 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  });
  
  await mobileContext.addCookies(cookies);
  const mobilePage = await mobileContext.newPage();
  
  await mobilePage.addInitScript(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      nextjs-portal, next-dev-overlay, netlify-devtools, [id*="netlify"], [class*="netlify"],
      [data-netlify], #__next-build-watcher, div[style*="position: fixed"][style*="bottom: 0"][style*="left: 0"] {
        display: none !important; opacity: 0 !important; visibility: hidden !important;
        pointer-events: none !important; width: 0 !important; height: 0 !important;
      }
    `;
    document.head ? document.head.appendChild(style) : document.documentElement.appendChild(style);

    setInterval(() => {
      ['nextjs-portal', 'next-dev-overlay', 'netlify-devtools'].forEach(tag => {
        const el = document.querySelector(tag);
        if (el) el.remove();
      });
    }, 100);
  });

  // A. Capturar RDO Mobile (Página Inteira para Rolagem)
  await mobilePage.goto(`http://localhost:3000/rdo/${rdoId}`);
  await mobilePage.waitForTimeout(5000);
  
  await mobilePage.evaluate(() => {
    ['netlify-devtools', 'next-dev-overlay', 'nextjs-portal'].forEach(tag => {
      const el = document.querySelector(tag);
      if (el) el.remove();
    });
    const style = document.createElement('style');
    style.innerHTML = `
      nextjs-portal, next-dev-overlay, netlify-devtools, [id*="netlify"], [class*="netlify"],
      #__next-build-watcher, div[style*="position: fixed"][style*="bottom"][style*="left"] {
        display: none !important; opacity: 0 !important; visibility: hidden !important;
      }
    `;
    document.head.appendChild(style);
  });
  await mobilePage.waitForTimeout(500);

  await mobilePage.screenshot({ 
    path: path.join(printsDir, 'rdo_mobile.png'),
    fullPage: true 
  });
  console.log('[OK] Foto salva: rdo_mobile.png');

  // B. Capturar Painel/Dashboard Mobile (Página Inteira para Rolagem)
  await mobilePage.goto('http://localhost:3000/painel');
  await mobilePage.waitForTimeout(5000);
  
  await mobilePage.evaluate(() => {
    ['netlify-devtools', 'next-dev-overlay', 'nextjs-portal'].forEach(tag => {
      const el = document.querySelector(tag);
      if (el) el.remove();
    });
  });
  await mobilePage.waitForTimeout(500);

  await mobilePage.screenshot({ 
    path: path.join(printsDir, 'painel_mobile.png'),
    fullPage: true 
  });
  console.log('[OK] Foto salva: painel_mobile.png');

  await mobileContext.close();
  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
```
