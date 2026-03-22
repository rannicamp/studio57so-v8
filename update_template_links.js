require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Atualizando templates de chat e whatsapp...");
  
  // 1. Chat Interno P2P
  const resChat = await supabase
    .from('sys_notification_templates')
    .update({ link_template: '/chat?usuario={remetente_id}' })
    .eq('tabela_alvo', 'sys_chat_messages');
    
  // 2. WhatsApp (Se existir)
  const resWhats = await supabase
    .from('sys_notification_templates')
    .update({ link_template: '/whatsapp?contato={contato_id}' })
    .in('tabela_alvo', ['whatsapp_messages', 'whatsapp_mensagens']);
    
  // 3. Clientes CRM (Se existir)
  const resCRM = await supabase
    .from('sys_notification_templates')
    .update({ link_template: '/crm/cliente/{id}' })
    .eq('tabela_alvo', 'clientes');
    
  console.log("Links Inteligentes (Deep Links) injetados com sucesso nas templates correspondentes.");
}
run();
