require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) { console.log('Sem senha no env local. Cancelando.'); return; }
  
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;

  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr });
  
  try {
     await client.connect();
     console.log("Conectado. Injetando colunas 'link_opcional' e 'imagem_url'...");
     await client.query(`
        ALTER TABLE feedback 
        ADD COLUMN IF NOT EXISTS link_opcional TEXT,
        ADD COLUMN IF NOT EXISTS imagem_url TEXT;
     `);
     console.log("Sucesso: Colunas adicionadas!");
  } catch(e) {
     console.log("ERRO SQL:", e.message);
  } finally {
     await client.end();
  }

  console.log("Verificando existencia do bucket de storage 'feedbacks'...");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
     console.log("ERRO STORAGE:", error.message);
  } else {
     const exists = buckets.find(b => b.name === 'feedbacks');
     if (!exists) {
         console.log("Criando Bucket 'feedbacks' PUBLICO...");
         const { data, error: createError } = await supabase.storage.createBucket('feedbacks', { public: true });
         if (createError) console.log("Erro ao criar bucket:", createError.message);
         else console.log("Bucket CRIADO com sucesso!");
     } else {
         console.log("Bucket 'feedbacks' ja existe. Tudo pronto.");
         // Garantindo que seja publico caso n seja
         await supabase.storage.updateBucket('feedbacks', { public: true });
     }
  }
}
run();
