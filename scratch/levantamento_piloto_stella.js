// scratch/levantamento_piloto_stella.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos no .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== INICIANDO LEVANTAMENTO DO STATUS DO PILOTO AUTOMÁTICO PARA A STELLA IA ===");

  // 1. Buscar todos os usuários da Stella nas organizações
  const { data: usuariosStella, error: errU } = await supabase
    .from('usuarios')
    .select('id, email, contato_id, nome, organizacao_id')
    .ilike('email', 'stella%');

  if (errU) {
    console.error("Erro ao buscar usuários da Stella:", errU);
    return;
  }

  if (!usuariosStella || usuariosStella.length === 0) {
    console.log("Nenhum usuário da Stella encontrado no banco.");
    return;
  }

  console.log(`\nRobôs Stella encontrados no sistema: ${usuariosStella.length}`);
  console.table(usuariosStella.map(u => ({
    Nome: u.nome,
    Email: u.email,
    ID_Usuario: u.id,
    ID_Contato_Corretor: u.contato_id,
    ID_Org: u.organizacao_id
  })));

  const stellaContactIds = usuariosStella.map(u => u.contato_id).filter(id => id !== null);

  if (stellaContactIds.length === 0) {
    console.log("Aviso: Nenhum dos usuários Stella encontrados possui contato_id associado.");
    return;
  }

  // 2. Buscar todos os leads associados no funil a estes corretores Stella
  console.log(`\nBuscando leads no funil atribuídos aos contatos de corretor da Stella: [${stellaContactIds.join(', ')}]...`);
  
  const { data: leadsFunil, error: errF } = await supabase
    .from('contatos_no_funil')
    .select('id, contato_id, coluna_id, corretor_id, organizacao_id')
    .in('corretor_id', stellaContactIds);

  if (errF) {
    console.error("Erro ao buscar leads no funil:", errF);
    return;
  }

  if (!leadsFunil || leadsFunil.length === 0) {
    console.log("Nenhum lead encontrado no funil atualmente sob responsabilidade da Stella IA.");
    return;
  }

  console.log(`Total de leads sob atribuição da Stella no funil: ${leadsFunil.length}`);

  // 3. Buscar colunas de CRM para traduzir o nome
  const { data: colunas, error: errCol } = await supabase
    .from('crm_colunas')
    .select('id, nome');
  
  const colunasMap = {};
  if (!errCol && colunas) {
    colunas.forEach(c => {
      colunasMap[c.id] = c.nome;
    });
  }

  // 4. Buscar informações detalhadas de cada lead (nome, status do piloto automático)
  const leadIds = leadsFunil.map(lf => lf.contato_id);
  
  const { data: contatosInfo, error: errC } = await supabase
    .from('contatos')
    .select('id, nome, ia_atendimento_ativo, organizacao_id')
    .in('id', leadIds);

  if (errC) {
    console.error("Erro ao buscar detalhes dos contatos:", errC);
    return;
  }

  // Criar mapa de informações de contatos
  const contatosMap = {};
  contatosInfo.forEach(c => {
    contatosMap[c.id] = c;
  });

  // Mapear também os nomes das organizações
  const { data: orgs, error: errO } = await supabase
    .from('organizacoes')
    .select('id, nome');
  
  const orgsMap = {};
  if (!errO && orgs) {
    orgs.forEach(o => {
      orgsMap[o.id] = o.nome;
    });
  }

  // 5. Montar o relatório completo
  const relatorio = [];
  let totalAtivos = 0;
  let totalInativos = 0;

  leadsFunil.forEach(lf => {
    const contato = contatosMap[lf.contato_id];
    if (!contato) return; // Lead apagado ou inconsistente

    const stellaRobo = usuariosStella.find(u => u.contato_id === lf.corretor_id);
    const orgNome = orgsMap[lf.organizacao_id] || `Org ${lf.organizacao_id}`;
    const colunaNome = colunasMap[lf.coluna_id] || `Coluna ID: ${lf.coluna_id}`;

    const pilotoAtivo = !!contato.ia_atendimento_ativo;
    if (pilotoAtivo) {
      totalAtivos++;
    } else {
      totalInativos++;
    }

    relatorio.push({
      Lead_ID: contato.id,
      Nome_Lead: contato.nome,
      Piloto_Automático: pilotoAtivo ? 'LIGADO 🤖' : 'DESLIGADO 👤',
      Coluna_Funil: colunaNome,
      Org: orgNome,
      Responsável_Stella: stellaRobo ? stellaRobo.nome : `ID Corretor: ${lf.corretor_id}`
    });
  });

  console.log(`\n=== LEVANTAMENTO DETALHADO DE LEADS SOB ATRIBUIÇÃO DA STELLA ===`);
  console.table(relatorio);

  console.log(`\n=== RESUMO GERAL ===`);
  console.log(`Total de Leads Atribuídos à Stella: ${relatorio.length}`);
  console.log(`Piloto Automático Ativo: ${totalAtivos}`);
  console.log(`Piloto Automático Inativo: ${totalInativos}`);

  // Gravar em um arquivo de texto no scratch para persistência e visualização do usuário se necessário
  const fs = require('fs');
  const path = require('path');
  const reportPath = path.join(__dirname, 'levantamento_piloto_stella.txt');
  
  let txtContent = `=== LEVANTAMENTO DO STATUS DO PILOTO AUTOMÁTICO PARA A STELLA IA ===\n`;
  txtContent += `Data de verificação: ${new Date().toISOString()}\n\n`;
  txtContent += `Total de Leads sob atribuição da Stella: ${relatorio.length}\n`;
  txtContent += `- Piloto Automático LIGADO 🤖: ${totalAtivos}\n`;
  txtContent += `- Piloto Automático DESLIGADO 👤: ${totalInativos}\n\n`;
  txtContent += `--------------------------------------------------------------------------\n`;
  txtContent += `LISTA DE LEADS ENCONTRADOS:\n`;
  txtContent += `--------------------------------------------------------------------------\n`;
  
  relatorio.forEach(r => {
    txtContent += `Lead: ${r.Nome_Lead} (ID: ${r.Lead_ID})\n`;
    txtContent += `  - Piloto Automático: ${r.Piloto_Automático}\n`;
    txtContent += `  - Coluna do Funil: ${r.Coluna_Funil}\n`;
    txtContent += `  - Organização: ${r.Org}\n`;
    txtContent += `  - Stella Responsável: ${r.Responsável_Stella}\n`;
    txtContent += `--------------------------------------------------------------------------\n`;
  });

  fs.writeFileSync(reportPath, txtContent, 'utf-8');
  console.log(`\nRelatório gravado com sucesso em: ${reportPath}`);
}

main().catch(console.error);
