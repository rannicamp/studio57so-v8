require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { findOrCreateContactAndConversation } = require('./app/api/whatsapp/webhook/services/crm.js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const config = { organizacao_id: 2 };
  const message = {
    from: '553388442862', // Número da Kelly SEM o 9
    type: 'text',
    text: { body: 'Teste auto-heal local' }
  };
  
  console.log("Simulando chegada de mensagem de: ", message.from);
  
  // Vamos buscar a conversa antes para ver o que tem
  const { data: convBefore } = await supabase.from('whatsapp_conversations').select('id, phone_number').eq('contato_id', 4931).order('id');
  console.log("Conversas antes:", convBefore);

  try {
    const { contatoId, conversationRecordId } = await findOrCreateContactAndConversation(supabase, message, config);
    console.log("Matchmaker retornou:", { contatoId, conversationRecordId });
    
    // Verificamos a conversa depois
    const { data: convAfter } = await supabase.from('whatsapp_conversations').select('id, phone_number').eq('contato_id', 4931).order('id');
    console.log("Conversas depois:", convAfter);
    
  } catch (e) {
    console.error("Erro na simulação:", e);
  }
}
run();
