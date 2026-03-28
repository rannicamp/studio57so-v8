// Migração final com BIGINT correto
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  // Extrai project ID da URL
  const projectId = supabaseUrl.replace('https://', '').split('.')[0];
  const host = `db.${projectId}.supabase.co`;
  
  // Para conexão pg direta, usamos a service role key como senha não funciona.
  // Usa o SUPABASE_JWT_SECRET ou a senha direta se houver
  // Como não temos a senha Postgres, vamos usar a API REST do Supabase via fetch
  
  console.log('Aplicando migração via Supabase Management API...');
  
  // Tenta via fetch direto na API de SQL do Supabase
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectId}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        query: `
          ALTER TABLE instagram_conversations 
          ADD COLUMN IF NOT EXISTS contato_id BIGINT REFERENCES contatos(id) ON DELETE SET NULL;
          
          CREATE INDEX IF NOT EXISTS idx_instagram_conversations_contato_id 
          ON instagram_conversations(contato_id);
        `
      })
    }
  );
  
  const result = await response.json();
  
  if (!response.ok) {
    console.error('❌ Erro na Management API:', JSON.stringify(result, null, 2));
    console.log('\n📋 Execute manualmente no Supabase Dashboard SQL Editor:');
    console.log(`
ALTER TABLE instagram_conversations 
ADD COLUMN IF NOT EXISTS contato_id BIGINT REFERENCES contatos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_instagram_conversations_contato_id 
ON instagram_conversations(contato_id);
    `);
  } else {
    console.log('✅ Migração aplicada com sucesso!', result);
    
    // Verificar
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });
    const { data } = await sb.from('instagram_conversations').select('id, contato_id').limit(1);
    console.log('✅ Verificação: coluna contato_id disponível!', data);
  }
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
