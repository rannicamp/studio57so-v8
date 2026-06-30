// scratch/pegar_dados_tabela.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const ORGANIZACAO_ID = 2; // STUDIO 57

async function main() {
  const { data: colunas } = await supabase
    .from('colunas_funil')
    .select('id')
    .eq('organizacao_id', ORGANIZACAO_ID)
    .ilike('nome', '%atendimento%');

  const colunaId = colunas[0].id;

  const { data: cards } = await supabase
    .from('contatos_no_funil')
    .select(`
      id,
      created_at,
      contato_id,
      corretor_id,
      contatos!contatos_no_funil_contato_id_fkey(id, nome, ia_atendimento_ativo)
    `)
    .eq('coluna_id', colunaId)
    .eq('organizacao_id', ORGANIZACAO_ID);

  const relatorioLeads = [];

  for (const card of cards) {
    const contato = card.contatos;
    if (!contato) continue;

    const { data: telefones } = await supabase
      .from('telefones')
      .select('telefone')
      .eq('contato_id', contato.id)
      .limit(1);
    const telefone = telefones && telefones[0]?.telefone || 'Sem telefone';

    let nomeCorretor = 'Não atribuído';
    if (card.corretor_id) {
      const { data: corretor } = await supabase
        .from('contatos')
        .select('nome')
        .eq('id', card.corretor_id)
        .maybeSingle();
      if (corretor) nomeCorretor = corretor.nome;
    }

    const { data: ultimaMsg } = await supabase
      .from('whatsapp_messages')
      .select('content, direction, created_at')
      .eq('contato_id', contato.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let ultimaMsgTexto = 'Nenhuma mensagem registrada';
    let ultimaMsgData = null;
    let ultimaMsgDirecao = null;
    let diasInativo = 'N/A';

    if (ultimaMsg) {
      ultimaMsgTexto = ultimaMsg.content.replace(/\n/g, ' ').substring(0, 50).trim();
      ultimaMsgData = new Date(ultimaMsg.created_at);
      ultimaMsgDirecao = ultimaMsg.direction;

      const diffMs = Date.now() - ultimaMsgData.getTime();
      diasInativo = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    relatorioLeads.push({
      id: contato.id,
      nome: contato.nome,
      telefone: telefone,
      corretor: nomeCorretor,
      stella: contato.ia_atendimento_ativo ? 'Ativa' : 'Desativada',
      dias_inativo: diasInativo,
      quem_falou_ultimo: ultimaMsgDirecao ? (ultimaMsgDirecao === 'inbound' ? 'Lead' : 'Empresa') : 'N/A',
      data_ultima_msg: ultimaMsgData ? ultimaMsgData.toLocaleString('pt-BR') : 'N/A',
      texto_ultima_msg: ultimaMsgTexto,
      card_criado: new Date(card.created_at).toLocaleString('pt-BR')
    });
  }

  // Ordenar
  relatorioLeads.sort((a, b) => {
    if (a.dias_inativo === 'N/A') return 1;
    if (b.dias_inativo === 'N/A') return -1;
    return b.dias_inativo - a.dias_inativo;
  });

  console.log(JSON.stringify(relatorioLeads, null, 2));
}

main().catch(console.error);
