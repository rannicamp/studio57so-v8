const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const args = process.argv.slice(2);
const searchParam = args[0];

if (!searchParam) {
  console.error('Por favor, informe o ID ou parte do Nome do lead. Exemplo: node scripts/debug-lead.js 5965 ou node scripts/debug-lead.js "Luis Carlos"');
  process.exit(1);
}

async function run() {
  console.log(`=== DEBUG DO LEAD: "${searchParam}" ===`);

  let contato = null;

  if (isNaN(searchParam)) {
    // Busca por nome
    const { data, error } = await supabase
      .from('contatos')
      .select('id, nome, ia_atendimento_ativo, organizacao_id')
      .ilike('nome', `%${searchParam}%`)
      .limit(5);

    if (error) {
      console.error('Erro ao buscar contato por nome:', error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log('Nenhum lead encontrado com esse nome.');
      return;
    }

    if (data.length > 1) {
      console.log('Múltiplos contatos encontrados, escolha o ID:');
      data.forEach(c => console.log(` - ID: ${c.id} | Nome: ${c.nome}`));
      return;
    }

    contato = data[0];
  } else {
    // Busca por ID
    const { data, error } = await supabase
      .from('contatos')
      .select('id, nome, ia_atendimento_ativo, organizacao_id')
      .eq('id', parseInt(searchParam))
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar contato por ID:', error.message);
      process.exit(1);
    }

    contato = data;
  }

  if (!contato) {
    console.log('Lead não encontrado.');
    return;
  }

  console.log(`Lead Encontrado: ${contato.nome} (ID: ${contato.id})`);
  console.log(`Organização: ${contato.organizacao_id}`);
  console.log(`Autopilot Ativo: ${contato.ia_atendimento_ativo}`);

  // Funil
  const { data: funil } = await supabase
    .from('contatos_no_funil')
    .select('corretor_id, coluna_id')
    .eq('contato_id', contato.id)
    .maybeSingle();

  if (funil) {
    console.log(`Funil: Coluna ID: ${funil.coluna_id}`);
    if (funil.corretor_id) {
      const { data: corr } = await supabase.from('contatos').select('nome').eq('id', funil.corretor_id).maybeSingle();
      console.log(`Corretor Responsável: ${corr?.nome || 'Não encontrado'} (ID: ${funil.corretor_id})`);
    } else {
      console.log('Corretor Responsável: Nenhum (Sem corretor no funil)');
    }
  } else {
    console.log('Funil: Lead não está no funil comercial no momento.');
  }

  // Telefone
  const { data: tel } = await supabase
    .from('telefones')
    .select('telefone')
    .eq('contato_id', contato.id)
    .limit(1)
    .maybeSingle();
  console.log(`Telefone: ${tel?.telefone || 'Não informado'}`);

  // Mensagens
  console.log('\nÚltimas 10 mensagens:');
  const { data: mensagens, error: msgErr } = await supabase
    .from('whatsapp_messages')
    .select('id, content, direction, created_at, status, error_message')
    .eq('contato_id', contato.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (msgErr) {
    console.error('Erro ao buscar mensagens:', msgErr.message);
  } else if (!mensagens || mensagens.length === 0) {
    console.log('Sem histórico de mensagens.');
  } else {
    mensagens.forEach(m => {
      const date = new Date(m.created_at).toLocaleString('pt-BR');
      const statusStr = m.direction === 'outbound' ? ` [Status: ${m.status}${m.error_message ? ` - Erro: ${m.error_message}` : ''}]` : '';
      console.log(`[${date}] ${m.direction.toUpperCase()}:${statusStr} "${m.content}"`);
    });
  }

  // Logs
  console.log('\nLogs do Sistema (app_logs) para este contato nos últimos 3 dias:');
  const tresDiasAtras = new Date();
  tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);
  const { data: logs, error: logsErr } = await supabase
    .from('app_logs')
    .select('created_at, origem, mensagem')
    .eq('payload->>contato_id', contato.id.toString())
    .gte('created_at', tresDiasAtras.toISOString())
    .order('created_at', { ascending: true });

  if (logsErr) {
    console.error('Erro ao buscar logs:', logsErr.message);
  } else if (!logs || logs.length === 0) {
    console.log('Sem logs encontrados.');
  } else {
    logs.forEach(l => {
      const date = new Date(l.created_at).toLocaleString('pt-BR');
      console.log(`[${date}] [${l.origem}] ${l.mensagem}`);
    });
  }
}

run().catch(console.error);
