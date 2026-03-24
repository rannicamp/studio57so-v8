require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function runSQL() {
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || 'Srbr19010720@';
  if (!password) { 
      console.error('ERRO FATAL: Senha não encontrada na .env.local.'); 
      return; 
  }
  
  // Extrai inteligentemente o Subdomínio correto do Projeto a partir da URL pública
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;

  // String de Conexão MASTER: Porta 6543 obrigatória.
  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;
  // Conexão sem os parâmetros de SSL restritivos do node para contornar o pooler
  const client = new Client({ connectionString: connStr });
  
  try {
     console.log("Estabelecendo link P2P com Supabase na porta 6543...");
     await client.connect();
     
     // Lendo o arquivo SQL atualizado
     const sqlFilePath = path.join(__dirname, '..', 'fix_faturas_trigger.sql');
     const sqlQuery = fs.readFileSync(sqlFilePath, 'utf8');

     console.log("Executando a querry DDL de correção de Faturas...");
     await client.query(sqlQuery);
     
     console.log("Operação SQL homologada com sucesso! Trigger Corrigida!");
  } catch(e) {
     console.error("FALHA NA INJEÇÃO SQL:", e.message);
  } finally {
     await client.end();
  }
}

runSQL();
