// scratch/buscar_curriculos_fds.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Sexta-feira passada (26/06) a partir das 00:00 até hoje segunda (29/06) às 10:00
const DATA_INICIO = '2026-06-26T00:00:00.000Z';

async function main() {
  let output = `=== AUDITORIA DE MENSAGENS DO FDS (${DATA_INICIO} até agora) ===\n\n`;

  // 1. Buscar todas as mensagens inbound no período
  const { data: msgs, error: errM } = await supabase
    .from('whatsapp_messages')
    .select('id, contato_id, content, created_at, direction, status')
    .eq('direction', 'inbound')
    .gte('created_at', DATA_INICIO)
    .order('created_at', { ascending: true });

  if (errM) {
    console.error("Erro ao buscar mensagens:", errM.message);
    return;
  }

  output += `Total de mensagens inbound encontradas no período: ${msgs.length}\n`;

  // Palavras-chave para identificar currículos/vagas
  const keywords = [
    'currículo', 'curriculo', 'vaga', 'contratando', 'trabalhar', 
    'oportunidade', 'emprego', 'trabalho', 'vagas', 'rh', 
    'contratação', 'cv', 'portfólio', 'portfolio', 'candidatar'
  ];

  // Filtrar contatos que enviaram alguma mensagem com as palavras-chave
  const contatosCandidatosMap = new Map();

  msgs.forEach(m => {
    const text = (m.content || '').toLowerCase();
    const matches = keywords.some(k => text.includes(k));
    
    if (matches) {
      if (!contatosCandidatosMap.has(m.contato_id)) {
        contatosCandidatosMap.set(m.contato_id, []);
      }
      contatosCandidatosMap.get(m.contato_id).push(m);
    }
  });

  output += `Contatos que mencionaram currículo/vagas: ${contatosCandidatosMap.size}\n\n`;

  if (contatosCandidatosMap.size === 0) {
    output += "Nenhum candidato encontrado nas mensagens de fim de semana.\n";
    fs.writeFileSync(path.join(__dirname, 'resultado_curriculos_fds.txt'), output, 'utf-8');
    return;
  }

  // Buscar informações de contatos
  const candidatoContactIds = Array.from(contatosCandidatosMap.keys());
  
  const { data: contatos, error: errC } = await supabase
    .from('contatos')
    .select('id, nome, ia_atendimento_ativo, organizacao_id')
    .in('id', candidatoContactIds);

  if (errC) {
    console.error("Erro ao buscar detalhes dos contatos:", errC.message);
    return;
  }

  const { data: leadsFunil, error: errLF } = await supabase
    .from('contatos_no_funil')
    .select('id, contato_id, coluna_id, corretor_id')
    .in('contato_id', candidatoContactIds);

  const funilMap = {};
  if (!errLF && leadsFunil) {
    leadsFunil.forEach(lf => {
      funilMap[lf.contato_id] = lf;
    });
  }

  // Traduzir nome das colunas
  const { data: colunas, error: errCol } = await supabase
    .from('colunas_funil')
    .select('id, nome');
  
  const colMap = {};
  if (!errCol && colunas) {
    colunas.forEach(c => {
      colMap[c.id] = c.nome;
    });
  }

  output += `=== LEADS ENCONTRADOS QUE ENVIARAM CURRÍCULO/RH ===\n`;

  for (const contato of contatos) {
    const msgsContato = contatosCandidatosMap.get(contato.id);
    const funilLead = funilMap[contato.id];
    const colunaNome = funilLead ? (colMap[funilLead.coluna_id] || `Coluna ID: ${funilLead.coluna_id}`) : 'Fora do Funil';

    output += `\nLead: ${contato.nome} (ID: ${contato.id})\n`;
    output += `  - Piloto Automático: ${contato.ia_atendimento_ativo ? 'LIGADO' : 'DESLIGADO'}\n`;
    output += `  - Coluna Atual no CRM: ${colunaNome}\n`;
    output += `  - Organização: ${contato.organizacao_id}\n`;
    output += `  - Mensagens relevantes enviadas no FDS:\n`;
    
    msgsContato.forEach(msg => {
      output += `    [${msg.created_at}] "${msg.content}"\n`;
    });

    // Buscar diálogo completo do FDS
    const { data: todasMsgs } = await supabase
      .from('whatsapp_messages')
      .select('content, direction, created_at')
      .eq('contato_id', contato.id)
      .gte('created_at', DATA_INICIO)
      .order('created_at', { ascending: true });

    if (todasMsgs && todasMsgs.length > 0) {
      output += `  - Diálogo completo no FDS:\n`;
      todasMsgs.forEach(tm => {
        output += `    [${tm.direction.toUpperCase()}] ${tm.content}\n`;
      });
    }
    output += `--------------------------------------------------------------------------\n`;
  }

  const reportPath = path.join(__dirname, 'resultado_curriculos_fds.txt');
  fs.writeFileSync(reportPath, output, 'utf-8');
  console.log(`Relatório gravado em: ${reportPath}`);
}

main().catch(console.error);
