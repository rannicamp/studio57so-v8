// scratch/investigar_detalhes_leads_sem_mensagem.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IDs das colunas de Entrada analisadas
const COLUNAS_ENTRADA = [
  '902f7707-1f11-4fa6-89c3-b15735acfe1d',
  'e8e88027-c7be-4e8c-9667-e17fa4e06ce5'
];

async function main() {
  console.log("=== INVESTIGANDO DETALHES DE LEADS SEM MENSAGEM NA ENTRADA ===");

  try {
    // 1. Buscar os contatos no funil nas colunas de Entrada
    const { data: leadsFunil, error: errLf } = await supabase
      .from('contatos_no_funil')
      .select('contato_id, coluna_id, created_at')
      .in('coluna_id', COLUNAS_ENTRADA);

    if (errLf) {
      console.error(errLf);
      return;
    }

    const contatoIds = leadsFunil.map(l => l.contato_id);

    // 2. Buscar contatos
    const { data: contatos, error: errC } = await supabase
      .from('contatos')
      .select('id, nome, ia_atendimento_ativo, created_at, organizacao_id, origem, meta_campaign_name, meta_ad_name, meta_form_data')
      .in('id', contatoIds);

    if (errC) {
      console.error(errC);
      return;
    }

    // 3. Buscar telefones
    const { data: telefones, error: errT } = await supabase
      .from('telefones')
      .select('contato_id, telefone')
      .in('contato_id', contatoIds);

    if (errT) {
      console.error(errT);
      return;
    }

    const telefonesMap = new Map();
    telefones.forEach(t => {
      if (!telefonesMap.has(t.contato_id)) {
        telefonesMap.set(t.contato_id, []);
      }
      telefonesMap.get(t.contato_id).push(t.telefone);
    });

    // 4. Buscar quais contatos têm mensagens
    const { data: mensagens, error: errM } = await supabase
      .from('whatsapp_messages')
      .select('contato_id')
      .in('contato_id', contatoIds);

    if (errM) {
      console.error(errM);
      return;
    }

    const contatosComMensagens = new Set(mensagens.map(m => m.contato_id));

    // Filtrar apenas contatos sem mensagens
    const leadsSemMensagem = contatos.filter(c => !contatosComMensagens.has(c.id));
    console.log(`Analisando ${leadsSemMensagem.length} leads sem mensagens...`);

    const origens = {};
    const campanhas = {};
    const datas = {};
    const organizacoes = {};
    const telefonesInfo = { com_telefone: 0, sem_telefone: 0 };

    leadsSemMensagem.forEach(c => {
      // Origem
      const orig = c.origem || 'Não informada';
      origens[orig] = (origens[orig] || 0) + 1;

      // Campanha
      const camp = c.meta_campaign_name || 'Sem campanha';
      campanhas[camp] = (campanhas[camp] || 0) + 1;

      // Organização
      const org = c.organizacao_id;
      organizacoes[org] = (organizacoes[org] || 0) + 1;

      // Data de criação (Mês/Ano)
      const dataCriacao = c.created_at ? c.created_at.substring(0, 7) : 'Sem data';
      datas[dataCriacao] = (datas[dataCriacao] || 0) + 1;

      // Telefone
      const tels = telefonesMap.get(c.id) || [];
      if (tels.length > 0) {
        telefonesInfo.com_telefone++;
      } else {
        telefonesInfo.sem_telefone++;
      }
    });

    console.log("\n--- DISTRIBUIÇÃO POR ORGANIZAÇÃO ---");
    console.log(organizacoes);

    console.log("\n--- DISTRIBUIÇÃO POR ORIGEM ---");
    console.log(origens);

    console.log("\n--- DISTRIBUIÇÃO POR DATA DE CRIAÇÃO (MÊS) ---");
    console.log(datas);

    console.log("\n--- POSSUI TELEFONE VÍNCULADO? ---");
    console.log(telefonesInfo);

    console.log("\n--- PRINCIPAIS CAMPANHAS ---");
    const topCampanhas = Object.entries(campanhas)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    console.log(topCampanhas);

    // Amostra de leads sem mensagens
    console.log("\n--- AMOSTRA DE LEADS SEM MENSAGEM (Primeiros 10) ---");
    leadsSemMensagem.slice(0, 10).forEach(l => {
      const tels = telefonesMap.get(l.id) || [];
      console.log(`- ${l.nome} (ID: ${l.id}) | Org: ${l.organizacao_id} | Origem: ${l.origem} | Tel: [${tels.join(', ')}] | Data: ${l.created_at}`);
    });

  } catch (err) {
    console.error("Erro no script:", err);
  }
}

main();
