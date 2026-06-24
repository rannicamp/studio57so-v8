const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TEST_CONTACT_ID = 5923; // ID do contato de Ranniere

async function checkMessages() {
  console.log('=== CONSULTANDO DADOS ATUAIS E MENSAGENS DO CONTATO ===');

  // 1. Verificar informações cadastrais do contato
  const { data: contato, error: contatoErr } = await supabase
    .from('contatos')
    .select('id, nome, ia_atendimento_ativo, ai_analysis')
    .eq('id', TEST_CONTACT_ID)
    .single();

  if (contatoErr) {
    console.error('Erro ao buscar contato:', contatoErr.message);
    return;
  }

  console.log('Dados do Contato:', {
    id: contato.id,
    nome: contato.nome,
    ia_atendimento_ativo: contato.ia_atendimento_ativo,
    ai_analysis_last_updated: contato.ai_analysis?.last_updated || 'Nunca'
  });

  // 2. Buscar mensagens recentes com ID
  console.log('\n=== ÚLTIMAS 10 MENSAGENS DO WHATSAPP ===');
  const { data: msgs, error: msgsErr } = await supabase
    .from('whatsapp_messages')
    .select('id, content, direction, created_at, status, error_message')
    .eq('contato_id', TEST_CONTACT_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  if (msgsErr) {
    console.error('Erro ao buscar mensagens:', msgsErr.message);
  } else if (msgs && msgs.length > 0) {
    msgs.reverse().forEach(m => {
      console.log(`[ID: ${m.id}] [${new Date(m.created_at).toLocaleString('pt-BR')}] ${m.direction.toUpperCase()} | Status: ${m.status} | Conteúdo: "${m.content}"`);
      if (m.error_message) {
        console.log(`   ⚠️ Erro de Envio/Processamento: ${m.error_message}`);
      }
    });
  } else {
    console.log('Nenhuma mensagem encontrada.');
  }

  // 3. Buscar logs de erro recentes da Stella na tabela app_logs filtrando por payload->>contato_id
  console.log('\n=== LOGS RECENTES DA STELLA NO SISTEMA (app_logs) ===');
  const { data: logs, error: logsErr } = await supabase
    .from('app_logs')
    .select('origem, mensagem, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(50); // Pega os últimos 50 logs do sistema e filtra localmente no JS para evitar erros de sintaxe SQL no JSONB

  if (logsErr) {
    console.error('Erro ao buscar logs:', logsErr.message);
  } else if (logs && logs.length > 0) {
    const logsFiltrados = logs.filter(l => {
      const contatoIdNoPayload = l.payload?.contato_id || l.payload?.contatoId;
      return String(contatoIdNoPayload) === String(TEST_CONTACT_ID);
    });

    if (logsFiltrados.length > 0) {
      logsFiltrados.slice(0, 10).forEach(l => {
        console.log(`[${new Date(l.created_at).toLocaleString('pt-BR')}] Origem: ${l.origem} | Mensagem: ${l.mensagem}`);
        if (l.payload?.error) {
          console.log(`   ⚠️ Detalhes do Erro: ${JSON.stringify(l.payload.error)}`);
        }
      });
    } else {
      console.log('Nenhum log correspondente ao contato encontrado nos últimos 50 logs do sistema.');
    }
  } else {
    console.log('Nenhum log recente no banco.');
  }
}

checkMessages().catch(console.error);
