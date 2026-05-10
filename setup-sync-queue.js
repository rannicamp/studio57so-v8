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
  const host = `db.${projectId}.supabase.co`;

  // String de Conexão MASTER: Porta 6543 obrigatória.
  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr });
  
  try {
     console.log("Estabelecendo link P2P com Supabase...");
     await client.connect();
     
     console.log("Criando tabela sync_queue...");
     await client.query(`
        CREATE TABLE IF NOT EXISTS public.sync_queue (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            contato_id UUID NOT NULL,
            organizacao_id BIGINT NOT NULL,
            user_id UUID NOT NULL,
            status TEXT NOT NULL DEFAULT 'pendente',
            tentativas INT DEFAULT 0,
            mensagem_erro TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
     `);

     console.log("Criando índices...");
     await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON public.sync_queue(status);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_org ON public.sync_queue(organizacao_id);
     `);
     
     console.log("Operação SQL homologada com sucesso!");
  } catch(e) {
     console.error("FALHA NA INJEÇÃO SQL:", e.message);
  } finally {
     await client.end();
  }
}

runSQL();
