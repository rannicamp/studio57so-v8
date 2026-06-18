const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('=== AJUSTANDO DATA DE OUTBOUND PARA O LEAD 5965 ===');
  
  // Buscar mensagens outbound de hoje para o contato 5965
  const hojeInicio = new Date();
  hojeInicio.setHours(0, 0, 0, 0);
  
  const { data: msgs, error } = await supabase
    .from('whatsapp_messages')
    .select('id, created_at, content, status')
    .eq('contato_id', 5965)
    .eq('direction', 'outbound')
    .gte('created_at', hojeInicio.toISOString());

  if (error) {
    console.error('Erro ao buscar mensagens:', error.message);
    return;
  }

  console.log(`Encontradas ${msgs.length} mensagens outbound hoje.`);

  if (msgs.length > 0) {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    
    for (const msg of msgs) {
      console.log(`Atualizando msg ID ${msg.id} ("${msg.content}") para ontem...`);
      const { error: updateErr } = await supabase
        .from('whatsapp_messages')
        .update({
          created_at: ontem.toISOString(),
          sent_at: ontem.toISOString()
        })
        .eq('id', msg.id);

      if (updateErr) {
        console.error(`Erro ao atualizar msg ${msg.id}:`, updateErr.message);
      } else {
        console.log(`Mensagem ${msg.id} atualizada com sucesso.`);
      }
    }
  } else {
    console.log('Nenhuma mensagem outbound de hoje precisa ser ajustada.');
  }
}

run().catch(console.error);
