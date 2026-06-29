// scratch/criar_funil_rh_e_triagem.js
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
const CANDIDATOS_IDS = [6121, 6137]; // IDs dos dois leads triados do FDS

async function main() {
  console.log("=== INICIANDO CRIAÇÃO DO FUNIL DE RH E TRIAGEM DE CANDIDATOS ===");

  // 1. Verificar se o funil "Recrutamento & Talentos" já existe
  console.log("\n1. Verificando existência do funil 'Recrutamento & Talentos'...");
  const { data: funilExistente, error: errF } = await supabase
    .from('funis')
    .select('id, nome')
    .eq('nome', 'Recrutamento & Talentos')
    .eq('organizacao_id', ORGANIZACAO_ID)
    .maybeSingle();

  if (errF) {
    console.error("Erro ao verificar funil:", errF.message);
    return;
  }

  let funilId = null;

  if (funilExistente) {
    console.log(`Funil 'Recrutamento & Talentos' já existe. ID: ${funilExistente.id}`);
    funilId = funilExistente.id;
  } else {
    console.log("Criando novo funil 'Recrutamento & Talentos'...");
    const { data: novoFunil, error: errC } = await supabase
      .from('funis')
      .insert({
        nome: 'Recrutamento & Talentos',
        organizacao_id: ORGANIZACAO_ID,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (errC) {
      console.error("Erro ao criar funil:", errC.message);
      return;
    }
    console.log(`Funil criado com sucesso! ID: ${novoFunil.id}`);
    funilId = novoFunil.id;
  }

  // 2. Criar as colunas do funil de RH
  console.log("\n2. Criando etapas/colunas do funil...");
  const colunasPropostas = [
    { nome: 'Currículos Recebidos', ordem: 0, tipo_coluna: 'entrada', cor: 'bg-blue-100', descricao: 'Currículos recém-recebidos pelo WhatsApp para triagem.' },
    { nome: 'Em Análise', ordem: 1, tipo_coluna: 'padrao', cor: 'bg-yellow-100', descricao: 'Candidatos com perfil pré-selecionado sob análise do RH.' },
    { nome: 'Entrevista Agendada', ordem: 2, tipo_coluna: 'padrao', cor: 'bg-purple-100', descricao: 'Entrevistas técnicas ou de fit cultural agendadas.' },
    { nome: 'Banco de Talentos / Aprovados', ordem: 3, tipo_coluna: 'ganho', cor: 'bg-green-100', descricao: 'Candidatos aprovados aguardando vaga aberta ou contratação.' },
    { nome: 'Descartados / Arquivados', ordem: 4, tipo_coluna: 'perdido', cor: 'bg-red-100', descricao: 'Currículos arquivados ou descartados para esta vaga.' }
  ];

  const colunasMap = {};

  for (const col of colunasPropostas) {
    // Verificar se a coluna já existe
    const { data: colunaExistente, error: errCol } = await supabase
      .from('colunas_funil')
      .select('id')
      .eq('funil_id', funilId)
      .eq('nome', col.nome)
      .maybeSingle();

    if (errCol) {
      console.error(`Erro ao verificar coluna ${col.nome}:`, errCol.message);
      continue;
    }

    if (colunaExistente) {
      console.log(`Coluna '${col.nome}' já existe. ID: ${colunaExistente.id}`);
      colunasMap[col.nome] = colunaExistente.id;
    } else {
      console.log(`Criando coluna '${col.nome}'...`);
      const { data: novaCol, error: errNewCol } = await supabase
        .from('colunas_funil')
        .insert({
          funil_id: funilId,
          nome: col.nome,
          ordem: col.ordem,
          tipo_coluna: col.tipo_coluna,
          cor: col.cor,
          descricao: col.descricao,
          organizacao_id: ORGANIZACAO_ID,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (errNewCol) {
        console.error(`Erro ao criar coluna ${col.nome}:`, errNewCol.message);
        continue;
      }
      console.log(`Coluna '${col.nome}' criada. ID: ${novaCol.id}`);
      colunasMap[col.nome] = novaCol.id;
    }
  }

  const colunaEntradaId = colunasMap['Currículos Recebidos'];
  if (!colunaEntradaId) {
    console.error("\n[ERRO CRÍTICO] Coluna de Entrada 'Currículos Recebidos' não está definida. Abortando triagem.");
    return;
  }

  // 3. Triagem e Roteamento de cada lead de FDS
  console.log("\n3. Iniciando movimentação de contatos...");
  for (const leadId of CANDIDATOS_IDS) {
    console.log(`\nProcessando lead ID: ${leadId}`);

    // Buscar informações do lead para auditoria
    const { data: contato, error: errCont } = await supabase
      .from('contatos')
      .select('nome, ia_atendimento_ativo')
      .eq('id', leadId)
      .single();

    if (errCont || !contato) {
      console.error(`Erro ao buscar contato ${leadId}:`, errCont?.message || 'Não encontrado');
      continue;
    }

    console.log(`Lead: ${contato.nome} (Piloto: ${contato.ia_atendimento_ativo})`);

    // A. Desativar piloto automático comercial da Stella
    if (contato.ia_atendimento_ativo) {
      console.log(`Desligando piloto automático comercial da Stella...`);
      const { error: errUpd } = await supabase
        .from('contatos')
        .update({ ia_atendimento_ativo: false })
        .eq('id', leadId);
      
      if (errUpd) console.error("Erro ao desligar piloto automático:", errUpd.message);
    }

    // B. Mover para a coluna "Currículos Recebidos"
    const { data: funilLead, error: errFL } = await supabase
      .from('contatos_no_funil')
      .select('id, coluna_id')
      .eq('contato_id', leadId)
      .limit(1)
      .maybeSingle();

    let funilRecordId = null;

    if (funilLead) {
      console.log(`Atualizando card do lead no funil para a nova coluna de RH...`);
      const { data: updatedRecord, error: errUpdFL } = await supabase
        .from('contatos_no_funil')
        .update({ 
          coluna_id: colunaEntradaId,
          updated_at: new Date().toISOString()
        })
        .eq('id', funilLead.id)
        .select('id')
        .single();

      if (errUpdFL) {
        console.error("Erro ao mover lead no funil:", errUpdFL.message);
      } else {
        console.log("Lead movido com sucesso no funil.");
        funilRecordId = updatedRecord.id;
      }
    } else {
      console.log(`Criando card no funil de recrutamento para o lead...`);
      const { data: insertedRecord, error: errInsFL } = await supabase
        .from('contatos_no_funil')
        .insert({
          contato_id: leadId,
          coluna_id: colunaEntradaId,
          organizacao_id: ORGANIZACAO_ID,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (errInsFL) {
        console.error("Erro ao criar card no funil:", errInsFL.message);
      } else {
        console.log("Card criado com sucesso no funil de RH.");
        funilRecordId = insertedRecord.id;
      }
    }

    // C. Gravar Nota explicativa no CRM
    if (funilRecordId) {
      console.log("Gravando nota de triagem no CRM...");
      const { error: errNota } = await supabase
        .from('crm_notas')
        .insert({
          contato_id: leadId,
          contato_no_funil_id: funilRecordId,
          conteudo: `🤖 [Triagem de RH Automática] O lead entrou em contato buscando vagas/currículos no fim de semana. Foi criado o funil de Recrutamento & Seleção, o piloto automático da Stella de vendas foi desativado e o candidato foi movido para a coluna "Currículos Recebidos" para análise do time de recrutamento.`,
          organizacao_id: ORGANIZACAO_ID
        });

      if (errNota) {
        console.error("Erro ao gravar nota no CRM:", errNota.message);
      } else {
        console.log("Nota gravada com sucesso!");
      }
    }
  }

  console.log("\n=== OPERAÇÃO CONCLUÍDA COM SUCESSO ===");
}

main().catch(console.error);
