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
  const connStr = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
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

  // Capturar as páginas de interesse
  const urls = [
    { name: 'painel.png', url: 'http://localhost:3000/painel', delay: 4000 },
    { name: 'pedidos_compras.png', url: 'http://localhost:3000/pedidos', delay: 4000 },
    { name: 'rdo_modelo.png', url: `http://localhost:3000/rdo/${rdoId}`, delay: 4000 },
    { name: 'bim_manager.png', url: 'http://localhost:3000/bim-manager', delay: 8000 }
  ];

  for (const item of urls) {
    console.log(`Navegando para: ${item.url}...`);
    await page.goto(item.url);
    await page.waitForTimeout(item.delay);
    await page.screenshot({ path: path.join(printsDir, item.name) });
    console.log(`[OK] Foto salva: ${item.name}`);
  }

  await browser.close();
}
```
