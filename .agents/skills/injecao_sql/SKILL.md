---
name: "Injeção de SQL (Bypass SSL / Pooler)"
description: "Como a IA deve criar e executar scripts diretos no banco de dados Supabase via Node.js quando não for possível usar o painel web ou o supabase-js (ex: Criação de Tabelas, Migrações, Updates Massivos)."
---

# Injeção de SQL via Node.js (Bypass SSL 6543)

Devido aos certificados auto-assinados de segurança (SSL) do Supabase e ao Transaction Pooler (Supavisor) estarem configurados de forma restrita, muitas conexões diretas da IA para fazer DDL (CREATE TABLE) ou DML Massivo (UPDATE/INSERT) podem ser recusadas com erro de "foreign key" ou "ssl required".

Sempre que o usuário pedir para você "injetar um SQL" ou rodar uma migração que não pode ser feita via `supabase-js`, **VOCÊ DEVE USAR A ESTRATÉGIA DE CONEXÃO DIRETA P2P VIA PORTA 6543**.

## 🚀 Passo a Passo Obrigatório

### 1. Criar o Script de Injeção
Crie um arquivo na raiz do projeto chamado `setup-script.js` (ou nome similar descritivo) com o seguinte boilerplate exato:

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
     
     console.log("Injetando SQL...");
     // ==========================================
     // INJETE SUAS QUERIES AQUI
     await client.query(\`
        -- EXEMPLO:
        -- CREATE TABLE IF NOT EXISTS public.minha_tabela (...)
     \`);
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

### 2. Rodar o Script Silenciosamente
Utilize sua ferramenta `run_command` para executar o arquivo:
\`node setup-script.js\`

### 3. Excluir o Arquivo (Limpeza)
Depois que a query retornar sucesso, delete o arquivo \`setup-script.js\` para manter a raiz do projeto limpa. Não deixe lixo de script no repositório.
