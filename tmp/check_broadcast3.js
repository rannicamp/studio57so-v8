const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBroadcasts() {
  // Buscar a lista 15
  const { data: listMembers } = await supabase
    .from('whatsapp_list_members')
    .select('*')
    .eq('list_id', 15);
    
  console.log(`\nA lista 15 tem ${listMembers?.length || 0} membros.`);
  if (listMembers?.length > 0) {
      console.log("Campos de um membro:", Object.keys(listMembers[0]));
      // likely 'phone' or 'whatsapp_number'
      const phoneField = Object.keys(listMembers[0]).find(k => k.includes('phone') || k === 'telefone' || k === 'number');
      console.log(`Campo de telefone: ${phoneField}`);
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  // Buscar mensagens que contenham o nome do template no payload
  const { data: templateMsgs, error: tmErr } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .gte('created_at', oneHourAgo)
    .ilike('raw_payload', '%refugio_acompanhamento_1%');

  if (tmErr) {
    console.error(tmErr);
  } else {
    console.log(`\nForam encontrados ${templateMsgs.length} disparos do template 'refugio_acompanhamento_1' na última hora.`);
    
    if (listMembers && listMembers.length > 0) {
      const phoneField = Object.keys(listMembers[0]).find(k => k.includes('phone') || k === 'telefone' || k === 'number' || k === 'contact_phone');
      const receiverField = 'receiver_id'; // em whatsapp_messages
      
      const sentPhones = templateMsgs.map(m => m[receiverField]);
      const listPhones = listMembers.map(m => m[phoneField] || m.phone || m.whatsapp_number || m.contact_phone).filter(Boolean);
      
      // Padronizar para comparar
      const normalize = p => p.replace(/\D/g, '');
      const sentSet = new Set(sentPhones.map(normalize));
      
      const missing = listMembers.filter(m => {
          const p = m[phoneField] || m.phone || m.whatsapp_number || m.contact_phone;
          if (!p) return true;
          return !sentSet.has(normalize(p));
      });
      
      console.log(`Total na lista: ${listMembers.length}`);
      console.log(`Foram enviados para: ${sentSet.size} contatos distintos`);
      console.log(`Faltaram: ${missing.length}`);
      
      // Se houver missing, e forem poucos, podemos listá-los
      if (missing.length > 0 && missing.length <= 10) {
          console.log("Contatos que faltaram:", missing.map(m => m.contact_phone || m.phone));
      }
    }
  }
}

checkBroadcasts();
