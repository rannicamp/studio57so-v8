// scratch/buscar_detalhes_falha_hudson.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CONTATO_ID = 6124; // Hudson Mota

async function main() {
  console.log("=== BUSCANDO DETALHES DA MENSAGEM FALHA DO HUDSON ===");

  const { data: mensagens, error: err } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('contato_id', CONTATO_ID)
    .eq('status', 'failed')
    .limit(5);

  if (err) {
    console.error("Erro ao buscar mensagens falhas:", err.message);
    return;
  }

  console.log(`Mensagens falhas encontradas: ${mensagens?.length || 0}`);
  
  if (mensagens && mensagens.length > 0) {
    mensagens.forEach((msg, idx) => {
      console.log(`\n--- MENSAGEM FALHA #${idx + 1} ---`);
      console.log(`ID: ${msg.id}`);
      console.log(`Criado em: ${msg.created_at || msg.sent_at}`);
      console.log(`Texto: "${msg.content}"`);
      console.log(`Media URL (Link do Anexo): "${msg.media_url}"`);
      console.log("Raw Payload da Meta:");
      console.log(JSON.stringify(msg.raw_payload, null, 2));
    });
  } else {
    console.log("Nenhuma mensagem com status 'failed' encontrada.");
  }
}

main();
