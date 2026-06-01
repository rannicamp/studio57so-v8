require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  try {
    const orgId = 2;
    console.log("=== BUSCANDO CONFIGURAÇÃO DE WHATSAPP DA ORG 2 ===");
    const { data: config, error: errConf } = await supabase
      .from('configuracoes_whatsapp')
      .select('*')
      .eq('organizacao_id', orgId);
    if (errConf) throw errConf;
    console.log(config);

    console.log("\n=== BUSCANDO AUTOMAÇÕES ATIVAS DA ORG 2 ===");
    const { data: automacoes, error: errAut } = await supabase
      .from('automacoes')
      .select('*')
      .eq('organizacao_id', orgId)
      .eq('ativo', true);
    if (errAut) throw errAut;
    console.log(JSON.stringify(automacoes, null, 2));

    console.log("\n=== BUSCANDO ÚLTIMOS LEADS DO META E SE RECEBERAM MENSAGENS ===");
    const { data: conts, error: errConts } = await supabase
      .from('contatos')
      .select('id, nome, created_at, origem')
      .eq('organizacao_id', orgId)
      .eq('tipo_contato', 'Lead')
      .order('created_at', { ascending: false })
      .limit(10);
    if (errConts) throw errConts;
    console.log("Últimos Leads:", conts);

    if (conts && conts.length > 0) {
      const contactIds = conts.map(c => c.id);
      const { data: msgs, error: errMsgs } = await supabase
        .from('whatsapp_messages')
        .select('id, contato_id, content, direction, status, error_message, sent_at')
        .in('contato_id', contactIds)
        .order('sent_at', { ascending: false });
      if (errMsgs) throw errMsgs;
      console.log("Mensagens enviadas para esses leads:", msgs);
    }

  } catch (e) {
    console.error("Erro:", e);
  }
}

run();
