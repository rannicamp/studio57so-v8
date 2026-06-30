// scripts/exportar-conversa.js
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const artifactsDir = 'C:\\Users\\ranni\\.gemini\\antigravity\\brain\\0254b46f-ded9-44e2-9d20-658a8e0cad55\\scratch';

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos em .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper para parsear argumentos
function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--id' && argv[i + 1]) {
      args.id = parseInt(argv[i + 1], 10);
      i++;
    } else if (argv[i] === '--telefone' && argv[i + 1]) {
      args.telefone = argv[i + 1].replace(/[^0-9]/g, '');
      i++;
    }
  }
  return args;
}

async function exportarContato(contatoId, telefoneFixo = null) {
  // 1. Buscar contato
  const { data: contato, error: errC } = await supabase
    .from('contatos')
    .select('*')
    .eq('id', contatoId)
    .single();

  if (errC || !contato) {
    console.error(`Erro ao buscar contato ID ${contatoId}:`, errC?.message || "Não encontrado");
    return null;
  }

  // 2. Buscar telefones associados
  const { data: telefones } = await supabase
    .from('telefones')
    .select('telefone')
    .eq('contato_id', contatoId);

  const telefonePrincipal = telefoneFixo || (telefones && telefones[0]?.telefone) || `sem_telefone_${contatoId}`;

  // 3. Buscar mensagens
  const { data: mensagens, error: errM } = await supabase
    .from('whatsapp_messages')
    .select('id, direction, content, created_at, sent_at, status, error_message')
    .eq('contato_id', contatoId)
    .order('created_at', { ascending: true });

  if (errM) {
    console.error(`Erro ao buscar mensagens do contato ${contatoId}:`, errM.message);
    return null;
  }

  // 4. Buscar informações do funil
  const { data: funil } = await supabase
    .from('contatos_no_funil')
    .select('id, coluna_id, colunas_funil(id, nome)')
    .eq('contato_id', contatoId)
    .maybeSingle();

  // 5. Formatar cabeçalho do lead
  let txt = `========================================================================\n`;
  txt += `FICHA CADASTRAL DO LEAD: ${contato.nome || 'Sem Nome'}\n`;
  txt += `========================================================================\n`;
  txt += `ID do Contato: ${contato.id}\n`;
  txt += `Telefone Principal: ${telefonePrincipal}\n`;
  txt += `Organização ID: ${contato.organizacao_id}\n`;
  txt += `Criado em: ${new Date(contato.created_at).toLocaleString('pt-BR')}\n`;
  txt += `Origem: ${contato.origem || 'Não identificada'}\n`;
  txt += `Objetivo de Compra: ${contato.objetivo || 'Não informado'}\n`;
  txt += `Cidade / UF: ${contato.city || 'Não informada'} / ${contato.state || 'Não informado'}\n`;
  txt += `Renda Familiar: R$ ${contato.renda_familiar !== null ? contato.renda_familiar : 'Não informada'}\n`;
  txt += `FGTS: ${contato.fgts ? 'SIM' : 'NÃO'}\n`;
  txt += `CLT (+3 anos): ${contato.mais_de_3_anos_clt ? 'SIM' : 'NÃO'}\n`;
  txt += `Piloto Automático Stella: ${contato.ia_atendimento_ativo ? '✅ ATIVO' : '❌ INATIVO (Humano)'}\n`;
  txt += `Funil Comercial: ${funil?.colunas_funil?.nome || 'Fora do Funil'}\n`;
  
  if (contato.ai_analysis && typeof contato.ai_analysis === 'object') {
    txt += `\n🎯 ÚLTIMO DOSSIÊ STELLA IA:\n`;
    txt += `${contato.ai_analysis.justificativa_movimentacao || 'Nenhum dossiê gerado ainda.'}\n`;
  }
  
  txt += `\n========================================================================\n`;
  txt += `HISTÓRICO DE MENSAGENS NO WHATSAPP\n`;
  txt += `========================================================================\n`;

  if (mensagens && mensagens.length > 0) {
    mensagens.forEach(msg => {
      const dataFormatada = new Date(msg.created_at || msg.sent_at).toLocaleString('pt-BR');
      const ator = msg.direction === 'inbound' ? '👤 Lead' : '🏢 Stella/Corretor';
      const statusText = msg.status === 'failed' ? ` [❌ FALHOU: ${msg.error_message || 'Erro de rede'}]` : '';
      txt += `[${dataFormatada}] ${ator}: "${msg.content}"${statusText}\n`;
    });
  } else {
    txt += `Nenhuma mensagem trocada nesta conversa.\n`;
  }

  // 6. Gravar arquivo no scratch de forma sobrescrita
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const filename = `conversa_${telefonePrincipal}.txt`;
  const filePath = path.join(artifactsDir, filename);

  fs.writeFileSync(filePath, txt, 'utf8');
  console.log(`Conversa do contato ${contatoId} salva com sucesso em: ${filePath}`);
  return filePath;
}

async function main() {
  const args = parseArgs();
  
  if (!args.id && !args.telefone) {
    console.log("Uso:");
    console.log("  node scripts/exportar-conversa.js --id <ID_DO_CONTATO>");
    console.log("  node scripts/exportar-conversa.js --telefone <TELEFONE_DO_CONTATO>");
    process.exit(0);
  }

  let contatoId = args.id;
  let telefonePrincipal = args.telefone;

  if (telefonePrincipal && !contatoId) {
    console.log(`Buscando contato pelo número: ${telefonePrincipal}...`);
    
    // Buscar variants do telefone
    const cleanPhone = telefonePrincipal;
    const cleanPhoneSem9 = cleanPhone.length === 13 && cleanPhone.startsWith('55') && cleanPhone[4] === '9' 
      ? '55' + cleanPhone.substring(2, 4) + cleanPhone.substring(5) 
      : cleanPhone;
    const cleanPhoneCom9 = cleanPhone.length === 12 && cleanPhone.startsWith('55')
      ? '55' + cleanPhone.substring(2, 4) + '9' + cleanPhone.substring(4)
      : cleanPhone;

    const { data: telefones, error: errT } = await supabase
      .from('telefones')
      .select('contato_id, telefone')
      .in('telefone', [cleanPhone, cleanPhoneSem9, cleanPhoneCom9]);

    if (errT || !telefones || telefones.length === 0) {
      console.error(`Nenhum contato encontrado para o telefone ${telefonePrincipal}`);
      process.exit(1);
    }

    contatoId = telefones[0].contato_id;
    telefonePrincipal = telefones[0].telefone;
    console.log(`Contato encontrado! ID: ${contatoId} (Telefone: ${telefonePrincipal})`);
  }

  await exportarContato(contatoId, telefonePrincipal);
}

main().catch(err => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
