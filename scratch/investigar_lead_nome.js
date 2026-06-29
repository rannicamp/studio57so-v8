// scratch/investigar_lead_nome.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TELEFONE_BUSCA = '553399493228';

async function main() {
  console.log(`=== INVESTIGANDO LEAD DO WHATSAPP: ${TELEFONE_BUSCA} ===`);

  // 1. Buscar o telefone na tabela 'telefones'
  console.log("1. Buscando telefone na tabela 'telefones'...");
  const cleanPhone = TELEFONE_BUSCA.replace(/[^0-9]/g, '');
  const cleanPhoneSem9 = cleanPhone.length === 13 && cleanPhone.startsWith('55') && cleanPhone[4] === '9' 
    ? '55' + cleanPhone.substring(2, 4) + cleanPhone.substring(5) 
    : cleanPhone;
  const cleanPhoneCom9 = cleanPhone.length === 12 && cleanPhone.startsWith('55')
    ? '55' + cleanPhone.substring(2, 4) + '9' + cleanPhone.substring(4)
    : cleanPhone;

  const { data: telefones } = await supabase
    .from('telefones')
    .select('contato_id, telefone')
    .in('telefone', [cleanPhone, cleanPhoneSem9, cleanPhoneCom9]);

  if (!telefones || telefones.length === 0) {
    console.error("Nenhum telefone encontrado na base para este número!");
    return;
  }

  const contatoId = telefones[0].contato_id;
  console.log(`Contato ID associado: ${contatoId}`);

  // 2. Buscar o contato
  const { data: contato } = await supabase
    .from('contatos')
    .select('*')
    .eq('id', contatoId)
    .single();

  console.log("\nInformações do Contato:");
  console.log(JSON.stringify(contato, null, 2));

  // 3. Buscar histórico de mensagens da conversa
  console.log("\n3. Buscando histórico de mensagens da conversa...");
  const { data: mensagens, error: errM } = await supabase
    .from('whatsapp_messages')
    .select('id, direction, content, created_at, sent_at, status')
    .eq('contato_id', contato.id)
    .order('created_at', { ascending: true })
    .limit(50);

  if (errM) {
    console.error("Erro ao buscar mensagens:", errM.message);
    return;
  }

  console.log(`Mensagens encontradas: ${mensagens?.length || 0}`);
  if (mensagens && mensagens.length > 0) {
    mensagens.forEach(msg => {
      const dataFormatada = new Date(msg.created_at || msg.sent_at).toLocaleString('pt-BR');
      const remetenteStr = msg.direction === 'inbound' ? '👤 Cliente' : '🏢 Empresa/Stella';
      console.log(`[${dataFormatada}] ${remetenteStr}: "${msg.content}"`);
    });
  } else {
    console.log("Nenhuma mensagem encontrada para este contato.");
  }
}

main();
