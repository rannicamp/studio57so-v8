require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function runSQL() {
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
  if (!password) { 
      console.error('ERRO FATAL: Senha não encontrada na .env.local.'); 
      return; 
  }
  
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;

  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr });
  
  try {
     console.log("Estabelecendo link P2P com Supabase...");
     await client.connect();
     
     console.log("Adicionando novas colunas na tabela empreendimentos...");
     
     const query = `
        ALTER TABLE public.empreendimentos
        ADD COLUMN IF NOT EXISTS inscricao_imobiliaria text,
        ADD COLUMN IF NOT EXISTS lote text,
        ADD COLUMN IF NOT EXISTS quadra text,
        ADD COLUMN IF NOT EXISTS area_total_construcao text,
        ADD COLUMN IF NOT EXISTS uso_edificacao text,
        ADD COLUMN IF NOT EXISTS numero_pavimentos text,
        ADD COLUMN IF NOT EXISTS alvara_construcao_numero text,
        ADD COLUMN IF NOT EXISTS alvara_construcao_data text,
        ADD COLUMN IF NOT EXISTS processo_administrativo text,
        ADD COLUMN IF NOT EXISTS registro_incorporacao text,
        ADD COLUMN IF NOT EXISTS patrimonio_afetacao boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS resp_tecnico_projeto text,
        ADD COLUMN IF NOT EXISTS resp_tecnico_obra text;
     `;
     
     await client.query(query);
     
     console.log("Operação SQL homologada com sucesso! Colunas adicionadas.");
  } catch(e) {
     console.error("FALHA NA INJEÇÃO SQL:", e.message);
  } finally {
     await client.end();
  }
}

runSQL();
