const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const STELLA_PHONE_ID = '690198827516149'; // Phone Number ID da Stella Org 2
const VALID_CONTACT_IDS = [5965, 3810, 5923];

async function run() {
  console.log('=== AUDITORIA DE SEGURANÇA E CAIXA DE ENTRADA ===\n');

  const hojeInicio = new Date();
  hojeInicio.setHours(0, 0, 0, 0);

  // 1. Verificar logs do dia de hoje
  console.log('1. Analisando logs operacionais do dia no app_logs...');
  const { data: logs, error: logsErr } = await supabase
    .from('app_logs')
    .select('id, origem, mensagem, created_at')
    .gte('created_at', hojeInicio.toISOString())
    .in('origem', ['STELLA TEMPLATE ERROR', 'STELLA TEMPLATE WARNING', 'GEMINI COST'])
    .order('created_at', { ascending: false });

  if (logsErr) {
    console.error('Erro ao buscar logs:', logsErr.message);
  } else {
    console.log(` -> Encontrados ${logs.length} logs operacionais da Stella hoje.`);
    const errors = logs.filter(l => l.origem.includes('ERROR'));
    const warnings = logs.filter(l => l.origem.includes('WARNING'));
    console.log(` -> Erros fatais: ${errors.length} | Avisos: ${warnings.length}`);
    if (errors.length > 0) {
      console.log('\nErros detectados hoje:');
      errors.forEach(e => console.log(`   - [${new Date(e.created_at).toLocaleTimeString('pt-BR')}] [${e.origem}] ${e.mensagem}`));
    }
  }

  // 2. Verificar todas as mensagens enviadas pela Stella (outbound) hoje
  console.log('\n2. Verificando as mensagens enviadas (outbound) pela Stella hoje...');
  
  const { data: msgs, error: msgsErr } = await supabase
    .from('whatsapp_messages')
    .select('id, contato_id, receiver_id, content, status, created_at, error_message')
    .eq('direction', 'outbound')
    .eq('sender_id', STELLA_PHONE_ID)
    .gte('created_at', hojeInicio.toISOString());

  if (msgsErr) {
    console.error('Erro ao buscar mensagens:', msgsErr.message);
    return;
  }

  console.log(` -> Total de mensagens enviadas pela Stella hoje: ${msgs.length}`);
  
  let hasInvasion = false;
  const invalidDispatches = [];

  msgs.forEach(m => {
    const isContactValid = VALID_CONTACT_IDS.includes(m.contato_id);
    if (!isContactValid) {
      hasInvasion = true;
      invalidDispatches.push(m);
    }
  });

  if (hasInvasion) {
    console.warn('\n⚠️ CRÍTICO: DETECTADOS DISPAROS PARA CONTATOS FORA DO ESCOPO DE TESTE/RECONEXÃO!');
    invalidDispatches.forEach(m => {
      console.warn(`   - ID Mensagem: ${m.id} | Contato ID: ${m.contato_id} | Destinatário: ${m.receiver_id} | Conteúdo: "${m.content}" | Status: ${m.status}`);
    });
  } else {
    console.log('\n✅ SUCESSO: Nenhum contato indevido recebeu mensagens da Stella hoje. A regra de escopo de atendimento e antispam foi 100% respeitada!');
  }

  // Detalhe dos disparos válidos de hoje
  console.log('\nDetalhes das interações válidas processadas hoje pela Stella:');
  const uniqueContactsMessaged = [...new Set(msgs.map(m => m.contato_id))];
  
  for (const cId of uniqueContactsMessaged) {
    const { data: contato } = await supabase.from('contatos').select('nome').eq('id', cId).single();
    const cMsgs = msgs.filter(m => m.contato_id === cId);
    console.log(`\nLead: ${contato?.nome || 'Desconhecido'} (ID: ${cId})`);
    cMsgs.forEach(m => {
      console.log(` - [${new Date(m.created_at).toLocaleTimeString('pt-BR')}] Status: ${m.status}${m.error_message ? ` - Erro: ${m.error_message}` : ''} | "${m.content}"`);
    });
  }

  console.log('\n=== FIM DA AUDITORIA ===');
}

run().catch(console.error);
