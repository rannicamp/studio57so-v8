const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBroadcasts() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: msgs, error: mErr } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false });

  if (mErr) {
    console.error(mErr);
  } else {
    console.log(`\nMensagens criadas na última hora: ${msgs.length}`);
    if (msgs.length > 0) {
      const statusCounts = msgs.reduce((acc, curr) => {
          acc[curr.status] = (acc[curr.status] || 0) + 1;
          return acc;
      }, {});
      console.log("Resumo por status:", statusCounts);
      console.log("Uma amostra de mensagem:", msgs[0]);
    }
  }
  
  // Vamos buscar também os membros da lista_id 15 para ver o que faltou enviar.
  const { data: listMembers, error: lmErr } = await supabase
    .from('whatsapp_list_members')
    .select('id, telefone, lead_id, custom_fields')
    .eq('lista_id', 15);
    
  if (lmErr) console.error(lmErr);
  else {
    console.log(`\nA lista alvo do disparo (lista_id: 15) tem um total de ${listMembers.length} membros.`);
    // Podemos comparar os telefones dos membros com as mensagens criadas para saber quem não recebeu
    if (msgs.length > 0) {
      // Assuming 'to' or 'telefone' is the column name in whatsapp_messages.
      // Let's check the keys of msgs[0] to find the phone number field
      const phoneField = Object.keys(msgs[0]).find(k => k.includes('phone') || k.includes('to_') || k === 'to' || k === 'telefone' || k === 'destinatario' || k === 'whatsapp_number' || k === 'numero_destino' || k === 'contact_phone');
      
      if (phoneField) {
        console.log(`Campo de telefone identificado em whatsapp_messages: ${phoneField}`);
        const sentPhones = msgs.map(m => m[phoneField]);
        const unsent = listMembers.filter(member => !sentPhones.includes(member.telefone) && !sentPhones.includes(member.telefone?.replace(/\D/g, '')));
        
        console.log(`Enviados: ${sentPhones.length}`);
        console.log(`Faltam enviar para: ${unsent.length} membros.`);
      } else {
        console.log("Não consegui identificar o campo de telefone em whatsapp_messages.");
      }
    }
  }
}

checkBroadcasts();
