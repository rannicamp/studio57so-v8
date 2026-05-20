require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const oldConvId = 15484; // Número SEM o 9
  const newConvId = 9042; // Número COM o 9
  const metaCanonical = '553388442862';
  
  console.log('Mesclando conversa ' + oldConvId + ' para ' + newConvId + '...');

  // 1. Mover as mensagens
  const { data: updateMsgs, error: err1 } = await supabase
    .from('whatsapp_messages')
    .update({ conversation_record_id: newConvId })
    .eq('conversation_record_id', oldConvId)
    .select();
    
  if (err1) { console.error('Erro ao mover mensagens:', err1); return; }
  console.log('Movidas ' + (updateMsgs ? updateMsgs.length : 0) + ' mensagens.');

  // 2. Excluir a conversa antiga
  const { error: err2 } = await supabase
    .from('whatsapp_conversations')
    .delete()
    .eq('id', oldConvId);
    
  if (err2) { console.error('Erro ao excluir conversa antiga:', err2); return; }
  console.log('Conversa ' + oldConvId + ' excluída.');

  // 3. Atualizar o phone_number da conversa principal para o Padrão Meta
  const { error: err3 } = await supabase
    .from('whatsapp_conversations')
    .update({ phone_number: metaCanonical })
    .eq('id', newConvId);

  if (err3) { console.error('Erro ao atualizar telefone da conversa principal:', err3); return; }
  console.log('Conversa principal ' + newConvId + ' atualizada para a Fonte de Verdade: ' + metaCanonical);
  
  console.log('Mesclagem concluída com sucesso!');
}
run();
