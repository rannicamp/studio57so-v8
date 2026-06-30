// scripts/auditar-whatsapp-recente.js
const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos em .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Definir o corte: Ontem, 29/06/2026 às 12:00 BRT = 15:00 UTC
const DATA_CORTE_UTC = '2026-06-29T15:00:00.000Z';

async function main() {
  console.log(`=== AUDITORIA DE CONVERSAS RECENTES (DESDE ${new Date(DATA_CORTE_UTC).toLocaleString('pt-BR')}) ===`);

  // 1. Buscar mensagens trocadas após o corte
  console.log("Buscando mensagens no banco de dados...");
  const { data: mensagens, error: errM } = await supabase
    .from('whatsapp_messages')
    .select('contato_id, direction, created_at, content')
    .gte('created_at', DATA_CORTE_UTC)
    .order('created_at', { ascending: false });

  if (errM) {
    console.error("Erro ao buscar mensagens recentes:", errM.message);
    process.exit(1);
  }

  console.log(`Mensagens encontradas desde ontem 12h: ${mensagens?.length || 0}`);

  if (!mensagens || mensagens.length === 0) {
    console.log("Nenhuma mensagem recente encontrada no período.");
    process.exit(0);
  }

  // 2. Agrupar por contato_id e obter metadados das interações
  const contatosAtivos = {};
  
  mensagens.forEach(msg => {
    const cid = msg.contato_id;
    if (!cid) return;

    if (!contatosAtivos[cid]) {
      contatosAtivos[cid] = {
        contato_id: cid,
        mensagens_inbound: 0,
        mensagens_outbound: 0,
        ultima_mensagem: null,
        ultima_mensagem_data: null
      };
    }

    if (msg.direction === 'inbound') {
      contatosAtivos[cid].mensagens_inbound++;
      // A primeira mensagem no loop decrescente de data é a mais recente
      if (!contatosAtivos[cid].ultima_mensagem) {
        contatosAtivos[cid].ultima_mensagem = msg.content;
        contatosAtivos[cid].ultima_mensagem_data = msg.created_at;
      }
    } else {
      contatosAtivos[cid].mensagens_outbound++;
    }
  });

  const idsAtivos = Object.keys(contatosAtivos);
  console.log(`Leads ativos detectados no período: ${idsAtivos.length}`);

  // 3. Buscar informações adicionais de cada contato
  console.log("\nCarregando metadados dos contatos e exportando conversas...");
  const { data: contatos, error: errC } = await supabase
    .from('contatos')
    .select('id, nome, ia_atendimento_ativo, organizacao_id, created_at')
    .in('id', idsAtivos);

  if (errC) {
    console.error("Erro ao buscar metadados dos contatos:", errC.message);
    process.exit(1);
  }

  const relatorio = [];

  for (const c of contatos) {
    const stats = contatosAtivos[c.id];
    
    // Atualizar/Gerar o arquivo TXT usando o script exportar-conversa
    console.log(`> Exportando/Atualizando conversa para o lead "${c.nome}" (ID ${c.id})...`);
    try {
      execSync(`node scripts/exportar-conversa.js --id ${c.id}`);
    } catch (errExec) {
      console.error(`Erro ao rodar exportar-conversa para ID ${c.id}:`, errExec.message);
    }

    // Buscar telefone do lead para o relatório
    const { data: telefones } = await supabase
      .from('telefones')
      .select('telefone')
      .eq('contato_id', c.id)
      .limit(1);

    const telefone = telefones && telefones[0]?.telefone || 'Sem telefone';

    relatorio.push({
      id: c.id,
      nome: c.nome,
      telefone: telefone,
      organizacao: c.organizacao_id === 2 ? 'Studio 57 (Org 2)' : `Org ${c.organizacao_id}`,
      stella: c.ia_atendimento_ativo ? 'Ativo (IA)' : 'Desativado (Humano)',
      criado_em: new Date(c.created_at).toLocaleString('pt-BR'),
      inbound: stats.mensagens_inbound,
      outbound: stats.mensagens_outbound,
      ultima_resposta: stats.ultima_mensagem ? `"${stats.ultima_mensagem}"` : 'Nenhuma resposta do lead'
    });
  }

  // 4. Imprimir o sumário consolidado
  console.log("\n========================================================================");
  console.log("SUMÁRIO DAS CONVERSAS ATIVAS NO PERÍODO");
  console.log("========================================================================");
  console.table(relatorio.map(r => ({
    Lead: r.nome,
    ID: r.id,
    Telefone: r.telefone,
    Org: r.organizacao,
    Stella: r.stella,
    "Msg Clie": r.inbound,
    "Msg Stella": r.outbound,
    "Última Resposta Lead": r.ultima_resposta
  })));
  console.log("========================================================================");
}

main().catch(err => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
