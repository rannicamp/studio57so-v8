const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectMemory() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: msgs, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .gte('created_at', oneHourAgo);

  if (error) {
     console.error(error);
     return;
  }
  
  const templateMsgs = msgs.filter(m => m.raw_payload && m.raw_payload.includes('refugio_acompanhamento_1'));
  
  const uniqueReceivers = new Set(templateMsgs.map(m => m.receiver_id));
  
  console.log(`Total de mensagens criadas na última hora: ${msgs.length}`);
  console.log(`Mensagens do template 'refugio_acompanhamento_1': ${templateMsgs.length}`);
  console.log(`Contatos Únicos que receberam: ${uniqueReceivers.size}`);
}

inspectMemory();
