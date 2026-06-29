// scratch/consertar_card_maria.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CONTATO_ID = 6170; // Maria
const ORGANIZACAO_ID = 2; // STUDIO 57
const COLUNA_QUALIFICACAO_STELLA = '4b9b7e6d-5e4f-3a2b-1c0d-e9f8a7b6c5d4';

async function main() {
  console.log("=== CRIANDO E MOVIMENTANDO CARD DA MARIA NO FUNIL DE QUALIFICAÇÃO ===");

  // 1. Verificar se o card já existe (apenas por garantia)
  const { data: cardExistente, error: errCard } = await supabase
    .from('contatos_no_funil')
    .select('id, coluna_id')
    .eq('contato_id', CONTATO_ID)
    .eq('organizacao_id', ORGANIZACAO_ID)
    .maybeSingle();

  if (errCard) {
    console.error("Erro ao buscar card no funil:", errCard.message);
    return;
  }

  let cardId = null;

  if (cardExistente) {
    console.log(`O card da Maria já existe no funil! Coluna Atual: ${cardExistente.coluna_id}`);
    cardId = cardExistente.id;
    
    // Atualizar a coluna
    console.log(`Movendo card existente para a coluna QUALIFICAÇÃO STELLA...`);
    const { error: errUpd } = await supabase
      .from('contatos_no_funil')
      .update({ 
        coluna_id: COLUNA_QUALIFICACAO_STELLA,
        updated_at: new Date().toISOString()
      })
      .eq('id', cardId);
      
    if (errUpd) console.error("Erro ao atualizar coluna do card:", errUpd.message);
  } else {
    console.log(`Card da Maria não existe no funil. Criando novo card na coluna QUALIFICAÇÃO STELLA...`);
    
    // Obter o ID do contato da Stella na Org 2 para associar como corretor se aplicável
    let corretorId = null;
    const { data: usuarioStella } = await supabase
      .from('usuarios')
      .select('id, contato:contatos(id)')
      .eq('email', `stella.org${ORGANIZACAO_ID}@elo57.com.br`)
      .maybeSingle();

    if (usuarioStella && usuarioStella.contato) {
      corretorId = usuarioStella.contato.id;
      console.log(`Corretor Stella ID encontrado: ${corretorId}`);
    }

    const { data: novoCard, error: errIns } = await supabase
      .from('contatos_no_funil')
      .insert({
        contato_id: CONTATO_ID,
        coluna_id: COLUNA_QUALIFICACAO_STELLA,
        organizacao_id: ORGANIZACAO_ID,
        corretor_id: corretorId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (errIns) {
      console.error("Erro ao criar card no funil:", errIns.message);
      return;
    }
    
    console.log(`Card criado com sucesso no funil! Card ID: ${novoCard.id}`);
    cardId = novoCard.id;
  }

  // 2. Desativar piloto automático da Stella
  console.log("\nDesativando piloto automático da Stella para a Maria...");
  const { error: errPiloto } = await supabase
    .from('contatos')
    .update({ ia_atendimento_ativo: false })
    .eq('id', CONTATO_ID);

  if (errPiloto) {
    console.error("Erro ao desativar piloto automático:", errPiloto.message);
  } else {
    console.log("Piloto automático desativado com sucesso.");
  }

  // 3. Cadastrar nota explicativa de transbordo (Dossiê da Stella)
  console.log("\nCadastrando nota de transbordo no CRM...");
  
  // Buscar a justificativa do ai_analysis anterior
  const { data: contato } = await supabase
    .from('contatos')
    .select('ai_analysis')
    .eq('id', CONTATO_ID)
    .single();

  const justificativa = contato?.ai_analysis?.justificativa_movimentacao || 
    `🎯 DOSSIÊ DE QUALIFICAÇÃO STELLA IA:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏠 Empreendimento de Interesse: Residencial Alfa\n🎯 Objetivo de Compra: Moradia\n🌍 Localização/Cidade: Governador Valadares\n💰 Renda Familiar Declarada: R$ 7.000,00\n💼 Possui FGTS / CLT: Não FGTS / Sim (CLT +3 anos)\n📝 Resumo Conversa: Qualificação concluída com sucesso.`;

  const { error: errNota } = await supabase
    .from('crm_notas')
    .insert({
      contato_id: CONTATO_ID,
      contato_no_funil_id: cardId,
      conteudo: justificativa,
      organizacao_id: ORGANIZACAO_ID
    });

  if (errNota) {
    console.error("Erro ao criar nota no CRM:", errNota.message);
  } else {
    console.log("Nota cadastrada com sucesso no CRM!");
  }

  console.log("\n=== PROCESSO CONCLUÍDO COM SUCESSO ===");
}

main().catch(console.error);
