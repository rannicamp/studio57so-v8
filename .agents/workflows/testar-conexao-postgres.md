---
description: Guia definitivo e template de código para a IA conectar no banco Postgres via Node.js contornando falhas de SSL e Pooler.
---

Sempre que o usuário solicitar uma alteração direta no Banco de Dados (UPDATE, INSERT massivo, ALTER TABLE) via script temporário ao invés do código web, e a biblioteca comum `supabase-js` não puder ser usada, a IA DEVE usar obrigatóriamente este método.

Devido aos certificados auto-assinados de segurança (SSL) do Supabase da Studio 57, a maioria das conexões remotas de scripts node.js (`pg.Pool` ou porta `5432`) são sumariamente recusadas na raiz. 
O único túnel testado e homologado para a IA agir como DBA (Database Admin) na máquina local é conectar via pacote nativo `pg` usando `Client` **exclusivamente na porta `6543`**.

### Template Homologado de Conexão Studio 57:

Quando criar o script (ex: `query_banco.js`), use exatamente este boilerplate dinâmico abaixo:

```javascript
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function runSQL() {
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
  if (!password) { 
      console.error('ERRO FATAL: Senha não encontrada na .env.local.'); 
      return; 
  }
  
  // Extrai inteligentemente o Subdomínio correto do Projeto a partir da URL pública
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = \`db.\${projectId}.supabase.co\`;

  // String de Conexão MASTER: Porta 6543 obrigatória.
  const connStr = \`postgres://postgres:\${password}@\${host}:6543/postgres\`;
  const client = new Client({ connectionString: connStr });
  
  try {
     console.log("Estabelecendo link P2P com Supabase...");
     await client.connect();
     
     // ==========================================
     // INJETE SUAS QUERIES AQUI DENTRO DO TRY
     // Exemplo de uso seguro com array de bindings:
     // await client.query("UPDATE feedback SET status = $1 WHERE id = $2", ['Em Análise', 1]);
     // ==========================================
     
     console.log("Operação SQL homologada com sucesso!");
  } catch(e) {
     console.error("FALHA NA INJEÇÃO SQL:", e.message);
  } finally {
     await client.end();
  }
}

runSQL();
```

Não devie dessa estrutura para não lotar o painel visual do corretor com testes unitários errôneos que ficarão travados por falha de banco de dados.
