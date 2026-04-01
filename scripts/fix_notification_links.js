require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, serviceKey);

  console.log('1. Atualizando Template...');
  const { error: errorTpl } = await supabase
    .from('sys_notification_templates')
    .update({ link_template: '/caixa-de-entrada?contato={contato_id}' })
    .eq('tabela_alvo', 'whatsapp_messages')
    .ilike('link_template', '%/whatsapp?%');
    
  if (errorTpl) console.error('Erro no Template:', errorTpl);
  else console.log('✅ Template de WhatsApp atualizado.');

  console.log('2. Buscando Notificações Corrompidas...');
  const { data: notificacoes, error: errFetch } = await supabase
    .from('notificacoes')
    .select('id, link')
    .or("link.ilike./whatsapp?contato=%,link.eq./caixa-de-entrada");
    
  if (errFetch) {
      console.error('Erro ao buscar notificações:', errFetch);
      return;
  }
  
  if (!notificacoes || notificacoes.length === 0) {
      console.log('✅ Nenhuma notificação antiga precisa de correção ou já foram corrigidas.');
  } else {
      console.log(`Encontradas ${notificacoes.length} notificações que precisam de atualização.`);
      
      let mudancas = 0;
      for (const notif of notificacoes) {
          let novoLink = null;
          if (notif.link && notif.link.includes('/whatsapp?contato=')) {
              novoLink = notif.link.replace('/whatsapp?contato=', '/caixa-de-entrada?contato=');
          }
          
          if (novoLink) {
              const { error: errUpdate } = await supabase
                .from('notificacoes')
                .update({ link: novoLink })
                .eq('id', notif.id);
                
              if (errUpdate) console.error(`Erro ao atualizar notif ${notif.id}:`, errUpdate);
              else mudancas++;
          }
      }
      console.log(`✅ Corrigidas ${mudancas} notificações antigas!`);
  }
  
  console.log('3. Ticket #85 implementado...');
  await supabase.from('feedback').update({ status: 'Implementado' }).eq('id', 85);
  console.log('✅ Ticket finalizado.');
}

run().catch(console.error);
