// Script de migração usando supabase-js (service role) — sem precisar de DB_PASSWORD
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.error('Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY necessárias');
    process.exit(1);
  }
  
  const sb = createClient(url, key, { auth: { persistSession: false } });
  
  console.log('Aplicando migração via RPC...');

  // Usa a função exec_sql (se existir) ou tenta via supabase rpc
  const { error } = await sb.rpc('exec_sql', {
    sql: `
      ALTER TABLE instagram_conversations 
      ADD COLUMN IF NOT EXISTS contato_id UUID REFERENCES contatos(id) ON DELETE SET NULL;
      
      CREATE INDEX IF NOT EXISTS idx_instagram_conversations_contato_id 
      ON instagram_conversations(contato_id);
    `
  });

  if (error) {
    console.log('RPC não disponível, tentando verificar via query simples...');
    // Verificar se a coluna já existe
    const { data, error: e2 } = await sb
      .from('instagram_conversations')
      .select('contato_id')
      .limit(1);
    
    if (e2 && e2.message.includes('column')) {
      console.error('Coluna ainda não existe. Precisamos do MCP ou DB_PASSWORD.');
      console.log('\n📋 SQL para aplicar manualmente no Supabase Dashboard:');
      console.log(`
ALTER TABLE instagram_conversations 
ADD COLUMN IF NOT EXISTS contato_id UUID REFERENCES contatos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_instagram_conversations_contato_id 
ON instagram_conversations(contato_id);
      `);
    } else {
      console.log('✅ Coluna contato_id já existe na tabela!');
    }
  } else {
    console.log('✅ Migração aplicada via RPC com sucesso!');
  }
  
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
