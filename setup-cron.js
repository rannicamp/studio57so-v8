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

  // String de Conexão MASTER: Porta 6543
  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr });
  
  try {
     console.log("Estabelecendo link P2P com Supabase na porta 6543...");
     await client.connect();
     
     console.log("Injetando SQL para criar Cron Job nativo no Supabase...");
     
     // =========================================================================
     // ATENÇÃO RANNIERE: COLOQUE AQUI A SUA URL REAL DE PRODUÇÃO DO SISTEMA
     // =========================================================================
     const prodUrl = 'https://studio57.arq.br/api/google/process-sync'; 

     if (prodUrl.includes('COLOQUE-SUA-URL-AQUI')) {
       console.error("ERRO: Você esqueceu de colocar a URL de produção no arquivo setup-cron.js!");
       console.error("Por favor, edite a linha 23 do arquivo setup-cron.js antes de rodar.");
       return;
     }

     await client.query(`
        -- 1. Habilita as extensões necessárias para CRON e HTTP
        CREATE EXTENSION IF NOT EXISTS pg_cron;
        CREATE EXTENSION IF NOT EXISTS pg_net;

        -- 2. Remove o job antigo (caso exista) de forma segura
        DO $do$
        BEGIN
          PERFORM cron.unschedule('sync-google-contacts-job');
        EXCEPTION WHEN OTHERS THEN
          -- Ignora o erro se o job não existir
        END $do$;

        -- 3. Cria o job para rodar a cada 1 minuto (* * * * *)
        SELECT cron.schedule(
          'sync-google-contacts-job',
          '* * * * *',
          $req$
            SELECT net.http_post(
                url:='${prodUrl}',
                headers:='{"Content-Type": "application/json"}'::jsonb
            );
          $req$
        );
     `);
     
     console.log("✅ Cron Job configurado com sucesso direto no banco de dados!");
     console.log("🎯 URL Alvo sendo chamada a cada 1 minuto:", prodUrl);
     console.log("👉 Para verificar se está rodando, execute no SQL Editor do Supabase:");
     console.log("SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;");
  } catch(e) {
     console.error("❌ FALHA NA INJEÇÃO SQL:", e.message);
  } finally {
     await client.end();
  }
}

runSQL();
