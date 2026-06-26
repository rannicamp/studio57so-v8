// scratch/inspect_leads_varredura.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const fs = require('fs');

const ids = [4936, 5887, 5880, 4919, 6068, 6071, 6072, 6076, 656, 5977, 6056, 6059, 6073, 3467, 6077, 5020, 6087];

async function main() {
  let output = "=== INSPECIONANDO DETALHES DOS LEADS PENDENTES E COM FALHA ===\n";
  console.log("Iniciando varredura detalhada no banco...");
  
  const { data: contatos, error: errC } = await supabase
    .from('contatos')
    .select('id, nome, ia_atendimento_ativo, origem, created_at')
    .in('id', ids);

  if (errC) {
    console.error("Erro ao carregar contatos:", errC);
    return;
  }

  // Buscar telefones associados
  const { data: telefonesData, error: errT } = await supabase
    .from('telefones')
    .select('contato_id, telefone')
    .in('contato_id', ids);

  if (errT) {
    console.error("Erro ao carregar telefones:", errT);
  }

  const telefonesMap = new Map((telefonesData || []).map(t => [t.contato_id, t.telefone]));

  // Buscar informações do funil
  const { data: funil, error: errF } = await supabase
    .from('contatos_no_funil')
    .select('contato_id, coluna_id, colunas_funil(nome)')
    .in('contato_id', ids);

  const funilMap = new Map((funil || []).map(f => [f.contato_id, f]));

  for (const contato of contatos) {
    const fData = funilMap.get(contato.id);
    const tel = telefonesMap.get(contato.id) || 'Sem telefone';
    output += `\n======================================================\n`;
    output += `ID: ${contato.id} | Nome: ${contato.nome} | Tel: ${tel}\n`;
    output += `Origem: ${contato.origem || 'N/A'} | Piloto: ${contato.ia_atendimento_ativo ? 'LIGADO 🤖' : 'DESLIGADO 👤'}\n`;
    output += `Coluna CRM: ${fData?.colunas_funil?.nome || 'Inbox / Sem Coluna'}\n`;
    output += `------------------------------------------------------\n`;
    
    // Buscar as últimas 5 mensagens
    const { data: msgs, error: errM } = await supabase
      .from('whatsapp_messages')
      .select('content, direction, created_at, status, error_message')
      .eq('contato_id', contato.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (errM) {
      output += `Erro ao carregar mensagens: ${errM.message}\n`;
    } else {
      const reversedMsgs = (msgs || []).reverse();
      reversedMsgs.forEach(m => {
        output += `[${m.created_at}] [${m.direction.toUpperCase()}] Status: ${m.status} | Erro: ${m.error_message || 'Nenhum'}\n`;
        output += `   "${m.content}"\n`;
      });
    }
  }

  fs.writeFileSync('scratch/inspect_varredura_utf8.txt', output, 'utf-8');
  console.log("Varredura concluída! Arquivo salvo em scratch/inspect_varredura_utf8.txt");
}

main();
